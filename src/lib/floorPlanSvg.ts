/**
 * floorPlanSvg - Week 4a, rewritten in Week 4b Hotfix 4.
 *
 * Renders a Room's polygon + placed items as an inline SVG, then
 * converts that SVG to a PNG data URL ready for jsPDF.
 *
 * Why not Konva's stage.toDataURL()? Only the ACTIVE room is mounted in
 * the canvas at any given time (multi-room Model A). Capturing all
 * rooms would require us to mount each in turn, wait for paint, and
 * snap - way too much complexity for the checkout flow.
 *
 * Hotfix 4 fix: the previous implementation conflated px-per-metre
 * with a dimensionless scale ratio. `roomWpx` was pre-multiplied by
 * 100 (`* pxPerMetre`), and the resulting `scale` came out as ~1.36
 * (px/px) instead of ~80 (px/m), so a 5x4 m room rendered as a ~7 px
 * blob in the middle of an otherwise empty canvas. The renderer is now
 * built around a single `pxPerM` value derived directly from the
 * available draw area and the polygon's metre bounds. Products carry
 * their on-screen name + dimensions, walls are drawn thick to match
 * the Konva canvas, axis ticks + a scale bar + a North arrow are baked
 * in so the PDF reads like a proper install plan.
 */

import type { Polygon, Vertex } from './geometry';
import { polygonBounds } from './geometry';

interface PlacedItemForRender {
  productId: string;
  productName?: string;
  x: number;
  y: number;
  length_cm: number;
  width_cm: number;
  rotation: number;
}

interface RoomForRender {
  name: string;
  polygon: Polygon;
  placedItems: PlacedItemForRender[];
}

const PPW_TEAL = '#1f4a4a';
const PPW_SAND = '#f4efe3';
const PPW_INK = '#0E1B1F';
const PPW_SLATE = '#3B4A52';
const PPW_CORAL = '#c97b6a';
const PPW_STONE = '#C4CBCD';

