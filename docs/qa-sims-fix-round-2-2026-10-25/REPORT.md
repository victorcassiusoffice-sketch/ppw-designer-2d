# One Live Build — fix round 2, 25 October 2026

Branch: `gpt/olb-fix-round-2-2026-10-25`, created from production `fc0b1118390813444d6bf45d7c452e3677ec16eb`.

This round covers the six issues in `GPT-OLB-SIMS-PARITY-FIX-2-2026-10-25.md`. PR49 and the next feature prompt are excluded. No production release is authorized by this report.

## 1. Natural 3D shading

The previous release changed Natural preview from Neutral to ACES tone mapping. Neutral is restored for that preview. The calibrated Colour Check light rig and all saved material values stay unchanged.

Auto starts its real AO trial only after a building picture and the full material picture have rendered. It retains AO only at measured throughput of at least 45 FPS. Phone Auto keeps AO off. Optional shaders are prepared asynchronously; renderer identity guards prevent stale work from drawing after unmount or quality changes.

Matched-camera house-region brightness is restored: production Auto was +14.38% above the old build; branch Auto is +0.18%. High changes from +14.78% to +0.29%. These are encoded-sRGB image measurements, not physical luminance. The same fitted camera and 1168×592 canvas are asserted in the evidence. Root also visually inspected old / production / branch pictures: stronger grass and material colour is restored without blank or clipped geometry.

Completed-frame orbit: production Auto 59.88 FPS / High 33.61 FPS; compiled branch Auto 60.00 FPS / High 37.17 FPS. This Intel Iris Xe laptop's measured AO trial is below 45 FPS, so Auto correctly keeps it off. No full Sims or photorealistic parity is claimed. [Graphics report and comparison pictures](GRAPHICS-LOAD-REPORT.md).

## 2. First 3D picture

Changes: explicit `view=3d` visits preload the renderer in parallel with the app; the existing Inter typeface is self-hosted under its OFL licence; the actual building first draws with lightweight diffuse materials; original PBR materials, reflections and optional AO are prepared afterward. Geometry, placement, scale, maps and camera are preserved. The original materials are restored after each progressive draw, and temporary materials are disposed.

Loading 3D remains visible until a real building frame. First picture, full material picture and AO start are recorded separately. This is progressive rendering, not a blank scene or a screenshot substituted for the model. The 2D route does not preload the 3D renderer. No new runtime dependency was added.

Method: fresh Chromium process/profile on each run, no network or CPU throttling, desktop 1280×800 and phone emulation 390×844, native D3D11. The acceptance measurement is navigation to the reviewer's loading-hidden condition. Raw render timestamps are diagnostic only. Three runs per size are required.

| Loading-hidden elapsed | Production before | Final preview after |
| --- | --- | --- |
| Desktop runs 1 / 2 / 3 | 29.530 / 15.198 / 15.287 seconds | Pending |
| Phone runs 1 / 2 / 3 | 10.840 / 9.556 / 15.077 seconds | Pending |

The first production desktop run included a slow external font stylesheet. It is retained as measured, not discarded. Local compiled diagnostics are separate from the deployed comparison: desktop 6.433 / 6.578 / 5.397s; phone 6.257 / 5.508 / 5.578s. Both the under-3s desktop and under-5s phone targets remain unmet locally. The first full original-PBR picture takes 5.60–7.13s; early diffuse rendering is not presented as full material completion. Immutable-preview measurement follows deployment.

## 3. Pictures in both baskets — implemented

The 2D cart sheet and 3D Your design basket use the same photo-first image resolver. Existing supplier photos win; saved top-downs and plan art are labelled **Drawing**. Public demo quantities and money are hidden. The normal Designer retains quantities and monetary values.

All 22 existing K1 / Emcar photos are preserved. All four baseline baskets had zero images; all four local after baskets display 33 loaded drawings for the default furnished scene. The phone and desktop checks cover both views, with no placeholder requests, console/page errors, attempted writes or horizontal overflow.

Evidence: [basket report](catalogue-and-baskets/REPORT.md), [before JSON](catalogue-and-baskets/before/report.json), [after JSON](catalogue-and-baskets/after/report.json).

| Picture | Before | After |
| --- | --- | --- |
| Desktop 2D basket | [PNG](catalogue-and-baskets/before/desktop-2d-basket.png) | [PNG](catalogue-and-baskets/after/desktop-2d-basket.png) |
| Phone 3D basket | [PNG](catalogue-and-baskets/before/phone-3d-basket.png) | [PNG](catalogue-and-baskets/after/phone-3d-basket.png) |

