import { getProductById } from '../../data/products';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from '../../designer/levels';
import { renderRoomSvg, svgToPngDataUrl } from '../../lib/floorPlanSvg';
import type { Property } from '../../store/propertyStore';
import type { Photo } from '../../designer/link/vendor/tradefolder/lib/jobPack/types';

export const TRADE_FOLDER = 'https://tradefolder.vercel.app/pro/job-pack';
export const opaqueId = () => crypto.randomUUID();
export function downloadFile(name: string, value: string, type = 'application/json') {
  const href = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}
export function workFileName(title: string) {
  return (
    (title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 65) || 'work') + '.olbpackage.json'
  );
}
export function resolveItem(id: string) {
  const product = getProductById(id);
  if (!product) return undefined;
  return {
    label: product.name,
    widthM: product.dimensions_cm.length / 100,
    depthM: product.dimensions_cm.width / 100,
  };
}
/** The existing exporter draws one room, not an invented whole-building image.
 * Its metre coordinates are unchanged. The full measured extract travels separately. */
export async function roomPhoto(property: Property, levels: string[]): Promise<Photo | undefined> {
  const room = property.rooms.find(
    (r) =>
      levels.includes(roomLevelId(r)) &&
      !isRoofRoom(r) &&
      !isOutdoorRoom(r) &&
      r.polygon.length >= 3,
  );
  if (!room) return;
  const items = room.placedItems.flatMap((it) => {
    const product = getProductById(it.productId);
    return product
      ? [
          {
            productId: it.productId,
            productName: product.name,
            x: it.x,
            y: it.y,
            rotation: it.rotation,
            length_cm: product.dimensions_cm.length,
            width_cm: product.dimensions_cm.width,
          },
        ]
      : [];
  });
  for (const width of [480, 320]) {
    const height = Math.round(width * 0.7);
    const svg = renderRoomSvg(
      { name: room.name, polygon: room.polygon, placedItems: items },
      { widthPx: width, heightPx: height, marginPx: 32 },
    );
    const ref = await svgToPngDataUrl(svg, width, height);
    if (!ref || ref.length > 80000) continue;
    const sizeBytes = atob(ref.slice(ref.indexOf(',') + 1)).length;
    if (sizeBytes > 0 && sizeBytes <= 60000) return { ref, sizeBytes };
  }
}
