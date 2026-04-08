/**
 * main.js - Entry Point
 */
import { PreParsedRules, SemanticRules } from './rules.js';
import { ProbeEngine } from './probes.js';
import { ExecutionEngine } from './engine.js';
import { UI, SAMPLES } from './ui.js';

const handleAnalyse = () => {
    const code = document.getElementById('code-editor').value;
    const findings = [...PreParsedRules.run(code), ...SemanticRules.run(code)];
    const probes = ProbeEngine.run(findings);
    const exec = ExecutionEngine.run(code);

    UI.renderFindings(findings);
    // Add logic here to call UI.renderProbes and UI.renderExecution
};

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-analyse').addEventListener('click', handleAnalyse);
    document.getElementById('btn-clear').addEventListener('click', () => {
        document.getElementById('code-editor').value = '';
        UI.updateLineNumbers();
    });

    const sampleContainer = document.getElementById('sample-container');
    Object.keys(SAMPLES).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'sample-chip';
        btn.textContent = key;
        btn.onclick = () => {
            document.getElementById('code-editor').value = SAMPLES[key];
            UI.updateLineNumbers();
        };
        sampleContainer.appendChild(btn);
    });

    UI.updateLineNumbers();
});