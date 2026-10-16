# Language and theme visual review — 15 October 2026

Verified local production bundle: `App-BLprWb7G.js`, served at `http://127.0.0.1:5173`.

## Evidence and method

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\tools\preferences-shot-2026-10-15.mjs` - One Live Build language/theme QA; terminal-driven headless Playwright with disposable browser state and API mutation blocking.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\report.json` - Final run: 12 route/device cases, 18 screenshots, zero console errors, zero page errors, zero attempted API writes and zero detected horizontal-overflow/header-clipping defects.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\report-final-first-run.json` - Retained first run of this same bundle. One request to the external Inter stylesheet at `https://rsms.me/inter/inter.css` failed with `ERR_CONNECTION_CLOSED`. A repeat run loaded the pages without console errors. The repeat recorded one local reverse-wordmark request cancelled with `ERR_ABORTED` during City navigation; no missing visible wordmark or page failure was observed.

The developer, merchant, construction and plumbing pitches, Studio, and City entry were captured at desktop 1280 × 900 and phone 390 × 844. Desktop default captures use English/Ivory; phone default captures use French/Ocean. Studio additionally exercises the actual preference controls to select Spanish/Slate and Mandarin/Ivory, captures the open preferences panel and verifies Escape dismisses it. All 18 final screenshots were inspected. No forms were submitted, external account data changed, or orders made.

## Confirmed

- Company Project hub links preserve the correct `developers`, `merchants`, `construction` or `plumbing` context.
- Document language and theme match the selected values. Studio language/theme switching remains usable on desktop and phone, and its meeting link is legible in Slate.
- Light and reverse One Live Build wordmarks match the background theme on the inspected headers.
- Navigation, the preference panel and City entry controls fit the tested widths without blocking overlap or horizontal clipping.
- City phone tools wrap into the intended two rows. These screenshots cover the City entry/empty plan, not a populated city or a full ordering workflow.

## Remaining limits

- The app is not fully translated. Long pitch and Studio prose, some call-to-action wording, and detailed legacy/help content remain English. The exact coverage boundary is recorded in `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\LANGUAGE-AND-THEME-COVERAGE-2026-10-15.md`.
- Some secondary decorative Studio card icons remain olive in dark themes; their accompanying text and link names are readable. No blocking visual defect was found in this scoped review.
- Construction/pitch images are existing captures or labelled concept art. The language/theme selector changes live interface chrome, not text baked into those images.
- This is a local headless Chromium review at two viewport sizes, not a claim of complete device/browser or WCAG certification. Dedicated professional-view/Project hub checks are separate evidence.

## Key screenshots

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\studio-desktop-es-slate.png` - One Live Build Studio; Spanish/Slate navigation and final meeting-link contrast.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\studio-phone-fr-ocean.png` - One Live Build Studio; phone French/Ocean navigation and controls.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\studio-phone-zh-CN-ivory.png` - One Live Build Studio; Mandarin/Ivory preference switch.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\city-phone-fr-ocean.png` - One Live Build City Build; phone infrastructure-planning entry.
