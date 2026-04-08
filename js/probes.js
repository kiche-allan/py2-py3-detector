/**
 * probes.js - Comparison Probe Engine
 */
export const ProbeEngine = {
    run(findings) {
        const needed = new Set(findings.filter(f => f.probe).map(f => f.probe.type));
        const rows = [];

        if (needed.has('division')) {
            const pairs = [[7, 2], [3, 10], [10, 5]];
            pairs.forEach(([a, b]) => {
                rows.push({
                    expr: `${a} / ${b}`,
                    py2: Math.floor(a / b),
                    py3: (a / b).toFixed(1),
                    diverges: Math.floor(a / b) !== (a / b)
                });
            });
        }
        return rows;
    }
};