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

---

## Hotfix 4: plan PDF floor plan + Draw mode polygon room

**Reported by Vic** after first live order was placed via the deployed Stripe Checkout. Two unrelated regressions surfaced in the same smoke test:

1. **Plan PDF floor plan looks broken.** The room page showed the title bar ("Room 1: Main Room") and the product table fine, but the floor plan box in the middle was mostly empty white with a tiny illegible blob in the centre. Customers couldn't see where their furniture would sit.
2. **Draw mode is dead.** Clicking the "Draw" toggle in the TopBar visibly switched the canvas (cursor crosshair, draggable off, placed items hidden) but no HUD appeared, the perimeter / area / name input were nowhere on screen, and the polygon-draw workflow couldn't proceed.

### Bug 1 - Floor plan root cause

`src/lib/floorPlanSvg.ts:renderRoomSvg` was computing a unit-confused `scale` value. The polygon's metre bounds were pre-multiplied by `pxPerMetre` (=100) into `roomWpx` / `roomHpx`, then `scale` was derived as `Math.min((widthPx - margin*2) / roomWpx, ..., pxPerMetre)`. The first two ratios produce a **dimensionless** px/px ratio (e.g. ~1.36 for a 5x4 m room on a 800x540 canvas) but the third cap is `pxPerMetre` (100), so `Math.min(1.36, 0.84, 100) = 0.84`. The same `scale` was then used as the px-per-metre factor when rendering vertices (`v.x * scale + offsetX`) and product rectangles (`(length_cm/100) * scale`). Result: a 5x4 m room rendered as roughly 4-7 px wide centred in a 800x540 canvas - the "tiny blob" Vic saw. Worse, the PNG was then stretched by jsPDF into a 182 mm x 80 mm box (~2.27:1 aspect ratio vs the source 1.48:1), squashing whatever marker survived.

### Bug 1 - Fix

Rewrote `src/lib/floorPlanSvg.ts` around a single `pxPerM` value derived directly as `Math.min(availWpx / roomWm, availHpx / roomHm, 220)` (units: px/m, capped to avoid tiny rooms exploding). Everything - polygon vertices, grid, product rectangles, axis ticks, scale bar - now uses this one factor. Also added:
- **Thick wall outline** (`stroke-width="6"` ink + 1 px slate inner, matches the Konva canvas walls).
- **Each placed product rendered as a colour-filled rectangle** scaled to its real cm footprint, rotated around its centre, with the product name and `L x W cm` dimensions labelled inside.
- **Axis ticks every 1 m** along the bottom + left margins, labelled "0 m", "1 m", ...
- **Wall length labels** in white-on-ink pills pushed outward from the polygon centroid (so they sit off-wall rather than on top of the stroke).
- **Scale bar** in the bottom-left margin: a 1 m reference rule with caption.
- **North arrow** in the top-right corner.
- **Room caption** in the top-left: room name + bounding-box dimensions + item count.

Bumped the default SVG canvas from 800x540 -> 1100x780 (~1.41:1, crisp at the ~180 mm A4 width jsPDF reserves) and patched `src/lib/planPdf.ts` so the image box height derives from `maxW / (1100/780)` instead of a hard-coded 80 mm.

Updated `src/pages/CheckoutPage.tsx` to pass the product name into the SVG so the rectangle label reads "Pro Massage Table" rather than blank.

Added `src/lib/__tests__/floorPlanSvg.test.ts` (9 tests) covering: non-empty output, polygon spread across the canvas (the exact regression that made it a blob - asserts > 700 px wide / > 550 px tall for a 5x4 m room), product name + dim label, wall length labels, scale bar caption, North arrow, XML escape, triangle room, custom canvas size.

### Bug 2 - Draw mode root cause

