# World rubric — first Stage 2 assessment

Scored 2026-10-27 by the implementation agent. These scores assess the two branch candidates together, not production. Scale: **0 missing, 1 works with faults or incomplete evidence, 2 good with recorded evidence, 3 demonstrated best-in-class**. No item is awarded 3 in this first round. A unit test is not a physical-device usability study. Final preview measurements are recorded in the two build reports.

| Area | Item | Score | Proof / limit |
|---|---|---:|---|
| Game feel | Input-to-movement delay | 1 | 120 Hz bounded controller ticks; actual browser input latency measurement pending. |
| Game feel | Walk and run speeds | 2 | Runtime uses 1.45 and 3.4 m/s; collision tests prove fixed-step movement and no tunnelling. |
| Game feel | Camera clears walls, floors and doors | 2 | `src/walk/__tests__/collision.test.ts`: wall, door, slab and grazing-angle swept-camera tests. |
| Game feel | Stairs climb and descend | 2 | Same test file: ascent/descent at four rotations and ground→first→roof route through real apertures. |
| Game feel | Doors have clear reach and cannot trap | 2 | Explicit 2 m ray reach; occupied sweep prevents closing; mirrored shared doors share one hinge/collider. |
| Game feel | Third-person follow and corner recovery | 1 | Follow is smoothed then collision-checked again; narrow rooms still pull the camera close to stylized avatars. |
| Game feel | First-person body/head hidden | 2 | Entire actor is hidden in first-person; `walk` screenshot evidence verifies the view. |
| Game feel | Animation follows resolved movement | 2 | Idle/walk/run use actual moved metres, with 180 ms blends; blocked movement resolves to idle. |
| Usability | First-use controls understood in 10 seconds | 1 | Controls card contains keyboard and phone instructions; no first-time human comprehension study yet. |
| Usability | Phone works with one hand at 390×844 | 1 | Move-and-turn thumb pad plus optional drag-look; browser touch checks pending final evidence. |
| Usability | Exit always visible | 2 | Fixed top Exit button; Escape, focus return and prior-editor capture regression tests. |
| Usability | Chooser fast and remembered | 1 | Four small thumbnails and browser preference; final cold-open timing pending. |
| Usability | Site search/draw/edit/undo | 1 | Explicit search, corner editing and undo implemented; phone/map-provider evidence in Site report. |
| Usability | Plain-language site report | 2 | Boundary, levels, sun, surroundings, planning and foundation sections with source tags/unavailable states. |
| Usability | Report fits A4 and phone | 1 | Dedicated print CSS and responsive report; final rendered-page inspection pending. |
| Function | Every site field tagged or unavailable | 2 | `SiteReport.tsx` renders required metrics with provenance; missing data is not converted into zero. |
| Function | Survey traverse closure shown | 2 | New Site geometry tests cover decimal/quadrant bearings and unadjusted closure residual. |
| Function | Cut/fill and foundation rerun on chosen levels | 2 | Separate survey/what-if surface integration; cloned foundation scenario reuses unchanged estimator. Public terrain excluded. |
| Function | Every connected level reachable | 2 | Ground→first→roof route test. Invalid/missing stairs remain inaccessible; roof coverings explicitly hidden in Walk. |
| Function | Every door type behaves | 2 | Hinged rectangle/arch, paired doors, open doorway and solid window tests; shaped visual leaf shares collider profile. |
| Function | Walk never writes the design | 2 | Browser exit preserves serialized design/camera; real-store Delete/Backspace regression protects selected opening. |
| Performance | Paired first 3D picture unchanged | 0 | Final production/preview pairs pending; no passing claim from the local build. |
| Performance | Walk JavaScript under 600 KB gzip plus one character | 1 | Deferred chunks built; final chunk totals and network trace pending. Four GLBs each <93 KB. |
| Performance | Phone 30 / laptop 60 fps and 1% lows | 0 | Formal device-viewport measurement pending; desktop viewport emulation is not a physical-phone test. |
| Performance | Map chunk size reported | 2 | Initial Site build: MapLibre about 299 KB gzip; exact final bytes and worker requests in Site report. |
| Performance | Entry pause reported separately | 1 | Runtime records start-to-ready milliseconds; dev smoke saw 6.9 s, final preview measurement pending. |
| Honesty | Banner on screen and print | 2 | Required banner is part of both Site workspace and printable report. |
| Honesty | Boundary uncertainty label | 2 | Distinct drawn and typed-surveyor-plan labels; offline practice outlines explicitly identified. |
| Honesty | Licence and attribution visible | 2 | Full copied licences; always-visible map links and Kenney CC0 credit. Terrain accepts only audited source headers. |
| Honesty | Current-state file matches shipped candidate | 1 | Versions, hashes and provider limits recorded; final preview/measurement entries still pending. |

After each authorized merge, the Claude tester re-scores production and records evidence in the vault. The Commander selects the lowest items and the next-three list for one fix-round prompt. Codex implements one PR, updates these three files and hands back. Weekly while any item is below 2; a stay-current review every four weeks regardless. Do not turn these scores into an automatic merge or upgrade permission.

Backlog requiring Victor's own word: satellite provider, survey-plan photo/OCR, sun/building shadows, shared walk with the station, and headset view. None is enabled in these candidates.
