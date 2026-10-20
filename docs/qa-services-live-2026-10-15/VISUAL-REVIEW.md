# Live visual review — 15 October 2026

Reviewed all **16 saved PNGs** in this folder: eight routes at 1280 × 900 desktop and eight at 390 × 844 phone. This review inspected the existing captures directly; it did not browse again, submit forms, place orders or change source code.

- Feature preview: [One Live Build](https://ppw-designer-2d-i3ojsz3qo-victor-ppw.vercel.app/demo?view=3d&pitch=1).
- Recorded commit: `97146b738e3a649edac8597aecc7d9caec38231d`.
- Recorded application bundle: **`App-B_e4HdbN.js`**. Static pitch/access pages do not necessarily expose the application bundle in their initial HTML.
- Capture evidence: [report.json](./report.json). All 16 cases recorded HTTP 200, zero console/page errors, failed requests, HTTP errors, write attempts or horizontal overflow. These are the saved runner's results, not conclusions inferred from appearance.

## Screenshot findings

| Captures inspected | Desktop | Phone |
| --- | --- | --- |
| `desktop-plan.png`, `phone-plan.png` | Complete floor plan is visible with separated tool rows, measurement labels, Clear and Products controls. No dialogue covers the house. | Whole plan fits the drawing region; Clear, view toggle and Products remain visible. The compact floor selector abbreviates its selected label; finer room labels need zoom. |
| `desktop-house.png`, `phone-house.png` | House, furniture and surrounding grass render; build controls sit above/alongside the canvas and camera tools below it. No persistent overlay blocks the scene. | House remains framed within a useful canvas; camera strip and bottom category row are visible. Small icons/labels are dense, but no control is visibly cut off in this state. |
| `desktop-services-plan.png`, `phone-services-plan.png` | Floor context appears behind the measured plan editor. Inspector occupies its own right column, with visible close/collapse controls. | Controls wrap above the drawing; the inspector is below it rather than across it. The floor outline remains visible. Long material option text is truncated inside the select. |
| `desktop-services-3d.png`, `phone-services-3d.png` | 3D edit is visibly selected and the measured grid/context loads. The fresh demo contains no service routes or equipment. | 3D edit remains selected after demo startup. Drawing area and inspector are separate, with Hide details available. The fresh grid is mostly empty and floor context is faint. |
| `desktop-foundation.png`, `phone-foundation.png` | Excavation/footing controls, dashed building context and separate dimensions panel are legible. No element has been drawn in this captured state. | Tools wrap into multiple rows; drawing area, quantity strip and start of the dimensions panel are visible. The remaining form continues beyond the captured viewport. |
| `desktop-pitch-plumbing.png`, `phone-pitch-plumbing.png` | Clear headline, six-step navigation, working-demo/meeting actions and an actual app image. Supplier/installer audience and technical-review limitation are explicit. | Headline and actions stack without horizontal clipping. Step buttons wrap into two rows. The app image begins below the first screen, requiring normal page scrolling. |
| `desktop-designer-access.png`, `phone-designer-access.png` | Branded access form, input and Open action are visible. | Form fits the screen width; input and Open action are fully visible. |
| `desktop-tintex-access.png`, `phone-tintex-access.png` | Same expected access gate as the Designer route, without exposing protected content. | Same expected mobile access gate. |

## Remaining visual limitations

1. The services 3D editor is a schematic coordination workspace, not the full furnished building renderer. Its fresh empty state has a prominent grid and low-contrast building outline. The captures do not demonstrate connected routes because this public demo starts without any. Separate local interaction evidence in `docs/qa-services-spatial-2026-10-15/` covers drawing and editing routes.
2. Several secondary labels are small or low contrast, especially room names and the 3D instruction line. Long selected material names are visibly truncated; the phone plan floor label is abbreviated. These are presentation refinements rather than an observed blocked interaction in these captures.
3. The plumbing pitch hero contains an earlier actual plan capture labelled “Plumbing & Electric”; current workbench controls are reorganised and titled “Building services”. It is a real app capture, but is not a pixel-identical screenshot of this release's toolbar. The page remains clear about coordination rather than automatic engineered design.
4. The main plan uses stylised product symbols; the house uses mixed schematic/procedural assets. Neither should be presented as matching the user's photoreal reference images or exact manufacturer CAD throughout.
5. Phone foundation and pitch pages have content below the viewport. These initial screenshots verify visible layout, not every scrolled field or every pitch step.

## What this evidence does not establish

The two protected Designer routes were checked at their access gate. Their screenshots do not prove post-access editing, passcode handling or authorisation security. Public demo route checks do not publish a change to `designer.ppwellness.co`.

Screenshots cannot certify measurement accuracy, engineering suitability, material compatibility, hydraulic/circuit/HVAC/fire design, structural approval, supplier availability or fulfilment. Those remain separate calculation tests, qualified project review and commissioned backend integrations. No order, invoice, email or meeting booking was submitted during this review.

**Assessment:** no new blocking overlap, broken image, clipped primary action or horizontal overflow was observed in the 16 captured initial states. The specific visual limitations above remain open; this is not a claim that every interaction, viewport or downstream service has been verified.
