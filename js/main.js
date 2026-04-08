/**
 * main.js - Coordination logic
 * Integrating Manual AST Walker for Layer 2
 */
import { PreParsedRules, SemanticAnalyzer } from "./rules.js";
import { ProbeEngine } from "./probes.js";
import { ExecutionEngine } from "./engine.js";
import { UI, SAMPLES } from "./ui.js";

// Note: Ensure filbert.js is loaded in index.html via <script>
// or imported if using a bundler.

const handleAnalyse = () => {
  const code = document.getElementById("code-editor").value;
  if (!code.trim()) return;

  // --- LAYER 1: Pre-Parse (Regex) ---
  const findingsL1 = PreParsedRules.run(code);

  // --- LAYER 2: Semantic Analysis (Manual AST Walker) ---
  let findingsL2 = [];
  try {
    // We use filbert to get the JSON AST.
    // {locations: true} is critical so the walker knows what line to report.
    const ast = filbert.parse(code, { locations: true });

    // This calls your transparent, manual recursive walker
    findingsL2 = SemanticAnalyzer.analyze(ast);
  } catch (e) {
    console.warn("AST Parsing skipped or failed: ", e.message);
    // If parsing fails (e.g., Python syntax is too broken),
    // we still have Layer 1 findings to show.
  }

  // Combine findings from both layers
  const allFindings = [...findingsL1, ...findingsL2].sort(
    (a, b) => a.line - b.line,
  );

  // --- LAYER 3: Dynamic Probes & Execution ---
  const probes = ProbeEngine.run(allFindings);
  const execResults = ExecutionEngine.run(code);

  // --- UI UPDATES ---
  UI.renderFindings(allFindings);
  UI.renderProbes(probes);
  UI.renderExecution(execResults);

  document.getElementById("run-status").textContent =
    `Analysis complete: ${allFindings.length} issues found.`;
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  // Analyse Button
  document
    .getElementById("btn-analyse")
    .addEventListener("click", handleAnalyse);

  // Clear Button
  document.getElementById("btn-clear").addEventListener("click", () => {
    document.getElementById("code-editor").value = "";
    UI.updateLineNumbers();
    document.getElementById("run-status").textContent = "";
  });

  // Keyboard Shortcut (Ctrl+Enter)
  document.getElementById("code-editor").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAnalyse();
    }
  });

  // Inject Samples into the UI
  const sampleContainer = document.getElementById("sample-container");
  if (sampleContainer) {
    Object.keys(SAMPLES).forEach((key) => {
      const btn = document.createElement("button");
      btn.className = "sample-chip";
      btn.textContent = key;
      btn.onclick = () => {
        document.getElementById("code-editor").value = SAMPLES[key];
        UI.updateLineNumbers();
        handleAnalyse();
      };
      sampleContainer.appendChild(btn);
    });
  }

  UI.updateLineNumbers();
});
