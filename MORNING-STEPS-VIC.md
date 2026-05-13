# Morning Steps — Vic — Finish Week 4b (≈ 10 minutes)

**State as you wake up:** Production is LIVE at https://ppw-designer-2d.vercel.app/. Stripe Checkout already returns a real session URL when called with the right payload (verified by curl overnight — see `WEEK-4b-LOG.md`). You just need to close out the webhook + DNS + Resend domain.

Do **A → B → C** in one sitting (≈ 5 min). **D → E** can wait until later in the day. **F** is the final smoke test.

---

## Step A — Register the Stripe webhook (~3 min)

1. Open **https://dashboard.stripe.com/test/webhooks** (TEST mode — keep it test for now).
2. Click **"Add endpoint"** (older accounts: **"Add destination"**).
3. **Endpoint URL:** `https://ppw-designer-2d.vercel.app/api/stripe-webhook`
4. **Description:** `PPW Designer 2D — order fulfilment` (optional).
5. **Events to send** → click **"+ Select events"** → check exactly these two:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
6. Click **Add events**, then **Add endpoint**.
7. On the new endpoint's detail page, find the **"Signing secret"** section → click **"Reveal"** → copy the value (starts with `whsec_…`). Keep this tab open — you'll paste it in Step B.

---

## Step B — Add `STRIPE_WEBHOOK_SECRET` to Vercel (~1 min)

1. Open **https://vercel.com/victor-ppw/ppw-designer-2d/settings/environment-variables**
2. Click **Add New**.
3. **Key:** `STRIPE_WEBHOOK_SECRET`
4. **Value:** paste the `whsec_…` you just copied.
5. **Environments:** tick all three — Production, Preview, Development.
6. Click **Save**.

---

## Step C — Redeploy so the new env var ships (~1 min + ~1 min build)

1. Open **https://vercel.com/victor-ppw/ppw-designer-2d** → **Deployments** tab.
2. Click the **"⋯"** menu on the topmost deployment → **Redeploy**.
3. In the dialog, leave **"Use existing Build Cache"** ticked → **Redeploy**.
4. Wait ~1 min until the status badge flips to **"Ready"**.

Step C must happen *after* Step B — Vercel only injects env vars at build/run time, so a redeploy is required.

---

## Step D — DNS for custom domain `designer.ppwellness.co` (can wait, ~5 min you + 5–30 min propagation)

1. In Vercel: **Settings → Domains → Add Domain** → type `designer.ppwellness.co` → **Add**.
2. Vercel will show you a panel like *"Set the following record on your DNS provider"* with an exact **CNAME** value (usually `cname.vercel-dns.com`). **Leave this tab open.**
3. Log into your domain registrar (where `ppwellness.co` is parked).
4. Go to the DNS zone for `ppwellness.co`.
5. Add a new record:
   - **Type:** `CNAME`
   - **Host / Name:** `designer`
   - **Value / Target:** the exact `cname.vercel-dns.com` string Vercel showed you
   - **TTL:** 5 min or default
6. Save. Return to the Vercel domains panel — it will re-check automatically and flip to **"Valid Configuration"** within 5–30 min.

---

## Step E — Verify `ppwellness.co` in Resend (can wait, ~5 min you + verification)

1. Open **https://resend.com/domains** → **Add Domain** → enter `ppwellness.co` → **Add**.
2. Resend gives you **3 DNS records**: one SPF (TXT), one DKIM (TXT or CNAME), one DMARC (TXT). Keep this tab open.
3. In your registrar's DNS zone for `ppwellness.co`, add each record exactly as Resend shows. Common gotchas:
   - SPF: if you already have an SPF TXT record, do not duplicate — merge instead. Tell me first if one exists.
   - DKIM: usually a CNAME — copy the host and target verbatim.
   - DMARC: a TXT at `_dmarc.ppwellness.co`.
4. Back in Resend, click **Verify**. May take a few minutes.

Until this verifies, order-confirmation emails fall back to the Resend sandbox sender (`onboarding@resend.dev`) — fine for testing, **not** for live customers.

---

## Step F — Full smoke test (~3 min, do this *after* A→B→C; D→E optional for this test)

1. Open **https://ppw-designer-2d.vercel.app/** (or `https://designer.ppwellness.co/` once Step D propagates).
2. Drag a couple of products into a room → click **Checkout**.
3. Fill the customer form with real-looking data (use your own email so the confirmation lands somewhere you can see it).
4. On the Stripe Checkout page, use the test card:
   - Number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12/30`)
   - CVC: any 3 digits (e.g. `123`)
   - ZIP: any (e.g. `90901`)
5. Submit. Expect to land on `/order/success` with:
   - ✅ The plan PDF auto-downloads.
   - ✅ A Stripe email receipt arrives at the address you used.
   - ✅ An order-alert email arrives at the Resend-configured destination (once Step E is done — until then, check Resend logs at https://resend.com/emails).
   - ✅ In Stripe dashboard: a `checkout.session.completed` event appears, and your webhook endpoint logs it as delivered (2xx).

If any of these fail, open `WEEK-4b-LOG.md` for the curl payload contract and reply back to me with the failure — I can debug from the curl side.

---

## If anything goes wrong

- **Step C build fails** → it's almost certainly Node version. Project Settings → General → Node.js Version → must be `22.x`.
- **Webhook returning 400 in Stripe** → signing secret mismatch. Re-copy the `whsec_…` (no leading/trailing spaces) and redeploy.
- **DNS not validating after 30 min** → confirm in the registrar that the CNAME host is `designer` (not `designer.ppwellness.co.`) — most registrars auto-append the apex.
- **Resend won't verify** → SPF collision is the usual culprit. Send me the existing SPF TXT and I'll merge it.

Any other surprise — flag it. We are one webhook + two DNS changes away from done.
