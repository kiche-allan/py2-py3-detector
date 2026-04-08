/**
 * rules.js - Layer 1 & 2 Logic
 */

export const PreParsedRules = {
    run(code) {
        const findings = [];
        const lines = code.split('\n');

        lines.forEach((line, i) => {
            const s = line.trim();
            const lineno = i + 1;
            if (s.startsWith('#') || !s) return;

            // print statement
            if (/^print\s+[^(]/.test(s)) {
                findings.push({
                    rule: 'PRINT_STMT', severity: 'medium', line: lineno, snippet: s,
                    message: 'print used as statement — SyntaxError in py3',
                    detail: 'Python 3 requires parentheses for print().',
                    py2: 'print "text"', py3: 'SyntaxError'
                });
            }

            // xrange
            if (/\bxrange\s*\(/.test(s)) {
                findings.push({
                    rule: 'XRANGE', severity: 'medium', line: lineno, snippet: s,
                    message: 'xrange() removed in py3',
                    detail: 'Use range() instead; it is lazy by default in Python 3.',
                    py2: 'xrange(n)', py3: 'NameError'
                });
            }
        });
        return findings;
    }
};

export const SemanticRules = {
    matchLines(code, pattern) {
        return code.split('\n').reduce((acc, line, i) => {
            if (!line.trim().startsWith('#') && pattern.test(line)) {
                acc.push({ line: i + 1, snippet: line.trim() });
            }
            return acc;
        }, []);
    },

    run(code) {
        const findings = [];
        
        // Integer Division
        this.matchLines(code, /[^<>=!/*][^<>=!/*]\s*\/\s*[^/=*]/).forEach(({ line, snippet }) => {
            if (/https?:\/\//.test(snippet)) return;
            findings.push({
                rule: 'INT_DIV', severity: 'critical', line, snippet,
                message: '/ operator behavior change',
                detail: 'py2 floors integers (7/2=3), py3 returns float (7/2=3.5).',
                py2: '7/2 = 3', py3: '7/2 = 3.5',
                probe: { type: 'division' }
            });
        });

        return findings;
    }
};