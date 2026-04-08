/**
 * rules-preparsed.js
 * Layer 1 — tokeniser-level rules.
 * These patterns are SyntaxErrors in Python 3 so they can never reach
 * an AST walker.  We detect them with line-by-line regex before anything
 * else runs.
 */

"use strict";

const PreParsedRules = (() => {

  /**
   * Run all pre-parse rules against `code`.
   * Returns an array of finding objects.
   */
  function run(code) {
    const findings = [];
    const lines = code.split('\n');

    lines.forEach((line, i) => {
      const s     = line.trim();
      const lineno = i + 1;

      // Skip comment lines — none of these patterns can appear inside them
      if (s.startsWith('#')) return;

      // ── print as statement ────────────────────────────────────────────
      if (/^print\s+[^(]/.test(s)) {
        findings.push({
          rule: 'PRINT_STMT',
          severity: 'medium',
          line: lineno,
          snippet: s,
          message: 'print used as statement — SyntaxError in py3',
          detail:
            'Python 3 requires print() as a function call with parentheses. ' +
            'Also note: a trailing comma (print "x",) suppresses newline in py2; ' +
            'the py3 equivalent is print("x", end="").',
          py2: 'print statement: outputs text normally',
          py3: 'SyntaxError: Missing parentheses in call to print',
        });
      }

      // ── except Foo, e: syntax ────────────────────────────────────────
      if (/except\s+\w[\w.]*\s*,\s*\w+\s*:/.test(s)) {
        findings.push({
          rule: 'EXCEPT_COMMA',
          severity: 'high',
          line: lineno,
          snippet: s,
          message: 'except Foo, e: is a SyntaxError in py3',
          detail:
            'The comma form is py2-only. The 2to3 tool sometimes produces ' +
            '"except (Foo, e):" (a tuple catch, wrong) instead of ' +
            '"except Foo as e:". Always review 2to3 output manually.',
          py2: 'except Foo, e: → catches Foo, binds exception to e',
          py3: 'SyntaxError — use: except Foo as e:',
        });
      }

      // ── unicode() builtin removed ────────────────────────────────────
      if (/\bunicode\s*\(/.test(s)) {
        findings.push({
          rule: 'UNICODE_BUILTIN',
          severity: 'high',
          line: lineno,
          snippet: s,
          message: 'unicode() builtin does not exist in py3',
          detail:
            'In py3 every string is unicode by default. Replace unicode(x) ' +
            'with str(x), or use the six library: six.text_type(x).',
          py2: 'unicode("x") → unicode string',
          py3: 'NameError: name "unicode" is not defined',
        });
      }

      // ── dict.has_key() ───────────────────────────────────────────────
      if (/\.has_key\s*\(/.test(s)) {
        findings.push({
          rule: 'HAS_KEY',
          severity: 'medium',
          line: lineno,
          snippet: s,
          message: 'dict.has_key() removed in py3',
          detail:
            'has_key() was deprecated in py2.2. ' +
            'Use the "in" operator instead: "key in d".',
          py2: 'd.has_key("x") → True / False',
          py3: 'AttributeError: "dict" object has no attribute "has_key"',
        });
      }

      // ── xrange() ────────────────────────────────────────────────────
      if (/\bxrange\s*\(/.test(s)) {
        findings.push({
          rule: 'XRANGE',
          severity: 'medium',
          line: lineno,
          snippet: s,
          message: 'xrange() removed in py3 — use range()',
          detail:
            'In py3 range() is the lazy iterator that xrange() was in py2. ' +
            'py2 range() created a full list in memory; py3 range() does not.',
          py2: 'xrange(N) → lazy iterator; range(N) → list',
          py3: 'NameError: name "xrange" is not defined',
        });
      }

      // ── raw_input() ──────────────────────────────────────────────────
      if (/\braw_input\s*\(/.test(s)) {
        findings.push({
          rule: 'RAW_INPUT',
          severity: 'medium',
          line: lineno,
          snippet: s,
          message: 'raw_input() removed — use input() in py3',
          detail:
            'py3 input() always returns str (safe — no eval). This is exactly ' +
            'what py2 raw_input() did.',
          py2: 'raw_input() → returns str safely',
          py3: 'NameError: name "raw_input" is not defined',
        });
      }

      // ── exec as statement ───────────────────────────────────────────
      if (/^exec\s+[^(]/.test(s)) {
        findings.push({
          rule: 'EXEC_STMT',
          severity: 'medium',
          line: lineno,
          snippet: s,
          message: 'exec used as statement — must be a function call in py3',
          detail:
            'exec "code" is a statement in py2. ' +
            'py3 requires exec("code") as a function.',
          py2: 'exec "code" → executes the string',
          py3: 'SyntaxError — use exec("code")',
        });
      }

      // ── raise Exception, message ────────────────────────────────────
      if (/^raise\s+\w[\w.]*\s*,/.test(s)) {
        findings.push({
          rule: 'RAISE_COMMA',
          severity: 'high',
          line: lineno,
          snippet: s,
          message: 'raise Exc, msg — old py2 raise syntax',
          detail:
            'py3 requires raise Exc(msg). ' +
            'The comma form is a SyntaxError in py3.',
          py2: 'raise ValueError, "message" → raises ValueError',
          py3: 'SyntaxError — use: raise ValueError("message")',
        });
      }

    }); // end forEach

    return findings;
  }

  return { run };

})();

/**
 * rules-semantic.js
 * Layer 2 — Semantic divergence rules.
 * These patterns are syntactically valid in Python 3 but produce different
 * output/behaviour compared to Python 2.  The engine detects them with
 * line-aware regex and flags them with a py2 vs py3 behaviour description.
 */

"use strict";

const SemanticRules = (() => {

  /**
   * Helper: returns every line that matches `pattern`, skipping comment lines.
   * Returns [{ line, snippet }].
   */
  function matchLines(code, pattern) {
    return code.split('\n').reduce((acc, line, i) => {
      const s = line.trim();
      if (!s.startsWith('#') && pattern.test(line)) {
        acc.push({ line: i + 1, snippet: s });
      }
      return acc;
    }, []);
  }

  /** Deduplicate findings by (rule, line). */
  function dedup(findings) {
    const seen = new Set();
    return findings.filter(f => {
      const k = `${f.rule}:${f.line}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /** Run all semantic rules against `code`. Returns array of findings. */
  function run(code) {
    const findings = [];

    // ── 1. Integer division ──────────────────────────────────────────────
    // Match any single / that is not //, /=, */ etc.
    // We use a conservative pattern and skip comment / string lines.
    matchLines(code, /[^<>=!/*][^<>=!/*]\s*\/\s*[^/=*]/).forEach(({ line, snippet }) => {
      // Extra guard: skip lines that are clearly string literals or URLs
      if (/https?:\/\//.test(snippet)) return;
      findings.push({
        rule: 'INT_DIV',
        severity: 'critical',
        line,
        snippet,
        message: '/ operator — floor division in py2, float division in py3',
        detail:
          'In py2, dividing two integers with / always floors (7/2 → 3). ' +
          'In py3, / always returns a float (7/2 → 3.5). ' +
          'Use // explicitly when you need integer (floor) division.',
        py2: 'int / int → floor int  (7/2 = 3)',
        py3: 'int / int → float      (7/2 = 3.5)',
        probe: { type: 'division' },
      });
    });

    // ── 2. round() — banker's rounding ──────────────────────────────────
    matchLines(code, /\bround\s*\(/).forEach(({ line, snippet }) => {
      findings.push({
        rule: 'ROUND',
        severity: 'critical',
        line,
        snippet,
        message: "round() — py2 round-half-up vs py3 banker's rounding",
        detail:
          "py2 always rounds 0.5 away from zero: round(0.5)=1, round(2.5)=3. " +
          "py3 rounds to the nearest even number: round(0.5)=0, round(2.5)=2. " +
          "Sums over many .5 values diverge by up to N/4. Critical for financial code.",
        py2: 'round(0.5)=1, round(2.5)=3  (always rounds away from zero)',
        py3: 'round(0.5)=0, round(2.5)=2  (rounds to nearest even)',
        probe: { type: 'rounding' },
      });
    });

    // ── 3. map() and filter() — lazy iterators ───────────────────────────
    matchLines(code, /\bmap\s*\(|\bfilter\s*\(/).forEach(({ line, snippet }) => {
      const fn = /\bmap\s*\(/.test(snippet) ? 'map' : 'filter';
      findings.push({
        rule: `${fn.toUpperCase()}_ITER`,
        severity: 'high',
        line,
        snippet,
        message: `${fn}() returns a list in py2, a lazy iterator in py3`,
        detail:
          `py3 ${fn}() iterator: (1) always truthy even when input is empty — ` +
          `breaks "if ${fn}(...):" guards; ` +
          `(2) single-pass — second iteration yields nothing; ` +
          `(3) has no len(). Materialise with list() if you need any of these.`,
        py2: `${fn}() → list (reusable, has len, falsy when empty)`,
        py3: `${fn}() → iterator (single-pass, always truthy, no len)`,
        probe: { type: 'map_bool' },
      });
    });

    // ── 4. zip() — lazy iterator ─────────────────────────────────────────
    matchLines(code, /\bzip\s*\(/).forEach(({ line, snippet }) => {
      findings.push({
        rule: 'ZIP_ITER',
        severity: 'high',
        line,
        snippet,
        message: 'zip() returns a list in py2, an iterator in py3',
        detail:
          'If the zip result is consumed twice (e.g. dict(z) then list(z)), ' +
          'the second pass is empty and raises no error. ' +
          'Audit logs, validation loops, and secondary processing silently become no-ops.',
        py2: 'zip() → list (reusable, second pass returns full list)',
        py3: 'zip() → iterator (exhausted after first consumption → [])',
        probe: { type: 'zip' },
      });
    });

    // ── 5. dict.keys()/values()/items() indexed or sorted ───────────────
    matchLines(code, /\.(keys|values|items)\s*\(\s*\)\s*[\[.]/).forEach(({ line, snippet }) => {
      findings.push({
        rule: 'DICT_VIEW',
        severity: 'high',
        line,
        snippet,
        message: 'dict.keys()/values()/items() indexed or mutated — fails in py3',
        detail:
          'py3 returns a dict_keys / dict_values / dict_items view, not a list. ' +
          'Views do not support indexing ([n]) or .sort() / .append(). ' +
          'Use list(d.keys())[n] or sorted(d.keys()).',
        py2: 'd.keys() → list  (indexable, sortable)',
        py3: 'd.keys() → view  (TypeError on d.keys()[0] or d.keys().sort())',
        probe: { type: 'dict_keys' },
      });
    });

    // ── 6. bytes literal compared to str ────────────────────────────────
    matchLines(code, /b["'].*["']\s*==\s*["']|==\s*b["']|b["'].*["']\s*!=\s*["']/).forEach(({ line, snippet }) => {
      findings.push({
        rule: 'BYTES_CMP',
        severity: 'critical',
        line,
        snippet,
        message: 'bytes == str comparison — always False in py3',
        detail:
          'py2 silently coerced bytes↔str for comparisons. ' +
          'In py3, b"x" == "x" is ALWAYS False, regardless of content. ' +
          'Any auth check, token comparison, or header match that crosses the ' +
          'bytes/str boundary silently fails — access always denied.',
        py2: 'b"x" == "x" → True  (implicit coercion)',
        py3: 'b"x" == "x" → False (always — no coercion)',
        probe: { type: 'bytes_str' },
      });
    });

    // ── 7. input() — eval in py2 ─────────────────────────────────────────
    matchLines(code, /\binput\s*\(/).forEach(({ line, snippet }) => {
      findings.push({
        rule: 'INPUT',
        severity: 'critical',
        line,
        snippet,
        message: 'input() evaluates expressions in py2 (security hole) + type change',
        detail:
          'py2 input() calls eval() on the user string — typing "18" returns int 18, ' +
          'typing "__import__(\'os\').system(\'rm -rf /\')" executes the command. ' +
          'py3 input() always returns str. Code comparing input() to integers breaks.',
        py2: 'input("age: ") where user types 18 → int 18 (eval!)',
        py3: 'input("age: ") where user types 18 → str "18"',
      });
    });

    // ── 8. open() without explicit encoding ─────────────────────────────
    matchLines(code, /\bopen\s*\([^)]+\)/).forEach(({ line, snippet }) => {
      if (/encoding=|'[rwab]+b['"]|"[rwab]+b"/.test(snippet)) return;
      findings.push({
        rule: 'OPEN_ENCODING',
        severity: 'medium',
        line,
        snippet,
        message: 'open() without explicit encoding — platform-dependent in py3',
        detail:
          'py2 open() returns bytes (str in py2). ' +
          'py3 open() returns unicode using the platform locale. ' +
          'Files with non-ASCII content crash with UnicodeDecodeError on servers ' +
          'that have a different locale from the developer machine. ' +
          'Always use: open("file", encoding="utf-8")',
        py2: 'open() returns bytes — no Unicode decoding attempted',
        py3: 'open() returns str (unicode) using platform locale encoding',
      });
    });

    // ── 9. sorted() / .sort() on mixed-type collections ─────────────────
    matchLines(code, /\bsorted\s*\(|\b\.sort\s*\(/).forEach(({ line, snippet }) => {
      findings.push({
        rule: 'CROSS_SORT',
        severity: 'medium',
        line,
        snippet,
        message: 'sorted()/sort() — cross-type ordering removed in py3',
        detail:
          'py2 defined a total ordering across all types: None < numbers < strings. ' +
          'Sorting a mixed-type list produced an arbitrary but stable result. ' +
          'py3 raises TypeError when comparing incompatible types. ' +
          'Real-world data from CSV/DB/API often contains mixed types.',
        py2: 'sorted([3, None, "a"]) → [None, 3, "a"]  (arbitrary, no error)',
        py3: 'TypeError: "<" not supported between instances of "str" and "int"',
      });
    });

    // ── 10. Modifying dict while iterating ──────────────────────────────
    // Pattern: pop/del inside a for-loop that iterates over d.keys() or d directly
    matchLines(code, /for\s+\w+\s+in\s+\w+\s*:/).forEach(({ line, snippet }) => {
      // Check whether the next few lines contain a pop/del on the same dict
      const block = code.split('\n').slice(line, line + 8).join('\n');
      if (/\.pop\s*\(|del\s+\w+\s*\[/.test(block)) {
        findings.push({
          rule: 'DICT_MUTATE_ITER',
          severity: 'critical',
          line,
          snippet,
          message: 'Possible dict mutation during iteration — RuntimeError in py3',
          detail:
            'py2 dict.keys() returned a list (a copy), so mutating the dict during ' +
            'iteration was safe. py3 dict.keys() returns a live view — ' +
            'RuntimeError: dictionary changed size during iteration. ' +
            'This is the Ansible ec2_instance bug pattern (issue #709).',
          py2: 'for k in d.keys(): d.pop(k) → works (iterating over a copy)',
          py3: 'RuntimeError: dictionary changed size during iteration',
        });
      }
    });

    return dedup(findings);
  }

  return { run };

})();

/**
 * engine-probes.js
 * Layer 3 — Dynamic probe engine.
 *
 * For each detected bug class, this module generates concrete test inputs,
 * runs them through a JavaScript simulation of Python 2 semantics, and
 * compares against real Python 3 behaviour (also computed in JS).
 *
 * The goal is to show *actual diverging values* rather than just a warning —
 * this is what exposes "hidden bugs" where easy test inputs look the same
 * but edge-case production inputs diverge.
 */

"use strict";

const ProbeEngine = (() => {

  // ── Python 2 behaviour simulators ────────────────────────────────────────

  /** Simulate py2 integer division: floors when both operands are integers. */
  function py2Div(a, b) {
    if (Number.isInteger(a) && Number.isInteger(b)) {
      return Math.floor(a / b);   // py2 int floor division
    }
    return a / b;                  // float division — same in both
  }

  /**
   * Simulate py2 round-half-up (always rounds away from zero at .5).
   * py3 uses banker's rounding (round-half-to-even).
   */
  function py2Round(x) {
    return x >= 0
      ? Math.floor(x + 0.5)
      : Math.ceil(x - 0.5);
  }

  /**
   * Simulate py3 banker's rounding (round-half-to-even).
   * JS Math.round() is round-half-up, so we compute this explicitly.
   */
  function py3Round(x) {
    const floor = Math.floor(x);
    const diff  = x - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exactly .5 — round to nearest even
    return floor % 2 === 0 ? floor : floor + 1;
  }

  // ── Individual probe families ─────────────────────────────────────────────

  function divisionProbes() {
    const pairs = [[7,2], [3,10], [5,10], [3,7], [1,3], [10,4]];
    return pairs.map(([a, b]) => {
      const p2 = py2Div(a, b);
      const p3 = a / b;
      return {
        expr:     `${a} / ${b}`,
        py2:      String(p2),
        py3:      Number.isInteger(p3) ? String(p3) : p3.toFixed(4),
        diverges: p2 !== p3,
      };
    });
  }

  function roundingProbes() {
    const vals = [0.5, 1.5, 2.5, 3.5, 4.5];
    const rows = vals.map(v => ({
      expr:     `round(${v})`,
      py2:      String(py2Round(v)),
      py3:      String(py3Round(v)),
      diverges: py2Round(v) !== py3Round(v),
    }));
    // Accumulation row — the real killer
    const py2Sum = vals.reduce((s, v) => s + py2Round(v), 0);
    const py3Sum = vals.reduce((s, v) => s + py3Round(v), 0);
    rows.push({
      expr:     'sum(round(v) for v in [0.5 .. 4.5])',
      py2:      String(py2Sum),
      py3:      String(py3Sum),
      diverges: py2Sum !== py3Sum,
    });
    return rows;
  }

  function mapBoolProbes() {
    // py2 map() returns a list — truthy only when non-empty
    // py3 map() returns an iterator object — ALWAYS truthy
    return [
      {
        expr:     'bool(map(str, []))',
        py2:      'False',           // empty list is falsy
        py3:      'True',            // iterator object is always truthy
        diverges: true,
      },
      {
        expr:     'bool(map(str, [1, 2, 3]))',
        py2:      'True',
        py3:      'True',
        diverges: false,             // ← the hidden bug: same output, different reason
      },
      {
        expr:     'len(map(str, [1, 2, 3]))',
        py2:      '3',
        py3:      'TypeError: object of type "map" has no len()',
        diverges: true,
      },
    ];
  }

  function zipProbes() {
    // Demonstrate iterator exhaustion
    const keys = ['a', 'b', 'c'];
    const vals = [1, 2, 3];

    // py2: zip returns a list — reusable
    const py2Z = keys.map((k, i) => [k, vals[i]]);
    const py2First  = Object.fromEntries(py2Z);
    const py2Second = [...py2Z];      // same list, still full

    // py3 simulation: after first consumption, second pass is empty
    const py3First  = Object.fromEntries(py2Z);
    const py3Second = [];             // exhausted iterator

    return [
      {
        expr:     "z = zip(['a','b','c'], [1,2,3]); dict(z)",
        py2:      JSON.stringify(py2First),
        py3:      JSON.stringify(py3First),
        diverges: false,
      },
      {
        expr:     'list(z)  ← second consumption',
        py2:      JSON.stringify(py2Second),
        py3:      '[]  (iterator exhausted — silent data loss)',
        diverges: true,
      },
    ];
  }

  function dictKeysProbes() {
    return [
      {
        expr:     '{"a": 1, "b": 2}.keys()[0]',
        py2:      '"a" (list — indexable)',
        py3:      'TypeError: "dict_keys" object is not subscriptable',
        diverges: true,
      },
      {
        expr:     '{"a": 1}.keys().sort()',
        py2:      'sorted list',
        py3:      'AttributeError: "dict_keys" has no attribute "sort"',
        diverges: true,
      },
      {
        expr:     'd.keys() & d2.keys()',
        py2:      'TypeError: unsupported operand type(s) for &: "list" and "list"',
        py3:      'set intersection — works!  (dict_keys supports set ops)',
        diverges: true,
      },
    ];
  }

  function bytesStrProbes() {
    return [
      {
        expr:     'b"hello" == "hello"',
        py2:      'True   (implicit coercion)',
        py3:      'False  (always — no coercion)',
        diverges: true,
      },
      {
        expr:     'b"SECRET" in ["SECRET"]',
        py2:      'True   (coerced to match)',
        py3:      'False  (bytes not equal to str)',
        diverges: true,
      },
      {
        expr:     'b"abc"[0]',
        py2:      '"a"    (single character str)',
        py3:      '97     (integer — ASCII code)',
        diverges: true,
      },
    ];
  }

  // ── Main entry point ──────────────────────────────────────────────────────

  /**
   * Given the array of findings from the rule layers, determine which probe
   * families to run and return all probe rows.
   *
   * @param  {Array} findings - findings from PreParsedRules + SemanticRules
   * @returns {Array}           flat array of probe objects {expr,py2,py3,diverges}
   */
  function run(findings) {
    // Build a set of probe types that are relevant for this code
    const needed = new Set(
      findings
        .filter(f => f.probe)
        .map(f => f.probe.type)
    );

    const rows = [];

    if (needed.has('division'))  rows.push(...divisionProbes());
    if (needed.has('rounding'))  rows.push(...roundingProbes());
    if (needed.has('map_bool'))  rows.push(...mapBoolProbes());
    if (needed.has('zip'))       rows.push(...zipProbes());
    if (needed.has('dict_keys')) rows.push(...dictKeysProbes());
    if (needed.has('bytes_str')) rows.push(...bytesStrProbes());

    return rows;
  }

  return { run };

})();

"use strict";

const SAMPLES = {

  division: `# Integer division
# py2: int/int floors  |  py3: int/int returns float
print(7 / 2)
print(3 / 10)
print(10 / 2)

# Real-world pattern: percentage
hits  = 3
total = 10
print((hits / total) * 100)

# Hidden case: even denominators look the same in both
print(10 / 5)
print(9 / 3)`,

  rounding: `# Banker's rounding
# py2: round(0.5)=1  |  py3: round(0.5)=0
print(round(0.5))
print(round(1.5))
print(round(2.5))
print(round(3.5))
print(round(4.5))

# Accumulation: where financial code breaks
vals = [0.5, 1.5, 2.5, 3.5, 4.5]
print(sum(round(v) for v in vals))

# Invoice lines
prices = [1.5, 2.5, 3.5, 4.5, 5.5]
print(sum(round(p) for p in prices))`,

  iterator: `# map() / filter() / zip() return iterators in py3

# Bug 1: map() always truthy even when input is empty
empty = []
print(bool(map(str, empty)))

data = [1, 2, 3]
print(bool(map(str, data)))

# Bug 2: zip() exhausted after first consumption
keys = ["a", "b", "c"]
vals = [1, 2, 3]
z = zip(keys, vals)
first_pass  = dict(z)
second_pass = list(z)
print(first_pass)
print(second_pass)

# Bug 3: filter() result as list
nums     = [1, -2, 3, -4, 5]
positive = filter(lambda x: x > 0, nums)
print(list(positive))`,

  dict: `# dict.keys() is a view in py3, not a list

config = {"timeout": 30, "retry": 3, "host": "localhost"}

# Iteration works in both
for k in config.keys():
    print(k)

# Membership works in both
print("timeout" in config.keys())

# py3 bonus: set ops on views
config2 = {"timeout": 60, "debug": True}
common = config.keys() & config2.keys()
print(sorted(common))`,

  bytes: `# bytes vs str: different types in py3

b_val = b"SECRET"
s_val = "SECRET"

# True in py2, False in py3
print(b_val == s_val)

# char in py2, integer in py3
data = b"hello"
print(data[0])

# type equality
print(type(b_val) == type(s_val))`,

  hidden: `# Hidden bugs: same output on easy inputs, diverge on real data

# Division: even denominator hides the bug
print(10 / 2)
print(6  / 3)

# Division: odd denominator reveals it
print(3 / 7)
print(1 / 3)

# Rounding: integers — both the same
print(round(1.0))
print(round(2.0))

# Rounding: .5 boundary — split here
print(round(0.5))
print(round(2.5))

# Sum of .5 values
vals = [0.5, 1.5, 2.5, 3.5, 4.5]
print(sum(round(v) for v in vals))`,

  django: `# Django migration bytes/str bug
# py2 generates b"Article", py3 needs "Article"

name_bytes  = b"Article"
name_str    = "Article"

print(name_bytes == name_str)
print(type(name_bytes))
print(type(name_str))

# Indexing bytes gives int in py3
field_name = b"title"
print(field_name[0])`,

  ansible: `# Ansible bugs

# Safe dict iteration with list() copy
filters = {"region": "us-east", "state": None, "tag": None}
clean = {}
for k in list(filters.keys()):
    if filters[k] is not None:
        clean[k] = filters[k]
print(clean)

# bytes/str comparison
content_str   = "openssl config data"
content_bytes = b"openssl config data"
print(content_str  == content_bytes)
print(content_bytes[0])`,

  sorting: `# Cross-type sorting

# Same types: works in both
nums  = [3, 1, 4, 1, 5, 9, 2, 6]
words = ["banana", "apple", "cherry"]
print(sorted(nums))
print(sorted(words))

# Mixed numbers: works in both
mixed_nums = [3, 1.5, 2, 0.5]
print(sorted(mixed_nums))`,

  all: `# All key divergences

print("--- division ---")
print(7 / 2)
print(3 / 10)

print("--- rounding ---")
print([round(v) for v in [0.5, 1.5, 2.5, 3.5, 4.5]])
print(sum(round(v) for v in [0.5, 1.5, 2.5, 3.5, 4.5]))

print("--- map bool ---")
print(bool(map(str, [])))
print(bool(map(str, [1, 2, 3])))

print("--- zip exhaust ---")
z = zip([1, 2, 3], [4, 5, 6])
print(dict(z))
print(list(z))

print("--- bytes vs str ---")
print(b"hello" == "hello")
print(b"hello"[0])

print("--- sorted ---")
print(sorted([3, 1, 4, 1, 5]))`,

};

/**
 * ui.js
 * UI controller.
 * Wires together the detection engine (PreParsedRules + SemanticRules +
 * ProbeEngine) and all DOM interactions.
 *
 * Depends on (must be loaded first):
 *   rules-preparsed.js  →  PreParsedRules
 *   rules-semantic.js   →  SemanticRules
 *   engine-probes.js    →  ProbeEngine
 *   samples.js          →  SAMPLES
 */

"use strict";

// ── Utility ───────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Line-number panel ─────────────────────────────────────────────────────

function updateLineNumbers() {
  const editor  = document.getElementById('code-editor');
  const panel   = document.getElementById('line-numbers');
  const nLines  = Math.max(editor.value.split('\n').length, 20);
  let html = '';
  for (let i = 1; i <= nLines; i++) html += `<span id="ln-${i}">${i}</span>`;
  panel.innerHTML = html;
}

function syncScroll(editorEl) {
  document.getElementById('line-numbers').scrollTop = editorEl.scrollTop;
}

function highlightLines(lineNos) {
  // Clear all flags first
  document.querySelectorAll('#line-numbers span').forEach(s => s.classList.remove('flagged'));
  lineNos.forEach(n => {
    const el = document.getElementById(`ln-${n}`);
    if (el) el.classList.add('flagged');
  });
}

// ── Finding card HTML builder ─────────────────────────────────────────────

function buildFindingHTML(f, idx) {
  const snippetBlock = f.snippet
    ? `<div class="snip-label">Source</div>
       <div class="snippet-box">${escHtml(f.snippet)}</div>
       <br>`
    : '';

  return `
    <div class="finding" id="f-${idx}">
      <div class="finding-head" onclick="UI.toggleFinding(${idx})">
        <span class="sev-badge sev-${f.severity}">${escHtml(f.severity)}</span>
        <div>
          <div class="finding-msg">${escHtml(f.message)}</div>
          <div class="finding-line">
            line&nbsp;${f.line}&nbsp;·&nbsp;<span style="opacity:.6">${escHtml(f.rule)}</span>
          </div>
        </div>
        <span class="chevron">▶</span>
      </div>
      <div class="finding-body">
        ${snippetBlock}
        <p class="detail-text">${escHtml(f.detail)}</p>
        <div class="compare-grid">
          <div class="ver-box py2">
            <div class="ver-label">Python 2</div>
            <div class="ver-val">${escHtml(f.py2)}</div>
          </div>
          <div class="ver-box py3">
            <div class="ver-label">Python 3</div>
            <div class="ver-val">${escHtml(f.py3)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Probe rows HTML builder ───────────────────────────────────────────────

function buildProbeRow(p) {
  return `
    <div class="probe-row">
      <span class="probe-expr">${escHtml(p.expr)}</span>
      <span class="probe-py2">${escHtml(p.py2)}</span>
      <span class="probe-py3">${escHtml(p.py3)}</span>
      <span class="probe-diff ${p.diverges ? 'bug' : 'ok'}">
        ${p.diverges ? '⚠ DIVERGES' : '✓ same'}
      </span>
    </div>`;
}

// ── Main analysis runner ──────────────────────────────────────────────────

function runAnalysis() {
  const code      = document.getElementById('code-editor').value.trim();
  const statusEl  = document.getElementById('run-status');

  if (!code) { statusEl.textContent = 'Nothing to analyse'; return; }

  const t0 = performance.now();

  // Run all three layers
  const findings = [
    ...PreParsedRules.run(code),
    ...SemanticRules.run(code),
  ];

  // Sort by line, then severity precedence
  const sevOrder = { critical: 0, high: 1, medium: 2, hidden: 3 };
  findings.sort((a, b) =>
    (a.line - b.line) || ((sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))
  );

  const probes  = ProbeEngine.run(findings);
  const elapsed = (performance.now() - t0).toFixed(1);

  renderSummaryBar(findings);
  renderFindings(findings);
  renderProbes(probes);
  highlightLines(findings.map(f => f.line));

  statusEl.textContent = `${findings.length} finding${findings.length !== 1 ? 's' : ''} · ${elapsed}ms`;
}

// ── Render functions ──────────────────────────────────────────────────────

function renderSummaryBar(findings) {
  const bar = document.getElementById('summary-bar');
  if (!findings.length) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  const counts = { critical: 0, high: 0, medium: 0, hidden: 0 };
  findings.forEach(f => { if (f.severity in counts) counts[f.severity]++; });

  Object.entries(counts).forEach(([sev, n]) => {
    const badge = document.getElementById(`cnt-${sev}`);
    if (badge) badge.querySelector('span:last-child').textContent = n;
  });
}

function renderFindings(findings) {
  const list = document.getElementById('findings-list');

  if (!findings.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚡</div>
        <div class="empty-text">Write or paste code, then click Analyse</div>
      </div>
      <div class="ok-banner">✓ No migration issues detected — code looks py3-safe</div>`;
    return;
  }

  list.innerHTML = findings.map((f, i) => buildFindingHTML(f, i)).join('');
}

function renderProbes(probes) {
  const section = document.getElementById('probe-section');
  const rows    = document.getElementById('probe-rows');

  if (!probes.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  rows.innerHTML = probes.map(buildProbeRow).join('');
}

// ── Finding toggle ────────────────────────────────────────────────────────

function toggleFinding(idx) {
  document.getElementById(`f-${idx}`)?.classList.toggle('open');
}

// ── Sample loader ─────────────────────────────────────────────────────────

function loadSample(name) {
  const code = SAMPLES[name];
  if (!code) return;
  document.getElementById('code-editor').value = code.trimStart();
  updateLineNumbers();
  runAnalysis();
}

// ── Clear editor ──────────────────────────────────────────────────────────

function clearEditor() {
  document.getElementById('code-editor').value = '';
  document.getElementById('findings-list').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚡</div>
      <div class="empty-text">Write or paste code, then click Analyse</div>
    </div>`;
  document.getElementById('summary-bar').style.display  = 'none';
  document.getElementById('probe-section').style.display = 'none';
  document.getElementById('run-status').textContent = '';
  updateLineNumbers();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

document.getElementById('code-editor').addEventListener('keydown', e => {
  // Tab → 4 spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = e.target.selectionStart, end = e.target.selectionEnd;
    e.target.value =
      e.target.value.substring(0, s) + '    ' + e.target.value.substring(end);
    e.target.selectionStart = e.target.selectionEnd = s + 4;
  }

  // Ctrl/Cmd + Enter → run analysis
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAnalysis();

  // Always update line numbers after any keystroke
  updateLineNumbers();
});

// Keep line numbers in sync with editor scroll
document.getElementById('code-editor').addEventListener('scroll', function () {
  syncScroll(this);
});

// ── Expose public surface for inline onclick handlers ─────────────────────
const UI = { toggleFinding, loadSample, clearEditor, runAnalysis };

// ── Init ──────────────────────────────────────────────────────────────────
updateLineNumbers();


// ═══════════════════════════════════════════════════════════════════
// EXECUTION ENGINE — py2 simulated + py3 live side-by-side
// ═══════════════════════════════════════════════════════════════════
const ExecutionEngine = (() => {

  function py2div(a,b){ return (Number.isInteger(a)&&Number.isInteger(b))?Math.floor(a/b):a/b; }
  function py2round(x,n=0){ const f=Math.pow(10,n); return Math.floor(x*f+0.5)/f; }
  function py2range(a,b,c){
    let start,stop,step;
    if(b===undefined){start=0;stop=a;step=1;}
    else if(c===undefined){start=a;stop=b;step=1;}
    else{start=a;stop=b;step=c;}
    const r=[];for(let i=start;step>0?i<stop:i>stop;i+=step)r.push(i);return r;
  }

  // py3 iterator: single-pass, always truthy
  class PyIter {
    constructor(arr,name){this._arr=[...arr];this._done=false;this._name=name||'iterator';}
    [Symbol.iterator](){if(this._done)return [][Symbol.iterator]();this._done=true;return this._arr[Symbol.iterator]();}
    toString(){return `<${this._name} object>`;}
  }
  PyIter.prototype.valueOf=function(){return true;};

  function py3map(fn,...iters){return new PyIter(Array.from(iters[0]).map(fn),'map');}
  function py3filter(fn,iter){return new PyIter(Array.from(iter).filter(fn),'filter');}
  function py3zip(...arrays){
    const arrs=arrays.map(a=>Array.from(a)),len=Math.min(...arrs.map(a=>a.length));
    return new PyIter(Array.from({length:len},(_,i)=>arrs.map(a=>a[i])),'zip');
  }
  function py3round(x,n=0){
    if(n!==0){const f=Math.pow(10,n);return Math.round(x*f)/f;}
    const fl=Math.floor(x),d=x-fl;
    if(d<.5)return fl;if(d>.5)return fl+1;return fl%2===0?fl:fl+1;
  }
  function py3sorted(arr){
    const copy=[...arr];
    copy.sort((a,b)=>{
      if(a===null||b===null||(typeof a!==typeof b&&!(typeof a==='number'&&typeof b==='number')))
        throw new TypeError(`'<' not supported between instances of '${a===null?'NoneType':typeof a}' and '${b===null?'NoneType':typeof b}'`);
      return a<b?-1:a>b?1:0;
    });
    return copy;
  }

  function fmt(v){
    if(v===null||v===undefined)return 'None';
    if(v===true)return 'True';if(v===false)return 'False';
    if(v instanceof PyIter)return v.toString();
    if(Array.isArray(v))return '['+v.map(fmt).join(', ')+']';
    if(typeof v==='object')return '{'+Object.entries(v).map(([k,val])=>`'${k}': ${fmt(val)}`).join(', ')+'}';
    if(typeof v==='string')return "'"+v+"'";
    return String(v);
  }

  function toJS(code,mode){
    let js=code;
    js=js.replace(/#[^\n]*/g,'');
    js=js.replace(/\bprint\s*\(([^)]*)\)/g,'__out($1)');
    js=js.replace(/\bTrue\b/g,'true');js=js.replace(/\bFalse\b/g,'false');js=js.replace(/\bNone\b/g,'null');
    js=js.replace(/\band\b/g,'&&');js=js.replace(/\bor\b/g,'||');js=js.replace(/\bnot\s+/g,'!');
    js=js.replace(/\brange\s*\(/g,'__range__(');
    js=js.replace(/\blen\s*\(/g,'__len__(');
    js=js.replace(/\blist\s*\(/g,'__list__(');
    js=js.replace(/\bdict\s*\(/g,'__dict__(');
    js=js.replace(/\bstr\s*\(/g,'String(');
    js=js.replace(/\bint\s*\(/g,'parseInt(');
    js=js.replace(/\bfloat\s*\(/g,'parseFloat(');
    js=js.replace(/\bsum\s*\(/g,'__sum__(');
    js=js.replace(/\bbool\s*\(/g,'Boolean(');
    js=js.replace(/\btype\s*\(/g,'__type__(');
    js=js.replace(/\babs\s*\(/g,'Math.abs(');
    if(mode==='py2'){
      js=js.replace(/([a-zA-Z0-9_)\]]+)\s*\/\s*([a-zA-Z0-9_(]+)(?!\/)/g,'__div__($1,$2)');
      js=js.replace(/\bround\s*\(/g,'__round__(');
      js=js.replace(/\bmap\s*\(/g,'__map__(');
      js=js.replace(/\bfilter\s*\(/g,'__filter__(');
      js=js.replace(/\bzip\s*\(/g,'__zip__(');
      js=js.replace(/\bsorted\s*\(/g,'__sorted__(');
    } else {
      js=js.replace(/\bround\s*\(/g,'__round__(');
      js=js.replace(/\bmap\s*\(/g,'__map__(');
      js=js.replace(/\bfilter\s*\(/g,'__filter__(');
      js=js.replace(/\bzip\s*\(/g,'__zip__(');
      js=js.replace(/\bsorted\s*\(/g,'__sorted__(');
    }
    return js;
  }

  function makeEnv(mode,lines){
    const __out=(...args)=>lines.push(args.map(fmt).join(' '));
    const __len=x=>{if(x instanceof PyIter)throw new TypeError(`object of type '${x._name}' has no len()`);return x.length??Object.keys(x).length;};
    const __list=x=>x instanceof PyIter?Array.from(x):Array.isArray(x)?[...x]:Array.from(x);
    const __dict=x=>{if(x instanceof PyIter)return Object.fromEntries(Array.from(x));if(Array.isArray(x))return Object.fromEntries(x);return x;};
    const __sum=x=>Array.from(x).reduce((a,b)=>a+b,0);
    const __type=x=>{
      if(x instanceof Uint8Array||ArrayBuffer.isView(x))return "<class 'bytes'>";
      if(typeof x==='string')return "<class 'str'>";
      if(typeof x==='number')return Number.isInteger(x)?"<class 'int'>":"<class 'float'>";
      if(typeof x==='boolean')return "<class 'bool'>";
      if(Array.isArray(x))return "<class 'list'>";
      if(x instanceof PyIter)return `<class '${x._name}'>`;
      return "<class 'object'>";
    };
    // byte string simulation
    const __bytes=(s)=>{
      const obj={_bytes:true,_str:s,[Symbol.toPrimitive](){return this._str;}};
      obj.toString=()=>`b'${s}'`;
      obj.__eq__=(other)=>false; // bytes != str always in py3
      return obj;
    };
    const common={__out,__len,__list,__dict,__sum,__type,__range:py2range,
      String,parseInt,parseFloat,Boolean,abs:Math.abs,max:Math.max,min:Math.min,
      print:__out,
    };
    if(mode==='py2') return {...common,
      __div__:py2div,__round__:py2round,
      __map__:(fn,...a)=>Array.from(a[0]).map(fn),
      __filter__:(fn,a)=>Array.from(a).filter(fn),
      __zip__:(...arrays)=>{const arrs=arrays.map(a=>[...a]),len=Math.min(...arrs.map(a=>a.length));return Array.from({length:len},(_,i)=>arrs.map(a=>a[i]));},
      __sorted__:(a,k)=>{const c=[...a];if(k)c.sort((x,y)=>{const kx=k(x),ky=k(y);return kx<ky?-1:kx>ky?1:0;});else c.sort((x,y)=>x<y?-1:x>y?1:0);return c;},
    };
    return {...common,
      __round__:py3round,__map__:py3map,__filter__:py3filter,
      __zip__:py3zip,__sorted__:py3sorted,
    };
  }

  // Handle byte string literals b"..." before JS translation
  function preprocessBytes(code){
    // Replace b"..." and b'...' with __bstr__("...")
    return code
      .replace(/b"([^"]*)"/g, '__bstr__("$1")')
      .replace(/b'([^']*)'/g,  "__bstr__('$1')");
  }

  function execCode(source,mode){
    const lines=[],result={output:'',error:null};
    try{
      let code = preprocessBytes(source);
      const env=makeEnv(mode,lines);

      // Add byte string handler to env
      if(mode==='py2'){
        // py2: b"x" == "x" → True (same type)
        env.__bstr__ = s => s;  // just a plain string in py2
      } else {
        // py3: b"x" is a bytes object, != str
        env.__bstr__ = s => {
          const proxy = new Proxy({_s:s,_bytes:true},{
            get(t,k){
              if(k===Symbol.toPrimitive) return ()=>t._s;
              if(k==='toString') return ()=>`b'${t._s}'`;
              if(k==='valueOf') return ()=>t;
              if(k==='__eq__') return other=>false;
              if(typeof k==='number'||k==='0') return t._s.charCodeAt(parseInt(k));
              // index access
              if(!isNaN(k)) return t._s.charCodeAt(parseInt(k));
              return t[k];
            },
            // == comparison: bytes != str always
          });
          return proxy;
        };
      }

      new Function(...Object.keys(env),toJS(code,mode))(...Object.values(env));
      result.output=lines.join('\n')||'(no output)';
    }catch(e){result.error=`${e.constructor?.name||'Error'}: ${e.message}`;}
    return result;
  }

  return {run:src=>({py2:execCode(src,'py2'),py3:execCode(src,'py3')})};
})();

function runExecution(){
  const code=document.getElementById('code-editor').value.trim();
  if(!code)return;
  const {py2,py3}=ExecutionEngine.run(code);
  const py2el=document.getElementById('exec-py2');
  const py3el=document.getElementById('exec-py3');
  if(py2.error){py2el.textContent=py2.error;py2el.className='exec-result err';}
  else{py2el.textContent=py2.output;py2el.className='exec-result'+(py2.output==='(no output)'?' empty':'');}
  if(py3.error){py3el.textContent=py3.error;py3el.className='exec-result err';}
  else{py3el.textContent=py3.output;py3el.className='exec-result'+(py3.output==='(no output)'?' empty':'');}
  const badge=document.getElementById('exec-diff');
  const note=document.getElementById('exec-diff-note');
  const same=(py2.error||py2.output)===(py3.error||py3.output);
  if(same){badge.textContent='outputs match';badge.className='diff-badge diff-same';note.textContent='(check probe table — may diverge on edge-case inputs)';}
  else{badge.textContent='outputs differ';badge.className='diff-badge diff-diff';note.textContent='';}
  document.getElementById('exec-diff-row').style.display='flex';
}


const _origClear2 = clearEditor;
clearEditor = function(){
  _origClear2();
  document.getElementById('exec-py2').textContent='click Analyse to run';
  document.getElementById('exec-py2').className='exec-result empty';
  document.getElementById('exec-py3').textContent='click Analyse to run';
  document.getElementById('exec-py3').className='exec-result empty';
  document.getElementById('exec-diff-row').style.display='none';
};
const _origLoad2 = loadSample;
loadSample = function(name){
  _origLoad2(name);
  runExecution();
};