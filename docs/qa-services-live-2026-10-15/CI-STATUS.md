# Published services release: CI and route status

Checked 15 October 2026 for published feature commit **`97146b738e3a649edac8597aecc7d9caec38231d`**, branch `gpt/designer-2026-10-15`, PR #48. This report does not claim that all GitHub checks are green.

- [https://ppw-designer-2d-i3ojsz3qo-victor-ppw.vercel.app/demo?view=3d&pitch=1](https://ppw-designer-2d-i3ojsz3qo-victor-ppw.vercel.app/demo?view=3d&pitch=1) - One Live Build feature preview: property designers and building-services teams.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/48](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/48) - One Live Build code review: product maintainers.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/commit/97146b738e3a649edac8597aecc7d9caec38231d](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/commit/97146b738e3a649edac8597aecc7d9caec38231d) - One Live Build source snapshot: developers and other AI chats.

## Checks on this exact SHA

| Workflow      | Result  | Evidence                                                                                                                                                                                                                                       |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality gates | Success | [Run 38760090127](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38760090127)                                                                                                                                      |
| Secrets scan  | Success | [Run 38760090142](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38760090142)                                                                                                                                      |
| Lighthouse CI | Failure | [Run 38760090043](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38760090043) · [failed job 116508761153](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38760090043/job/116508761153) |

Lighthouse's install and production-build steps succeeded. Its audit/assertion step failed. The workflow at `.github/workflows/lighthouse.yml`, lines 24–26, still explicitly audits `https://designer.ppwellness.co/products` and `https://designer.ppwellness.co/designer`; it does not use this PR's Vercel preview despite the workflow's introductory comment.

The downloaded LHR artifacts confirm those production URLs as both requested and final URLs. They fetched only the HTML document and favicon, not the Designer application JavaScript. Their final screenshot shows the production access-code screen. The crawler audit records both `<meta name="robots" content="noindex,nofollow">` and the corresponding response directive. Thus these results describe the protected production entry screen, not the new services application.

Both audited URLs produced eight failing assertions (installable manifest, crawlability, maskable icon, description, robots file, splash screen, theme colour and total byte weight) plus four warnings (SEO category, DOM size, main-thread work and response time). Both report performance/accessibility/best-practices scores of 1, SEO 0.7 and PWA 0.29. These are gate-page scores and must not be presented as application performance or accessibility measurements.

The target mismatch is unchanged: a later CI maintenance change should deliberately audit the built app or the deployment's public demo route, with appropriate separate expectations for a protected access page. No workflow, access control, production deployment or global network configuration was changed during this verification.

## HTTP route verification

All **30** unique feature paths listed in `docs/RELEASE-LINKS-2026-10-15.md` were requested against the **new origin above**, with unique cache-busting query values and no-cache request headers. The document's previous deployment hostname was not used for the checks. All returned HTTP 200 with the expected classification: **23 application shells and seven access gates**.

Public demo, embed and pitch pages returned the branded application HTML and an entry-module script. `/designer`, the legacy paint-demo entry and the five Studio paths returned the expected unauthenticated passcode screen. A gate's 200 status does not verify the protected application. These HTTP checks also do not replace runtime interaction or visual tests; the release's separate headless report covers those.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15/url-report.json](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15/url-report.json) - One Live Build: all 30 full URLs, cache-busted request URLs, response classifications and hashes for release maintainers.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15/lighthouse-evidence.json](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15/lighthouse-evidence.json) - One Live Build: extracted primary CI evidence for product maintainers.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15/lighthouse-production-gate.jpg](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15/lighthouse-production-gate.jpg) - One Live Build: Lighthouse's actual production-gate capture, not a feature-preview product screenshot.

Read-only HTTP and GitHub inspection only. No credentials, backend writes, form submissions, orders, source edits or publishing occurred in this verification.
