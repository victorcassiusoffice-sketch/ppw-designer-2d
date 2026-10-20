# Working views — 16 October 2026

One Live Build keeps one canonical project. Working views are personal presentation preferences: hiding a wall, pipe, fixture or floor does not remove it, change a measured quantity, or alter a saved specification.

## How to use

1. Open **Layers** in the plan navigation, the house camera rail, or the Building services toolbar.
2. Choose a **Working view**: All disciplines, Pipes only, Plumbing + electrical + walls, Architect, Engineer, Plumber, Electrician or Client.
3. Adjust **What to show** independently: walls and openings, floors, roofs, stairs, routes and pipes, service equipment.
4. Ticking a building part also enables Structure, so Walls can be added directly to Pipes only. Tick any combination of disciplines. For example, Plumbing and Electrical with Structure on, Walls on, Floors/Roofs off gives visible service routes inside the walls without a slab hiding underground work.
5. **Only** isolates a discipline and restores its presentation parts. **Hide all** hides geometry; **Show all** restores every discipline and part. Neither deletes anything.
6. Close using Close, Escape, or a click/tap outside. In Building services, Escape closes Layers before closing the workbench.

Pipes only displays plumbing routes without fixture bodies, wall outlines or floor surfaces. Ventilation, fire-water, electrical or data routes can be added with their discipline checkboxes; keep Service equipment off for route-only coordination. The measurement grid remains as a navigation aid.

Working views persist on this browser/device. They are not project access permissions and are not saved as a stakeholder's shared engineering approval. City infrastructure retains its separate workspace.

## Implementation boundaries

- The existing `visible` discipline flags remain compatible with saved preferences. New independent `parts` default to enabled for existing users.
- Service connections resolve against the complete model before fixtures are hidden, preserving linked endpoint position and quantity.
- Hidden objects are removed from the renderer's selectable geometry. Selection and unfinished drawing are cancelled when changing filters; the saved model is preserved.
- Both main plan/house views and the dedicated services editor obey the same relevant filters. The dedicated services 3D context is schematic, with translucent floor context and optional wall outlines.
- Changing working-view filters does not fit, remount, or reset the current camera. Explicit Fit remains available.
- Full selected pipe material and equipment supplier names wrap below their selectors instead of relying on truncated phone select text.

## Dashboard integration

Use `useDisciplineVisibilityStore.getState().applyPreset(id)` with `ViewPreset` from `src/designer/disciplineVisibility.ts`. Supported IDs: `all`, `pipes`, `plumbing-electrical-walls`, `architect`, `engineer`, `plumber`, `electrician`, `client`.

Use `setVisible(discipline, enabled)` and `setPartVisible(part, enabled)` for a custom view. `showAll()` is the reset action. These functions never call the project/specification store or a supplier API.

## Validation

49 focused Vitest tests passed across discipline preferences, service scene derivation, Services workspace interaction and the house camera. They cover old preference migration, combinations and reset, canonical quantity preservation, connected endpoints when fixtures are hidden, deselection, Escape priority, wall/floor geometry separation and unchanged camera framing.

Headless visual runner: `tools/working-views-shot-2026-10-16.mjs`. Screenshots/report: `docs/qa-working-views-2026-10-16/`. Local production-mode bundle `App-t4bdqfGj.js` passed 26 desktop/phone captures, all presets and custom combinations with zero console/page errors or API writes. Both 3D views returned to identical pixels after filtering/reset at each width. Read that folder's report and visual review for exact evidence and limits.
