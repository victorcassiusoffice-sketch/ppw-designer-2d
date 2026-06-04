# Neon prod/preview DB isolation (P3-3) — [VIC-VERIFY] runbook

**Status: NOT applied autonomously.** This is an infra change to the Vercel↔Neon
integration that needs dashboard access + a Vic decision. It is documented here
as a ready-to-execute runbook, not shipped.

## The risk

The Designer's Neon database (`ppw-marketplace`) is a **single branch**. The
same connection string is injected into Production, Preview, AND Development
Vercel environments. So:

- A preview deployment (e.g. a Dependabot PR build, or any branch preview) that
  runs a write — a webhook test, a seed script, a migration — **mutates
  production data**.
- There is no safe place to test a destructive migration before it hits live
  orders/products/payouts.

This is called out in `architecture/api-deploy-topology.md` and tracker
`p3-neon-isolation`.

## The fix (do this in the Neon + Vercel dashboards)

1. **Create a Neon branch** for non-prod. In the Neon console for project
   `ppw-marketplace`: Branches → New branch → name it `preview` (branched off
   `main`/`production`). Neon branches are copy-on-write — cheap, instant.
2. **Get the `preview` branch pooled connection string** (Neon → branch →
   Connection details → Pooled).
3. **Re-scope the Vercel env vars.** In Vercel → ppw-designer-2d → Settings →
   Environment Variables, set the Neon connection vars
   (`DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_PRISMA_URL` /
   `POSTGRES_URL_NON_POOLING` and the `PG*` siblings) so that:
   - **Production** → the production branch string (unchanged).
   - **Preview** + **Development** → the new `preview` branch string.
   If the Neon–Vercel native integration manages these automatically, switch the
   integration's branch mapping instead of hand-editing (the integration may
   re-inject and overwrite manual edits otherwise).
4. **Verify isolation.** Deploy a preview, run a harmless write against it
   (e.g. create a throwaway product via the preview URL), then confirm it does
   **not** appear in the production `/api/products`.
5. **Keep migrations forward-only on prod** until isolation is confirmed
   (`api/db/migrations/README.md`).

## Why it wasn't done here

- No Neon dashboard / API token is available to this build.
- The Vercel Neon connection strings are integration-managed and **empty in
  `vercel env pull`** (runtime-injected) — they can't be re-pointed from code.
- Re-pointing a production database integration is a HARD-STOP-adjacent infra
  change per the operating protocol → Vic executes or explicitly approves.
