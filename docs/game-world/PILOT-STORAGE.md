# Private pilot records

Shared records are separate from the device-only example. A valid studio session represents the shared studio workspace (the studio code is a shared identity); individual admin accounts own their own pilots. Members have a separate, pilot-bound session. New member links work once, for seven days. Send the link by hand. Membership then lasts 30 days on the joining host. Opening the same pilot on the other domain requires that domain's own session/invite.

The only member pages outside the studio door are the empty shared list and the strictly matched shared record shell. Both get their data from a checked API. Device-only routes and plans remain behind the studio door. Public summaries are off. The browser never stores a shared photo in IndexedDB. Hiding a photo prevents future member fetches; it cannot revoke a copy a member already downloaded.

Use the existing orders function, Neon, private Blob and the existing rate limiter. Both production and preview deployments contain 12 function entries. Photos use fewer than 400,000 bytes each: 100 photos <40 MB, 200 <80 MB, excluding object and database overhead. Neon holds metadata, not photo bytes.

## Release and isolation

Do not use Vercel Preview to create, join or upload a pilot until the [Neon isolation runbook](../NEON-PREVIEW-ISOLATION.md) has been completed. On a **verified, distinct preview branch only**, the database administrator applies the pilot schema and marks its pilots table with the comment `olb-pilot-isolated:<exact Vercel Git branch name>`. This marker is not set by the migration. Never mark the production table. A preview without the matching marker cannot read or write records. Other studio features keep their original behaviour. No additional environment variable, store, or function is needed.

Run the actual handler and SQL without hosting credentials: `npx vitest run src/pilots/pilotAccess.test.ts`. Start the local designer; `npx tsx tools/world/test-pilot-session.ts http://localhost:4213 <evidence-directory>` exercises two browser profiles and a stranger using an in-memory Postgres and private object adapter. The test refuses non-loopback targets. The hosted test must separately prove the real Neon, private Blob and limiter connections.

Production migrations are manual. After explicit migration approval, first verify in read-only mode that 0033_pilots is the only pending forward migration. Run `npm run db:migrate` against the approved production target, with the existing `ALLOW_PROD_MIGRATIONS=1` guard scoped to that one command. Never run backfill. After rollout, verify both production hosts. Do not enable public summaries through migration or deployment.
