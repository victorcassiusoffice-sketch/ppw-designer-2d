# Decisions Pending - WRD Konva 2D MVP

**Owner:** Vic.
**Last refresh:** 2026-05-12 00:11 MUT (post-Week-4b overnight deploy — Vercel LIVE, Stripe Checkout end-to-end verified by curl, webhook + DNS pending Vic morning).

---

## Decided 2026-05-11 (Week 2.5 lock-in)

Vic ratified five infrastructure choices simultaneously when authorising the Week 2.5 mammoth scope. These are STRUCK - no longer pending.

- **A.2 Payment stack** -> **Stripe** (Payment Links / Checkout). Cart aggregates per Property -> one order.
- **A.3 Hosting** -> **`designer.ppwellness.co`** on Vercel free tier (subdomain pattern, Option B).
- **A.6 Sender residence** -> **Workspace `victor@ppwellness.co`**.
- **Room model** -> **Polygon walls only** (Week 2.5 shipped). Doors / windows DEFERRED to Phase 2.
- **Multi-room model** -> **Model A - separate canvases per room** (RoomSketcher-style). NOT floor-plan adjacency.

Implementation evidence: `WEEK-2.5-LOG.md`, `MIGRATION-NOTES.md`.

## Decided implicitly 2026-05-11 (Week 4a build)

- **A.4 Plan PDF generation** -> **A. Client-side jsPDF**. Cowork shipped `src/lib/planPdf.ts` per Vic's preferred recommendation. SVG-based floor plans captured at checkout-submit time, baked into the PDF on the success page. Server-side `@react-pdf/renderer` left as a Phase-2 fallback if quality complaints surface.

---

## Decided 2026-05-11/12 (Week 4b overnight autonomous deploy)

- ~~**Vercel project creation**~~ — DONE. Project `victor-ppw/ppw-designer-2d` live at https://ppw-designer-2d.vercel.app/.
- ~~**Node version pin**~~ — Project Settings → Node.js 22.x (was defaulting to 24.x and breaking the build).
- ~~**Env vars (3 of 4)**~~ — `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` all pasted into Vercel and confirmed reaching runtime (curl returned a real `cs_test_…` Checkout URL).
- ~~**Payload contract verification**~~ — `/api/create-checkout-session` validated end-to-end against `api/lib/orderTypes.ts`. Canonical field is `cart[].unitAmount` in smallest currency unit. Stripe round-trip confirmed at 2026-05-12 00:10 MUT.

## Still open — Vic morning Week 4b

- **`STRIPE_WEBHOOK_SECRET`** — Vic registers the webhook at `dashboard.stripe.com/test/webhooks` and pastes `whsec_…` into Vercel env. Cowork blocked: Stripe Dashboard creds not held. **See `MORNING-STEPS-VIC.md` Steps A–C.**
- **DNS CNAME for `designer.ppwellness.co`** — Vic adds the CNAME at the registrar that hosts `ppwellness.co`. Cowork blocked: registrar creds not held. **See Step D.**
- **Resend domain verification for `ppwellness.co`** — Vic pastes 3 DNS records (SPF/DKIM/DMARC). Cowork blocked: same registrar. **See Step E.**
- **End-to-end smoke test on live URL** — Vic runs once webhook + (optionally) DNS are in. **See Step F.**

---

## Closed historical entries (reference)

- **A.1 Repo strategy** - closed 2026-05-11 (Week 1 Day 1): Option B, fresh init at `PPW-Code\ppw-designer-2d\`.
- **A.4 Plan PDF generation** - closed 2026-05-11 (Week 4a, Cowork shipped client-side jsPDF per the recommended path).
- **A.5 Email/invoice sender (Shopify built-in vs Mailgun)** - moot now that A.2 = Stripe (no Shopify in scope). Closed by transitive decision.
- **Transactional email provider** - closed 2026-05-11 (Vic locked Resend). SDK + dry-run fallback wired in `api/lib/email.ts`. Domain DNS verify + API key paste happen at Week 4b cutover.

---

## Other PPW-wide open items relevant to this build

- **PAT-used-without-asking ruling (REBIRTH 11.3)** - Vic authorised a one-off push at 2026-05-11 23:22 MUT specifically for the Week 4b Vercel cutover (commit `358e73c`). Default rule still holds: all future commits stay local until Vic rules. Future deploys will re-prompt.
- **`/space-designer-pro.html` mobile breakpoint fix** - single CSS block, ~30 min. Independent of this MVP but on the same domain.
- **Cat 1 blast send Y/N** - Vic's call at end of Week 4 once the live URL passes curl-verify.

---

## What changes when Vic decides

Updates appended to this file by Cowork (timestamp + decision + impact). Nothing in the locked sprint plan changes without an explicit Vic confirmation logged at the bottom of `WRD-KONVA-SPRINT-PLAN.md`.
