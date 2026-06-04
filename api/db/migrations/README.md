# Database migrations

Sequential SQL migrations for the Neon `ppw-marketplace` database. Each
`NNNN_*.sql` has an optional `NNNN_*_rollback.sql`. Apply in numeric order.

## Numbering gap 0012–0023 is intentional (not missing migrations)

The sequence jumps **0011 → 0024**. This is **historical, not a gap in the
applied schema**. Numbers 0012–0023 were reserved during the Sims-Parity DT
planning phase for capture/3D migrations that were either folded into other
files, superseded before they were written, or never needed once the design
settled. **No migration 0012–0023 was ever authored or applied** — there is
nothing missing and nothing to back-fill.

The live schema is fully described by the files that exist here:
`0000`–`0011`, then `0024` (capture scale-locks), `0025` (products.use_gltf —
now vestigial after the Babylon 3D viewer removal, P1-1; harmless to leave),
`0026` (designer_referrals).

If you add a migration, continue from the highest existing number (`0027+`).
Do **not** try to "fill in" 0012–0023.

## Notes

- `0025_products_use_gltf.sql` adds a column the frontend no longer reads
  (the Babylon 3D viewer was removed in P1-1, 2026-06-04). It is left in place
  because dropping it is a no-value schema change on a DO-NOT-BREAK table; the
  rollback exists (`0025_products_use_gltf_rollback.sql`) if a clean schema is
  ever wanted.
- The Neon database is a **single branch** — previews + Dependabot PRs hit prod
  data. Gate any destructive migration accordingly (see
  `architecture/api-deploy-topology.md` and tracker `p3-neon-isolation`).
