# PPW Studio — presentation and integration guide

Status: shipped and verified. Application `7b1837e912b3f50f85f09ace627732828931c558`, Vercel `6664311042`. Production/main remain untouched.

- Standalone Studio + Shop: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/studio
- Developer presentation: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/pitch/developers
- Merchant presentation: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/pitch/merchants
- Designer-only Demo: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/demo
- Embed: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/embed/designer?scene=home&view=3d
- Standard Designer: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/designer
- Demo (legacy TintEX URL): https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/designer?demo=tintex

Final application CI passes 262 files / 2,931 tests, client/API typechecks and secret scan. Production build and scoped lint pass; zero public source maps. Unique preview browser checks pass for both pitches, Studio, Demo and preserved Designer/TintEX routes on desktop and 360/390px phones. Final embedded frames measure 420/423px on desktop and about 480px on phone; no horizontal overflow or browser errors observed. Added a floor in Studio 3D, switched to Plan, and undid it without resetting history. Real catalogue/product/cart reads work; checkout renders the no-order screen. Empty Stripe/PayPal/Gumroad/lead probes return 403 SHOWCASE_READ_ONLY; final deployment Stripe guard and embed-only HTTPS framing headers rechecked. No customer data, order, payment, email or booking submitted. Separate Lighthouse continues to fail against unchanged production.

## Public experiences

| Path | Purpose |
| --- | --- |
| `/pitch/developers` | Five interactive chapters: apartment vision, finish alternatives, deadline/delivery simulation, material and electrical-load brief, partnership meeting |
| `/pitch/merchants` | Five interactive chapters: opportunity, product categories, embedded/standalone/Shop channels, hypothetical partnerships, catalogue access and proposed finance/signing |
| `/studio` | Standalone website entry with 2D, Premium 3D, Shop and merchant access |
| `/studio/designer?view=2d` | Studio with the real 2D designer |
| `/studio/designer?view=3d` | Studio with the real Premium 3D designer |
| `/studio/shop` | Existing public product API and Shop, with a preview notice |
| `/studio/merchants` | Links to existing authenticated merchant workspaces and platform administration |
| `/demo` | Generic, designer-only Demo; no Shop navigation |
| `/embed/designer?scene=home&view=3d` | Embeddable designer-only Demo |
| `/embed/designer?scene=paint&view=2d` | Paint scene in 2D |
| `/designer?demo=tintex` | Preserved legacy supplier URL; public demo name is Demo |

2D and Premium 3D are both included for this presentation. “Premium” describes the richer view, not an active subscription or paywall. Existing local plans are preserved when a demo scene opens. Actual products, dimensions, attributed suppliers, paint quantities, roof/floor tools and solar estimates use the existing designer.

## Embedding

This embed uses the current verified preview. Serve the parent website over HTTPS. Update the host when a later deployment is selected.

```html
<iframe
  src="https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/embed/designer?scene=home&view=3d"
  title="Demo — design your home"
  style="width:100%;height:760px;border:0;border-radius:18px"
  loading="lazy"
  allowfullscreen>
</iframe>
```

Only `/embed/designer` permits HTTPS parent sites. Other routes keep same-origin framing protection, including Shop, checkout, merchant administration and the main designer. Before a live merchant launch, agree the allowed hostnames and restrict the embed policy accordingly. Header matching follows [Vercel’s documented configuration syntax](https://vercel.com/docs/project-configuration/vercel-json#headers).

The embedded designer has its own editing controls. Internal PPW pitch/Studio view switches use a narrowly scoped same-origin parent message; external sites do not receive access to designer state or customer information.

## Working now and proposed connections

**Working:** shared measured Plan/3D design, local plan saving, actual bundled/connected catalogue data, existing product API and authenticated merchant/admin maintenance, material estimates, roof solar planning, guided presentation interactions and the supplied meeting link.

**Interactive examples:** finish studies, local duplicate alternatives, lead-time/deadline dependencies, example paint pack calculation, connected lighting load, recipient assignment and hypothetical partner share. These do not modify the live embedded design or create project contracts. Their inputs and assumptions are labelled.

**Integration still required:** multi-user project permissions and approvals, client change deadlines and automatic release of orders, confirmed stock/capacity/delivery/contractor slots, recipient emails, consumer AI auto-design, secure identity checks, finance and e-signature. Existing merchant AI chat is authenticated and does not execute a consumer building-design workflow. Existing order maintenance cron jobs are not supplier scheduling integrations.

The intended project workflow is: clients may revise choices before the approved deadline; the latest approved choices are frozen and released only with purchasing authorization; delivery precedes the agreed contractor visit. Supplier confirmation, customer consent and partner connections must be implemented before this can run automatically.

## Demo safety and deployment

- All feature Vercel preview deployments are transaction-disabled from trusted server `VERCEL_ENV=preview`, independently of browser flags.
- For a separate permanent demo host, set **`DEMO_ONLY=true` at build time and runtime**. Do not reuse a live transactional production host as a security boundary for a demo URL.
- Public order/payment/quote/email/design-submission handlers reject demo requests before side effects; payment webhooks and transactional scheduled jobs are disabled on preview. Pure catalogue reads and cart calculation remain. Authorized catalogue editing retains its existing access checks.
- The client also guards payment routes, payment libraries, manual local order creation and designer quote/cloud-save entries. Local design editing, estimates and saved plans remain available.
- No ID documents or payment applications are collected by the presentations. Book a meeting opens the provided Calendly page; it does not create a booking automatically.
- Browser JavaScript and rendered assets cannot be made impossible to copy. Private API keys and server logic are not shipped to the browser. Public source maps are disabled; when Sentry is configured, hidden maps are uploaded privately and removed before release. The build fails if a map survives.

Product models use supplied dimensions where available; 3D previews are not guaranteed exact manufacturer models. Solar output is an estimate, not telemetry or guaranteed generation. Material quantities still depend on coverage, waste, substrate, measurements and supplier specifications. Generated artwork is explicitly labelled architectural concept imagery.

Meeting: https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour?month=2026-09

Branch: `cursor/feat-3d-flooring-hud-bc95`. Draft PR #36. Never push/merge main. Production stays untouched. Resume from `docs/DESIGNER-WORKFLOW-LOG.md`.
