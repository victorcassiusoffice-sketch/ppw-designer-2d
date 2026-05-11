# Vercel Deploy Guide - Week 4b

**Owner:** Vic.
**Status:** Pre-flight. Nothing live yet. ZERO money will be spent following these steps in test mode.

This is the exact sequence to get `designer.ppwellness.co` live with Stripe Checkout + webhook + Resend email + custom domain. Follow top-to-bottom; each step takes a few minutes.

---

## 0. Pre-flight - what is already wired

- Code in `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\` is feature-complete for Week 4a (Stripe Checkout Session function, webhook handler, Resend wrapper, plan PDF generator).
- `package.json` includes the new deps (`stripe`, `resend`, `jspdf`, `jspdf-autotable`).
- `vercel.json` declares the function routes + SPA rewrite.
- Local typecheck / tests / vite build all PASS (see `WEEK-4a-LOG.md`).
- `.env.example` lists every env var the project needs.

You will need accounts at: **Vercel**, **Stripe**, **Resend**. None require a credit card to start in test mode.

---

## 1. Push the repo to GitHub (one-off, ~5 min)

Cowork has NOT pushed. Run these in PowerShell from `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\`:

```powershell
git status                  # sanity-check the diff is what you expect
git add -A
git commit -m "Week 4a: Stripe checkout function, webhook, Resend email, plan PDF"
git remote -v               # confirm an origin exists
# if no origin yet:
# git remote add origin https://github.com/<your-user>/ppw-designer-2d.git
git push -u origin main
```

If GitHub asks for credentials, use your PAT (personal access token). Do NOT paste it into a chat afterwards.

---

## 2. Sign up for Resend (~3 min)

1. Go to <https://resend.com/signup>. Use `victor@ppwellness.co`.
2. After login: **API Keys** -> **Create API Key** -> name it `ppw-designer-prod`. Copy the `re_...` value into a password manager. You will only see it once.
3. **Domains** -> **Add Domain** -> `ppwellness.co`. Resend gives you 3-4 DNS records (TXT, MX, DKIM). 
4. In your DNS provider (HostGator or wherever the `ppwellness.co` zone lives), add those records. Propagation = 5-15 min.
5. Back in Resend, click **Verify**. Once green, real emails from `victor@ppwellness.co` will send.

Until verification completes, the function will still run - it falls back to console logging (no real send). Vic will get the alert in the Vercel function log instead.

---

## 3. Make sure Stripe is ready (~2 min)

The Stripe account was created in Week 3 (see `STRIPE-INTEGRATION-NOTES.md`). Confirm:

1. <https://dashboard.stripe.com> -> top-left toggle is on **TEST mode** (orange).
2. **Developers -> API keys**. Have these tabs open ready to copy:
   - `pk_test_...` (publishable) - already in `.env.local`. Will also paste into Vercel.
   - `sk_test_...` (secret) - paste into Vercel only. NEVER into `.env.local`.

Webhook signing secret comes later in step 6 - leave that one for now.

---

## 4. Import the repo into Vercel (~3 min)

1. <https://vercel.com/new>. Sign in with GitHub.
2. **Import Git Repository** -> pick `ppw-designer-2d`.
3. Framework preset: **Vite**. (Vercel auto-detects from `vite.config.ts`.)
4. Build command: leave default `npm run build` (this runs `tsc --noEmit && vite build`).
5. Output directory: `dist`.
6. Root directory: `./` (default).
7. Click **Deploy** but do NOT add env vars yet - the first deploy will FAIL (or run in dry mode); that's expected and harmless.

---

## 5. Add the 4 environment variables (~3 min)

In the Vercel project dashboard: **Settings -> Environment Variables**. Add each of these for **Production** AND **Preview**:

| Name | Value | Where it came from |
| ---- | ----- | ------------------ |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Stripe Dashboard -> Developers -> API keys |
| `STRIPE_SECRET_KEY`           | `sk_test_...` | same place, "Secret key" |
| `STRIPE_WEBHOOK_SECRET`       | `whsec_...`   | (step 6 - blank for now, fill after step 6) |
| `RESEND_API_KEY`              | `re_...`      | Resend -> API Keys (step 2) |

After adding all four: **Deployments -> latest -> Redeploy** so the new env vars take effect.

A successful deploy shows the temporary URL `https://ppw-designer-2d-<hash>.vercel.app`. Open it - you should see the designer. Try `/cart` and `/order/success` - both should return 200.

