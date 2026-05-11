# Stripe Integration Notes - Wellness Room Designer

**Owner:** Vic.
**Last updated:** 2026-05-11 (end of Week 4a - code complete, awaiting Week 4b deploy).
**Status:** Code-complete. NO live Stripe account yet. NO money can be charged.

---

## What Cowork built in Week 3

- `@stripe/stripe-js` installed (client SDK).
- `src/lib/stripe.ts`:
  - Reads `VITE_STRIPE_PUBLISHABLE_KEY` from `import.meta.env`.
  - Exposes `isStripeConfigured()`, `buildCheckoutPayload()`, `startStripeCheckout()`, `makeOrderId()`.
- Behaviour with env var **unset**: every `Place order` click bypasses Stripe and routes the user to `/order/pending` - a placeholder page that surfaces the order summary and a `mailto:victor@ppwellness.co` prefill so you can finalise manually.

## What Cowork added in Week 4a

- `stripe` (server SDK), `resend`, `jspdf`, `jspdf-autotable` installed.
- **`api/create-checkout-session.ts`** - Vercel function. Validates the cart payload, reads `STRIPE_SECRET_KEY` from env, calls `stripe.checkout.sessions.create`, returns `{ url }`. CORS allow-list is dev (`127.0.0.1:5173`) + prod (`designer.ppwellness.co`). Stripe errors are sanitised before being surfaced to the client (no env-var leakage).
- **`api/stripe-webhook.ts`** - Vercel function. Raw-body Stripe signature verification, in-memory event-id dedupe Set (Phase 2 = KV-backed), branches on `checkout.session.completed` (-> customer email + Vic alert) and `payment_intent.payment_failed` (-> Vic alert). 200ms-fast 200-response target; emails are awaited but Resend is sub-100ms in practice.
- **`api/lib/email.ts`** - Resend wrapper. Inline-HTML templates with PPW branding (Phase 2 = react-email). Functions: `sendOrderConfirmation(customer, order)`, `sendOrderAlertToVic(customer, order)`, `sendPaymentFailedAlertToVic(args)`. Dry-run mode when `RESEND_API_KEY` unset.
- **Client snapshot path** - `src/lib/floorPlanSvg.ts` + `src/lib/orderSnapshot.ts` capture the per-room polygon + placed items + a PNG of the floor plan into `localStorage` at checkout-submit time. The post-redirect `/order/success` page (which has lost all Konva state) reads the snapshot and renders the plan PDF.
- **PDF** - `src/lib/planPdf.ts`. Cover, per-room pages with the floor plan image, summary, footer. Customer-facing - NO commission % anywhere.

---

## Full webhook flow (Week 4a code path)

```
[Customer]            [Browser]            [Vercel Function]            [Stripe]            [Resend]
   |                      |                       |                       |                    |
   |--places order ------>|                       |                       |                    |
   |                      |--POST /api/create-... |                       |                    |
   |                      |---------------------->|                       |                    |
   |                      |                       |--checkout.sessions.create() ----->          |
   |                      |                       |<------------ session{url,id} -----          |
   |                      |<---{ url } -----------|                       |                    |
   |<--redirect Stripe ---|                       |                       |                    |
   |---4242 4242 4242 4242 ------------------------------------------>|                    |
   |                                              |       checkout.session.completed event |
   |                      |                       |<----------------- POST /api/stripe-webhook
   |                      |                       |--verify sig, dedupe, listLineItems()
   |                      |                       |--sendOrderConfirmation --------------------->|
   |                      |                       |--sendOrderAlertToVic ----------------------->|
   |                      |                       |--200 OK ------------>|                    |
   |<--Stripe redirects to /order/success?cs=... ------------------------|                    |
   |                      |--reads ordersStore + orderSnapshot from localStorage              |
   |                      |--generatePlanPdf -> auto-download                                 |
   |                                                                      |       email to customer
   |                                                                      |       email to victor@
```

### Idempotency