export function renderRoomSvg(
  room: RoomForRender,
  opts: { widthPx?: number; heightPx?: number; marginPx?: number } = {},
): string {
  const widthPx = opts.widthPx ?? 1100;
  const heightPx = opts.heightPx ?? 780;
  const margin = opts.marginPx ?? 70;

  const bounds = polygonBounds(room.polygon);
  const roomWm = Math.max(0.01, bounds.maxX - bounds.minX);
  const roomHm = Math.max(0.01, bounds.maxY - bounds.minY);

  const availWpx = widthPx - margin * 2;
  const availHpx = heightPx - margin * 2;
  const pxPerM = Math.min(availWpx / roomWm, availHpx / roomHm, 220);

  const drawWpx = roomWm * pxPerM;
  const drawHpx = roomHm * pxPerM;
  const offsetX = (widthPx - drawWpx) / 2 - bounds.minX * pxPerM;
  const offsetY = (heightPx - drawHpx) / 2 - bounds.minY * pxPerM;

  const toX = (xm: number): number => xm * pxPerM + offsetX;
  const toY = (ym: number): number => ym * pxPerM + offsetY;
  const toXY = (v: Vertex): string => `${toX(v.x).toFixed(1)},${toY(v.y).toFixed(1)}`;

  const points = room.polygon.map(toXY).join(' ');

  const gridLines: string[] = [];
  const gridXStart = Math.floor(bounds.minX);
  const gridXEnd = Math.ceil(bounds.maxX);
  const gridYStart = Math.floor(bounds.minY);
  const gridYEnd = Math.ceil(bounds.maxY);
  for (let gx = gridXStart; gx <= gridXEnd; gx++) {
    gridLines.push(
      `<line x1="${toX(gx).toFixed(1)}" y1="${toY(bounds.minY).toFixed(1)}" x2="${toX(gx).toFixed(1)}" y2="${toY(bounds.maxY).toFixed(1)}" stroke="${PPW_STONE}" stroke-width="0.6" opacity="0.55"/>`,
    );
  }
  for (let gy = gridYStart; gy <= gridYEnd; gy++) {
    gridLines.push(
      `<line x1="${toX(bounds.minX).toFixed(1)}" y1="${toY(gy).toFixed(1)}" x2="${toX(bounds.maxX).toFixed(1)}" y2="${toY(gy).toFixed(1)}" stroke="${PPW_STONE}" stroke-width="0.6" opacity="0.55"/>`,
    );
  }

  const items = room.placedItems
    .map((it) => {
      const wm = it.length_cm / 100;
      const hm = it.width_cm / 100;
      const r = ((it.rotation % 360) + 360) % 360;
      const swap = r === 90 || r === 270;
      const footprintW = swap ? hm : wm;
      const footprintH = swap ? wm : hm;
      const cxM = it.x + footprintW / 2;
      const cyM = it.y + footprintH / 2;
      const cxPx = toX(cxM);
      const cyPx = toY(cyM);
      const wPx = wm * pxPerM;
      const hPx = hm * pxPerM;
      const nameSafe = escapeXml(it.productName ?? '');
      const dimSafe = `${Math.round(it.length_cm)} x ${Math.round(it.width_cm)} cm`;
      const fontSize = Math.max(9, Math.min(13, Math.round(Math.min(wPx, hPx) / 6)));
      const nameY = -hPx / 2 + fontSize + 2;
      const dimY = hPx / 2 - 4;
      return `<g transform="translate(${cxPx.toFixed(1)}, ${cyPx.toFixed(1)}) rotate(${r.toFixed(1)})">
        <rect x="${(-wPx / 2).toFixed(1)}" y="${(-hPx / 2).toFixed(1)}" width="${wPx.toFixed(1)}" height="${hPx.toFixed(1)}" fill="${PPW_CORAL}" fill-opacity="0.55" stroke="${PPW_TEAL}" stroke-width="1.4" rx="2" ry="2"/>
        ${nameSafe ? `<text x="0" y="${nameY.toFixed(1)}" font-family="Helvetica, Arial" font-size="${fontSize}" font-weight="bold" fill="${PPW_INK}" text-anchor="middle">${nameSafe}</text>` : ''}
        <text x="0" y="${dimY.toFixed(1)}" font-family="Helvetica, Arial" font-size="${Math.max(8, fontSize - 2)}" fill="${PPW_SLATE}" text-anchor="middle">${dimSafe}</text>
      </g>`;
    })
    .join('');

  const wallLabels: string[] = [];
  for (let i = 0; i < room.polygon.length; i++) {
    const a = room.polygon[i];
    const b = room.polygon[(i + 1) % room.polygon.length];
    const dxm = a.x - b.x;
    const dym = a.y - b.y;
    const lengthM = Math.sqrt(dxm * dxm + dym * dym);
    if (lengthM < 0.3) continue;
    const mx = (toX(a.x) + toX(b.x)) / 2;
    const my = (toY(a.y) + toY(b.y)) / 2;
    const cx = room.polygon.reduce((acc, v) => acc + toX(v.x), 0) / room.polygon.length;
    const cy = room.polygon.reduce((acc, v) => acc + toY(v.y), 0) / room.polygon.length;
    const dxp = mx - cx;
    const dyp = my - cy;
    const len = Math.hypot(dxp, dyp) || 1;
    const off = 16;
    const tx = mx + (dxp / len) * off;
    const ty = my + (dyp / len) * off;
    wallLabels.push(
      `<g>
        <rect x="${(tx - 32).toFixed(1)}" y="${(ty - 10).toFixed(1)}" width="64" height="18" rx="3" ry="3" fill="${PPW_INK}" opacity="0.88"/>
        <text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" font-family="Helvetica, Arial" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${lengthM.toFixed(2)} m</text>
      </g>`,
    );
  }

  const ticks: string[] = [];
  const tickFont = 10;
  for (let gx = gridXStart; gx <= gridXEnd; gx++) {
    const xPx = toX(gx);
    const yBase = toY(bounds.maxY);
    ticks.push(
      `<line x1="${xPx.toFixed(1)}" y1="${yBase.toFixed(1)}" x2="${xPx.toFixed(1)}" y2="${(yBase + 6).toFixed(1)}" stroke="${PPW_SLATE}" stroke-width="1"/>`,
    );
    ticks.push(
      `<text x="${xPx.toFixed(1)}" y="${(yBase + 18).toFixed(1)}" font-family="Helvetica, Arial" font-size="${tickFont}" fill="${PPW_SLATE}" text-anchor="middle">${gx} m</text>`,
    );
  }
  for (let gy = gridYStart; gy <= gridYEnd; gy++) {
    const yPx = toY(gy);
    const xBase = toX(bounds.minX);
    ticks.push(
      `<line x1="${xBase.toFixed(1)}" y1="${yPx.toFixed(1)}" x2="${(xBase - 6).toFixed(1)}" y2="${yPx.toFixed(1)}" stroke="${PPW_SLATE}" stroke-width="1"/>`,
    );
    ticks.push(
      `<text x="${(xBase - 9).toFixed(1)}" y="${(yPx + 3).toFixed(1)}" font-family="Helvetica, Arial" font-size="${tickFont}" fill="${PPW_SLATE}" text-anchor="end">${gy} m</text>`,
    );
  }

  const scaleBarX = 18;
  const scaleBarY = heightPx - 28;
  const scaleBarLen = pxPerM;
  const scaleBar = `<g>
    <line x1="${scaleBarX}" y1="${scaleBarY}" x2="${(scaleBarX + scaleBarLen).toFixed(1)}" y2="${scaleBarY}" stroke="${PPW_INK}" stroke-width="3"/>
    <line x1="${scaleBarX}" y1="${scaleBarY - 5}" x2="${scaleBarX}" y2="${scaleBarY + 5}" stroke="${PPW_INK}" stroke-width="2"/>
    <line x1="${(scaleBarX + scaleBarLen).toFixed(1)}" y1="${scaleBarY - 5}" x2="${(scaleBarX + scaleBarLen).toFixed(1)}" y2="${scaleBarY + 5}" stroke="${PPW_INK}" stroke-width="2"/>
    <text x="${(scaleBarX + scaleBarLen / 2).toFixed(1)}" y="${scaleBarY - 8}" font-family="Helvetica, Arial" font-size="10" font-weight="bold" fill="${PPW_INK}" text-anchor="middle">1.00 m</text>
    <text x="${scaleBarX}" y="${scaleBarY + 18}" font-family="Helvetica, Arial" font-size="9" fill="${PPW_SLATE}">Scale: 1 m = ${pxPerM.toFixed(0)} px on PDF</text>
  </g>`;

  const northX = widthPx - 42;
  const northY = 50;
  const north = `<g transform="translate(${northX}, ${northY})">
    <circle cx="0" cy="0" r="22" fill="#FFFFFF" stroke="${PPW_SLATE}" stroke-width="1"/>
    <polygon points="0,-16 6,6 0,2 -6,6" fill="${PPW_CORAL}" stroke="${PPW_INK}" stroke-width="0.8"/>
    <text x="0" y="-18" font-family="Helvetica, Arial" font-size="10" font-weight="bold" fill="${PPW_INK}" text-anchor="middle">N</text>
  </g>`;

  const caption = `<g>
    <text x="14" y="22" font-family="Helvetica, Arial" font-size="14" font-weight="bold" fill="${PPW_INK}">${escapeXml(room.name)}</text>
    <text x="14" y="40" font-family="Helvetica, Arial" font-size="11" fill="${PPW_SLATE}">Bounding box ${roomWm.toFixed(2)} m x ${roomHm.toFixed(2)} m  ${room.placedItems.length} item${room.placedItems.length === 1 ? '' : 's'}</text>
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">
    <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="${PPW_SAND}"/>
    <g clip-path="url(#room-clip)">
      <polygon points="${points}" fill="#FAF7F1"/>
      ${gridLines.join('')}
    </g>
    <polygon points="${points}" fill="none" stroke="${PPW_INK}" stroke-width="6" stroke-linejoin="miter"/>
    <polygon points="${points}" fill="none" stroke="${PPW_SLATE}" stroke-width="1" stroke-linejoin="miter"/>
    ${ticks.join('')}
    ${items}
    ${wallLabels.join('')}
    ${caption}
    ${scaleBar}
    ${north}
    <defs>
      <clipPath id="room-clip"><polygon points="${points}"/></clipPath>
    </defs>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function svgToPngDataUrl(
  svg: string,
  width = 1100,
  height = 780,
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
