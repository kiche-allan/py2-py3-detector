# Python 2↔3 Detection Harness

A web-based tool for analyzing Python code and detecting compatibility issues between Python 2 and Python 3. Identify syntax errors, behavioral differences, and hidden bugs that could arise from Python version migration.

## Features

- **Real-time Analysis**: Paste Python code and instantly get compatibility warnings
- **Multiple Severity Levels**:
  - 🔴 **Critical** - Code that will fail in Python 3
  - 🟠 **High** - Significant compatibility issues
  - 🟡 **Medium** - Subtle differences that may cause problems
  - 🟣 **Hidden** - Edge cases and behavioral divergences

- **Dynamic Probes**: Compare actual runtime behavior between Python versions
- **Pattern Detection**: Comprehensive rule set covering:
  - Print statements (`print x` vs `print(x)`)
  - Exception handling (`except E, e:` vs `except E as e:`)
  - Integer division (`1/2` returns different values)
  - Dictionary methods (`.keys()`, `.values()`, `.items()`)
  - String/bytes handling
  - Iterator behavior (`.next()` vs `__next__()`)
  - And many more patterns

- **Code Samples**: Pre-loaded examples to explore common Python 2/3 issues
- **Modern UI**: Dark mode editor with monospace font and syntax highlighting

## Usage

1. Open `py2-py3.html` in a web browser
2. Either:
   - Paste Python code in the editor
   - Click a sample button to load pre-made examples
3. Click **Analyse** to run detection
4. Review findings organized by severity
5. Check for dynamic probes showing actual divergence values

## Installation

No installation required! Just open the HTML file in any modern web browser.

```bash
# Clone the repository
git clone https://github.com/yourusername/py2-py3-detector.git

# Navigate to the directory
cd py2-py3-detector

# Open in browser (or just double-click the HTML file)
open py2-py3.html
```

## How It Works

The detection engine uses multiple analysis strategies:

1. **Tokenizer-level Rules**: Pattern matching on raw code lines
2. **AST-based Analysis**: Abstract Syntax Tree inspection for semantic understanding
3. **Dynamic Execution**: Runs probe code snippets to detect behavioral differences
4. **Heuristic Detection**: Identifies hidden bugs and subtle migration issues

## Supported Python 2/3 Issues

- Print statements vs functions
- Exception handling syntax
- Integer division differences
- Dictionary iteration changes
- String/bytes differences
- Iterator protocol changes
- Octal and hexadecimal literals
- Unicode strings
- Import statements

## Key Sample Codes

- **division**: Shows 1/2 behavior difference
- **rounding**: Compares rounding behavior
- **iterators**: Tests iterator and generator changes
- **dict.keys**: Demonstrates dictionary method differences
- **bytes/str**: Explores string/bytes handling
- **hidden bug**: Reveals subtle compatibility issues
- **django migration**: Real-world Django code migration example
- **all patterns**: Comprehensive feature showcase

