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

---

## Hotfix 2: page scroll + country default + test-mode copy

**Reported by Vic** during a second smoke test of `https://ppw-designer-2d.vercel.app/checkout`:

1. The checkout page **couldn't be scrolled** by mouse-wheel or scrollbar. Vic could Tab through the inputs, but the form was taller than the viewport and the lower sections (delivery address, country, place-order button) were unreachable.
2. The **Country select defaulted to United Kingdom (GB)** instead of Mauritius, even though the Currency switcher had already detected Mauritius.
3. The customer-facing copy under the order summary said *"Test mode: Stripe is not live yet. Your order will be recorded locally..."* — which reads to a real prospect like the system is unfinished. The publishable key IS set in Vercel, but if it ever fails to reach the bundle the fallback message looks broken.

### Root causes

1. **Scroll lock.** `src/index.css` had a *global* `body { overflow: hidden }` plus `html, body, #root { height: 100% }`. The Designer (`/`, `/designer`) needs that fixed-height shell so the Konva canvas and product palette can each scroll inside their own pane. The checkout / cart / orders / success / cancelled / pending pages all use `min-h-screen` — so they grew taller than the viewport, but the global body overflow lock prevented the window from scrolling. Result: form content past the fold was unreachable on every non-Designer route.
2. **Country default.** `initialForm()` in `src/store/checkoutStore.ts` was calling `detectRegion()` from `src/lib/region.ts`. On Vic's browser, locale `en-GB` parsed to `GB`, so the form initialised with `country: 'GB'`. The Currency switcher uses the same detector but with a Mauritius fallback via `currencyForCountry`, which is why MUR was picked correctly while the form's Country dropdown went to GB.
3. **Stripe copy.** The `<p>Test mode: Stripe is not live yet…</p>` block in `src/pages/CheckoutPage.tsx` was a fallback that only rendered when `isStripeConfigured()` returned `false`. The check itself is correct, but its dynamic env lookup (`env[PUBLISHABLE_KEY_ENV]`) is more fragile than direct static access (`import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY`) — Vite only guarantees inlining for direct dotted accesses. Even with the check fixed, the copy itself was unhelpful: a real prospect should see a clear test-mode banner ("no real money will be charged, use card 4242 …"), and the fallback should sound like an intentional manual-handover path, not like the site is broken.

### Fix

- **`src/index.css`** — removed the global `body { overflow: hidden }`. Changed `html, body, #root` from `height: 100%` to `min-height: 100%` so non-Designer pages can grow taller than the viewport and let the window scroll. The Designer route still scroll-locks via its own root `<div class="h-screen w-screen overflow-hidden">` in `src/App.tsx`, so the Konva canvas + palette + details panel still behave correctly. Mobile bottom-sheet behaviour in the ProductPalette is unaffected — that pattern is scoped to the Designer, not global CSS.
- **`src/store/checkoutStore.ts`** — `initialForm()` no longer calls `detectRegion()`; the Country field always starts on Mauritius (`'MU'`) since that is PPW's home market and the shipping default. Users outside Mauritius will pick from the dropdown explicitly. Persistence key bumped from `ppw_checkout_v1` → `ppw_checkout_v2` so cached `country: 'GB'` (etc.) in `sessionStorage` gets cleared on next load. `detectRegion`/`COUNTRY_OPTIONS` imports dropped (the dropdown still imports `COUNTRY_OPTIONS` directly in `CheckoutPage.tsx`).
- **`src/lib/stripe.ts`** — `getPublishableKey()` now tries direct static access (`import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY`) first so Vite can inline the literal at build time, then falls back to the dynamic lookup it used to do. Added `isStripeTestMode()` which returns true when the publishable key starts with `pk_test_`.
- **`src/pages/CheckoutPage.tsx`** — replaced the single "Stripe is not live yet" block with two clear states:
  - **Test mode banner** (`isStripeTestMode()` is true): teal-tinted, reads *"Stripe Test Mode — this is a test order, no real money will be charged. Use card 4242 4242 4242 4242, any future expiry date, and any 3-digit CVC."* This is what Vic and real prospects see during smoke-testing.
  - **Manual handover banner** (`!isStripeConfigured()`): sand-tinted, reads *"Manual handover: your order will be recorded and Vic will contact you within 24 hours to confirm details and arrange payment + installation."* This only renders if the publishable key fails to reach the bundle — much less alarming than "not live yet."

### Files touched
- `src/index.css`
- `src/store/checkoutStore.ts`
- `src/lib/stripe.ts`
- `src/pages/CheckoutPage.tsx`
- `.gitignore` (added `.bashtest.txt` / `.synctest` — sandbox scratch files the VM cannot unlink)

### Verification
- `npx tsc --noEmit` — clean (exit 0).
- `npm test` — **167/167 pass across 12 test files** (same suite count as Hotfix 1).
- `npx vite build` — succeeds (988.04 kB JS / 21.11 kB CSS, same chunk-size warning as before; the in-place `dist/` rebuild hit a Windows `EPERM` from a stale lock, ran cleanly when pointed at a temp outDir — code is clean, deploy artifact builds end-to-end).

### Commit (local only, per REBIRTH-11.3 — Vic pushes manually)
- Message: `fix: page scroll on checkout, default country to Mauritius, clarify test-mode copy`