- The webhook's in-memory Set of processed `event.id`s prevents double-emails on a SINGLE warm lambda instance.
- Multi-instance dedupe (Phase 2) needs a Vercel KV / Upstash Redis. Documented in the function's header comment.
- Stripe itself prevents double-charging - this is purely email-noise reduction.

### Raw-body handling

`api/stripe-webhook.ts` exports `config = { api: { bodyParser: false } }` so Vercel hands us the raw bytes. `readRawBody(req)` concatenates the data stream. `stripe.webhooks.constructEvent(raw, sig, secret)` is the canonical verification path.

### Error sanitisation

- The Checkout endpoint clamps Stripe error messages to 200 chars and never echoes env-var names.
- `STRIPE_SECRET_KEY` unset returns "Payments are not configured. Please try again later." - no hint to the client about WHY.
- Webhook signature mismatch returns 400 with the Stripe library's safe error message.

---

## Env-var checklist

| Env var | Where | Used by | Set in Week |
| ------- | ----- | ------- | ----------- |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `.env.local` (dev) + Vercel (prod) | client - loads Stripe.js | Week 3 (done) |
| `STRIPE_SECRET_KEY` | Vercel only - NEVER `.env.local` | `api/create-checkout-session.ts` | Week 4b (Vic) |
| `STRIPE_WEBHOOK_SECRET` | Vercel only | `api/stripe-webhook.ts` | Week 4b (Vic, after registering webhook) |
| `RESEND_API_KEY` | Vercel only | `api/lib/email.ts` | Week 4b (Vic) |

---

## Domain checklist

- `designer.ppwellness.co` -> Vercel via CNAME. Week 4b step 7.
- `ppwellness.co` -> Resend domain verification (DKIM/SPF/MX records). Week 4b step 2.
- Stripe webhook URL: `https://designer.ppwellness.co/api/stripe-webhook` once the custom domain resolves.

See `VERCEL-DEPLOY-GUIDE.md` for the click-by-click Week 4b deployment instructions.

---

## Test coverage (Week 4a)

| Path | Tests | Approach |
| ---- | ----- | -------- |
| `api/__tests__/createCheckoutSession.test.ts` | 12 | validateRequest happy + 4 rejection paths; buildMetadata size limit; buildLineItems shape; processCheckoutRequest happy + error sanitisation + 400 validation. |
| `api/__tests__/stripeWebhook.test.ts` | 6 | buildOrderSummary from metadata; dispatchEvent fires correct emails; tolerates listLineItems failure; ignores unhandled types. |
| `api/__tests__/email.test.ts` | 7 | Template snapshots; XSS escape; formatMoney; dry-run when RESEND_API_KEY unset. |
| `src/lib/__tests__/planPdf.test.ts` | 3 | Non-empty Blob; multi-room scales; handles empty room. |

All 167 tests green (12 W2/W3 carried + 28 new).

---

## Security checklist

- [x] Secret key NEVER in client bundle. Only `VITE_STRIPE_PUBLISHABLE_KEY` is prefixed `VITE_`.
- [x] `.env.local` in `.gitignore`.
- [x] Webhook handler verifies signature before trusting payload.
- [x] CORS allow-list locked to dev + production domains.
- [x] Error messages sanitised before reaching the client.
- [x] Customer name/email HTML-escaped in email templates (XSS test in place).
- [ ] Rate-limit on `/api/create-checkout-session` - Phase 2 (Vercel Edge config or Upstash limiter). For now, Stripe itself rate-limits at the API.
- [ ] Replay-attack-protection on webhook - Stripe's signature verification includes a timestamp; constructEvent rejects events older than 5 minutes by default.

---

## When this hits production

- Switch every env var from `pk_test_...` / `sk_test_...` to `pk_live_...` / `sk_live_...`.
- Register a LIVE-mode webhook in Stripe (separate from TEST webhook). Paste its `whsec_...` into Vercel.
- Smoke-test with a real R250 plant order. Refund immediately.
- Only then announce the live URL.

See `VERCEL-DEPLOY-GUIDE.md` -> "Cost summary" for the financial commitment (effectively $0/mo at MVP scale).
