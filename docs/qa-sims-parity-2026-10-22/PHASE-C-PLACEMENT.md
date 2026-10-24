# Placement Phase C — acceptance report

One Live Build · branch `gpt/olb-sims-parity-2026-10-22` · verified 24 October 2026.
Status: BUILT-NOT-LIVE. This report covers placement evidence; rotation and rendering have separate reports.

## What changed

- A carried product has a measured 3D preview and placement validation before it is committed.
- Object controls expose 50 cm, 25 cm and Free placement. Free permits furniture overlap but retains solid-wall and plot boundaries. These preferences are separate from construction precision.
- Copy type arms the selected catalogue SKU. Its carried angle can be changed before placement; Cancel adds no object.
- Moving a table carries its attached object in the preview and saved result. Wall products have a bounded height control.
- An invalid first outdoor drop leaves the entire stored property unchanged, including its outdoor-room containers.

## Actual acceptance run

`node tools/sims-placement-shot-2026-10-22.mjs` completed against `http://127.0.0.1:5176`: desktop 1280 × 900 and phone viewport 390 × 844. Each case passed six functional groups. Total: 12 groups, 26 PNGs, zero captured console errors, zero page exceptions and zero failures. Every capture also checked for horizontal page overflow.

The phone context enables mobile/touch emulation, but this harness uses real mouse-pointer and keyboard events. It proves responsive layout and these pointer actions, not physical-phone gestures. Debug projection helpers locate actual objects on screen; placement and movement are performed through pointer events. The initial fixture is a measured 8 × 6 m room, with a table, an attached diffuser and a wall shelf.

| Requirement | Result and exact evidence | Before / after pictures |
|---|---|---|
| Carried preview, half-step and Free | UI selected Copy type, 25 cm and a 45° carried turn, then Free. The preview record was `x=4.5, y=2.5, rotation=45, valid=true`, for `demo-console-table`. This is an actual catalogue SKU. | Baseline `before-actions/{desktop,phone}-selected-table.png`; after `placement-after/{desktop,phone}-carried-half-step.png` and `-carried-free.png`. The rerun after the colour fix shows the valid carried preview in teal-green in all four desktop/phone half-step and Free captures; it no longer retains the earlier invalid red colour. The carried body is a measured proxy, not a detailed merchant mesh. |
| Standard grid and repeated placement | One seeded lamp plus 19 actual Shift-held pointer placements produced 20 objects. Every pair had non-overlapping 40 cm footprints. This is not a claim of 20 new UI placements, or a touch-only repeat workflow. | Baseline `before-actions/{desktop,phone}-plan-attachments.png`; after `placement-after/{desktop,phone}-twenty-no-overlap.png`. |
| Move table and attached object | A real 3D pointer drag changed the table's position. The diffuser retained its 20 cm / 10 cm relative offset. Undo restored the initial table; redo restored its moved x position. | Baseline and after `{desktop,phone}-moving-table.png`, `-moved-table-child.png`, `-undo-move.png` in their respective folders. |
| Raise wall product | The selected shelf's Height input was set to 170 cm. The stored project's `mountHeightCm` became 170. Restart/re-import persistence was not exercised in this run. | Baseline `before-actions/{desktop,phone}-wall-item-selection.png`; after `placement-after/{desktop,phone}-wall-item-raised.png`. |
| Cancel carried product | After changing the carried copy's angle and placement mode, Cancel left the original three placed objects. | Carried-preview pictures above; assertion in `placement-after/report.json`. No separate post-cancel picture was captured. |
| Invalid first outdoor drop | In Free mode, an attempted drop over the plot edge was rejected. A deep comparison verified the whole property was unchanged: no object and no outdoor room created. | After `placement-after/{desktop,phone}-invalid-plot-edge.png`. The baseline had no equivalent invalid-drop capture, so this is a regression check rather than a matched before/after pair. |
| Delete and undo | Delete reduced the object count from 20 to 19; Undo restored 20. Delete redo was not exercised. | After `placement-after/{desktop,phone}-delete.png` and `-undo-delete.png`. No corresponding delete baseline was captured. |

## Named unit checks

`npx vitest run src/designer/__tests__/itemDrop.test.ts src/designer/__tests__/objectPlacementParity.test.ts --reporter=dot` → 2 files, 22 tests passed: 16 item-drop tests and 6 placement-parity tests.

Relevant passing test names:

- `25 cm half-step and 50 cm standard step agree with explicit grid`
- `free mode allows furniture overlap but still rejects solid walls and off plot`
- `twenty standard-grid objects have no overlapping footprints`
- `previews an outdoor move without creating a room, then creates it only on drop`
- `re-snaps to the nearest wall and turns with it`
- `lands on the table it is dropped on and names it as the parent`
- `object snap preferences are independent of construction precision`
- `carried ghost keeps its angle across views and resets only for a new product`
- `preview bridge is read-only and the older cleanup cannot remove a newer resolver`
- `a surface product rests on the real parent height in the 3D solid`
- `wall height is clamped without changing supplier dimensions`
- `door/window access hints disappear when furniture moves away`

The unit run emits two Zustand storage-unavailable warnings in its Node-only environment. They are retained; they are not browser console errors.

## Not fully verified

- Wall slide/automatic facing, moving a child between surface slots, cross-room parent/child movement, and visible door/window obstruction hints have unit coverage or source inspection, but no dedicated before/after real-pointer pictures in this Phase C run. They are not marked fully accepted.
- The entire place → move → rotate → delete Undo/Redo chain was not exercised. This run covers move Undo/Redo and delete Undo. Rotation evidence belongs to Phase B.
- Copy type was exercised for the exact seeded SKU. Merchant-declared finish variants and Duplicate-selected history were not exercised here.
- Physical-phone repeat placement, finger occlusion, haptics and Safari were not tested. The phone Plan screenshot still shows a clipped floor-name label; responsive width alone does not prove all labels are readable.
- The invalid-drop and delete checks have after pictures only. The original audit did not record their matched baseline actions.
- These are local branch results. No production or preview publication is asserted by this report.

## Evidence locations

Repository: `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/`.

- Harness: `tools/sims-placement-shot-2026-10-22.mjs`.
- Baseline report and 16 screenshots: `docs/qa-sims-parity-2026-10-22/before-actions/`.
- Final report and 26 screenshots: `docs/qa-sims-parity-2026-10-22/placement-after/`.
- Required inbox: `C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/`.
- Inbox screenshot copies: `shots/placement-after/`. These were captured using `pitch=1`; no prices are shown.

The report-writing task changed no app code, estimates, product dimensions, database, endpoint, environment setting, account or dependency. It made no generation calls and did not commit, push, merge or deploy.
