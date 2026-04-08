/**
 * rules.js - Layer 1 (Syntax) & Layer 2 (Semantic AST Analysis)
 */

export const PreParsedRules = {
    /**
     * Layer 1: Tokenizer level (Regex)
     * Detects patterns that are SyntaxErrors in Python 3.
     */
    run(code) {
        const findings = [];
        const lines = code.split('\n');

        lines.forEach((line, i) => {
            const s = line.trim();
            const lineno = i + 1;
            if (s.startsWith('#') || !s) return;

            // 1. Print as statement
            if (/^print\s+[^(]/.test(s)) {
                findings.push({
                    rule: 'PRINT_STMT',
                    severity: 'medium',
                    line: lineno,
                    snippet: s,
                    message: 'print used as statement — SyntaxError in py3',
                    py2: 'print "text"',
                    py3: 'SyntaxError: Missing parentheses'
                });
            }

            // 2. Except comma syntax
            if (/except\s+\w[\w.]*\s*,\s*\w+\s*:/.test(s)) {
                findings.push({
                    rule: 'EXCEPT_COMMA',
                    severity: 'high',
                    line: lineno,
                    snippet: s,
                    message: 'except Foo, e: is a SyntaxError in py3',
                    py2: 'except Foo, e:',
                    py3: 'SyntaxError — use: except Foo as e:'
                });
            }
        });
        return findings;
    }
};

export const SemanticAnalyzer = {
    /**
     * Layer 2: Semantic Analysis
     * Entry point that triggers the manual recursive walker.
     */
    analyze(ast) {
        const findings = [];
        this.walk(ast, (node) => {
            this.checkIntegerDivision(node, findings);
            this.checkDictionaryMethods(node, findings);
            this.checkRounding(node, findings);
            this.checkUnicodeLiterals(node, findings);
        });
        return findings;
    },

    /**
     * The Manual Walker (Implementation Detail for Action Item 19:01)
     * Recursively traverses every node in the AST without external abstractions.
     */
    walk(node, callback) {
        if (!node || typeof node !== 'object') return;

        callback(node);

        for (const key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key)) {
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(c => this.walk(c, callback));
                } else if (child && typeof child === 'object') {
                    this.walk(child, callback);
                }
            }
        }
    },

    // ── Semantic Check Methods ──────────────────────────────────

    checkIntegerDivision(node, findings) {
        if (node.type === 'BinaryExpression' && node.operator === '/') {
            const leftIsInt = node.left.type === 'Literal' && Number.isInteger(node.left.value);
            const rightIsInt = node.right.type === 'Literal' && Number.isInteger(node.right.value);

            if (leftIsInt && rightIsInt) {
                findings.push({
                    rule: 'INT_DIV',
                    severity: 'critical',
                    line: node.loc?.start.line || '?',
                    message: 'Semantic Divergence: Integer division behavior differs.',
                    py2: `${node.left.value} / ${node.right.value} = ${Math.floor(node.left.value / node.right.value)}`,
                    py3: `${node.left.value} / ${node.right.value} = ${node.left.value / node.right.value}`
                });
            }
        }
    },

    checkRounding(node, findings) {
        // Targets 'CallExpression' nodes where the function name is 'round'
        if (node.type === 'CallExpression' && node.callee.name === 'round') {
            findings.push({
                rule: 'ROUNDING',
                severity: 'critical',
                line: node.loc?.start.line || '?',
                message: "round() divergence (Banker's Rounding)",
                detail: "Py2 rounds 0.5 away from zero; Py3 rounds to the nearest even number.",
                py2: "round(0.5) = 1.0",
                py3: "round(0.5) = 0"
            });
        }
    },

    checkDictionaryMethods(node, findings) {
        if (node.type === 'CallExpression' && node.callee.property?.name === 'keys') {
            findings.push({
                rule: 'DICT_KEYS',
                severity: 'high',
                line: node.loc?.start.line || '?',
                message: 'dict.keys() returns a view in Py3, not a list.',
                detail: 'Views do not support indexing or .sort() in Python 3.'
            });
        }
    },

    checkUnicodeLiterals(node, findings) {
        // Detects 'u' prefix in strings which is redundant or valid depending on Py3 version
        if (node.type === 'Literal' && typeof node.value === 'string' && node.raw?.startsWith('u')) {
            findings.push({
                rule: 'UNICODE_PREFIX',
                severity: 'medium',
                line: node.loc?.start.line || '?',
                message: "Unicode 'u' prefix detected.",
                detail: "In Py3, all strings are Unicode by default. The 'u' prefix was removed in 3.0 and restored in 3.3 for compatibility."
            });
        }
    }
};