### Push command for Vic
```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```

---

## Hotfix 3: VITE_STRIPE_PUBLISHABLE_KEY not inlined in production bundle

**Reported by smoke test** against `https://ppw-designer-2d.vercel.app/`:

- Checkout page rendered the **"Manual handover"** banner (the `!isStripeConfigured()` fallback) instead of the **"Stripe Test Mode"** banner, even though all four env vars were correctly set in Vercel Project Settings (Production + Preview scopes).
- Submitting the cart routed to `/order/pending` instead of redirecting to Stripe Checkout.
- Grepping the deployed bundle confirmed root cause: `https://ppw-designer-2d.vercel.app/assets/index-Cgg8mR9S.js` contained **zero** occurrences of `pk_test_`. Vite had not statically inlined the publishable key at build time.

### Root cause

The Hotfix 2 implementation of `getPublishableKey()` in `src/lib/stripe.ts` accessed the env var via a TypeScript cast:

```ts
const direct = (import.meta as unknown as {
  env?: { VITE_STRIPE_PUBLISHABLE_KEY?: string };
})?.env?.VITE_STRIPE_PUBLISHABLE_KEY;
```

Vite's static-replacement pass scans the source for the **literal token** `import.meta.env.VITE_X` (dotted, un-wrapped). The cast `(import.meta as unknown as {...})?.env?.VITE_STRIPE_PUBLISHABLE_KEY` hides the token from the scanner — the source no longer contains `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY` as a contiguous expression, so Vite emits a runtime property lookup against the env object instead. In production builds the runtime env object only contains the special keys Vite adds (`MODE`, `BASE_URL`, `DEV`, `PROD`, `SSR`) — `VITE_*` vars are *not* attached at runtime, they're inlined as string literals at every call site. With no inlining and no runtime entry, the lookup returns `undefined`.

The dynamic-bracket fallback (`env?.[PUBLISHABLE_KEY_ENV]` with `PUBLISHABLE_KEY_ENV = 'VITE_STRIPE_PUBLISHABLE_KEY'`) had the same problem for the same reason — the variable hid the literal from the scanner.

The TS error the cast was silencing existed because `vite/client`'s `ImportMetaEnv` interface doesn't type custom `VITE_*` keys by default. Removing the cast leaves a clean direct read; `vite/client` types `ImportMetaEnv` with an index signature, so `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY` type-checks without help.

### Fix

`src/lib/stripe.ts` rewritten so every env-var read uses **direct dotted access** on `import.meta.env`:

1. Module-level capture at the top of the file:
   ```ts
   export const PUBLISHABLE_KEY: string | undefined =
     import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
   ```
   Exported so other modules can import it. This is the canonical token Vite inlines at build time.

2. Diagnostic `console.log('[stripe-init]', { hasKey, keyPrefix })` next to the capture, so the production browser console will surface whether the inlining actually reached the deployed bundle on next deploy.

3. `getPublishableKey()` now reads the env var directly at call time (also direct dotted access, no cast):
   ```ts
   const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
   ```
   Call-time read keeps the existing Vitest `vi.stubEnv(...)` tests working — in production this is a string-literal replacement, in tests it's the stubbable env object.

The fallback bracket-lookup branch was removed (it could never work in production for the reasons above).

`vite.config.ts` reviewed — no `envPrefix` override, no plugin stripping VITE_ vars, no `define` clobber. Vite picks up `.env.local` normally. No config change needed.

No other client-side file reads `VITE_STRIPE_PUBLISHABLE_KEY` (grepped `src/`). `RESEND_API_KEY` is server-only — only referenced in `api/` (Vercel functions, Node runtime, `process.env`) — never imported into the client bundle.

### Files touched
- `src/lib/stripe.ts` (full rewrite of the env-read section + diagnostic log)
- `WEEK-4b-LOG.md` (this entry)

### Verification
- `npx tsc --noEmit` — clean (exit 0).
- `npm test` — **167/167 pass across 12 test files**. Stripe suite prints `[stripe-init] { hasKey: true, keyPrefix: 'pk_test' }` from the diagnostic log — confirms the module-load capture is working in the Vitest env.
- `npx vite build --outDir <tmpdir>` — succeeds (988.06 kB JS / 21.11 kB CSS).
- **Bundle grep (the key verification):**
  ```
  grep -o "pk_test_[a-zA-Z0-9]\{20,\}" <tmpdir>/assets/*.js
  ```
  Returns **2 occurrences** of the full `pk_test_51TVx3mKAIwndBLJV...` publishable key embedded as a string literal in the production JS — one for the module-load const, one inlined into `getPublishableKey()`. Before Hotfix 3 this grep returned zero matches against the same `.env.local` source.

### Commit (local only, per REBIRTH-11.3 — Vic pushes manually)
- Message: `fix: ensure Vite statically inlines VITE_STRIPE_PUBLISHABLE_KEY (was dynamic access)`

### Push command for Vic
```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```
Vercel will auto-deploy on push. After the new build is live, re-run the smoke test: the checkout page should render the **teal "Stripe Test Mode"** banner, the browser console should show `[stripe-init] { hasKey: true, keyPrefix: 'pk_test' }`, and submitting the cart should redirect to a `https://checkout.stripe.com/...` session URL.
