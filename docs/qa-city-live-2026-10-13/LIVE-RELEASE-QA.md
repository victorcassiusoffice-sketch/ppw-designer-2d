# City Build publication — 13 October 2026

Application commit: `3f046cc655ab6e79803444038c8567dbe88dd445`. Branch: `gpt/designer-2026-10-13`.

- [https://ppw-designer-2d-21ijghs0m-victor-ppw.vercel.app/demo?view=2d&panel=city&pitch=1](https://ppw-designer-2d-21ijghs0m-victor-ppw.vercel.app/demo?view=2d&panel=city&pitch=1) - City Build: developers, civil contractors, utilities and infrastructure suppliers.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/47](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/47) - Room Designer / City Build: draft implementation PR for technical review.

Victor explicitly authorized publication in the continuing chat. The feature branch was pushed and its Git/Vercel preview published; no main push or production deployment was performed. Subsequent documentation-only commits may update the moving branch alias; the unique application URL above remains pinned to the tested application.

## Evidence

- Vercel deployment `dpl_5hrAnovWA1e9xPcXNXPxekrjaYL5` reports Ready; GitHub deployment `7044424438` reports success.
- Cache-busted `/api/healthcheck` returned HTTP 200, `env: preview` and the full expected commit on normal DNS at `2026-10-13T17:10:33.808Z`. Earlier process-only Vercel edge routing also confirmed the same SHA; no system DNS settings were modified.
- 35 route GET checks returned HTTP 200. Public Demo, pitches and embeds bypass the Studio code as intended. Protected routes return a 200 access screen: that is not proof of authenticated backend operation. See `route-checks.json`.
- Four City browser cases at desktop 1280×900 and phone 390×844 passed using normal DNS. All five City sections, road/utility controls, example district, City 3D, return to the building and reopen were checked. Eight screenshots were inspected. Final cases have zero console, page, HTTP or failed-request errors and zero attempted writes.
- Four public pitches × two viewport sizes passed: developers, merchants, construction and plumbing. Eight captures were inspected; zero console/page/network errors, attempted writes, page overflow or broken images. These checks cover opening screens, not every chapter or enquiry flow. See `PITCH-LIVE-REVIEW.md`.
- Application build and client/API typechecks passed. GitHub Vitest and secret scan passed. Earlier local verification recorded 340 test files / 3,799 tests, final scoped regressions and 50 desktop/phone captures.
- GitHub Lighthouse is red against the existing production `/products` and `/designer` pages for PWA, SEO and payload assertions. That workflow does not audit this preview. It remains an unresolved production CI issue; the PR is not described as all-green.

## Remaining issues and practical limits

1. Some Vercel requests had intermittent TCP connection timeouts from this network, including health probes. Normal-DNS route and browser checks succeeded afterward; that does not prove every network path is continuously available. This was not an application console exception.
2. City opens in its 2D plan even if the outer URL says `view=3d`; use the City's 3D button. The public City link intentionally uses `view=2d`.
3. Full-district labels and equipment are small on a phone at whole-site fit. Zoom in for detail. No blocking clipping or control overlap was found in the tested states.
4. The construction pitch on phone places two tall screenshots before its introductory heading, so more scrolling is needed than on the other pitches.
5. City geometry is a measured planning representation. It is not certified civil/structural/utility design or exact manufacturer CAD. Source-backed supplier references are not live inventory or partnerships.
6. Dated procurement packages and recipient choices are drafts. Automatic supplier orders, invoice generation and email dispatch are not implemented. Private cloud draft storage still needs migration 0031 and commissioning; preview writes, payments and enquiry submissions are disabled.

No purchases, invoices, supplier messages, enquiry submissions, migrations or merchant publications were made during validation. Use Calendly for booking, not the disabled preview enquiry submission.
