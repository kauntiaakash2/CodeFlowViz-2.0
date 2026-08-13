# MVP Design: Real-time Collaborative Code Flow Visualization

## 1. Room/Session Lifecycle
- **Creation:** A user clicks "Start Session" generating a unique, secure Room ID (UUIDv4).
- **Joining:** Participants join via URL containing the Room ID.
- **Termination:** The session closes automatically when the last participant disconnects, with an inactivity timeout of 30 minutes.

## 2. Participant Identity
- **MVP Scope:** Anonymous with display names (e.g., "User-123", "Guest-Alice"). No strict auth integration required for the MVP to minimize complexity.

## 3. Synchronization Model (WebSocket/WebRTC)
- **Protocol:** WebSockets via Socket.io/Yjs for reliable real-time document synchronization. WebRTC is deferred to v2 due to firewall/NAT traversal complexities.
- **State Management:** CRDTs (Conflict-free Replicated Data Types) via `Yjs` to manage the graph state (nodes, edges, node positions).

## 4. Conflict Handling
- Handled implicitly by `Yjs` CRDTs. Concurrent modifications to the same node position will resolve deterministically based on the last-writer-wins (timestamp-based) policy within the CRDT.

## 5. Persistence Limits
- **MVP:** In-memory only on the signaling server. If the server restarts, session state is lost. Users can "Export" the graph state manually.

## 6. Security Controls
- **Rate Limiting:** WebSocket connections limited to 100 messages/sec per client.
- **Sanitization:** All broadcasted graph payloads are sanitized to prevent XSS in node labels.

## 7. Tests
- **Unit:** Test CRDT state updates with mocked concurrent users.
- **E2E:** Playwright/Cypress tests simulating two browser contexts joining the same room and moving a node.
