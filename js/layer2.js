// layer2.js — Layer 2: semantic divergence rules
// Detects patterns valid in Python 3 but with different behaviour.
// Depends on: nothing
// Exports:     LAYER2_RULES, layer2(code), makeFinding()

const LAYER2_RULES = [
  {
    id: "INT_DIV",
    severity: "critical",
    // Match a / that is not // or /= or part of a URL
    pattern: /[^<>=!/*][^<>=!/*]\s*\/\s*[^/=*]/,
    guard: /https?:\/\//, // skip lines with URLs
    message: "/ operator — floor in py2, float in py3",
    py2: "int / int  →  floor  (7/2 = 3)",
    py3: "int / int  →  float  (7/2 = 3.5)",
    probe: { type: "division" },
  },
  {
    id: "ROUND",
    severity: "critical",
    pattern: /\bround\s*\(/,
    message: "round() — round-half-up in py2, banker's in py3",
    py2: "round(0.5) = 1  (always away from zero)",
    py3: "round(0.5) = 0  (nearest even)",
    probe: { type: "rounding" },
  },
  {
    id: "MAP_ITER",
    severity: "high",
    pattern: /\bmap\s*\(/,
    message: "map() returns list in py2, iterator in py3",
    py2: "map()  →  list (reusable, falsy when empty, has len)",
    py3: "map()  →  iterator (always truthy, single-pass, no len)",
    probe: { type: "map_bool" },
  },
  {
    id: "FILTER_ITER",
    severity: "high",
    pattern: /\bfilter\s*\(/,
    message: "filter() returns list in py2, iterator in py3",
    py2: "filter()  →  list",
    py3: "filter()  →  iterator (always truthy, single-pass, no len)",
    probe: { type: "map_bool" },
  },
  {
    id: "ZIP_ITER",
    severity: "high",
    pattern: /\bzip\s*\(/,
    message: "zip() returns list in py2, iterator in py3",
    py2: "zip()  →  list (reusable)",
    py3: "zip()  →  iterator (exhausted after first use → [])",
    probe: { type: "zip" },
  },
  {
    id: "DICT_VIEW",
    severity: "high",
    // .keys()[ or .values()[ or .items()[ or .keys().sort()
    pattern: /\.(keys|values|items)\s*\(\s*\)\s*[\[.]/,
    message: "dict.keys() indexed — TypeError in py3",
    py2: "d.keys()  →  list (indexable)",
    py3: "d.keys()  →  view (TypeError on [0] or .sort())",
    probe: { type: "dict_keys" },
  },
  {
    id: "BYTES_CMP",
    severity: "critical",
    pattern: /b["'].*["']\s*==\s*["']|==\s*b["']/,
    message: "bytes == str — always False in py3",
    py2: 'b"x" == "x"  →  True  (implicit coercion)',
    py3: 'b"x" == "x"  →  False (always)',
    probe: { type: "bytes_str" },
  },
  {
    id: "INPUT",
    severity: "critical",
    pattern: /\binput\s*\(/,
    message: "input() was eval() in py2",
    py2: 'input() with "18"  →  int 18 (eval!)',
    py3: 'input() with "18"  →  str "18"',
  },
  {
    id: "OPEN_ENCODING",
    severity: "medium",
    pattern: /\bopen\s*\([^)]+\)/,
    guard: /encoding=|'[rwab]+b['"]|"[rwab]+b"/,
    message: "open() without encoding — platform-dependent in py3",
    py2: "open()  →  bytes",
    py3: "open()  →  str (unicode) using platform locale",
  },
  {
    id: "CROSS_SORT",
    severity: "medium",
    pattern: /\bsorted\s*\(|\b\.sort\s*\(/,
    message: "sorted() — cross-type ordering removed in py3",
    py2: 'sorted([3, None, "a"])  →  works (arbitrary order)',
    py3: 'TypeError: "<" not supported between str and int',
  },
  {
    id: "DICT_MUTATE_ITER",
    severity: "critical",
    // for x in dict: — check if body has .pop() or del
    pattern: /for\s+\w+\s+in\s+\w[\w.]*\s*:/,
    message: "dict mutation during iteration — RuntimeError in py3",
    py2: "for k in d.keys(): d.pop(k)  →  safe (copy)",
    py3: "RuntimeError: dictionary changed size during iteration",
    requiresBlockCheck: true, // look ahead for .pop() / del
  },
  {
    id: "MRO_DIVERGENCE",
    severity: "high",
    // Matches: class Name(Parent1, Parent2):
    pattern: /class\s+\w+\s*\(\s*\w+\s*,\s*\w+.*\)\s*:/,
    message:
      "Multiple inheritance detected — MRO logic differs between Py2 and Py3",
    py2: "DFS (Depth-First Search) — can skip siblings in complex diamonds",
    py3: "C3 Linearization — guaranteed monotonic and consistent",
    probe: { type: "mro" },
  },
  {
    id: 'SUPER_NO_ARGS',
    severity: 'high',
    // super() with no arguments — py3 only syntax
    pattern: /\bsuper\s*\(\s*\)/,
    message: 'super() without arguments — fails in Python 2',
    py2: 'TypeError: super() takes at least 1 argument',
    py3: 'super() works — no arguments needed',
    probe: { type: "super_no_args" },
},
  // ── String rules ───────────────────────────────────────────────────
 
  {
    id: 'BASESTRING', severity: 'critical',
    // basestring was the common parent of str and unicode in Python 2
    // it does not exist in Python 3
    pattern: /\bbasestring\b/,
    message: 'basestring does not exist in Python 3',
    py2: 'isinstance(x, basestring) → True for both str and unicode',
    py3: 'NameError: name "basestring" is not defined',
    probe: { type: 'string' },
  },
  {
    id: 'UNICODE_LITERAL', severity: 'medium',
    // u"..." prefix — works in both but signals Python 2 era code
    // Python 2: creates a unicode object distinct from str
    // Python 3: str is always unicode, the u prefix is redundant
    pattern: /\bu["']/,
    message: 'unicode literal u"..." — redundant in Python 3',
    py2: 'u"hello" → <type "unicode"> — distinct from str',
    py3: 'u"hello" → <class "str"> — same as "hello", u prefix ignored',
    probe: { type: 'string' },
  },
  {
    id: 'UNICODE_METHOD', severity: 'high',
    // def __unicode__(self) — Python 2 method for unicode representation
    // Python 3 never calls __unicode__, only __str__
    pattern: /def\s+__unicode__\s*\(/,
    message: '__unicode__ method — silently ignored in Python 3',
    py2: 'unicode(obj) calls __unicode__ — unicode representation returned',
    py3: '__unicode__ never called — unicode() does not exist in py3',
    probe: { type: 'string' },
  },
  {
    id: 'ENCODE_NO_ARG', severity: 'medium',
    // .encode() with no arguments
    // Python 2: str is bytes — often a no-op for ASCII
    // Python 3: str is unicode — encode() returns bytes (utf-8 default)
    pattern: /\.encode\s*\(\s*\)/,
    message: '.encode() without arguments — different behaviour in py2 vs py3',
    py2: '"hello".encode() → "hello"  (str, no-op for ASCII content)',
    py3: '"hello".encode() → b"hello" (bytes, encodes as utf-8)',
    probe: { type: 'string' },
  },
  {
    id: 'BYTES_CONCAT', severity: 'critical',
    // b"..." + something — bytes concatenation
    // Python 2: b"x" is just str — concatenation works
    // Python 3: bytes + str raises TypeError
    pattern: /b["'].*["']\s*\+/,
    message: 'bytes + str concatenation — TypeError in Python 3',
    py2: 'b"hello" + "world" → "helloworld"  (both are str in py2)',
    py3: 'TypeError: can\'t concat str to bytes',
    probe: { type: 'string' },
  },
  {
    id: 'BYTES_FORMAT', severity: 'high',
    // "%s" % b"..." — formatting bytes into a string
    // Python 2: b"x" is str — formats as the value "hello"
    // Python 3: b"x" is bytes — formats as the repr "b'hello'"
    pattern: /["']%s["']\s*%\s*b["']/,
    message: '"%s" % b"..." — shows repr in py3, not the value',
    py2: '"%s" % b"hello" → "hello"      (bytes is str in py2)',
    py3: '"%s" % b"hello" → "b\'hello\'" (repr of bytes object)',
    probe: { type: 'string' },
  },
];

function layer2(code) {
  const findings = [];
  const lines = code.split("\n");

  LAYER2_RULES.forEach((rule) => {
    // DICT_MUTATE_ITER: scan for for-loop, then check the next 8 lines
    // for a .pop() or del inside the body
    if (rule.requiresBlockCheck) {
      lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        if (line.startsWith("#")) return;
        if (!rule.pattern.test(rawLine)) return;

        const blockAhead = lines.slice(index + 1, index + 9).join("\n");
        if (/\.pop\s*\(|del\s+\w+\s*\[/.test(blockAhead)) {
          findings.push(makeFinding(rule, index + 1, line));
        }
      });
      return;
    }

    // All other rules: match line, apply guard if present
    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (line.startsWith("#")) return;
      if (!rule.pattern.test(rawLine)) return;
      if (rule.guard && rule.guard.test(line)) return;
      findings.push(makeFinding(rule, index + 1, line));
    });
  });

  // Deduplicate: same rule on same line should only appear once
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.rule}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Build a finding object from a rule + line info

function makeFinding(rule, lineNo, snippet) {
  const f = {
    rule: rule.id,
    severity: rule.severity,
    line: lineNo,
    snippet: snippet,
    message: rule.message,
    py2: rule.py2,
    py3: rule.py3,
  };
  if (rule.probe) f.probe = rule.probe;
  return f;
}

// {
//     id: 'SUPER_NO_ARGS', severity: 'high',
//     // super() with no arguments — Python 3 only syntax
//     // Python 2 requires super(ClassName, self) explicitly
//     pattern: /\bsuper\s*\(\s*\)/,
//     message: 'super() without arguments — fails in Python 2',
//     py2: 'TypeError: super() takes at least 1 argument (0 given)',
//     py3: 'super() works — class and instance inferred automatically',
//   },
//   {
//     id: 'OLD_STYLE_CLASS', severity: 'medium',
//     // class Name: with no parentheses — old-style in Python 2
//     // old-style classes use depth-first MRO, not C3
//     // Python 3 makes all classes new-style automatically
//     pattern: /^class\s+\w+\s*:/,
//     message: 'old-style class — uses depth-first MRO in Python 2',
//     py2: 'old-style class: depth-first MRO, does not inherit from object',
//     py3: 'all classes new-style automatically — C3 MRO always used',
//   },
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
