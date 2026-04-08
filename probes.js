/**
 * engine-probes.js — Modern Logic
 */

const py2Div = (a, b) => (Number.isInteger(a) && Number.isInteger(b)) ? Math.floor(a / b) : a / b;

const py3Round = (x) => {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff !== 0.5) return Math.round(x);
  return floor % 2 === 0 ? floor : floor + 1;
};

const divisionProbes = () => {
  const pairs = [[7, 2], [3, 10], [10, 4]];
  return pairs.map(([a, b]) => {
    const p2 = py2Div(a, b);
    const p3 = a / b;
    return {
      expr: `${a} / ${b}`,
      py2: String(p2),
      py3: p3.toFixed(2),
      diverges: p2 !== p3
    };
  });
};

export const ProbeEngine = {
  run(findings) {
    const needed = new Set(findings.filter(f => f.probe).map(f => f.probe.type));
    const rows = [];

    if (needed.has('division')) rows.push(...divisionProbes());
    // Add other probes here...

    return rows;
  }
};