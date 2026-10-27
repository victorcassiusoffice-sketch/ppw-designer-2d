# Walk mode — Stage 2 candidate

Base: `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`, fetched from origin/main before the branch started. Branch: `gpt/olb-walk-mode-2026-10-27`. PR and preview links will be added after the normal branch workflow produces them. No merge or manual deployment.

## What works

Walk opens from a completed WebGL 3D view, including `/demo`. A deferred chooser offers four remembered CC0 characters. A private full-building snapshot and canvas provide first/third person, keyboard and one-thumb phone movement, run, drag/pointer-lock look, manual E/tap doors, safe collision and connected stairs. The original editing canvas and camera remain untouched. Exit restores focus and the previous view. No new API calls are added.

Walls, floors, shaped door apertures, windows, furniture envelopes, stair treads and handrails have runtime collision. Mirrored shared doors use one hinge and moving collider. A door cannot close through the player. First-person hides the avatar; idle/walk/run blend from resolved movement. Browser blur clears input; context failure/exit disposes the visit.

## Limits and deliberate choices

- The furnished demo has no exterior front door. Its fallback now chooses free standing space and faces an unobstructed route, tested against the actual demo data. Designs with a usable ground entrance prefer it.
- Roof coverings are hidden, explicitly stated in the chooser, so connected roof terraces and their slab apertures remain accessible. Missing/invalid stairs do not create a teleport route.
- Characters have Kenney's stylized proportions. The requested Quaternius licence downloads returned quota errors; no unverified archive was shipped. See `../characters/AUDIT.md`.
- Third-person camera must pull close in small furnished rooms. It hides the actor when extremely close; further camera/character polish remains on the rubric.
- Furniture uses coarse solid envelopes; sitting, jumping, swimming, vehicles and sound are outside this round. Doors are visit state only.

## Validation

The first full local run passed **399 files / 4,320 tests**. Additional regression coverage after review is recorded separately: existing estimate tests have not been edited. Root/API/middleware TypeScript and production builds passed before the final preview cycle.

New tests cover fixed-step wall sliding and tunnelling, four stair rotations, a full ground→first→roof route, furniture containment, actual-demo spawn, rectangular/arched/paired doors, blocked closing, window versus doorway, camera pull-in including shallow angles, focus/keyboard ownership, and a selected-opening Delete/Backspace read-only regression. Asset checks rendered all four characters and exercised idle/walk/run clips.

Local browser smoke recorded movement, first-person body hiding, zero page errors and exact saved-design/editing-camera preservation on exit. The initial poor fallback spawn was found by that smoke and fixed; its earlier evidence is not represented as a passing final state.

## Measurement status

Final chunk audit, paired production/preview first-picture timings (five per device), chooser latency, entry pause, fps/1% lows and compact screenshots are pending the branch preview. No performance gate is claimed passed at this point. All final timing pairs, including failures, will remain in the evidence.

## Licences and unchanged systems

Full source/date/text copies are in `../LICENCES.md`: existing Three MIT and Draco Apache 2.0, three-mesh-bvh MIT, Kenney CC0. Character archive SHA-256: `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999`. Chosen GLB is 91,804–92,780 bytes including embedded texture and three clips; only one is fetched per visit. Existing decoder files are retained.

No quantity/estimate calculation, saved schema, API route, key, account, environment variable or production setting is added by Walk. Existing tests remain byte-for-byte. Small editor keyboard guards prevent background mutation while the modal is active. `/demo` and meeting-link checks are included in final browser evidence.
