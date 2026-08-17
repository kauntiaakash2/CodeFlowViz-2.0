# MVP Design: Security Vulnerability Taint Analysis

## 1. Supported Language & Scope
- **Language:** JavaScript/TypeScript (Node.js/Express).
- **Scope:** Intra-procedural and basic Inter-procedural flow (max depth of 3 function calls) to maintain performance and avoid state explosion.

## 2. Sources, Sinks, and Sanitizers
- **Sources:** `req.body`, `req.query`, `req.params`.
- **Sinks:** `eval()`, `child_process.exec()`, standard SQL driver query functions (e.g., `db.query()`).
- **Sanitizers:** Standard validator libraries (e.g., `validator.escape()`, `parseInt()`). Data passing through these drops the "tainted" flag.

## 3. False-Positive Handling
- **MVP Approach:** The visualization will mark the path as "Potentially Tainted" (Orange/Red dashed line) rather than a definite vulnerability. Users can manually flag a node as "Safe" in the UI to dismiss false positives.

## 4. Visualization Contract
- Tainted data flows will overwrite standard edge colors with high-contrast red.
- Source nodes will get a "Biohazard/Warning" icon.
- Sink nodes will get a "Target" icon.

## 5. Security Regression Tests
- `tests/taint/positive/`: Sample Express routes with direct injection (should flag).
- `tests/taint/negative/`: Sample Express routes utilizing `parseInt()` or strict validators (should not flag).
