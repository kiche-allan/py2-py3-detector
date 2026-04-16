// main.js — entry point
// Calls all three layers, renders output to the DOM.
// Depends on: layer1.js, layer2.js, layer3.js
// Exports:     analyse(), render()

function analyse() {
  const code = document.getElementById('editor').value.trim();
  if (!code) return;

  // Runs the three layers
  const l1  = layer1(code);
  const l2  = layer2(code);
  const all = [...l1, ...l2].sort((a, b) => a.line - b.line);
  //conditional logic, only run layer3 if there are findings with a probe field
    const hasProbes = all.some(f => f.probe);
    const probes    = hasProbes ? layer3(all) : [];

  // Render
  document.getElementById('output').innerHTML = render(all, probes);
}


function render(findings, probes) {
  let html = '';

  // ── Findings ────────────────────────────────────────────────────
  if (findings.length === 0) {
    html += `<div class="no-findings">✓ No migration issues found</div>`;
  } else {
    html += `<div class="section-title">${findings.length} finding${findings.length !== 1 ? 's' : ''}</div>`;
    findings.forEach(f => {
      html += `
        <div class="finding ${f.severity}">
          <span class="sev ${f.severity}">${f.severity}</span>
          <span class="rule-id"> · ${f.rule} · line ${f.line}</span>
          <div class="msg">${f.message}</div>
          <div class="snippet">${f.snippet}</div>
          <div class="compare">
            <div class="py2-box"><div class="ver-label">Python 2</div>${f.py2}</div>
            <div class="py3-box"><div class="ver-label">Python 3</div>${f.py3}</div>
          </div>
        </div>`;
    });
  }

  // ── Probe table ─────────────────────────────────────────────────
  if (probes.length > 0) {
    html += `<div class="section-title">computed values — actual py2 vs py3</div>`;
    html += `<table class="probe-table">
      <tr><th>expression</th><th>Python 2</th><th>Python 3</th><th>result</th></tr>`;
    probes.forEach(p => {
      html += `<tr>
        <td>${p.expr}</td>
        <td style="color:#e8673a">${p.py2}</td>
        <td style="color:#4a9eff">${p.py3}</td>
        <td class="${p.diverges ? 'diverges' : 'same'}">${p.diverges ? '⚠ DIVERGES' : '✓ same'}</td>
      </tr>`;
    });
    html += `</table>`;
  }

  return html;
}