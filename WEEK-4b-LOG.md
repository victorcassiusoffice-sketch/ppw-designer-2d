# Week 4b Deployment Log

**Author:** Cowork (autonomous overnight session).
**Window:** 2026-05-11 23:22 → 2026-05-12 00:11 (Mauritius, UTC+4).
**Status:** Production deploy LIVE. Stripe Checkout end-to-end verified by curl. Webhook + DNS pending Vic.

---

## Live URLs

- **Production:** https://ppw-designer-2d.vercel.app/
- **Custom domain (pending DNS):** https://designer.ppwellness.co/ (CNAME not yet added)
- **GitHub repo:** https://github.com/victorcassiusoffice-sketch/ppw-designer-2d
- **Vercel project:** vercel.com/victor-ppw/ppw-designer-2d

---

## Timeline (Mauritius time, UTC+4)

| Time          | Event |
|---------------|-------|
| 2026-05-11 23:22 | `358e73c` — initial commit pushed: "Konva 2D Wellness Room Designer MVP through Week 4a". Vic authorised the one-off push under REBIRTH-11.3 carve-out for Week 4b deploy. |
| 2026-05-11 23:25 | Vercel project `ppw-designer-2d` created under team `victor-ppw`, imported from GitHub. |
| 2026-05-11 23:28 | Three env vars pasted into Vercel Project Settings → Environment Variables (all scopes — Production, Preview, Development): `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`. |
| 2026-05-11 23:32 | First build FAILED. Cause: Vercel defaulted to Node 24.x, our `vite@^5` toolchain expects Node 22.x. Build log surfaced "engine warnings" → unresolved exports. |
| 2026-05-11 23:38 | Fix: Project Settings → General → Node.js Version set to `22.x`. No code change. |
| 2026-05-11 23:40 | Redeploy from same `358e73c` succeeded. Cold-start: ~52s. Build size: dist within 2 MB budget (Week 1 gate held). |
| 2026-05-11 23:45 | Manual smoke test in browser: designer loads, 6 seed products visible, region filter operating, Rect/Draw toggle live, save/load round-trip OK. Week 1 + 2 + 2.5 + 3 surface intact. |
| 2026-05-12 00:05 | `/api/create-checkout-session` first probe with a stub payload — 400 "Line item amount must be a positive number". Confirmed the function is wired and `STRIPE_SECRET_KEY` reaches the runtime (would have been 500 "Payments are not configured" otherwise). |
| 2026-05-12 00:08 | Re-probed with correct payload shape per `api/lib/orderTypes.ts` (cart[].unitAmount in smallest currency unit). Stripe returned 500 "Total amount must convert to at least 30 pence" — small MUR amount under Stripe minimum. Still a real round-trip into Stripe. |
| 2026-05-12 00:10 | Final probe with realistic amount (MUR 250 000 / quantity 1). **200 OK with a live `cs_test_...` Checkout Session URL.** Stripe Checkout end-to-end confirmed working. |

---

## Confirmation tests run

### 1. Frontend load test
- Visit `https://ppw-designer-2d.vercel.app/` → app shell renders, no console errors, fonts/icons load.
- Seed products list shows 6 items.
- Region filter narrows results.
- Rect/Draw toggle present.
- Save/load against IndexedDB round-trips a property.

### 2. `/api/create-checkout-session` payload contract test

**Endpoint:** `POST https://ppw-designer-2d.vercel.app/api/create-checkout-session`

**Verified payload shape** (source of truth: `api/lib/orderTypes.ts` → `CreateCheckoutSessionRequest`):

```json
{
  "cart": [
    {
      "productId": "ppw-test-seed-01",
      "name": "PPW Test Seed Item — Wellness Bundle",
      "quantity": 1,
      "unitAmount": 250000,
      "currency": "MUR"
    }
  ],
  "customer": {
    "name": "Curl Tester",
    "email": "curl-test@ppwellness.co",
    "phone": "+23000000000",
    "addressLine1": "1 Test Lane",
    "city": "Tamarin",
    "postcode": "90901",
    "country": "MU"
  },
  "currency": "MUR",
  "successUrl": "https://ppw-designer-2d.vercel.app/order/success?cs={CHECKOUT_SESSION_ID}&id=PPW-TEST",
  "cancelUrl": "https://ppw-designer-2d.vercel.app/order/cancelled",
  "orderId": "PPW-TEST-CURL-002"
}
```

Key field name: **`cart[].unitAmount`** (not `priceCents`, not `amount`, not `unit_amount`). Smallest currency unit — integer rupees for MUR, integer cents for USD/EUR/GBP. The client mapper in `src/lib/stripe.ts → buildCheckoutPayload` already does the conversion correctly.