---

## 6. Register the Stripe webhook (~3 min)

1. Stripe Dashboard (TEST mode) -> **Developers -> Webhooks -> Add endpoint**.
2. Endpoint URL: `https://ppw-designer-2d-<hash>.vercel.app/api/stripe-webhook` (use the live Vercel URL; will update to the custom domain after step 7).
3. Events to send: tick exactly these THREE:
   - `checkout.session.completed`
   - `payment_intent.succeeded` (optional but useful)
   - `payment_intent.payment_failed`
4. Click **Add endpoint**.
5. On the endpoint detail page, copy the **Signing secret** (`whsec_...`) and paste it into the Vercel env var `STRIPE_WEBHOOK_SECRET` (Settings -> Environment Variables -> edit `STRIPE_WEBHOOK_SECRET`).
6. **Deployments -> Redeploy** so the function picks it up.
7. Back in Stripe -> the webhook endpoint page -> **Send test event** -> pick `checkout.session.completed` -> Send. Should return `200 OK` within 200ms in Stripe's view.

---

## 7. Custom domain `designer.ppwellness.co` (~5 min DNS + 10 min wait)

1. Vercel project dashboard -> **Settings -> Domains -> Add**.
2. Enter `designer.ppwellness.co`. Vercel will show a CNAME target (something like `cname.vercel-dns.com`).
3. In your DNS provider, add a **CNAME record**:
   - Name: `designer`
   - Value: `cname.vercel-dns.com`
   - TTL: 300 (5 min)
4. Wait 5-15 minutes. Vercel will pick up the propagation and issue a Let's Encrypt cert automatically.
5. Once green, the public URL is `https://designer.ppwellness.co`.

Update the Stripe webhook URL to point at the custom domain:
- Stripe Dashboard -> Webhooks -> your endpoint -> **Update endpoint URL** -> `https://designer.ppwellness.co/api/stripe-webhook`.
- (The signing secret does NOT change.)

---

## 8. Smoke test the full flow (~5 min)

1. Open `https://designer.ppwellness.co/`. Drop a few products into a room.
2. Click cart -> Checkout. Fill in the form. Click **Place order**.
3. Stripe Checkout opens. Use the test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC, any 5-digit ZIP.
4. After payment Stripe redirects to `/order/success`. The plan PDF auto-downloads.
5. Within 5 seconds, two emails should arrive: one to the email you typed in the form (customer confirmation) and one to `victor@ppwellness.co` (Vic alert). If they don't arrive, check Vercel function logs - if Resend domain verification is incomplete, the email will be in the function log instead of in an inbox.

When that all works in TEST mode, you flip to live by:
- Stripe Dashboard -> top-left toggle to **LIVE**.
- Copy the LIVE `pk_live_...` and `sk_live_...` into Vercel env vars (replace the test values).
- Stripe Dashboard -> Webhooks -> add a new endpoint pointing at `/api/stripe-webhook` (LIVE-mode webhooks are separate from TEST). Copy its `whsec_...` into Vercel.
- Redeploy.

---

## Rollback

If anything goes wrong, **Vercel -> Deployments -> previous successful** -> click the `...` menu -> **Promote to production**. Instant rollback.

To kill the Stripe webhook temporarily: Stripe Dashboard -> Webhooks -> your endpoint -> **Disable**.

---

## Cost summary - what you are committing to

- **Vercel free tier**: 100 GB/mo bandwidth, 1M function invocations/mo. Designer traffic at MVP launch volume = effectively free.
- **Stripe**: 2.9% + R10 per successful transaction (Mauritius pricing). Zero fixed cost.
- **Resend free tier**: 3,000 emails/mo, 100/day. More than enough for MVP.
- **Domain `ppwellness.co`**: already paid (HostGator), no marginal cost.

**Total marginal cost of running this stack at MVP scale = ~$0/mo.** Once orders flow, Stripe takes its cut on the transaction itself.

