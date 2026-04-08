/**
 * ui.js - DOM Manipulation
 */
export const SAMPLES = {
    division: `print(7 / 2)\nprint(10 / 5)`,
    print: `print "Hello World"\n# Try changing this to print("Hello")`
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
        const summary = document.getElementById('summary-bar');
        
        if (!findings.length) {
            list.innerHTML = `<div class="ok-banner">✓ No migration issues detected</div>`;
            summary.style.display = 'none';
            return;
        }

        summary.style.display = 'flex';
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
    },

    renderProbes(probes) {
        const section = document.getElementById('probe-section');
        const container = document.getElementById('probe-rows');
        if (!probes.length) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        container.innerHTML = probes.map(p => `
            <div class="probe-row">
                <span class="probe-expr">${p.expr}</span>
                <span class="probe-py2">${p.py2}</span>
                <span class="probe-py3">${p.py3}</span>
                <span class="probe-diff ${p.diverges ? 'bug' : 'ok'}">${p.diverges ? '⚠' : '✓'}</span>
            </div>
        `).join('');
    },

    renderExecution(results) {
        const py2el = document.getElementById('exec-py2');
        const py3el = document.getElementById('exec-py3');

        const updateEl = (el, res) => {
            el.textContent = res.error || res.output || '(no output)';
            el.className = 'exec-result' + (res.error ? ' err' : '');
        };

        updateEl(py2el, results.py2);
        updateEl(py3el, results.py3);
    }
};