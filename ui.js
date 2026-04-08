/**
 * ui.js — Modern DOM interactions
 */
import { PreParsedRules, SemanticRules } from './rules.js';
import { ProbeEngine } from './probes.js';

const escHtml = (s) => String(s).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

export const runAnalysis = () => {
  const editor = document.getElementById('code-editor');
  const code = editor.value.trim();
  if (!code) return;

  const t0 = performance.now();

  // Combine findings using Spread Operator
  const findings = [
    ...PreParsedRules.run(code),
    ...SemanticRules.run(code)
  ].sort((a, b) => a.line - b.line);

  const probes = ProbeEngine.run(findings);
  const elapsed = (performance.now() - t0).toFixed(1);

  renderFindings(findings);
  console.log(`Analysis complete in ${elapsed}ms`);
};

const renderFindings = (findings) => {
  const list = document.getElementById('findings-list');
  
  // Using Template Literals for cleaner HTML generation
  list.innerHTML = findings.map((f, idx) => `
    <div class="finding" id="f-${idx}">
      <div class="finding-head">
        <span class="sev-badge sev-${f.severity}">${f.severity}</span>
        <div class="finding-msg">${escHtml(f.message)}</div>
      </div>
      <div class="finding-body">
        <div class="snippet-box">${escHtml(f.snippet)}</div>
        <p>${escHtml(f.detail)}</p>
      </div>
    </div>
  `).join('');
};