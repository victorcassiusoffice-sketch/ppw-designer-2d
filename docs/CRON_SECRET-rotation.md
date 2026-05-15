# `CRON_SECRET` rotation calendar

**OMS Wave 4.10 — operational hygiene.**

The `CRON_SECRET` env var authenticates every call to `/api/cron/*`
endpoints. Rotating it every 90 days reduces blast radius if the
secret ever leaks through Vercel build logs / Sentry breadcrumbs / a
copy-paste accident.

## Rotation procedure

1. Generate a new 32-byte hex secret:

   ```powershell
   [System.BitConverter]::ToString((1..32 | ForEach-Object { Get-Random -Min 0 -Max 256 })) -replace '-'
   ```

   …or `openssl rand -hex 32` on any Unix.

2. Update the Vercel env var:

   ```powershell
   npx vercel env rm CRON_SECRET production
   npx vercel env add CRON_SECRET production
   # paste the new value
   ```

3. Trigger a redeploy so the env var ships:

   ```powershell
   npx vercel deploy --prod
   ```

4. Smoke-test the cron path with the new secret:

   ```powershell
   curl -X GET "https://designer.ppwellness.co/api/cron/escalate-orders?key=<new-secret>"
   # expect 200 + { ok: true, flaggedCount: 0, items: [] }
   ```

5. Update the local `outputs/OMS-CRON-SECRET.txt` (gitignored) with the
   new value so the next driver knows it without having to round-trip
   through Vercel.

## Calendar reminder

Add a recurring Google Calendar event titled
"Rotate CRON_SECRET" every 90 days starting from the last rotation.

**Tracked rotations:**

| Date          | Rotated by | Notes                                   |
| ------------- | ---------- | --------------------------------------- |
| (initial set) | Vic        | Tick 5 — value lives in `OMS-CRON-SECRET.txt`. |
| Next due:     | 2026-08-13 | 90 days from initial set.               |

When a rotation happens, append a row here in the same commit.
