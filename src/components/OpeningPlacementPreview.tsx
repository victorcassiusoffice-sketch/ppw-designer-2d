import type { OpeningPlacementPreview as Preview } from '../designer/openingPlacement';
import { doorSymbol } from '../designer/openings';
import { openingHeightM, openingProfile, openingProfileWorldPoint } from '../designer/openingGeometry';

/** A projected ghost, never saved geometry: the room changes only on release. */
export function OpeningPlacementPreview({ preview, projectPoint, baseElevation = 0 }: {
  preview: Preview;
  projectPoint: (x: number, y: number, z: number) => { x: number; y: number } | null;
  baseElevation?: number;
}) {
  const opening = preview.opening;
  const sill = opening.sillM ?? 0;
  const bottom = preview.elevationM - baseElevation + sill;
  const top = bottom + openingHeightM(opening);
  const points = openingProfile({ ...opening, id: 'preview' }, 100).map(point => {
    const world = openingProfileWorldPoint(point, preview.edge.a, preview.edge.b);
    return { ...world, z: world.z + preview.elevationM - baseElevation };
  });
  const polygon = points.map(p => projectPoint(p.x, p.y, p.z)).filter(p => p !== null);
  const label = projectPoint((preview.a.x + preview.b.x) / 2, (preview.a.y + preview.b.y) / 2, top + 0.15);
  const swing = opening.kind === 'door' ? doorSymbol(preview.edge, { ...opening, id: 'preview' }) : null;
  const leaf = swing ? [swing.hinge, swing.leafEnd].map(p => projectPoint(p.x, p.y, bottom + 0.04)).filter(p => p !== null) : [];
  return <svg className="house-room-preview house-opening-preview" data-testid="opening-3d-preview" data-valid={preview.ok} aria-hidden="true">
    {polygon.length >= 3 && <polygon points={polygon.map(p => `${p.x},${p.y}`).join(' ')} />}
    {leaf.length === 2 && <polyline points={leaf.map(p => `${p.x},${p.y}`).join(' ')} />}
    {label && <text x={label.x} y={label.y} textAnchor="middle">{preview.ok ? `${opening.widthM.toFixed(2)} m · release to place` : preview.message}</text>}
  </svg>;
}
