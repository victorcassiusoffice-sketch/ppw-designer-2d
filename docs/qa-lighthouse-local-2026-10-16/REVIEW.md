# Local Lighthouse CI review — 16 October 2026

The workflow now audits the pull request's built `dist` rather than unrelated production pages. LHCI starts a local SPA server and audits `/demo?view=2d&pitch=1` and `/pitch/plumbing`. Existing assertion thresholds and exclusions are unchanged. `.lighthouseci/` is ignored; the compact evidence is retained here.

## Recorded build and scores

LHCI CLI 0.13.0 / Lighthouse 11.4.0, desktop preset, one run per route, Chrome on Windows. Local server: `http://localhost:61845`. The demo requested `assets/App-CQre-53N.js`. No Lighthouse runtime warnings were recorded. This is local build evidence, not a deployed-site audit or a phone performance benchmark.

| Route | Performance | Accessibility | Best practices | SEO | PWA |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/demo?view=2d&pitch=1` | 41 | 100 | 100 | 91 | 29 |
| `/pitch/plumbing` | 73 | 100 | 100 | 91 | 29 |

Accessibility scores rose from 93/94 in the first audit to 100/100 after fixing invalid room-button roles, visible-text/accessibility-name mismatches, selected pitch-step contrast and pitch heading order. Scored accessibility checks are not the complete `lighthouse:recommended` assertion set: the recorded demo still failed `label-content-name-mismatch` for the Furnish launcher. The final one-line source correction removes its redundant `aria-label` so its native visible text supplies the name, and preserves the browse hint in `title`. Ten catalogue tests passed after this correction. The recorded Lighthouse run predates that final line; it has not been represented as a clean assertion run.

## Remaining assertions

`lhci collect` completed successfully. `lhci assert` exited **1**; CI is **not green**. No thresholds were reduced and no new assertion exclusions were added.

- Both routes: missing/effective CSP assertion under the local static server; installability/manifest, maskable icon, splash screen and theme-color assertions; invalid `robots.txt` because SPA fallback returns HTML; network payload and unused CSS.
- Demo: the recorded launcher-name assertion above; preconnect recommendation; missing public source maps. The repository deliberately rejects public source maps, so none were published to silence the audit.
- Plumbing pitch: LCP image prioritisation, missing explicit image dimensions and responsive-image sizing.
- Performance warnings remain for main-thread/JavaScript work, DOM size, paint timing and render-blocking resources. The pitch also reports layout shift. Exact failures and warnings, with expected/actual values, are in `summary.json`.

The local static server does not reproduce Vercel response-header rules. Its CSP failure must not be interpreted as verification of deployed CSP, positively or negatively. Performance results are a single development-machine run and can vary; the low designer score remains a real optimisation backlog, not a pass.

## Validation and reproduction

47 focused toolbar, panel, catalogue and pitch tests passed after the accessibility edits; the catalogue's 10 tests passed again after the final native-name correction. Scoped ESLint passed. Separate desktop/phone working-view screenshots and camera/quantity checks are in `../qa-working-views-2026-10-16/`.

```powershell
$env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npx --yes --package=@lhci/cli@0.13.0 lhci collect --config=.lighthouserc.json
npx --yes --package=@lhci/cli@0.13.0 lhci assert --config=.lighthouserc.json
```

The built `dist` must exist first. LHCI supplies its own local port, so these commands do not target production or need an already-running preview server. No report upload was performed by this local audit.

Configuration semantics checked against [official Lighthouse CI configuration documentation](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) and the [v11 action implementation](https://github.com/treosh/lighthouse-ci-action/tree/v11).
