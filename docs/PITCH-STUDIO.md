# PPW Studio — presentation and integration guide

Production truth for the pitch, Studio, Demo and embed routes. They ship on **https://designer.ppwellness.co** — the same host as the real designer and shop — once the branch carrying them is merged to `main` (Vercel builds production from `main` automatically). A deploy is live only when a cache-busted `curl https://designer.ppwellness.co/api/healthcheck?cb=<unique>` reports the expected commit; a preview URL is never production.

## Routes on production

| URL | What it is | Orders? |
| --- | --- | --- |
| https://designer.ppwellness.co/pitch/developers | Five interactive chapters for property developers: apartment vision, finish alternatives, deadline/delivery simulation, material and electrical-load brief, partnership meeting | No (read-only) |
| https://designer.ppwellness.co/pitch/merchants | Five interactive chapters for merchants: opportunity, product categories, embedded/standalone/Shop channels, hypothetical partnerships, catalogue access and proposed finance/signing | No (read-only) |
| https://designer.ppwellness.co/studio | Standalone website entry with 2D, Premium 3D, Shop and merchant access | No (read-only) |
| https://designer.ppwellness.co/studio/designer?view=3d | Studio with the real Premium 3D designer (`view=2d` for the plan) | No (read-only) |
| https://designer.ppwellness.co/studio/shop | The public product API and Shop inside the Studio frame, with the preview notice | No (read-only) |
| https://designer.ppwellness.co/studio/merchants | Links to the existing authenticated merchant workspaces and platform administration | n/a |
| https://designer.ppwellness.co/demo | Generic designer-only Demo; no Shop navigation (`?scene=home\|paint&view=2d\|3d`) | No (read-only) |
| https://designer.ppwellness.co/embed/designer?scene=home&view=3d | The embeddable designer-only Demo (`scene=paint&view=2d` for the paint scene) | No (read-only) |
| https://designer.ppwellness.co/designer?demo=tintex | The legacy meeting-pack URL merchants already hold (`tintex`, `courts`, `sofap`, `captamarin`) | **Yes** — transactional, exactly as before |
| https://designer.ppwellness.co/designer | The standard designer | **Yes** |

2D and Premium 3D are both included in the presentations. "Premium" describes the richer view, not an active subscription or paywall. Existing local plans are preserved when a demo scene opens. Actual products, dimensions, attributed suppliers, paint quantities, roof/floor tools and solar estimates use the existing designer.

## What "read-only" means on production

The guard is **UI-level only** (`src/lib/showcaseSafety.ts`). On production the API stays fully transactional; the server-side guard (`api/_lib/showcaseSafety.ts`) is active only on Vercel **preview** deployments (`VERCEL_ENV=preview`) or on a separate host built and run with `DEMO_ONLY=true`. There is no `403 SHOWCASE_READ_ONLY` on production URLs — that response belongs to previews and to a dedicated demo host.

Three kinds of route:

1. **Read-only families** — `/demo`, `/embed/designer`, `/studio` and its sub-routes, `/pitch` and its sub-routes. Opening one marks the tab (in memory and in `sessionStorage` under `ppw_showcase_read_only`). On these the designer hides checkout, request-quote and cloud save; the cart button opens a local product estimate; the badge reads **Demo · no orders**.
2. **Checkout pages** — `/checkout` and `/marketplace/checkout` only consult the mark. A tab that came straight from the Demo, Studio or a pitch sees the "You are in the demo — no orders are placed" screen instead of a payment form, including after a reload on the payment page.
3. **Everything else** — `/designer`, `/products`, `/cart`, `/marketplace/cart`, `/` and the rest of the app clear the mark. Pitch → designer → checkout in one tab is a normal purchase again.

`/designer?demo=<slug>` is **not** a read-only route: cart, request-quote, cloud save and the K1 link behave exactly as on the standard designer, and its badge reads plain **Demo** with the × to leave. `?demo=off` leaves demo mode and is never read-only.

Preview builds and `DEMO_ONLY` builds compile `__SHOWCASE_READ_ONLY__` to `true`, which makes every route read-only in the browser regardless of URL, on top of the server guard.

Do not present the UI guard as a security boundary: a visitor on `/demo` who types `/designer` gets the real product, by design. Payment webhooks, transactional cron jobs and the public order/payment/quote/email handlers are refused only where the server guard is active (preview or `DEMO_ONLY`). Pure catalogue reads and cart calculation work everywhere; authorized catalogue editing keeps its existing access checks.

