// layer3.js — Layer 3: concrete value probes
// Simulates Python 2 arithmetic and compares to Python 3.
// Depends on: nothing
// Exports:     PROBES, layer3(findings)














function probeMRO() {
    return [
        { 
            expr: 'Diamond: D(B,C), B(A), C(A)', 
            py2: '[D, B, A, C]', 
            py3: '[D, B, C, A]', 
            diverges: true 
        }
    ];
}

function py2div(a, b) {
  if (Number.isInteger(a) && Number.isInteger(b)) return Math.floor(a / b);
  return a / b;
}

// py2: round-half-up  |  py3: round-half-to-even (banker's)

function py2round(x) {
  return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5);
}

function py3round(x) {
  const floor = Math.floor(x), diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;  // nearest even at exactly .5
}

// ── One probe function per bug type ──────────────────────────────────


function probeDiv() {
  return [[7,2],[3,10],[10,5],[3,7],[1,3]].map(([a,b]) => ({
    expr: `${a} / ${b}`,
    py2:  String(py2div(a, b)),
    py3:  (a/b) % 1 === 0 ? String(a/b) : (a/b).toFixed(4),
    diverges: py2div(a,b) !== a/b,
  }));
}

function probeRound() {
  const vals = [0.5, 1.5, 2.5, 3.5, 4.5];
  const rows = vals.map(v => ({
    expr: `round(${v})`,
    py2:  String(py2round(v)),
    py3:  String(py3round(v)),
    diverges: py2round(v) !== py3round(v),
  }));
  const py2sum = vals.reduce((s,v) => s + py2round(v), 0);
  const py3sum = vals.reduce((s,v) => s + py3round(v), 0);
  rows.push({ expr: 'sum of rounds [0.5..4.5]', py2: String(py2sum), py3: String(py3sum), diverges: py2sum !== py3sum });
  return rows;
}

function probeMapBool() {
  return [
    { expr: 'bool(map(str, []))',        py2: 'False', py3: 'True',  diverges: true  },
    { expr: 'bool(map(str, [1,2,3]))',   py2: 'True',  py3: 'True',  diverges: false },
    { expr: 'len(map(str, [1,2,3]))',    py2: '3',     py3: 'TypeError: no len()', diverges: true },
  ];
}

function probeZip() {
  return [
    { expr: 'z=zip([1,2],[3,4]); dict(z)',  py2: '{1:3,2:4}', py3: '{1:3,2:4}', diverges: false },
    { expr: 'list(z)  ← second pass',       py2: '[(1,3),(2,4)]', py3: '[] (exhausted)', diverges: true },
  ];
}

function probeDictKeys() {
  return [
    { expr: 'd.keys()[0]',        py2: '"first key" (list)', py3: 'TypeError: not subscriptable', diverges: true },
    { expr: 'd.keys().sort()',     py2: 'sorts in place',     py3: 'AttributeError: no .sort()',  diverges: true },
    { expr: 'd.keys() & d2.keys()',py2: 'TypeError',          py3: 'set intersection — works!',   diverges: true },
  ];
}

function probeBytesStr() {
  return [
    { expr: 'b"hello" == "hello"', py2: 'True  (coercion)',  py3: 'False (always)',    diverges: true },
    { expr: 'b"hi"[0]',            py2: '"h"   (char)',       py3: '104   (int ASCII)', diverges: true },
  ];
}

// Registry: maps probe.type → probe function


const PROBES = {
  division:  probeDiv,
  rounding:  probeRound,
  map_bool:  probeMapBool,
  zip:       probeZip,
  dict_keys: probeDictKeys,
  bytes_str: probeBytesStr,
  mro:       probeMRO,
};


function layer3(findings) {
  // Collect only the probe types that appear in the findings
  const needed = new Set(
    findings.filter(f => f.probe).map(f => f.probe.type)
  );

  const rows = [];
  needed.forEach(type => {
    if (PROBES[type]) rows.push(...PROBES[type]());
  });
  return rows;
}

