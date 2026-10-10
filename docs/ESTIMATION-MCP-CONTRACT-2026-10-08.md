# Shared estimation boundary — 8 October 2026

Room Designer's public `/api/mcp` remains stateless and read-only. It accepts supplied planning data, returns an estimate, and cannot read customer projects, place orders, message suppliers or certify a design.

## New tools

- `get_foundation_schema`: complete version 1 foundation example, metre/millimetre units, maximum sizes, limitations and the current concrete defaults.
- `estimate_foundation`: strict `foundation` plus optional partial `concrete` inputs. Calls the same normalizer and engine as the editor. Intersections count once; ready-mix and site-mix ingredients stay mutually exclusive. Reinforcement is entered explicitly, never inferred as structurally adequate.
- `estimate_materials`: strict `geometry`, optional partial `settings` and optional complete `foundation`. Calls shared materials quantities and quotation calculations. Each physical wall must be supplied once with deduplicated openings. A supplied enabled foundation replaces the legacy base, including an intentionally empty foundation. Raw `geometry.foundationVolumeM3` is rejected; callers must provide the measured model.

Missing quotation rates remain unknown. Rates are tied to the current specification, unit and declared tax basis. Withheld overlapping steel schedules prevent a complete quotation. No supplier checkout total is implied.

All supplied numbers must be finite and within explicit limits. Unknown fields and any malformed entity reject the whole estimate. The existing 128 KB request limit applies to direct dispatcher calls as well as HTTP. UI legacy normalizers are used only after external payload validation, so invalid user numbers cannot be silently clamped into another physical design.

## Services and products

`estimate_services` now accepts typed `startConnection` and `endConnection` references, optional fixture `portElevationsM` and `connectionLabel`, and the `sewer-connection` fixture kind. It resolves valid endpoints against current fixture positions before measuring. Missing, mismatched or cross-floor links are reported as unresolved; a drain connection needs its surveyed waste elevation. Crossings do not form junctions. Generic port locations are schematic, not verified manufacturer connector specifications.

The server AI catalogue includes the same five canonical published-envelope products used by the plan and 3D views. Procurement snapshot/source details are in `MAURITIUS-SERVICE-PRODUCTS-2026-10-08.md`. AI room proposals still support floor-hosted products only; wall and roof products must be placed using the editor's proper host tools.

## Save and import audit

- Optional `DesignDraft.foundation` uses the same strict shared schema; foundation rectangles must also remain inside the proposal plot. The proposal-to-property adapter preserves this model without changing metre coordinates or depth.
- `/api/designs` stores the full property snapshot, preserving new connection and foundation fields. A narrowly scoped check now rejects an invalid present foundation before create/update persistence. Legacy snapshots without foundations are unaffected.
- Property JSON persistence and cloud payloads carry the whole property. The root implementation handles foundation normalization on load.
- DXF/SVG plan import currently extracts room outlines only. It does not claim to extract foundation engineering, service routes, native DWG, RVT, SKP, IFC or arbitrary drawing annotations.

## Verification

77 tests passed across foundation/materials MCP, service MCP, design assistant and AI proposal conversion. API TypeScript and scoped ESLint passed. Cases include concrete overlap, ready/site mix, legacy-base replacement, malformed imports, whole-estimate rejection, quote tax/specification binding, unresolved steel/ports, endpoint movement, provider catalogue parity and the body-size limit. This note records implementation evidence; live preview verification belongs to the build handoff.
