# MVP Design: Time-Travel Architecture Diffing

## 1. Inputs
- **MVP Scope:** Two previously generated CodeFlowViz static JSON graph files (e.g., `graph-base.json` and `graph-head.json`).
- This avoids arbitrary Git fetching and tree-parsing in the first iteration, keeping the diff logic pure and isolated.

## 2. Normalized Graph Format & Matching Rules
- Nodes will be matched by a composite key: `filePath + symbolSignature`.
- Edges will be matched by `sourceNodeKey + targetNodeKey`.

## 3. Added/Removed/Modified Semantics
- **Added:** Node/Edge exists in `head` but not in `base` (Visual: Green, `+` badge).
- **Removed:** Node/Edge exists in `base` but not in `head` (Visual: Red, strikethrough, or ghosted).
- **Modified:** Node exists in both, but metadata (like cyclomatic complexity) has changed (Visual: Yellow/Orange).

## 4. UI States
- A toggle switch in the UI: "Standard View" vs "Diff View".
- In Diff View, unchanged nodes can optionally be faded out (opacity 30%) to highlight structural changes.

## 5. Regression Tests
- Create mock JSON graphs representing `commit A` and `commit B`.
- Unit tests to ensure the diffing algorithm accurately tags `status: "added" | "removed" | "modified" | "unchanged"` on all nodes and edges.