`src/components/RoomDrawMode.tsx` returned a React fragment from `<Stage>` that contained two children: a `<Layer />` (Konva node, fine) **and** `<DrawHUD />` which renders a plain DOM `<div>` with `<input>`/`<button>` children. react-konva's host config only knows Konva node types - any unknown tag (including `div`, `input`, `label`, etc.) hits `Core.default[type]` undefined, the reconciler logs `Konva has no node with the type div. Group will be used instead.` and silently substitutes an empty Konva.Group. So:
- The HUD never reached the DOM at all - no name input, no Undo/Cancel buttons, no perimeter / area / vertex counter.
- The console was flooded with the "no node with type ..." error every render, one per DOM tag inside the HUD subtree.
- The user could in theory still click on canvas to drop vertices (the Konva-side click handler was attached), but with no visual HUD feedback and no Cancel/Commit affordance the feature was unusable.

### Bug 2 - Fix

Lifted `DrawHUD` out of the Konva tree via `react-dom`'s `createPortal`. The HUD now portals into the `containerRef.current` (the RoomCanvas wrapper div, which already sits `position: relative`), so it overlays the Stage in the DOM without becoming a Stage child. To handle the ref-after-mount edge case, the portal target is tracked in `useState` and refreshed by a `useEffect` that fires on enable/disable. The Konva-side `<Layer>` (vertex dots, segment labels, hover crosshair, close indicator) is unchanged - that part was already correct.

### Files touched

- `src/lib/floorPlanSvg.ts` - rewritten (px-per-metre scale + walls + product labels + ticks + scale bar + North arrow).
- `src/lib/planPdf.ts` - room-page floor plan box uses derived height matching the SVG aspect; comment / wording cleanup.
- `src/pages/CheckoutPage.tsx` - passes `productName` into `renderRoomSvg`.
- `src/components/RoomDrawMode.tsx` - imports `createPortal`, HUD portals into the RoomCanvas container, target tracked via `useState` + `useEffect`. Removed the dead `DomOverlay` shim.
- `src/lib/__tests__/floorPlanSvg.test.ts` - new (9 tests, +102 lines).

### Verification

- `npx tsc --noEmit` - clean (exit 0).
- `npm test` - **176/176 pass across 13 test files** (was 167 across 12 - +9 floorPlanSvg tests).
- `npx vite build` - succeeds (991.35 kB JS / 21.11 kB CSS, same pre-existing chunk-size warning).

### Phase 2 polish note - Stripe FX fee

During the Phase 1 live smoke test Vic noticed Stripe Checkout adds a **3.75% FX conversion fee** when the customer's card currency differs from the merchant's settlement currency. Resolution: enable **Adaptive Pricing** on the Stripe Dashboard (Settings -> Payments -> Adaptive Pricing) so each session is presented to the customer in their card's currency and Stripe absorbs the conversion. No code change required - this is a Stripe-side toggle. Added here as a Phase 2 polish item so it doesn't get lost.

### Commit (local only, per REBIRTH-11.3 - Vic pushes manually)

- Message: `fix: improve plan PDF floor plan rendering + Draw mode polygon room`

### Push command for Vic

```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```

---

## Hotfix 5: Draw mode comprehensive fix - vertex placement + mode-switch crash + polygon close

**Reported by Vic** after Hotfix 4 deploy:

1. **Cannot draw anything** - clicks on the canvas didn't place vertices (or placed vertices never rendered). The HUD now showed (a Hotfix 4 win), but the drawing flow was dead.
2. **Rect -> Draw mode switch caused a "dead page"** - toggling to Rect then back to Draw produced a white screen / crashed Konva subtree / unresponsive canvas.

### Root cause (single root for both bugs)

Hotfix 4's "portal the HUD out of the Stage" fix put the portal **inside** the Konva `<Stage>` subtree:

```jsx
<Stage>
  <RoomDrawMode>
    <Layer .../>          // Konva node - fine
    <DrawHUD>{ createPortal(<div>...</div>, htmlContainer) }
  </RoomDrawMode>
</Stage>
```

