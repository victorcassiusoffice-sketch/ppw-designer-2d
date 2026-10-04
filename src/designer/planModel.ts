import type { Product } from '../data/products.schema';
import { hasFurniturePreview } from '../data/dimensionalPreview';
import { hasSolarPanelPreview } from '../data/solarPreview';
import type { ItemSolid } from './roomSolids';

/** A true supplier top-down asset remains authoritative. Otherwise the same
 * measured planning body used by 3D can be photographed from above in 2D. */
export function canRenderPlanModel(product: Product): boolean {
  return !product.topdown_image_url && (hasFurniturePreview(product.id) || hasSolarPanelPreview(product) || product.sku === 'DURACO-WATER-CYL-1000')
    && Object.values(product.dimensions_cm).every(value => Number.isFinite(value) && value > 0);
}

export function planModelKey(product: Product): string {
  return [product.id, product.dimensions_cm.length, product.dimensions_cm.width, product.dimensions_cm.height, product.front_edge ?? 'bottom'].join(':');
}

/** No current room coordinates, rotation, camera or price enter this model.
 * Konva applies the saved rotation once, after drawing this unrotated image. */
export function planModelSolid(product: Product): ItemSolid {
  const lengthM = product.dimensions_cm.length / 100;
  const widthM = product.dimensions_cm.width / 100;
  const heightM = product.dimensions_cm.height / 100;
  return { key: `plan-${product.id}`, instanceId: `plan-${product.id}`, productId: product.id,
    x0: 0, y0: 0, x1: lengthM, y1: widthM, z0: 0, z1: heightM,
    rotationDeg: 0, lengthM, widthM, heightM, frontEdge: product.front_edge, hex: '#c5bfb3' };
}

/** Resolution varies, the world-space projection and footprint never do. */
export function planModelRasterSize(lengthM: number, widthM: number): { width: number; height: number } {
  const largest = Math.max(lengthM, widthM);
  return { width: Math.max(8, Math.round(512 * lengthM / largest)), height: Math.max(8, Math.round(512 * widthM / largest)) };
}

/** Move a little overhead fill to the key light, preserving the irradiance of
 * an upward-facing surface. Seams/curves gain direction without a blanket
 * exposure/tone-map change to the catalog colour. */
export function planPhotoLightBalance(rig: { hemi: number; sun: number; fill: number }, sunDirection: readonly [number, number, number]) {
  const incidence = sunDirection[1] / Math.hypot(...sunDirection);
  const transfer = Math.min(0.24, Math.max(0, rig.hemi * 0.33));
  if (!(incidence > 0)) return rig;
  return { hemi: rig.hemi - transfer, sun: rig.sun + transfer / incidence, fill: rig.fill };
}

export interface PlanShadowDirection { x: number; y: number }
export interface PlanShadowFrame {
  xM: number; yM: number; widthM: number; depthM: number;
  itemWidthM: number; itemDepthM: number;
}

/** The shadow photograph has a larger canvas than the sold product. Its
 * world-metre bounds are separate, so the body and hit target never grow. */
export function planModelShadowFrame(product: Product, rotationDeg: number, direction: PlanShadowDirection): PlanShadowFrame {
  const { lengthM, widthM, heightM } = planModelSolid(product);
  const angle = rotationDeg * Math.PI / 180;
  const itemWidthM = lengthM * Math.abs(Math.cos(angle)) + widthM * Math.abs(Math.sin(angle));
  const itemDepthM = lengthM * Math.abs(Math.sin(angle)) + widthM * Math.abs(Math.cos(angle));
  const dx = heightM * direction.x, dy = heightM * direction.y;
  const padding = 0.08;
  const xM = Math.min(0, dx) - padding, yM = Math.min(0, dy) - padding;
  return { xM, yM, widthM: itemWidthM + Math.abs(dx) + padding * 2,
    depthM: itemDepthM + Math.abs(dy) + padding * 2, itemWidthM, itemDepthM };
}

export function planModelShadowKey(product: Product, rotationDeg: number, direction: PlanShadowDirection): string {
  const rotation = ((rotationDeg % 360) + 360) % 360;
  return `${planModelKey(product)}:shadow:${rotation.toFixed(2)}:${direction.x.toFixed(3)}:${direction.y.toFixed(3)}`;
}