## Embedding

Serve the parent website over HTTPS.

```html
<iframe
  src="https://designer.ppwellness.co/embed/designer?scene=home&view=3d"
  title="Demo — design your home"
  style="width:100%;height:760px;border:0;border-radius:18px"
  loading="lazy"
  allowfullscreen>
</iframe>
```

Only `/embed/designer` may be framed by other sites: it is sent with `Content-Security-Policy: frame-ancestors 'self' https:` (any HTTPS parent). Every other route — Shop, checkout, merchant administration, the main designer — keeps `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`. Before a live merchant launch, agree the allowed hostnames and narrow the embed policy to them in `vercel.json` (header matching follows [Vercel's documented configuration syntax](https://vercel.com/docs/project-configuration/vercel-json#headers)).

The embedded designer has its own editing controls. The Studio and pitch pages switch its view through a narrowly scoped same-origin `postMessage`; external sites receive no access to designer state or customer information. The embed shares the tab's `sessionStorage` with its parent, so an embed on a Studio or pitch page marks that tab read-only as described above.

## Working now and proposed connections

**Working:** shared measured Plan/3D design, local plan saving, actual bundled/connected catalogue data, existing product API and authenticated merchant/admin maintenance, material estimates, roof solar planning, guided presentation interactions and the meeting link.

**Interactive examples:** finish studies, local duplicate alternatives, lead-time/deadline dependencies, example paint pack calculation, connected lighting load, recipient assignment and hypothetical partner share. These do not modify the live embedded design or create project contracts. Their inputs and assumptions are labelled.

**Integration still required:** multi-user project permissions and approvals, client change deadlines and automatic release of orders, confirmed stock/capacity/delivery/contractor slots, recipient emails, consumer AI auto-design, secure identity checks, finance and e-signature. Existing merchant AI chat is authenticated and does not execute a consumer building-design workflow. Existing order maintenance cron jobs are not supplier scheduling integrations.

The intended project workflow is: clients may revise choices before the approved deadline; the latest approved choices are frozen and released only with purchasing authorization; delivery precedes the agreed contractor visit. Supplier confirmation, customer consent and partner connections must be implemented before this can run automatically.

## Other notes

- No ID documents or payment applications are collected by the presentations. "Book a meeting" opens the Calendly page; it does not create a booking automatically.
- Browser JavaScript and rendered assets cannot be made impossible to copy. Private API keys and server logic are not shipped to the browser. Public source maps are disabled; when Sentry is configured, hidden maps are uploaded privately and removed before release. The build fails if a map survives.
- Product models use supplied dimensions where available; 3D previews are not guaranteed exact manufacturer models. Solar output is an estimate, not telemetry or guaranteed generation. Material quantities still depend on coverage, waste, substrate, measurements and supplier specifications. Generated artwork is explicitly labelled architectural concept imagery.

Meeting: https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour?month=2026-09

## Tests that pin this behaviour

- `src/lib/__tests__/showcaseSafety.test.ts` — the three route kinds, pitch → designer → checkout transactional, demo → checkout blocked, `/designer?demo=tintex` and `?demo=off` never read-only, `/studio/shop` and `/embed/designer` read-only, the preview build flag, blocked-storage fallback.
- `src/pages/studio/StudioPage.test.tsx` — the checkout guard never mounts a payment form in a demo and leaves the live checkout alone otherwise.
- `src/demo/__tests__/demoDesignerControls.test.tsx` — `/demo` and the embed keep design controls without Studio, shop, cloud or checkout exits.
- `api/__tests__/showcaseSafety.test.ts` — the server guard on previews / `DEMO_ONLY`, and production requests passing through untouched.

## History

The routes were first built and verified on the Vercel preview `ppw-designer-2d-egshdczue-victor-ppw.vercel.app` (branch `cursor/feat-3d-flooring-hud-bc95`, draft PR #36, 25 September 2026). On that preview the server guard is active, so payment, quote and email probes return `403 SHOWCASE_READ_ONLY` there; that is preview behaviour, not production behaviour. The production-safe read-only rules above were set on 26 September 2026 after the sticky tab mark was found to lock a real customer out of checkout once they had looked at a pitch. Continuation notes: `docs/DESIGNER-WORKFLOW-LOG.md`.