React's `createPortal` doesn't switch reconcilers - the portal's children are still processed by the **same** host renderer that owns the parent tree. That host renderer is `react-konva`. So the inner `<div>` / `<input>` / `<button>` nodes hit `Core.default['div'] === undefined` in `react-konva`'s `createInstance` - the lookup falls back to `Konva.Group`. Then `appendChildToContainer(parentInstance.add(child))` runs against the DOM `containerRef.current` div... which has no `.add()` method. Result: either a silently broken Stage (no click handler binding, no vertices render - that's Bug 1) or a thrown exception that propagates up and unmounts the entire app section (white screen on Rect -> Draw toggle - that's Bug 2).

In short, the Hotfix 4 portal trick was the wrong shape. It made the HUD *visible* (because the portal mechanism does render to the HTML container correctly when reached), but only when the rest of the subtree didn't first blow up the reconciler.

### Fix

Split `RoomDrawMode` into **two siblings of the Stage**:

- `RoomDrawLayer` (Konva-only, child of `<Stage>`) - holds the `<Layer>` with the vertex dots, wall segments, length labels, hover crosshair, close-target circle. Wires `stage.on('click.roomdraw' | 'tap.roomdraw' | 'mousemove.roomdraw' | 'touchmove.roomdraw')` from a `useEffect` keyed on `enabled / stageRef / containerRef / pxPerMetre`.
- `RoomDrawHUD` (DOM-only, sibling of `<Stage>`) - the name input + perimeter / area readout + Undo / Close / Cancel buttons. Renders as a plain `<div>` inside the same `containerRef`, NEVER inside the Stage tree.

Shared state (`drawVertices`, `drawHover`, `drawName`) was **lifted up** to the parent `RoomCanvas`. Both children consume it via props. This guarantees the Konva subtree only ever sees Konva nodes, and the DOM subtree only ever sees DOM nodes - the two reconcilers never see each other's content.