## 4. Placeholder catalogue pictures — implemented

Removed 33 external placeholder URLs from the seed. All 13 reported false-photo cards use their existing local art and Drawing labels. Legacy API or saved-cart placeholder URLs are rejected before image rendering. The remaining hostname mentions are rejection rules, negative test fixtures and before evidence, not runtime image dependencies.

For 33 Courts products, cached overhead PNGs were projected from the existing dimensioned planning models. No Courts website photograph was fetched or copied. These are approximate planning drawings, not manufacturer CAD or new meshes. Unknown future products without supplied art can still use an explicitly documented category symbol; that is not a supplier photo.

139 focused checks across eight files pass. The static projection produced 33 drawings, zero skipped models, zero errors and zero remote requests. The supplied dimensions, IDs, prices and quantities did not change. See the [drawing provenance](catalogue-and-baskets/plan-drawings.json).

[Console card before](catalogue-and-baskets/before/desktop-2d-console.png) / [after](catalogue-and-baskets/after/desktop-2d-console.png). The same folder includes rubber-floor drawing and NordicTrack supplier-photo checks at both sizes in both views.

## 5. One meeting destination — implemented

The plumbing presentation, shared sales shell, employee starter pack and downloadable handbook now use `https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour`. Four historical documentation files were corrected too, including their obsolete fixed-month suffixes. No booking or form was submitted.

The handbook's four booking links use the canonical destination. Existing sales/pitch tests pass: 24 tests across two files. Actual before/after plumbing-page checks at desktop and phone verify all three visible booking anchors. Their layout is intentionally unchanged.

[Before desktop](meeting-links/before-desktop-plumbing-meeting.png) / [after desktop](meeting-links/after-desktop-plumbing-meeting.png); [before phone](meeting-links/before-phone-plumbing-meeting.png) / [after phone](meeting-links/after-phone-plumbing-meeting.png). [Link evidence](meeting-links/after.json), [handbook evidence](meeting-links/employee-handbook.json).

Existing external issue: the plumbing pitch sometimes receives HTTP401 from `api.exchangerate.host`. Production before has it too. It is recorded in the raw evidence and is not counted as zero console errors or claimed fixed by this link change.

## 6. Reachable desktop turn handle — implemented

The full 44px handle target is constrained to the visible Plan viewport. An item can remain offscreen; its handle stays reachable. Rotation still pivots around the actual object centre. No automatic pan, zoom or geometry change is introduced.

The exact reviewer case improves from desktop 0/4 turns to 4/4. Phone stays 4/4. All 28 focused tests pass. The six existing selection/carry/rotation regression checks pass at both sizes: selection preserves the canvas and immediate dragging; displayed, ghost and saved angles agree at 0/45/90 degrees. Final browser runs have zero console/page errors and overflow.

See [rotation evidence](rotation/ROTATION-HANDLE-REPORT.md), including before/after picture paths and the real-pointer reproduction. Phone checks use Chromium touch emulation, not a physical handset. Existing phone floor-label truncation remains outside this round.

## Boundaries and review overlap

- Existing quantity/geometry/material-estimate/foundation/services tests and calculation sources are unchanged. Seed product metadata changes only in 33 `image_url` fields.
- The only API change is `api/_lib/products/seedImagery.ts`. No new endpoint, migration, environment variable or dependency. No database operation, login, supplier order, email or credit spend.
- Passcode and checkout logic are unchanged. Public demos must remain free of prices, currencies, cart counts and retailer/client names; final deployed smoke check is pending.
- PR49 is excluded. Filename overlaps are **RoomCanvas.tsx** (handle viewport), **ThreeStage.tsx** (presentation/startup), **apiCatalogAdapter.ts** (placeholder rejection). No PR49 branch commits, models or visual-theme changes were imported.
- Only the final append to the existing Vault REPORT is permitted. All new scripts, screenshots, measurements and this report remain in the product repository.

See [boundary audit](boundaries.json). Full integration passes: **398 files / 4,298 tests**, root/middleware/API typechecks, scoped ESLint with zero warnings, and production build (Vite 12.63s). The existing large-chunk build warning remains. Logs: [tests](full-tests.txt), [types](typecheck.txt), [lint](lint.txt), [build](build.txt). Remote-head equality, draft PR and immutable preview verification follow deployment.

## Source location

`C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer` - One Live Build source and all evidence for construction, design and merchant reviewers. The separate dirty checkout under `PPW-Code` was not used.

Final commit, draft PR and unique preview links will be recorded here after validation. A merge requires Victor's explicit new instruction naming that PR.
