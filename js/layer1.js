const LAYER1_RULES = [
  {
    id: "PRINT_STMT",
    severity: "medium",
    pattern: /^print\s+[^(]/,
    message: "print as statement — SyntaxError in py3",
    py2: 'print "x"  →  outputs normally',
    py3: "SyntaxError: Missing parentheses in call to print",
  },
  {
    id: "EXCEPT_COMMA",
    severity: "high",
    pattern: /except\s+\w[\w.]*\s*,\s*\w+\s*:/,
    message: "except Foo, e: — SyntaxError in py3",
    py2: "except ValueError, e:  →  catches and binds to e",
    py3: "SyntaxError — use: except ValueError as e:",
  },
  {
    id: "UNICODE_BUILTIN",
    severity: "high",
    pattern: /\bunicode\s*\(/,
    message: "unicode() does not exist in py3",
    py2: 'unicode("x")  →  unicode string',
    py3: 'NameError: name "unicode" is not defined',
  },
  {
    id: "HAS_KEY",
    severity: "medium",
    pattern: /\.has_key\s*\(/,
    message: "dict.has_key() removed in py3",
    py2: 'd.has_key("x")  →  True / False',
    py3: 'AttributeError: dict has no attribute "has_key"',
  },
  {
    id: "XRANGE",
    severity: "medium",
    pattern: /\bxrange\s*\(/,
    message: "xrange() removed — use range()",
    py2: "xrange(N)  →  lazy iterator",
    py3: 'NameError: name "xrange" is not defined',
  },
  {
    id: "RAW_INPUT",
    severity: "medium",
    pattern: /\braw_input\s*\(/,
    message: "raw_input() removed — use input()",
    py2: "raw_input()  →  str (safe)",
    py3: 'NameError: name "raw_input" is not defined',
  },
  {
    id: "EXEC_STMT",
    severity: "medium",
    pattern: /^exec\s+[^(]/,
    message: "exec as statement — use exec() in py3",
    py2: 'exec "code"  →  executes string',
    py3: 'SyntaxError — use: exec("code")',
  },
  {
    id: "RAISE_COMMA",
    severity: "high",
    pattern: /^raise\s+\w[\w.]*\s*,/,
    message: "raise Exc, msg — old py2 syntax",
    py2: 'raise ValueError, "msg"  →  raises ValueError',
    py3: 'SyntaxError — use: raise ValueError("msg")',
  },
];

function layer1(code) {
  const findings = [];
  const lines = code.split("\n");

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim(); // strip indentation
    const lineNo = index + 1; // 1-based line numbers

    if (line.startsWith("#")) return;

    LAYER1_RULES.forEach((rule) => {
      if (rule.pattern.test(line)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          line: lineNo,
          snippet: line,
          message: rule.message,
          py2: rule.py2,
          py3: rule.py3,
        });
      }
    });
  });

  return findings;
}
