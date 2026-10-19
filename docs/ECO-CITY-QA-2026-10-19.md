# Eco-city pitch, coordination and furniture — verification

## Scope and workflow

Feature branch `gpt/designer-2026-10-15`, existing PR48. Changes extend the measured app; they do not change main, production, the shared database, paid services or supplier integrations. No external order, invoice or message was sent.

Construction and eco-city are now a guided seven-chapter presentation. The five workstreams group building geometry, foundations/quantities, services, city infrastructure, and landscape/interiors. Clickable role and logistics diagrams explain who reads, writes and reviews each change. The pitch uses actual app captures and does not embed the full design editor. Its revision and AI demonstrations are explicitly local scripted examples.

Personalise accepts public company/project labels, audience, scenario and sage/ocean/graphite palette. Share this version preserves only those allowlisted fields in the URL. Download presentation brief exports the same configuration and capability boundaries. Do not put private project details in a public share URL.

The real app's Shared project → Team & logistics provides six role stations, version-aware review actions, responsibility and delivery groups, and a JSON handoff. City roads, shared trench excavation, utility route lengths, equipment and parks now feed the canonical component register without duplicating the linked house. City takeoff errors retain the last valid register. Mauritius civil dates drive overdue checks.

## Automated checks

- `npm test -- --run`: **375 files / 4,188 tests pass**.
- `npm run build`: pass, including application and middleware typechecks. Existing large bundle warning remains.
- `npx tsc --noEmit -p api/tsconfig.json`: pass.
- ESLint on all changed/new TypeScript files: pass.
- `git diff --check`: pass.
- Final compiled browser checks use `npm run preview -- --host 127.0.0.1 --port 5173`, with terminal Playwright at desktop 1280 × 900 and phone 390 × 844. No browser-control connector or paid media API was used.

## Compiled browser evidence

| Suite | Captures | What was exercised |
| --- | ---: | --- |
| `docs/qa-eco-city-pitch-2026-10-19` | 22 | All seven chapters, six role cards, design revision rehearsal, workstreams, scripted AI, customisation, three palettes in component tests, share/reload, JSON brief, keyboard navigation, construction alias, developer entry |
| `docs/qa-coordination-2026-10-19` | 18 | Six stations, all eight review links, assignment isolation, delivery notes/dates, export, city quantity synchronisation and reload |
| `docs/qa-merchant-furniture-2026-10-19` | 6 | Same measured Courts/Espace products in 2D, 3D and close furniture views |
| `docs/qa-eco-city-evidence-2026-10-19` | 4 | Actual city, routed services, materials and coordination screens for the presentation |

All 50 scripted captures passed with **0 console/page errors, 0 attempted API writes and 0 horizontal page overflow**. Scripts and JSON reports are saved alongside the screenshots. Five additional lower-phone screenshots were inspected separately. Detailed visual review is in each suite's README where present. Disposable browser fixtures do not change the shipped demo or server data.

The coordination UI test starts with 16 city packages and three house packages. Road width 6 → 8 m changes union road-surface volume 124.2 → 146.1 m³, retains assignments/notes/dates, and does not duplicate packages or make a new revision on reopening.

## Visual findings and remaining limits

- Mobile chapter and dashboard navigation scroll horizontally, while the active tab reveals itself. Each chapter scrolls vertically; the full presentation is not stacked into one long page. No modal or toolbar covered the inspected actions.
- An omitted word boundary in the mobile headline was caught during screenshot review and corrected.
- App screenshots are illustrative at phone width; explanatory copy carries the workflow. They are actual app captures, not photorealistic marketing renders or video.
- Sofas have structured cushions, arms, seams, acacia slats and material textures. They preserve the sourced envelope in both views; they are **parametric representations, not exact manufacturer CAD or photographs**. Published dimensions and source limits are in `MERCHANT-FURNITURE-2026-10-19.md`.
- Technical prose in the new pitch and coordination section is English. Existing app language controls do not imply complete translation of this new narrative.
- Shared cloud migration0032 remains unapplied. Public stations are a browser-local pilot; no simultaneous multi-user geometry editing, threaded chat, automatic dispatch or live supplier availability is claimed. AI in the pitch is scripted; configured hosted AI remains a separate app capability.
- Combined road packages need explicit package splitting for independent procurement ownership. Building/data-centre envelopes are planning placeholders, not certified whole-building quantities. All engineering/environmental screening still needs qualified review.
- Previous Lighthouse performance/PWA findings remain; this is not an all-green CI claim.

Deployed proof and pinned application URL are recorded in `ECO-CITY-BUILD-LINKS-2026-10-19.md` after preview verification.
