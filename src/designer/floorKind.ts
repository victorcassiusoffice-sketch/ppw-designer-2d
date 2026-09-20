/**
 * floorKind — what a laid floor product reads as, for the 3D stage's
 * surfaces (3D Mode P3 realism, 2026-09-19). Pure and three-free so the
 * scene builder (which must never carry the three.js chunk) can decide it.
 */
export type FloorKind = 'screed' | 'rubber-tile' | 'eva-mat' | 'vinyl-mat' | 'epdm-roll' | 'interlock' | 'wood' | 'ceramic';

/**
 * The floor kind a laid material reads as, from its name / SKU / id. Unknown
 * names fall to the rubber tile, the wellness room's default floor; nothing
 * laid is bare screed.
 */
export function floorKindOf(material?: { name?: string; sku?: string; id?: string } | null): FloorKind {
  if (!material) return 'screed';
  const s = `${material.id ?? ''} ${material.sku ?? ''} ${material.name ?? ''}`.toLowerCase();
  if (/\beva\b|foam|kids mat|combat/.test(s)) return 'eva-mat';
  if (/epdm|roll/.test(s)) return 'epdm-roll';
  if (/vinyl|equipment mat|ifit/.test(s)) return 'vinyl-mat';
  if (/interlock|composite/.test(s)) return 'interlock';
  if (/wood|oak|parquet|plank|laminate|bamboo/.test(s)) return 'wood';
  if (/ceramic|porcelain|marble|stone/.test(s)) return 'ceramic';
  return 'rubber-tile';
}
