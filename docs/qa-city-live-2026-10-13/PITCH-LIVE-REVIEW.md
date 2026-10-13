# Live pitch overview verification — 13 October 2026

Origin: https://ppw-designer-2d-21ijghs0m-victor-ppw.vercel.app

Checked four public pitch pages in headless Chromium from the terminal at 1280 × 900 desktop and 390 × 844 phone. Fresh browser context per page. No forms were filled, no submissions were made and all non-GET/HEAD/OPTIONS network requests were blocked by the test harness; no such requests were attempted. These checks cover the opening screen, not every chapter or enquiry workflow.

## Results

All eight navigation responses returned HTTP 200. Across all eight cases: zero console errors, page errors, failed requests, HTTP errors, attempted writes, horizontal document overflow or broken images. Each page rendered its heading and visible controls. All eight PNGs were visually inspected.

No blocking visual defect was found in the inspected opening screens. Developer and merchant pages retain readable mobile navigation and bottom chapter controls. Plumbing presents its primary action before the fold. Construction uses a longer scrolling page: on phone, two tall app screenshots appear before the headline, leaving the headline and first content section below the initial viewport. This is a nonblocking presentation issue and an opportunity to improve the opening composition, not a loading or overflow failure.

## Evidence

- `pitch-live-browser-results.json` — per-route status, browser errors, layout measurements and screenshot references.
- `pitch-developers-desktop.png` and `pitch-developers-phone.png` — Room Designer: developers/off-plan property.
- `pitch-merchants-desktop.png` and `pitch-merchants-phone.png` — Room Designer: retailers, manufacturers and distributors.
- `pitch-construction-desktop.png` and `pitch-construction-phone.png` — Room Designer: construction and building-material suppliers.
- `pitch-plumbing-desktop.png` and `pitch-plumbing-phone.png` — Room Designer: plumbing suppliers, installers and bathroom showrooms.

Script: `tools/_scratch/pitch-live-2026-10-13.mjs`. This check did not commit, publish, contact prospects, place orders, or change source/application state.
