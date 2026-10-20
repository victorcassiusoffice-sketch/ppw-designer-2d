# Sculpted Ocean interface — implementation and visual review

Task started 19 October, verified 20 October 2026. Source: `Design/Theme 2.jpeg`, supplied by Victor. This is the working app UI, not a flattened advert or overlay.

## Reference mapped to the actual interface

| Supplied reference element | Implemented counterpart | Source / visual proof |
| --- | --- | --- |
| Mineral blue textured desktop | Shared blue semantic palette and fine procedural surface grain | `src/i18n/preferences.css`, `src/styles/tactileSkins.css`; `qa-sculpted-ui-2026-10-19/desktop-shared.png` |
| Tall dark navy rounded navigation | Navy rails in 2D/3D and Project/Shared workspaces; semantic construction icons | `desktop-plan.png`, `desktop-house.png`, `desktop-project.png`, `desktop-shared.png` |
| Raised frosted blue cards with a directional highlight | A single skin lift, inner shadow and rounded surface system; no duplicate flat card layer | `.shared-card`, `.project-card`, form controls and toolbar capsules |
| Four tinted tactile summary cards | Teal, blue, ice and lavender cards using live measured quantities and outstanding work counts | `desktop-project.png`, `desktop-shared.png` |
| Dark inset dashboard welcome banner | Actual project name, selected workspace section and revision/status | Project and shared overview banners |
| Teal sculpted primary actions | The existing genuine actions retain their handlers, with raised teal treatment | Review component specifications, Open designer and selected tools |
| Smaller touchscreen adaptation | Native narrow layout, readable floor selector and 44px-class primary targets | `phone-plan.png`, `phone-house.png`, `phone-project.png`, `phone-shared.png` |

## Behaviour and safety of the change

- New devices start with **Sculpted ocean**. Saved Ivory & sage and Slate & sand selections stay selected. The three skins use the same physical surface system; Ocean matches the new blue reference.
- A new four-language label is provided for Sculpted ocean. The language mechanism and stored preference key are unchanged.
- Geometry, scale, material finishes, pricing, data access, procurement and backend contracts are untouched by this UI work.
- Removed the earlier competing flat interface theme block from `preferences.css`; the bounded legacy chrome bridge and physical tokens live together in `tactileSkins.css`.
- Fixed an actual 390px defect: the floor dropdown previously shrank to about 48px and displayed “Groun”. Its minimum 108px space is preserved using existing aria-labelled icon actions beside it, with no extra toolbar row.
- Escape now closes an open Preferences panel first; a second Escape returns from either dashboard to the build. Closing preferences does not discard dashboard work.

## Verification

- 22 focused preference/shared-workbench tests passed. Colour assertions cover all three base palettes, four metric-card colours and dark navigation text. The existing persistence test verifies saved selections survive remount.
- Scoped ESLint and app TypeScript checks passed before final documentation; root performs final compiled release verification.
- `node tools/sculpted-ui-shot-2026-10-19.mjs <base>` captured 1280 × 900 and 390 × 844 Plan, House, Project and Shared routes: eight PNGs, zero console/page errors, zero API writes, no document horizontal overflow. Both dashboard Escape sequences pass at both sizes.
- `docs/qa-sculpted-ui-2026-10-19/report.json` contains results. The photographs are real Playwright app captures, not image-generation mockups.
- The supplemental three-skin axe capture script is `tools/sculpted-theme-contrast-2026-10-19.mjs`. An interrupted development-server run is not release proof; root should rerun on compiled preview. Axe may require manual review for text over the procedural grain/gradient; token contrasts are checked separately.

## Honest limits

The reference is a music dashboard illustration, with a 3D human mascot and music charts. We match its blue palette, navy spine, four-card hierarchy, depth, highlights, grain, rounded geometry and tactile controls, while retaining real construction functions and counts. We do not invent avatars, songs, progress, statistics or decorative charts that imply project facts. Semantic vector icons are embossed with CSS; they are not newly modelled 3D objects. The layout is therefore not a pixel-for-pixel reproduction of the music screen. The measured house scene has its separate product/material renderer; these interface tokens do not recolour merchant products.

## Files owned by this change

- `src/i18n/AppPreferences.tsx`
- `src/i18n/preferences.css`
- `src/styles/tactileSkins.css`
- `src/i18n/messages.ts`
- `src/i18n/__tests__/AppPreferences.test.tsx`
- `src/components/LocaleThemeControls.tsx`
- `src/components/ProjectWorkspace.tsx`
- `src/components/SharedProjectWorkbench.tsx`
- `tools/sculpted-ui-shot-2026-10-19.mjs`
- `tools/sculpted-theme-contrast-2026-10-19.mjs`

No commit, push, production action, database migration or paid API call was made by the theme subagent.

## Integrated logo-contrast correction

The integrated suite caught the old assumption that every non-Ivory theme needed white lettering. `src/brand/OlbLockup.tsx` now reverses automatically only for dark Slate. Ocean uses the dark wordmark. `src/pages/olb/OlbHomePage.tsx` explicitly chooses the dark wordmark because that page's paper background does not follow the selected theme. Explicit dark-hero overrides still work. Five new surface-semantic tests plus the three existing home-page tests pass; scoped ESLint passes. The audit found no other old Ocean-is-dark TS/TSX comparison.

## Fresh direct-route Escape regression correction

The later compiled release check used a fresh browser context for every route and found that `/demo?panel=shared&pitch=1` could not close with Escape. The earlier eight-screen development run reused one browser context per device, which did not expose this first-mount failure. The compiled bundle did contain the preferences-first handler; this was not a stale build.

On an initial open mount, Shared's child `Focus` component ran its layout effect before the parent section ref attached. Consequently the focus hook registered neither keyboard capture nor background inert ownership. A direct Playwright reproduction confirmed missing `tabindex`, a non-inert canvas, and no response to the second Escape.

Focus ownership now runs in the parent `SharedProjectWorkbench` with `enabled: open`, supported by `src/hooks/useWorkspaceFocus.ts`. It is established after the host attaches, released while hidden, and restored on reopening. The workbench tests now use the real focus hook instead of mocking it away. Three regressions cover initial open, preferences-first Escape, and closing/reopening. All 20 Shared workbench and focus-hook tests passed. Root is rebuilding and repeating the isolated compiled checks; the old failing report should not be described as a release pass.
