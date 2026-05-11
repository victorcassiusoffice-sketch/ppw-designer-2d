/**
 * floorPlanSvg — Week 4a.
 *
 * Renders a Room's polygon + placed items as an inline SVG, then
 * converts that SVG to a PNG data URL ready for jsPDF.
 *
 * Why not Konva's stage.toDataURL()? Only the ACTIVE room is mounted in
 * the canvas at any given time (multi-room Model A). Capturing all
 * rooms would require us to mount each in turn, wait for paint, and
 * snap — way too much complexity for the checkout flow.
 *
 * The SVG renderer here matches the look-and-feel of the on-screen
 * Konva canvas closely enough for an order plan: filled polygon,
 * dimensioned outline, dots for each placed product.
 */

import type { Polygon, Vertex } from './geometry';
import { polygonBounds } from './geometry';

interface PlacedItemForRender {
  productId: string;
  x: number;
  y: number;
  /** Length in cm. */
  length_cm: number;
  /** Width in cm. */
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
const PPW_INK = '#1f3a3a';
const PPW_CORAL = '#c97b6a';
const PPW_STONE = '#e5e1d8';

/** Render a room polygon + placed items as an inline SVG string. */
export function renderRoomSvg(
  room: RoomForRender,
  opts: { widthPx?: number; heightPx?: number; pxPerMetre?: number } = {},
): string {
  const widthPx = opts.widthPx ?? 800;
  const heightPx = opts.heightPx ?? 540;
  const pxPerMetre = opts.pxPerMetre ?? 100;

  const bounds = polygonBounds(room.polygon);
  const roomWpx = (bounds.maxX - bounds.minX) * pxPerMetre;
  const roomHpx = (bounds.maxY - bounds.minY) * pxPerMetre;
  // Margin = max 40px or 8% of canvas.
  const margin = 60;
  const scale = Math.min(
    (widthPx - margin * 2) / Math.max(roomWpx, 1),
    (heightPx - margin * 2) / Math.max(roomHpx, 1),
    pxPerMetre, // never up-scale beyond 1m → 100px
  );
  const drawWpx = roomWpx * scale;
  const drawHpx = roomHpx * scale;
  const offsetX = (widthPx - drawWpx) / 2 - bounds.minX * scale;
  const offsetY = (heightPx - drawHpx) / 2 - bounds.minY * scale;

  const toX = (v: Vertex) => v.x * scale + offsetX;
  const toY = (v: Vertex) => v.y * scale + offsetY;

  const points = room.polygon.map((v) => `${toX(v).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  // Grid (1 m squares) inside polygon bounds
  const gridLines: string[] = [];
  const gridStep = scale; // = 1m
  for (let gx = bounds.minX; gx <= bounds.maxX; gx += 1) {
    const xpx = gx * scale + offsetX;
    gridLines.push(
      `<line x1="${xpx.toFixed(1)}" y1="${(bounds.minY * scale + offsetY).toFixed(1)}" x2="${xpx.toFixed(1)}" y2="${(bounds.maxY * scale + offsetY).toFixed(1)}" stroke="${PPW_STONE}" stroke-width="0.5"/>`,
    );
  }
  for (let gy = bounds.minY; gy <= bounds.maxY; gy += 1) {
    const ypx = gy * scale + offsetY;
    gridLines.push(
      `<line x1="${(bounds.minX * scale + offsetX).toFixed(1)}" y1="${ypx.toFixed(1)}" x2="${(bounds.maxX * scale + offsetX).toFixed(1)}" y2="${ypx.toFixed(1)}" stroke="${PPW_STONE}" stroke-width="0.5"/>`,
    );
  }

  // Placed items — rects in metres with rotation around centre.
  const items = room.placedItems
    .map((it) => {
      const wPx = (it.length_cm / 100) * scale;
      const hPx = (it.width_cm / 100) * scale;
      const cx = it.x * scale + offsetX;
      const cy = it.y * scale + offsetY;
      return `<g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${it.rotation.toFixed(1)})">
        <rect x="${(-wPx / 2).toFixed(1)}" y="${(-hPx / 2).toFixed(1)}" width="${wPx.toFixed(1)}" height="${hPx.toFixed(1)}" fill="${PPW_CORAL}" fill-opacity="0.65" stroke="${PPW_TEAL}" stroke-width="1"/>
      </g>`;
    })
    .join('');

  // Dimension labels per polygon edge
  const labels: string[] = [];
  const usedGridStep = gridStep; // silence unused warn (kept above for clarity)
  void usedGridStep;
  for (let i = 0; i < room.polygon.length; i++) {
    const a = room.polygon[i];
    const b = room.polygon[(i + 1) % room.polygon.length];
    const lengthM = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    if (lengthM < 0.3) continue;
    const mx = (toX(a) + toX(b)) / 2;
    const my = (toY(a) + toY(b)) / 2;
    labels.push(
      `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-family="Helvetica, Arial" font-size="11" fill="${PPW_INK}" text-anchor="middle" dy="-4">${lengthM.toFixed(2)} m</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">
    <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="${PPW_SAND}"/>
    <g clip-path="url(#room-clip)">
      <polygon points="${points}" fill="#ffffff" stroke="${PPW_TEAL}" stroke-width="2"/>
      ${gridLines.join('')}
    </g>
    <polygon points="${points}" fill="none" stroke="${PPW_TEAL}" stroke-width="2"/>
    ${items}
    ${labels.join('')}
    <text x="14" y="22" font-family="Helvetica, Arial" font-size="13" font-weight="bold" fill="${PPW_INK}">${escape(room.name)}</text>
    <defs>
      <clipPath id="room-clip"><polygon points="${points}"/></clipPath>
    </defs>
  </svg>`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert an SVG string to a PNG data URL via an off-screen canvas.
 * Returns null if the browser environment isn't available (SSR / tests).
 */
export async function svgToPngDataUrl(svg: string, width = 800, height = 540): Promise<string | null> {
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
