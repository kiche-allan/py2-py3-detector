/**
 * engine.js - Execution Simulation
 */
export const ExecutionEngine = {
    run(source) {
        const results = { 
            py2: { output: '', error: null }, 
            py3: { output: '', error: null } 
        };
        
        const lines = source.split('\n');
        let py2Out = [];
        let py3Out = [];

        try {
            lines.forEach(line => {
                const s = line.trim();
                if (!s || s.startsWith('#')) return;

                // Simulate Print Logic
                if (s.startsWith('print(')) {
                    const val = s.match(/\((.*)\)/)?.[1];
                    py2Out.push(val);
                    py3Out.push(val);
                } else if (s.startsWith('print ')) {
                    const val = s.replace('print ', '').replace(/['"]/g, '');
                    py2Out.push(val);
                    results.py3.error = "SyntaxError: Missing parentheses in call to 'print'";
                }

                // Simulate Division Logic
                if (s.includes(' / ')) {
                    const parts = s.split('/');
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                        py2Out.push(Math.floor(eval(s)));
                        py3Out.push(eval(s));
                    }
                }
            });

            results.py2.output = py2Out.join('\n');
            if (!results.py3.error) results.py3.output = py3Out.join('\n');
            
        } catch (e) {
            results.py3.error = "Execution Error: " + e.message;
        }

        return results;
    }
};