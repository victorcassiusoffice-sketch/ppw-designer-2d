# Game world bug register

S0 sweep, 10 November 2026. The phone sizes are CSS pixels.

| Priority | Route and size | Reproduce | Status |
|---|---|---|---|
| P1 | /demo plan, 313 × 567 and 390 × 844 | Carry a product. The controls wrap across the middle of the small plan. The Help launcher can intercept Cancel. | Open in takeover baseline |
| P2 | /demo plan, 313 × 567 | Open the floor picker. Only part of the current floor name is visible. Draw a wall. Tool rows leave very little height for the plan. | Open in takeover baseline |
| P2 | /demo house view, 313 × 567 | Read the Foundation, Surfaces and Materials buttons. The rail distributes less width than the labels need. | Open in takeover baseline |
| P2 | /demo, City | Enter 3D, return to 2D, then enter 3D again. Cleanup explicitly loses the WebGL context. Undo a change and look for Redo in City. | Open in takeover baseline |
| P2 | /pitch/developers, desktop and phones | Load with an empty cache. Currency bootstrap makes an unnecessary cross-origin request and Chromium reports two errors. | Reproduced locally |
| P2 | /demo, Walk | Step past the building onto uncovered land. Walk resets to spawn. An invalid stair fit can still draw a flight without a climb surface. | S1 ground and stair collision |