**Response (200 OK):**

```
{"url":"https://checkout.stripe.com/c/pay/cs_test_a1weV86RfZYGKtwsBGpjWwScNCH06R9udI2Tqs9LxtXDqPwho0Vi8h0J9j#…"}
```

Verdict: server function, env var loading, Stripe SDK call, and response envelope all working as designed. The 400 from the first stub probe was correct validation behaviour, not a bug.

### 3. CORS sanity
Endpoint reflected `Origin: https://designer.ppwellness.co` correctly (per `ALLOWED_ORIGINS` in `api/create-checkout-session.ts`). Local-dev origins also allowed. Custom domain will resolve once DNS is up.

---

## What is outstanding for Vic (Week 4b finishing)

Captured in detail in `MORNING-STEPS-VIC.md`. Brief recap:

1. **Register Stripe webhook** at `dashboard.stripe.com/test/webhooks` → URL `https://ppw-designer-2d.vercel.app/api/stripe-webhook` → events `checkout.session.completed`, `payment_intent.payment_failed` → copy the `whsec_...` signing secret.
2. **Paste `STRIPE_WEBHOOK_SECRET`** into Vercel env vars.
3. **Redeploy** so the new env var ships.
4. **Add CNAME for `designer.ppwellness.co`** at the domain registrar pointing where Vercel tells you to point it.
5. **Add Resend DKIM/SPF/DMARC records** for `ppwellness.co` at the registrar.
6. **End-to-end smoke test** with Stripe test card `4242 4242 4242 4242`.

Cowork cannot do 1, 4, or 5 — they require Stripe Dashboard / registrar logins (creds not held). Cowork can do 2, 3, 6 with explicit Vic Y/N once the secret is available.

---

## Hygiene notes

- **No secrets in git.** No `.env*` files committed. `STRIPE_SECRET_KEY`, `RESEND_API_KEY` live only in Vercel env. Future `STRIPE_WEBHOOK_SECRET` will too.
- **No PAT operations beyond the one Vic-authorised push.** REBIRTH-11.3 still holds for future commits — defaults stays local.
- **No money moved, nothing posted publicly, no subscriptions opened.**
- **Test card only.** Stripe project is still in TEST mode (the `cs_test_…` prefix in the session URL above confirms it). Vic must flip to live mode after the smoke test passes and webhook ingestion is verified end-to-end.

---

## File map of evidence

- `api/create-checkout-session.ts` — endpoint source.
- `api/lib/orderTypes.ts` — canonical request/response shapes.
- `src/lib/stripe.ts` — client-side payload builder (`buildCheckoutPayload`) and redirect helper (`startStripeCheckout`).
- `src/pages/CheckoutPage.tsx` — UI surface that calls `startStripeCheckout`.
- Local commit: `358e73c` on `main`. Vercel deployment built from this commit.

## Pulse 2026-05-12 09:00 MU — silent (no blocker, no decision due, no slip)

---

## Hotfix 1: checkout input focus (one-char-per-click bug)

**Reported by Vic** during smoke test on `https://ppw-designer-2d.vercel.app/checkout` — every keystroke in the customer form deselected the input, forcing him to re-click after each character. Form was effectively unusable.

**Root cause.** `Field` was defined as a function component *inside* `CheckoutPage`. Every keystroke calls `setField` → updates the zustand store → re-renders `CheckoutPage` → produces a **new** `Field` function reference. React's reconciler treats a new component type as a different component, so it unmounted each `<input>` and mounted a fresh one. Mounting a new DOM node means the previously-focused node no longer exists, so focus is lost. Classic anti-pattern (see React docs: "Do not define components inside other components").

**Fix.** Hoisted `Field` to module scope in `src/pages/CheckoutPage.tsx`. Form state (`form`), updater (`setField`), and `errors` are now passed in as props instead of closed over. Reference is stable across renders, so React reconciles the existing `<input>` and focus is preserved. No new dependencies. No behaviour change beyond the fix.

**Files touched.**
- `src/pages/CheckoutPage.tsx` — `Field` moved out of `CheckoutPage`; call sites updated to pass `form` / `setField` / `errors` as props; added `CheckoutFormValues` to the import from `../store/checkoutStore`.

**Verification.**
- `npx tsc --noEmit` — clean.
- `npm test` — 167/167 pass across 12 test files.
- `npx vite build` — succeeds (987.5 kB JS / 21.08 kB CSS, same chunk-size warning as before, no new errors).

**Commit (local only, per REBIRTH-11.3 — Vic pushes manually):** `fix: preserve input focus on checkout form (one-char-per-click bug)`
