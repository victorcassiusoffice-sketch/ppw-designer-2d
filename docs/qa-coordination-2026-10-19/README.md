# Coordination dashboard QA — 2026-10-19

Scope: compiled Vite preview at http://127.0.0.1:5173. No cloud mutations, emails, orders, invoices, migrations or production actions.

Run: `node tools/coordination-shot-2026-10-19.mjs http://127.0.0.1:5173`.

- Desktop 1280 × 900 and phone 390 × 844: 18 final PNGs. Browser console/page errors: 0. Attempted API writes: 0. Horizontal workspace/content overflow: 0.
- All six stations exercised. Supplier station shows only its assigned package. All eight handoff steps navigate to their existing review sections.
- Handoff exports parse as versioned JSON with local scope, canonical component IDs and delivery references. Exports do not sum different units or create orders.
- Real UI sample plus linked house produces 16 city packages + 3 house packages. The sample's independent building envelope stays a coordination placeholder; the separately linked detailed house envelope is excluded.
- Road width changed through the City inspector from 6 m to 8 m. Union surface volume changes from 124.2 m³ to 146.1 m³. Component count remains 19, assignment/date/notes survive sync, and reopening does not create another revision.
- Visual fixes: mobile role labels now use the full available width; the selected navigation tab reveals itself after contextual review navigation. Supplier package count grammar corrected.
- Date handling: delivery comparison and handoff export use Mauritius civil dates, including the 20:00 UTC local-midnight boundary. A current-looking but blocked imported release acknowledgement is shown as blocked, not acknowledged.
- Focused model/component tests: 37 passed across sharedBuildAdapter, sharedCoordination and SharedProjectWorkbench. Scoped ESLint passes.

Visual inspection: selected controls, labels, action cards, delivery lists and review buttons remain accessible. The phone navigation is intentionally horizontally scrollable; the active tab stays visible. Eight-step workflow and detailed queues scroll vertically within the workspace. Back to Build stays fixed and accessible.

Limits: the public pilot persists only in its browser. Shared cloud activation, identity/membership setup and migration0032 remain separate. Building/data-centre envelopes are not full construction quantities. Combined city road packages need splitting into coordinated project packages for independent procurement responsibilities. Supplier references are not live availability. Stage notes are versioned coordination records, not a threaded chat or automatic message transport.
