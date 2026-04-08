/**
 * ui.js - DOM Controller
 */

export const SAMPLES = {
    division: `print(7 / 2)\nprint(10 / 5)`,
    iterator: `z = zip([1,2], [3,4])\nprint(list(z))\nprint(list(z)) # Empty in Py3!`
};

export const UI = {
    esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    updateLineNumbers() {
        const editor = document.getElementById('code-editor');
        const lines = editor.value.split('\n').length;
        const panel = document.getElementById('line-numbers');
        panel.innerHTML = Array.from({ length: Math.max(lines, 20) }, (_, i) => `<span>${i + 1}</span>`).join('');
    },

    renderFindings(findings) {
        const list = document.getElementById('findings-list');
        if (!findings.length) {
            list.innerHTML = `<div class="ok-banner">✓ No migration issues detected</div>`;
            return;
        }

        list.innerHTML = findings.map((f, i) => `
            <div class="finding" id="f-${i}">
                <div class="finding-head" onclick="this.parentElement.classList.toggle('open')">
                    <span class="sev-badge sev-${f.severity}">${f.severity}</span>
                    <div class="finding-msg">${this.esc(f.message)}</div>
                    <div class="finding-line">Line ${f.line}</div>
                </div>
                <div class="finding-body">
                    <div class="snippet-box">${this.esc(f.snippet)}</div>
                    <p class="detail-text">${this.esc(f.detail)}</p>
                </div>
            </div>
        `).join('');
    }
};