# Game world bug register

S0 sweep, 10 November 2026. The phone sizes are CSS pixels.

| Priority | Route and size | Reproduce | Status |
|---|---|---|---|
| P1 | /demo plan, 313 × 567 and 390 × 844 | Carry a product. The controls wrap across the middle of the small plan. The Help launcher can intercept Cancel. | Fixed in S0 |
| P2 | /demo plan, 313 × 567 | Open the floor picker. Only part of the current floor name is visible. Draw a wall. Tool rows leave very little height for the plan. | Fixed in S0 |
| P2 | /demo house view, 313 × 567 | Read the Foundation, Surfaces and Materials buttons. The rail distributes less width than the labels need. | Fixed in S0 |
| P2 | /demo, City | Enter 3D, return to 2D, then enter 3D again. Cleanup explicitly loses the WebGL context. Undo a change and look for Redo in City. | Fixed in S0 |
| P2 | /pitch/developers, desktop and phones | Load with an empty cache. Currency bootstrap makes an unnecessary cross-origin request and Chromium reports two errors. | Fixed in S0; zero exchange-rate requests |
| P2 | /demo, Walk | Step past the building onto uncovered land. Walk resets to spawn. An invalid stair fit can still draw a flight without a climb surface. | Fixed in S1. Plot and garden support, last grounded position, and explicit invalid-stair recovery passed on both brands. |

S0 local checks on both branded shells at 1280 × 800, 390 × 844 and 313 × 567 covered Plan, product placement, wall drawing, House, Walk, City 3D remount and the developer pitch. On the smallest phone the floor selector grew from 44 to 110 CSS pixels. The wall viewport grew from 97 to 208 pixels. The placement row measures 54 pixels, sits outside the viewport and keeps Cancel visible.
