# Test database isolation

**OMS Wave 5.8 — never let CI / test runs touch production Neon.**

## The rule

`DATABASE_URL` in CI MUST point at a Neon **branch**, never at the
production branch (`raspy-butterfly-74927202.main`). The branch is a
zero-copy clone of prod that can be reset between runs without
affecting customers.

## Setup (Vic — one-time)

1. Open Neon console → project `ppw-marketplace` → Branches.
2. Click "Create branch" → name `ci-tests` → parent `main`.
3. Copy the branch connection string (note the unique `endpoint=` qs
   param).
4. Add a GitHub Actions secret named `TEST_DATABASE_URL` with that
   value.

## CI workflow contract

Every GitHub Actions job that runs vitest/playwright with a DB
dependency must export:

```yaml
env:
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

The current vitest baseline is in-memory; only Playwright E2E + future
integration tests will need a live DB.

## Safety check at script entry

`scripts/migrate.ts` refuses to run if `DATABASE_URL` resolves to the
prod endpoint hostname AND `ALLOW_PROD_MIGRATIONS=1` is not set.
Anyone running migrations against prod must opt-in explicitly.

## Reset between runs

After a CI run finishes, reset the `ci-tests` branch:

```bash
npx neonctl branches reset ci-tests --parent main
```

…or use the Neon MCP `reset_from_parent` action.

## Tracked drifts

| Date       | Drift                                                         | Resolution            |
| ---------- | ------------------------------------------------------------- | --------------------- |
| 2026-05-13 | Smoke tests wrote 8 rows into prod `merchants` before W5.8.  | Vic to delete (HARD-STOP queued in VIC-DECISIONS-QUEUE row #4). |