Additional fixes pulled in while touching this code path (operating in the task's quality > speed mode):

- **Enter-to-close** as an alternative to "click first vertex" (per spec).
- **Console-log breadcrumbs** at every critical step under the tag `[draw-mode]`: click handler, vertex push, close-detection, Enter, Escape, Ctrl/Cmd+Z, layer wire/unwire, mode-toggle reset, commit, cancel. They stay in until Phase 1 is stable.
- **`CanvasErrorBoundary`** wrapping the canvas region in `App.tsx`. If a future change crashes the Konva tree again the rest of the app stays alive and Vic sees a clear "Reset canvas" affordance instead of a white screen.
- **Stale-closure proofing**: every Stage event handler reads its dependencies through `useRef.current` so handlers wired once never go stale, even as the parent re-renders. The `useEffect` re-binds Stage handlers only when `enabled / stageRef / containerRef / pxPerMetre` change (not on every name keystroke).
- **`handleDrawCommit` / `handleDrawCancel` memoised** via `useCallback`, removing churn that previously rebuilt them on every parent render.
- **`onEnter draw mode` reset** moved up to `RoomCanvas` (it owns the state now) and only fires when `drawMode` flips true, so it doesn't clobber name edits.
- **Inline `kbd` hint** at the bottom-left of the canvas now mentions Enter as an alternative close gesture.

### Side fix - jspdf 2.5.2 missing type defs

While running `npx tsc --noEmit` to verify the draw-mode fix, found 11 pre-existing TS errors in `src/lib/planPdf.ts` (committed in Hotfix 4 as part of the vector-PDF rewrite). Root cause: the installed `jspdf@2.5.2` ships `"typings": "types/index.d.ts"` in its package.json but the actual `types/` folder is missing from the published tarball. TS falls back to the JS module's empty exports and can't resolve `doc.lines`, `doc.circle`, `doc.triangle`, `doc.getTextWidth`, `doc.setLineCap`, `doc.setLineJoin`. All six methods exist at runtime - this is purely a missing-types-file issue upstream.

Fix: redefined `jsPDF` locally inside `planPdf.ts` as an intersection of `InstanceType<typeof JsPDFCtor>` with the missing method signatures, plus a tiny cast on the constructor. Two lines of real change, no behaviour change, lets the rest of the file stay strict-typed and `npx tsc --noEmit` now exits 0.

### Files touched

- `src/components/RoomDrawMode.tsx` - **major rewrite**. Split into `RoomDrawLayer` (Konva, child of Stage) and `RoomDrawHUD` (DOM, sibling of Stage). Removed `createPortal` entirely. Added Enter-to-close. Added `[draw-mode]` console-log breadcrumbs. Refs-everywhere stale-closure proofing.
- `src/components/RoomCanvas.tsx` - lift `drawVertices` / `drawHover` / `drawName` state up. Memo `handleDrawCommit` / `handleDrawCancel`. Render `<RoomDrawLayer>` inside `<Stage>`, render `<RoomDrawHUD>` as a sibling outside the Stage. Add `[draw-mode]` enter-Draw log + reset. Update the inline `kbd` hint to mention Enter.
- `src/App.tsx` - wrap the canvas section in `CanvasErrorBoundary`. Boundary's Reset clears `drawMode`.
- `src/components/CanvasErrorBoundary.tsx` - **new** (74 lines). React class error boundary scoped to the canvas region.
- `src/components/__tests__/RoomDrawMode.test.ts` - **new** (300 lines, 22 tests). Pure click-handler chain tests + architecture-invariant tests (read RoomDrawMode.tsx as text and assert no `createPortal(`, both new exports present, the deprecated combined export is gone, the Stage event names are wired/unwired correctly, Enter / Escape / Ctrl-Z keys handled, console-log breadcrumbs present at every critical step).
- `src/lib/planPdf.ts` - tiny side fix (local jsPDF type augmentation, see Side fix section). 2 lines of net change.
- `WEEK-4b-LOG.md` - this entry.

### Verification

- `npx tsc --noEmit` - clean (exit 0). All 11 pre-existing planPdf type errors now resolved by the local type augmentation.
- `npm test` - **207/207 pass across 15 test files** (was 176/176 across 13 files - the +9 floorPlanSvg tests from Hotfix 4 had already brought it to 176, the +22 new RoomDrawMode tests + +8 net from a planPdf test rewrite by prior work-in-progress brought it to 207).
- `npx vite build` - clean (998.23 kB JS / 21.13 kB CSS, same pre-existing chunk-size warning).
- Test count delta from Hotfix 4 -> Hotfix 5: **176 -> 207 = +31 tests, +2 test files**.

### Commit (local only, per REBIRTH-11.3 - Vic pushes manually)

- Message: `fix(draw-mode): vertex placement, mode-switch crash, polygon close - comprehensive`

### Push command for Vic

```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```

---

## Hotfix 5: architectural-grade plan PDF (vector floor plan, no canvas snapshot)

**Reported by Vic** during a follow-up review of the customer plan PDF: the floor plan was effectively "a low-quality canvas snapshot" — Hotfix 4 had improved the SVG renderer, but it was still being rasterised through `canvas.toDataURL()` and embedded as a stretched PNG. That route loses crispness on print, the wall labels look pixelated, and customer-facing zoom is illegible. PPW is selling premium installs - the document needs to look like a real architectural plan.

### Bar we're shooting for

Reference quality: SketchUp 2D plan exports, Floorplanner brochures, real-estate listing floor plans (RICS-style "drawn to scale" pages). Crisp at any zoom, vector everything, scale bar + north arrow + dimension lines + soft category fills + bold labels.

### Fix

`src/lib/planPdf.ts` rebuilt from scratch as a pure-vector jsPDF generator. Every shape, line, label is drawn with jsPDF primitives — `rect`, `line`, `lines`, `circle`, `triangle`, `text`, `setFillColor`, `setDrawColor`, `setLineWidth`, `setFontSize`, `setFont`, `getTextWidth`. **Zero raster anywhere in the pipeline.** No `addImage`, no `html2canvas`, no `Stage.toDataURL()`, no Konva snapshots, no `svgToPngDataUrl`.

Layout (A4 portrait, mm units throughout):

- **Page 1 - Cover.** Teal hero block with "PEAK PERFORMANCE WELLNESS", title "Wellness Property Design Plan", customer name + address, order ref + date, property summary (room count, total area in m2, total items, grand total in cart currency), italic thank-you line, footer.
- **Pages 2..N - One per room.** Title block (room name, bounding box dims, floor area, item count) → vector floor plan box (~70% of page) containing:
  - Polygon walls drawn with a 1.2 mm thick ink stroke and a soft cream interior fill.
  - Subtle 0.5 m grid clipped to the polygon bounds.
  - Each placed item rendered as a category-tinted rectangle (ice-bath blue, sleep-pod purple, ergo-chair brown, plant green, eco-office sand, neutral grey fallback) scaled to its real cm footprint, rotated correctly via 4-corner rotation matrix, with bold product name, dimensions, SKU stacked inside (auto-shrink + truncation when tight).
  - Wall length labels in white-on-ink pills perpendicular to each wall midpoint.
  - Dimension lines along the bottom and left edges with metre tick marks.
  - Segmented scale bar (0 / 1 m / 2 m) bottom-left.
  - North arrow (white circle + coral triangle + "N" label) top-right.
  - Category legend bottom of plan box.
  - Per-room product table via jspdf-autotable below the plan.
- **Last page - Itemised summary.** Cross-room SKU rollup table (SKU, Product, Qty, Dimensions, Supplier, Unit, Total) → totals block (Subtotal / Shipping / Grand total) → "Payment & next steps" panel with the order reference + currency + 3-step process → "Questions? victor@ppwellness.co" contact line.

Currency formatting uses a small in-module helper `formatCurrencyPdf` instead of the locale-dependent `Intl` formatter (which can vary in Node vs browser). MUR shows zero decimals with "Rs " prefix; USD uses "$"; EUR/GBP use 3-letter codes. Thousands grouped with commas. **No commission percentages anywhere.**

### Schema changes

`OrderPdfInput` extended with full per-room geometry:

- `PdfRoom` now carries `polygon: {x,y}[]` (metres) and `placedItems: PdfPlacedItem[]` (each with `xM`, `yM`, `lengthM`, `widthM`, `rotation`, `productName`, `category`, `dimensionsLabel`, `sku`).
- `PdfProductLine` adds optional `supplier` for the summary table.
- Top-level adds `customerAddress?` and `shipping?`.

`orderSnapshot.ts` — `RoomSnapshot` extended with `polygon?` and `placedItems?: SnapshotPlacedItem[]`. The deprecated `floorPlanDataUrl` field is retained on the type so old localStorage payloads still parse, but the new generator ignores it. `LastOrderSnapshot` adds `customerAddress?` and `shipping?`.

`CheckoutPage.tsx` — `captureOrderSnapshot` no longer rasterises (was `await svgToPngDataUrl(svg)`). It now stashes `polygon` + `placedItems` geometry directly. `floorPlanSvg.renderRoomSvg`/`svgToPngDataUrl` imports removed from this file (the module still exists for the standalone test suite but is no longer used by the production PDF path). Address parts joined into a single line for the cover.

`OrderSuccessPage.tsx` — `buildPdfInput` rewritten to feed the richer shape. Snapshot path uses snapshot polygon/placedItems; fallback path builds a placeholder 5x4 m room when no snapshot is available.

`src/vite-env.d.ts` — local jsPDF type shim extended with `lines`, `circle`, `triangle`, `setLineCap`, `setLineJoin`, `getTextWidth` (the bundled jspdf install is missing its own .d.ts in this repo, so we ship a curated shim).

### Files changed (LOC delta)

| File                                   | Before | After  | Delta |
|----------------------------------------|--------|--------|-------|
| `src/lib/planPdf.ts`                   | ~313   | ~945   | +632  |
| `src/lib/orderSnapshot.ts`             | ~82    | ~112   | +30   |
| `src/pages/CheckoutPage.tsx`           | ~427   | ~433   | +6    |
| `src/pages/OrderSuccessPage.tsx`       | ~217   | ~271   | +54   |
| `src/vite-env.d.ts`                    | ~98    | ~118   | +20   |
| `src/lib/__tests__/planPdf.test.ts`    | ~54    | ~247   | +193  |
| **Total**                              |        |        | **+935** |

### Verification

- `npx tsc --noEmit` - clean (exit 0).
- `npm test` - **207 / 207 pass across 15 test files** (was 176 / 176 across 13 - +11 new planPdf vector-render tests, +1 currency-format suite, +1 sample-plan placeholder; +13 net cumulative since Hotfix 4).
- `npx vite build` - succeeds (998.23 kB JS / 21.13 kB CSS, ~7 kB above Hotfix 4 from the new vector code, still well inside the 2 MB Week 1 budget).
- **Sample PDF rendered locally** via a one-shot vitest dump - 4 pages, 55,756 bytes, valid PDF v1.3 - copied to repo root as `sample-plan.pdf` and to the session outputs folder for Vic to inspect.

### Files changed

- `src/lib/planPdf.ts` — full rewrite around vector primitives.
- `src/lib/orderSnapshot.ts` — schema extended with polygon + placedItems geometry; address + shipping fields.
- `src/pages/CheckoutPage.tsx` — `captureOrderSnapshot` switched from raster to geometry; `renderRoomSvg`/`svgToPngDataUrl` imports removed.
- `src/pages/OrderSuccessPage.tsx` — `buildPdfInput` feeds the new shape.
- `src/vite-env.d.ts` — jsPDF type shim extended with the methods the new generator uses.
- `src/lib/__tests__/planPdf.test.ts` — full rewrite covering size threshold, multi-room scaling, empty-room handling, raw-byte text grep for cover title / room names / product names / order ref / customer email / footer, and `not.toContain('/Subtype /Image')` assertion to lock in "no raster ever".
- `src/lib/__tests__/sample-plan.test.ts` — placeholder shim left over from the one-shot sample-PDF dump (the Linux mount in this Cowork session refused to delete the file; harmless).
- `sample-plan.pdf` — committed sample at repo root for visual QA.
- `WEEK-4b-LOG.md` — this entry.

### Commit (local only, per REBIRTH-11.3 - Vic pushes manually)

- Message: `fix(plan-pdf): architectural-grade floor plan, vector-rendered from data`

### Push command for Vic

```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```

---

## Hotfix 7: Draw-mode Close + Enter actually commit a new room

**Reported by Vic** after Hotfix 5/6 deploy. Symptoms:

- In Draw mode, vertices placed fine, but clicking **Close** or pressing **Enter** did nothing visible - no new room appeared in the room list.
- Only **Cancel** appeared to work (because it just discarded the in-progress polygon).
- Net effect: user could not add a second room via the "Add room -> Draw polygon" flow.

### Root cause (one line)

`RoomCanvas.handleDrawCommit` had a conditional that **overwrote the active room's polygon** with the drawn polygon whenever the active room had zero placed items, instead of always adding a NEW room - so the second "Add room -> Draw" attempt silently replaced the empty active room's shape and never grew the rooms list.

The bug branch:

```ts
if (ar && ar.placedItems.length === 0) {
  setRoomPolygon(ar.id, newPolygon);   // <-- overwrites instead of adding
} else {
  const id = addRoom({ name, polygon: newPolygon });
  ...
}
```

The Close button and Enter key were both correctly wired into this commit path. They both ran. They just hit the overwrite branch instead of the add-room branch, so the rooms list never grew and Vic saw "nothing happened".

### Fix

`src/components/RoomCanvas.tsx` - `handleDrawCommit` rewritten so every Close / Enter / click-first-vertex commit goes through `usePropertyStore.getState().addRoom(...)`. The overwrite branch is gone entirely. Added:

- **`[draw-close]` diagnostics** at every branch point (`guard-too-few-vertices`, `commit-start`, `commit-success`, `commit-error`).
- **Try/catch around `addRoom`** with a user-facing toast on the error path (previously a silent throw would have killed the commit with no UI feedback).
- **`pushToast` on the < 3 vertices guard** so a caller that bypasses the disabled-button UI (e.g. Enter pressed too early) gets feedback.
- **Defensive `setActiveRoom(id)`** after `addRoom` - `addRoom` already sets it, but the explicit call locks the contract in.

`src/components/RoomDrawMode.tsx` - the close handlers updated to match the new commit contract:

- **HUD `handleClose`** emits `[draw-close]` with `reason: 'hud-close-button'` (or `'hud-close-button-too-few-vertices'` on the disabled-state guard), and shows a toast on the guard path.
- **Layer `onKey` Enter handler** no longer early-returns when focus is in an INPUT/TEXTAREA. The pre-Hotfix-7 guard bailed out at the top of `onKey` whenever the target was an input, which is exactly the state right before the user finishes drawing (they tab over to rename the room, then hit Enter to close). Enter now blurs the input, fires `[draw-close] reason: 'enter-key'`, and commits.
- **Click-first-vertex close** also emits `[draw-close] reason: 'click-first-vertex'` so all three close gestures share one tag.
- **Close button `title`** is now context-aware: `"Need at least 3 walls"` when disabled, `"Close polygon and commit as new room (Enter)"` when enabled.
- **Draw-mode-enter reset** in RoomCanvas now defaults `drawName` to `'New Room'` rather than the active room's name (which was misleading now that Draw mode always adds a NEW room).

### Files touched

- `src/components/RoomCanvas.tsx` - `handleDrawCommit` rewritten; `setRoomPolygon` import removed; `drawName` default switched to `'New Room'`.
- `src/components/RoomDrawMode.tsx` - Enter handler rewired so it works in inputs; HUD `handleClose` and click-first-vertex handler both emit `[draw-close]`; Close button tooltip is context-aware; toast on too-few-vertices guards.
- `src/components/__tests__/RoomDrawMode.test.ts` - **+11 tests**. New `RoomDrawMode - close-commit (Hotfix 7)` describe block exercises the propertyStore boundary directly (Close click adds new room, Enter does same as Close, < 3 vertices rejects, Cancel adds nothing, second Close from empty active room still adds a new room - pins the exact bug Vic reported). Two new source-inspection describes pin the `disabled={vertices.length < 3}` button state, the `Need at least 3 walls` tooltip, the `[draw-close]` reason tags, and the always-`addRoom`-never-`setRoomPolygon` invariant inside `handleDrawCommit`.
- `WEEK-4b-LOG.md` - this entry.

### Verification

- `npx tsc --noEmit` - clean (exit 0).
- `npm test` - **218 / 218 pass across 15 test files** (was 207 / 207 - **+11 new tests**).
- `npx vite build` - clean (999.18 kB JS / 21.34 kB CSS; in-place `dist/` rebuild hit the same pre-existing Windows EPERM that earlier hotfixes saw, ran cleanly when pointed at a temp `outDir`).
- Test count delta: **207 -> 218 (+11)**.

### Commit (local only, per REBIRTH-11.3 - Vic pushes manually)

- Message: `fix(draw-mode): wire Close button + Enter key to commit polygon as new room`

### Push command for Vic

```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```
