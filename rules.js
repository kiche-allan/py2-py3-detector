/**
 * rules.js — Modern ES6 Logic
 */

export const PreParsedRules = {
  run(code) {
    const findings = [];
    const lines = code.split('\n');

    lines.forEach((line, i) => {
      const s = line.trim();
      const lineno = i + 1;

      if (s.startsWith('#')) return;

      // Print as statement
      if (/^print\s+[^(]/.test(s)) {
        findings.push({
          rule: 'PRINT_STMT',
          severity: 'medium',
          line: lineno,
          snippet: s,
          message: 'print used as statement — SyntaxError in py3',
          detail: `Python 3 requires print() as a function call. 
                   The py2 'print "x",' equivalent is 'print("x", end="")'.`,
          py2: 'print statement: outputs text',
          py3: 'SyntaxError: Missing parentheses',
        });
      }

      // Except comma syntax
      if (/except\s+\w[\w.]*\s*,\s*\w+\s*:/.test(s)) {
        findings.push({
          rule: 'EXCEPT_COMMA',
          severity: 'high',
          line: lineno,
          snippet: s,
          message: 'except Foo, e: is a SyntaxError in py3',
          detail: 'Use "except Foo as e:" instead.',
          py2: 'except Foo, e: → catches and binds',
          py3: 'SyntaxError — use: except Foo as e:',
        });
      }

      // unicode() builtin
      if (/\bunicode\s*\(/.test(s)) {
        findings.push({
          rule: 'UNICODE_BUILTIN',
          severity: 'high',
          line: lineno,
          snippet: s,
          message: 'unicode() builtin removed in py3',
          detail: 'Replace unicode(x) with str(x).',
          py2: 'unicode("x") → unicode string',
          py3: 'NameError: name "unicode" is not defined',
        });
      }
    });

    return findings;
  }
};

export const SemanticRules = {
  matchLines: (code, pattern) => 
    code.split('\n')
      .map((line, i) => ({ line: i + 1, snippet: line.trim() }))
      .filter(({ snippet }) => !snippet.startsWith('#') && pattern.test(snippet)),

  run(code) {
    const findings = [];

    // Integer Division
    this.matchLines(code, /[^<>=!/*][^<>=!/*]\s*\/\s*[^/=*]/).forEach(({ line, snippet }) => {
      if (/https?:\/\//.test(snippet)) return;
      findings.push({
        rule: 'INT_DIV',
        severity: 'critical',
        line,
        snippet,
        message: '/ operator behavior change',
        detail: 'py2 floors integers (7/2=3), py3 returns float (7/2=3.5).',
        py2: '7/2 = 3',
        py3: '7/2 = 3.5',
        probe: { type: 'division' },
      });
    });

    return findings;
  }
};