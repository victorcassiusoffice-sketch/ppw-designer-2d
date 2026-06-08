# Sentry server-error capture — what's wired + what Vic does

Closes the observability blind spot: server-side 500s (e.g. the capture-PDF path
that was silently failing) are now captured by `@sentry/node`.

## What the code does (already on this branch)

- `api/lib/sentry.ts` — DSN-gated init. **`SENTRY_DSN` is a required env var; it
  is NEVER hardcoded.** No DSN → Sentry is a silent no-op (local dev / tests).
- Every serverless function wraps `withSentry(handler)` — on a thrown error it
  captures the exception **and flushes before the lambda freezes** (without the
  flush, serverless drops the event — that's why "0 events / 30d" before).
- Eager init on module load installs Sentry's global `onUncaughtException` +
  `onUnhandledRejection` handlers, catching errors that escape a handler.
- `GET /api/healthcheck` returns `"sentryConfigured": true|false` so you can
  confirm the DSN is wired **without** triggering an error.
- `GET /api/healthcheck?testsentry=1` throws a synthetic error on purpose — use
  it to confirm events actually arrive in Sentry end to end.

**One thing code can't catch:** a module-*resolution* crash (like the
2026-06-04 extensionless-import `ERR_MODULE_NOT_FOUND`) happens before any code
runs, so Sentry can't see it. That class is guarded by the build-time test
`api/__tests__/esm-extension-guard.test.ts`, not by Sentry.

---

## STEP 1 — Confirm `SENTRY_DSN` is set in Vercel (it already is)

As of the last check, `SENTRY_DSN` is **already present** in Vercel for
`ppw-designer-2d` (Production + Preview). To confirm it from your phone after
this branch deploys, open in any browser:

```
https://designer.ppwellness.co/api/healthcheck?cb=1
```

Look for `"sentryConfigured": true` in the JSON. If it says `true`, you are done
with Step 1 — skip to Step 3.

### If (and only if) it says `false` — add the DSN

1. **Grab the DSN** from Sentry:
   - Sentry → org **`ppwellness`** → project **`javascript-react`**
   - Settings → **Client Keys (DSN)** → copy the **DSN** (looks like
     `https://<hash>@o<org-id>.ingest.de.sentry.io/<project-id>`).
   - The DSN is NOT a secret-secret (it's a write-only ingest key) but treat it
     as config, not code.
2. **Paste it into Vercel:**
   - Vercel → project **`ppw-designer-2d`** → Settings → **Environment Variables**
   - Add a new variable:
     - **Key:** `SENTRY_DSN`
     - **Value:** *(the DSN you copied)*
     - **Environments:** tick **Production** and **Preview**
   - Save, then **redeploy** (or it applies on the next deploy of this branch).

---

## STEP 2 — (optional) source-map upload token

`vite.config.ts` uses `@sentry/vite-plugin`, which needs `SENTRY_AUTH_TOKEN` to
upload source maps at build time. That var is **already set** in Vercel. Nothing
to do unless stack traces show minified frames — then re-mint it (Step 3 token
shape, but with `project:releases` + `org:read` scopes).

---

## STEP 3 — Verify capture end to end (from your phone)

1. Open `https://designer.ppwellness.co/api/healthcheck?testsentry=1` — it
   returns a 500 (that's intentional; it throws a synthetic error).
2. In Sentry → `ppwellness` → `javascript-react` → **Issues**, within ~1 minute
   you should see **`[healthcheck] synthetic Sentry test error`**. That proves
   server 500s now reach Sentry.
3. You already have 3 alert rules on that project, so you'll also get the email.

---

## STEP 4 — Mint a READ-scoped token (closes tracker `sentry-token-scope`)

The current token (`junk files/sntryu.txt`) can read/write *alerts* but can't
pull issues/events for audit automation. Mint a read token:

1. Sentry → **Settings** (org `ppwellness`) → **Developer Settings** →
   **Auth Tokens** → **Create New Token** (or **User Auth Tokens** →
   **Create New Token**).
2. Give it these scopes (read-only):
   - **`event:read`**
   - **`issue:read`** (a.k.a. `event:read` covers issues on newer plans — tick both if shown)
   - **`project:read`**
   - **`org:read`**
3. Copy the token (starts `sntryu_…`). **Do not paste it into chat.** Save it to
   `C:\Users\Victor\Documents\junk files\sntryu-read.txt` (gitignored).
4. Tell Dispatch "read token saved" — it will use that path for future Sentry
   audit pulls (it never echoes the value).

---

## Quick reference

| Thing | Value |
|---|---|
| Sentry org | `ppwellness` |
| Sentry project | `javascript-react` (id `4511381065171024`) |
| Required env var | `SENTRY_DSN` (Production + Preview) |
| Verify wired | `GET /api/healthcheck` → `sentryConfigured: true` |
| Verify capture | `GET /api/healthcheck?testsentry=1` → Issue appears |
| Read token path | `junk files/sntryu-read.txt` (you create it, Step 4) |
