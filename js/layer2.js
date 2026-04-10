// layer2.js — Layer 2: semantic divergence rules
// Detects patterns valid in Python 3 but with different behaviour.
// Depends on: nothing
// Exports:     LAYER2_RULES, layer2(code), makeFinding()

const LAYER2_RULES = [
  {
    id: 'INT_DIV', severity: 'critical',
    // Match a / that is not // or /= or part of a URL
    pattern: /[^<>=!/*][^<>=!/*]\s*\/\s*[^/=*]/,
    guard:   /https?:\/\//,   // skip lines with URLs
    message: '/ operator — floor in py2, float in py3',
    py2: 'int / int  →  floor  (7/2 = 3)',
    py3: 'int / int  →  float  (7/2 = 3.5)',
    probe: { type: 'division' },
  },
  {
    id: 'ROUND', severity: 'critical',
    pattern: /\bround\s*\(/,
    message: "round() — round-half-up in py2, banker's in py3",
    py2: 'round(0.5) = 1  (always away from zero)',
    py3: 'round(0.5) = 0  (nearest even)',
    probe: { type: 'rounding' },
  },
  {
    id: 'MAP_ITER', severity: 'high',
    pattern: /\bmap\s*\(/,
    message: 'map() returns list in py2, iterator in py3',
    py2: 'map()  →  list (reusable, falsy when empty, has len)',
    py3: 'map()  →  iterator (always truthy, single-pass, no len)',
    probe: { type: 'map_bool' },
  },
  {
    id: 'FILTER_ITER', severity: 'high',
    pattern: /\bfilter\s*\(/,
    message: 'filter() returns list in py2, iterator in py3',
    py2: 'filter()  →  list',
    py3: 'filter()  →  iterator (always truthy, single-pass, no len)',
    probe: { type: 'map_bool' },
  },
  {
    id: 'ZIP_ITER', severity: 'high',
    pattern: /\bzip\s*\(/,
    message: 'zip() returns list in py2, iterator in py3',
    py2: 'zip()  →  list (reusable)',
    py3: 'zip()  →  iterator (exhausted after first use → [])',
    probe: { type: 'zip' },
  },
  {
    id: 'DICT_VIEW', severity: 'high',
    // .keys()[ or .values()[ or .items()[ or .keys().sort()
    pattern: /\.(keys|values|items)\s*\(\s*\)\s*[\[.]/,
    message: 'dict.keys() indexed — TypeError in py3',
    py2: 'd.keys()  →  list (indexable)',
    py3: 'd.keys()  →  view (TypeError on [0] or .sort())',
    probe: { type: 'dict_keys' },
  },
  {
    id: 'BYTES_CMP', severity: 'critical',
    pattern: /b["'].*["']\s*==\s*["']|==\s*b["']/,
    message: 'bytes == str — always False in py3',
    py2: 'b"x" == "x"  →  True  (implicit coercion)',
    py3: 'b"x" == "x"  →  False (always)',
    probe: { type: 'bytes_str' },
  },
  {
    id: 'INPUT', severity: 'critical',
    pattern: /\binput\s*\(/,
    message: 'input() was eval() in py2',
    py2: 'input() with "18"  →  int 18 (eval!)',
    py3: 'input() with "18"  →  str "18"',
  },
  {
    id: 'OPEN_ENCODING', severity: 'medium',
    pattern: /\bopen\s*\([^)]+\)/,
    guard:   /encoding=|'[rwab]+b['"]|"[rwab]+b"/,
    message: 'open() without encoding — platform-dependent in py3',
    py2: 'open()  →  bytes',
    py3: 'open()  →  str (unicode) using platform locale',
  },
  {
    id: 'CROSS_SORT', severity: 'medium',
    pattern: /\bsorted\s*\(|\b\.sort\s*\(/,
    message: 'sorted() — cross-type ordering removed in py3',
    py2: 'sorted([3, None, "a"])  →  works (arbitrary order)',
    py3: 'TypeError: "<" not supported between str and int',
  },
  {
    id: 'DICT_MUTATE_ITER', severity: 'critical',
    // for x in dict: — check if body has .pop() or del
    pattern: /for\s+\w+\s+in\s+\w[\w.]*\s*:/,
    message: 'dict mutation during iteration — RuntimeError in py3',
    py2: 'for k in d.keys(): d.pop(k)  →  safe (copy)',
    py3: 'RuntimeError: dictionary changed size during iteration',
    requiresBlockCheck: true,  // look ahead for .pop() / del
  },
{
    id: 'MRO_DIVERGENCE',
    severity: 'high',
    // class Name(A, B) — two or more parents
    pattern: /class\s+\w+\s*\(\s*\w[\w.]*\s*,\s*\w/,
    message: 'multiple inheritance — MRO differs between py2 and py3',
    py2: 'depth-first: may skip intermediate class overrides',
    py3: 'C3 linearisation: consistent ordering, respects hierarchy',
    probe: { type: 'mro' },
}
];


function layer2(code) {
  const findings = [];
  const lines    = code.split('\n');

  LAYER2_RULES.forEach(rule => {

    // DICT_MUTATE_ITER: scan for for-loop, then check the next 8 lines
    // for a .pop() or del inside the body
    if (rule.requiresBlockCheck) {
      lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        if (line.startsWith('#')) return;
        if (!rule.pattern.test(rawLine)) return;

        const blockAhead = lines.slice(index + 1, index + 9).join('\n');
        if (/\.pop\s*\(|del\s+\w+\s*\[/.test(blockAhead)) {
          findings.push(makeFinding(rule, index + 1, line));
        }
      });
      return;
    }

    // All other rules: match line, apply guard if present
    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (line.startsWith('#')) return;
      if (!rule.pattern.test(rawLine)) return;
      if (rule.guard && rule.guard.test(line)) return;
      findings.push(makeFinding(rule, index + 1, line));
    });
  });

  // Deduplicate: same rule on same line should only appear once
  const seen = new Set();
  return findings.filter(f => {
    const key = `${f.rule}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Build a finding object from a rule + line info


function makeFinding(rule, lineNo, snippet) {
  const f = {
    rule:     rule.id,
    severity: rule.severity,
    line:     lineNo,
    snippet:  snippet,
    message:  rule.message,
    py2:      rule.py2,
    py3:      rule.py3,
  };
  if (rule.probe) f.probe = rule.probe;
  return f;
}


// ───────────────────────────────────────────────────────────────────────
// STEP 3: Layer 3 — concrete value probes
//
// How it works:
//   1. Collect probe.type values from all findings that have one
//   2. For each type, run the matching probe function
//   3. Each probe function uses JS simulators of Python 2 arithmetic
//      and compares to real JS (= Python 3) values
//
// Why JS simulators:
//   The tool runs in the browser — there is no Python runtime.
//   We re-implement only the specific behaviours that diverge.
// ───────────────────────────────────────────────────────────────────────

// ── Python 2 arithmetic simulators ───────────────────────────────────

// py2: int/int floors  |  py3: int/int returns float