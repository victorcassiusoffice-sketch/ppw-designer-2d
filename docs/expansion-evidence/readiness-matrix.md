# Designer Expansion — Cross-Domain Readiness Matrix (P7 evidence)

> Branch `feat/designer-multidomain-2026-06-20` · generated 2026-06-20.
> Source of truth: `src/lib/domain/rubric.ts` + `src/__tests__/expansion/crossDomainMatrix.test.tsx`.

## Rubric results (machine-verified by the integration matrix)

| Domain | canEnter | canPlaceOrConfig | canPrice | canRouteOut | ready | enabledForLive |
|--------|:--------:|:----------------:|:--------:|:-----------:|:-----:|:--------------:|
| wellness-room | ✅ | ✅ (polygon-room) | ✅ | ✅ (`?ref=ppw`) | ✅ | ✅ live |
| airplane | ✅ | ✅ (fuselage-section) | ✅ | ✅ (`?ref=ppw`) | ✅ | ⛔ gated → [VIC-VERIFY] |
| car | ✅ | ✅ (vehicle-config) | ✅ | ✅ (`?ref=ppw`) | ✅ | ⛔ gated → [VIC-VERIFY] |

All three domains pass the four capability checks end-to-end (enter → build a
minimal design → see pricing → get a merchant hand-off URL). Airplane + car are
fully **ready** but remain `enabled: false` in the registry — flipping them live
is a [VIC-VERIFY] decision, not a machine gate.

## Chain exercised per domain (real modules, deterministic)

1. **enter** — `domainStore.setDomain(domain)` + `getDomain(domain).placement`.
2. **build** — `getDefaultSpace(domain)` yields a valid `BuildSpace`; first
   catalog product selected.
3. **price** — `priceDesign(domain, [{product, qty:2}])` → `subtotal == price.value × 2`,
   `totalCommission ≥ 0`.
4. **route-out** — `buildMerchantHandoffUrl(domain, …)` → URL carries `ref=ppw`,
   never an internal `/checkout` route.

## Live render evidence — domain picker (`/build`)

Captured headlessly via the repo dev server (DOM probe; the sandbox screenshot
tool times out on this renderer — a sandbox limit, not an app defect, per
`ref-fidelity-verification`). Pixel look-and-feel sign-off = [VIC-VERIFY].

| Viewport | Grid columns | Card widths | Horizontal overflow | Console errors |
|----------|:------------:|:-----------:|:-------------------:|:--------------:|
| Desktop 1280×800 | 3 | auto-fit | none | 0 |
| Mobile 390×844 | 1 | 350px | none (`scrollW == 390`) | 0 |

Cards present + correct enabled state at both widths: Wellness Room (enabled),
Airplane Cabin (coming soon), Car (coming soon). Disabled domains via
`/build/:domainId` render the "coming soon" panel — the unfinished builder is
not reachable.
