# Build plan — Sims world (2026-08-29)

Branch `feat/sims-world-2026-08-29`. Nothing here touches `main` or production.
No new API routes (12/12 Vercel functions). The server stores `property` as opaque JSON, so every
model change below rides inside it.

## Model

```ts
Property {
  id; name; activeRoomId; rooms: Room[];
  levels?: Level[];            // storeys. Absent = [{ id:'ground', name:'Ground floor', index:0 }]
  activeLevelId?: string;      // absent = 'ground'
  walls?: FreeWall[];          // free-standing walls (open runs), world metres, per level
  site?: Site | null;          // land plot: { widthM, depthM, originM } — locks scale + capacity
}
Room { ...; levelId?: string; kind?: 'room' | 'outdoor' }   // one 'outdoor' room per level, polygon [] = unbounded (or site)
PlacedItem { ...; lightOn?: boolean }
Level { id; name; index }
FreeWall { id; a: Vertex; b: Vertex; thicknessM; levelId? }
Site { widthM; depthM; originM: Vertex }
```

Wall thickness is a world constant `WALL_THICKNESS_M = 0.1` (= today's 10 px at 100 px/m). Walls are
stroked centred on the edge; **items flush to the INNER FACE (edge + 0.05 m)**.

## Work packages (parallel, disjoint files)

| WP | Scope | Files |
|---|---|---|
| A | Placement core: inner-face flush, two-wall corner snap, along-wall clamp, flush-preserving free slot, keep rotation mid-room, free walls as snap targets + obstacles, 1e-4 axis tolerance, `ceiling` kind | `designer/wallAwarePlacement.ts`, `designer/attachmentPlacement.ts`, tests |
| B | Image ratio: runtime content-bbox trim (alpha or near-white key), fill-when-close policy, back-edge anchor; matte + trim the 5 demo JPEGs to alpha PNGs | `designer/imageFit.ts`, `designer/imageContent.ts`, tests, `public/products/topdown/demo-*.png` |
| C | Data model: levels, outdoor rooms, free walls, site; whitelist + Raw types; migrate `wallStore` mm walls into `property.walls`; page bundle | `store/propertyStore.ts`, `designer/levels.ts`, `designer/freeWalls.ts`, `lib/pages.ts`, tests |
| D | Catalog: `lighting` category + `emits_light`/`light_radius_m`, `placement:'ceiling'`, `outdoor`, `plan_symbol`; seeds (floor lamp, pendant, garden tree, hedge, outdoor bench); macros Lighting + Outdoor; adapter passthrough | `data/*`, `components/mobile/catalogMacros.ts`, `MacroIcon.tsx`, `designer/lighting.ts`, `designer/layerBands.ts`, `lib/planPdf.ts` fills |
| E | Theme: architectural paper palette, `ROOM_BORDER_SCAN` retuned to charcoal walls, chip/draw/wall colours | `designer/blueprintTheme.ts`, `MeasurementChip.tsx`, `WallDrawMode.tsx`, theme tests |
| I | Integration (this session): RoomCanvas render (walls with shadow, levels, outdoor, site, glow, free walls, wall-item plan bars, dimension lines), draw tool (open runs → free walls, unit stepper, +/- keys), TopBar (Land, Floors, walls → pen), keyboard, DetailsPanel/FloatingCluster light toggle, help copy, e2e repair, screenshots, preview deploy | everything else |

## Gates

- `npx tsc --noEmit` clean · `npx vitest run` green · `npm run build` clean · eslint 0 errors on changed files.
- Playwright on a local dev server: the existing wall-aware / multiroom / units / floor-paint / door specs green after the colour-predicate updates, plus new specs for corner snap, outdoor placement, levels, free walls, unit stepper.
- Before/after captures at 1920×1080 and 390×844 in `docs/sims-world-2026-08-29/`.
- Branch pushed → Vercel preview URL verified live by cache-busted healthcheck showing the branch SHA. **No merge, no production.**
