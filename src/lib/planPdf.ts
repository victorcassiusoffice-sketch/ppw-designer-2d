/**
 * Plan PDF generator - Week 4b Hotfix 5 (vector floor plan).
 *
 * ARCHITECTURAL-GRADE FLOOR PLAN PDF
 * ----------------------------------
 * This module replaces the old canvas-snapshot PDF (an SVG rasterised
 * through canvas.toDataURL then embedded as a stretched PNG). The
 * customer plan is now a fully vector document drawn with jsPDF
 * primitives only: rect, line, lines, text, triangle, setFillColor,
 * setDrawColor, setLineWidth, setFontSize, setFont, circle.
 *
 * No html2canvas. No Stage.toDataURL. No Konva snapshots. No raster
 * embedding anywhere in the pipeline. Vector all the way.
 *
 * Layout (A4 portrait, mm units throughout):
 *   - Page 1: Cover - title, customer + order meta, property summary.
 *   - Page 2..N: One per room - title block, vector floor plan
 *     (walls, grid, products, dimensions, scale bar, north arrow),
 *     and a per-room item table.
 *   - Last page: Itemised summary via jspdf-autotable.
 *
 * Currency formatting respects MUR/USD/EUR/GBP and never exposes
 * commission percentages or any internal-only fields.
 */

import { jsPDF as JsPDFCtor } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Currency } from '../data/products.schema';

/**
 * Locally-augmented jsPDF type. The installed jspdf 2.5.2 ships
 * `"typings": "types/index.d.ts"` in its package.json but the actual
 * file is missing from the published tarball, so TS can't resolve any
 * of the legitimate runtime methods we use (lines, circle, triangle,
 * getTextWidth, setLineCap, setLineJoin). Re-declaring the surface
 * here keeps the rest of the file strict-typed.
 */
type jsPDF = InstanceType<typeof JsPDFCtor> & {
  lines: (
    lines: number[][],
    x: number,
    y: number,
    scale: [number, number],
    style?: string,
    closed?: boolean,
  ) => jsPDF;
  circle: (x: number, y: number, r: number, style?: string) => jsPDF;
  triangle: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    style?: string,
  ) => jsPDF;
  getTextWidth: (text: string) => number;
  setLineCap: (cap: string) => jsPDF;
  setLineJoin: (join: string) => jsPDF;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsPDF = JsPDFCtor as unknown as new (opts?: any) => jsPDF;

// =====================================================================
// Input shape
// =====================================================================

/** A placed item carrying enough geometry to draw the rectangle. */
export interface PdfPlacedItem {
  xM: number;
  yM: number;
  lengthM: number;
  widthM: number;
  rotation: number;
  productId: string;
  productName: string;
  category?: string;
  dimensionsLabel: string;
  sku: string;
}

/** Per-room line item used in the summary tables. */
export interface PdfProductLine {
  sku: string;
  name: string;
  quantity: number;
  dimensions: string;
  supplier?: string;
  unitPriceDisplay: number;
  lineTotalDisplay: number;
}

export interface PdfRoom {
  id: string;
  name: string;
  polygon: Array<{ x: number; y: number }>;
  placedItems: PdfPlacedItem[];
  products: PdfProductLine[];
}

export interface OrderPdfInput {
  orderId: string;
  date: number;
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
  currency: Currency;
  total: number;
  shipping?: number;
  property: {
    name: string;
    rooms: PdfRoom[];
  };
}

// =====================================================================
// Brand palette
// =====================================================================

const PPW_TEAL: [number, number, number] = [15, 118, 110];
const PPW_INK: [number, number, number] = [14, 27, 31];
const PPW_SLATE: [number, number, number] = [59, 74, 82];
const PPW_SAND: [number, number, number] = [245, 241, 234];
const PPW_STONE: [number, number, number] = [196, 203, 205];
const PPW_WHITE: [number, number, number] = [255, 255, 255];
const PPW_CORAL: [number, number, number] = [231, 111, 81];

const CATEGORY_FILL: Record<string, [number, number, number]> = {
  'ice-bath': [206, 226, 236],
  'sleep-pod': [218, 211, 234],
  'ergo-chair': [223, 207, 188],
  plant: [212, 226, 205],
  'eco-office-kit': [234, 226, 198],
};
const CATEGORY_BORDER: Record<string, [number, number, number]> = {
  'ice-bath': [78, 142, 174],
  'sleep-pod': [122, 96, 168],
  'ergo-chair': [156, 109, 70],
  plant: [102, 142, 86],
  'eco-office-kit': [168, 142, 78],
};

function fillForCategory(cat?: string): [number, number, number] {
  if (!cat) return [225, 225, 225];
  return CATEGORY_FILL[cat] ?? [225, 225, 225];
}
function borderForCategory(cat?: string): [number, number, number] {
  if (!cat) return PPW_SLATE;
  return CATEGORY_BORDER[cat] ?? PPW_SLATE;
}

// =====================================================================
// Currency
// =====================================================================

interface CurrencyStyle {
  prefix: string;
  decimals: number;
}

const CURRENCY_STYLES: Record<Currency, CurrencyStyle> = {
  MUR: { prefix: 'Rs ', decimals: 0 },
  USD: { prefix: '$', decimals: 2 },
  EUR: { prefix: 'EUR ', decimals: 2 },
  GBP: { prefix: 'GBP ', decimals: 2 },
};

export function formatCurrencyPdf(value: number, currency: Currency): string {
  const style = CURRENCY_STYLES[currency];
  const fixed = value.toFixed(style.decimals);
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${style.prefix}${grouped}${frac ? '.' + frac : ''}`;
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

// =====================================================================
// Geometry helpers
// =====================================================================

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function bounds(polygon: Array<{ x: number; y: number }>): Bounds {
  if (polygon.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = polygon[0].x;
  let minY = polygon[0].y;
  let maxX = polygon[0].x;
  let maxY = polygon[0].y;
  for (const v of polygon) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

function polygonArea(polygon: Array<{ x: number; y: number }>): number {
  if (polygon.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

// =====================================================================
// Page chrome
// =====================================================================

const A4_W = 210;
const A4_H = 297;
const MARGIN = 14;

function drawHeader(doc: jsPDF, title: string): void {
  doc.setFillColor(...PPW_TEAL);
  doc.rect(0, 0, A4_W, 22, 'F');
  doc.setTextColor(...PPW_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PEAK PERFORMANCE WELLNESS', MARGIN, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Tamarin  -  Mauritius  -  ppwellness.co', MARGIN, 16);
  doc.setTextColor(...PPW_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, MARGIN, 30);
  doc.setDrawColor(...PPW_TEAL);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 33, A4_W - MARGIN, 33);
}

function drawFooter(doc: jsPDF): void {
  doc.setDrawColor(...PPW_STONE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, A4_H - 14, A4_W - MARGIN, A4_H - 14);
  doc.setTextColor(...PPW_SLATE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Prepared by Peak Performance Wellness  -  Tamarin  -  Mauritius  -  ppwellness.co',
    MARGIN,
    A4_H - 9,
  );
  doc.text(`Page ${doc.getNumberOfPages()}`, A4_W - MARGIN, A4_H - 9, { align: 'right' });
}

// =====================================================================
// Cover page
// =====================================================================

function drawCover(doc: jsPDF, input: OrderPdfInput): void {
  doc.setFillColor(...PPW_SAND);
  doc.rect(0, 0, A4_W, A4_H, 'F');

  doc.setFillColor(...PPW_TEAL);
  doc.rect(0, 0, A4_W, 70, 'F');

  doc.setTextColor(...PPW_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PEAK PERFORMANCE', A4_W / 2, 28, { align: 'center' });
  doc.text('WELLNESS', A4_W / 2, 40, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Wellness Property Design Plan', A4_W / 2, 56, { align: 'center' });

  doc.setTextColor(...PPW_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(input.property.name || 'Wellness Property', A4_W / 2, 92, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...PPW_SLATE);
  doc.text(`Prepared for ${input.customerName}`, A4_W / 2, 100, { align: 'center' });

  const panelX = MARGIN;
  const panelY = 116;
  const panelW = A4_W - MARGIN * 2;
  const panelH = 86;
  doc.setFillColor(...PPW_WHITE);
  doc.setDrawColor(...PPW_STONE);
  doc.setLineWidth(0.4);
  doc.roundedRect(panelX, panelY, panelW, panelH, 3, 3, 'FD');

  const totalItems = input.property.rooms.reduce(
    (acc, r) => acc + r.products.reduce((a, p) => a + p.quantity, 0),
    0,
  );
  const totalAreaM2 = input.property.rooms.reduce(
    (acc, r) => acc + polygonArea(r.polygon),
    0,
  );

  const labelX = panelX + 6;
  const valueX = panelX + panelW / 2 + 4;
  let row = panelY + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PPW_INK);
  doc.text('Order details', labelX, row);
  row += 7;
  doc.setFontSize(9);

  const rows: Array<[string, string]> = [
    ['Order reference', input.orderId],
    ['Date', formatDate(input.date)],
    ['Customer', input.customerName],
    ['Email', input.customerEmail],
  ];
  if (input.customerAddress && input.customerAddress.trim()) {
    rows.push(['Address', input.customerAddress.replace(/\s+/g, ' ').trim()]);
  }
  rows.push(['Rooms', String(input.property.rooms.length)]);
  rows.push(['Total items', String(totalItems)]);
  rows.push(['Total floor area', `${totalAreaM2.toFixed(1)} m2`]);
  rows.push(['Grand total', formatCurrencyPdf(input.total, input.currency)]);

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PPW_SLATE);
    doc.text(label, labelX, row);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PPW_INK);
    const maxW = panelX + panelW - 6 - valueX;
    doc.text(truncateText(doc, value, maxW), valueX, row);
    row += 6;
  }

  doc.setDrawColor(...PPW_TEAL);
  doc.setLineWidth(0.6);
  doc.line(A4_W / 2 - 30, A4_H - 50, A4_W / 2 + 30, A4_H - 50);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...PPW_SLATE);
  doc.setFontSize(9);
  doc.text('Thank you. The install team will be in touch within 24 hours.', A4_W / 2, A4_H - 42, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PPW_SLATE);
  doc.text(
    'Prepared by Peak Performance Wellness  -  Tamarin  -  Mauritius  -  ppwellness.co',
    A4_W / 2,
    A4_H - 18,
    { align: 'center' },
  );
}

// =====================================================================
// Floor plan helpers
// =====================================================================

interface PlanBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fitScale(polygon: Array<{ x: number; y: number }>, box: PlanBox): {
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  const b = bounds(polygon);
  const wM = Math.max(0.01, b.maxX - b.minX);
  const hM = Math.max(0.01, b.maxY - b.minY);
  const innerPad = 10;
  const usableW = box.w - innerPad * 2;
  const usableH = box.h - innerPad * 2;
  const scale = Math.min(usableW / wM, usableH / hM);
  const drawW = wM * scale;
  const drawH = hM * scale;
  const offsetX = box.x + (box.w - drawW) / 2 - b.minX * scale;
  const offsetY = box.y + (box.h - drawH) / 2 - b.minY * scale;
  return { scale, offsetX, offsetY };
}

function drawRoomTitleBlock(
  doc: jsPDF,
  room: PdfRoom,
  roomIndex: number,
): void {
  const b = bounds(room.polygon);
  const wM = b.maxX - b.minX;
  const hM = b.maxY - b.minY;
  const areaM2 = polygonArea(room.polygon);
  const itemCount = room.products.reduce((acc, p) => acc + p.quantity, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PPW_INK);
  doc.text(`Room ${roomIndex + 1}  -  ${room.name}`, MARGIN, 41);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PPW_SLATE);
  const meta = `Bounding box ${wM.toFixed(2)} m x ${hM.toFixed(2)} m   .   Floor area ${areaM2.toFixed(2)} m2   .   ${itemCount} item${itemCount === 1 ? '' : 's'}`;
  doc.text(meta, MARGIN, 47);
}

function drawWalls(
  doc: jsPDF,
  polygon: Array<{ x: number; y: number }>,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  if (polygon.length < 2) return;

  doc.setFillColor(252, 250, 246);
  const pts: number[][] = polygon.map((v) => [v.x * scale + offsetX, v.y * scale + offsetY]);
  if (pts.length >= 3) {
    const start = pts[0];
    const deltas: number[][] = [];
    for (let i = 1; i < pts.length; i++) {
      deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    }
    deltas.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
    doc.lines(deltas, start[0], start[1], [1, 1], 'F', true);
  }

  doc.setDrawColor(...PPW_INK);
  doc.setLineWidth(1.2);
  doc.setLineCap('butt');
  doc.setLineJoin('miter');
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    doc.line(a[0], a[1], c[0], c[1]);
  }
}

function drawGrid(
  doc: jsPDF,
  polygon: Array<{ x: number; y: number }>,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  const b = bounds(polygon);
  doc.setDrawColor(...PPW_STONE);
  doc.setLineWidth(0.1);
  const step = 0.5;
  const x0 = Math.floor(b.minX / step) * step;
  const x1 = Math.ceil(b.maxX / step) * step;
  const y0 = Math.floor(b.minY / step) * step;
  const y1 = Math.ceil(b.maxY / step) * step;
  for (let gx = x0; gx <= x1 + 1e-6; gx += step) {
    const px = gx * scale + offsetX;
    doc.line(px, b.minY * scale + offsetY, px, b.maxY * scale + offsetY);
  }
  for (let gy = y0; gy <= y1 + 1e-6; gy += step) {
    const py = gy * scale + offsetY;
    doc.line(b.minX * scale + offsetX, py, b.maxX * scale + offsetX, py);
  }
}

function drawWallLabels(
  doc: jsPDF,
  polygon: Array<{ x: number; y: number }>,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  if (polygon.length < 2) return;
  let cx = 0;
  let cy = 0;
  for (const v of polygon) {
    cx += v.x * scale + offsetX;
    cy += v.y * scale + offsetY;
  }
  cx /= polygon.length;
  cy /= polygon.length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dxm = b.x - a.x;
    const dym = b.y - a.y;
    const lengthM = Math.sqrt(dxm * dxm + dym * dym);
    if (lengthM < 0.3) continue;

    const ax = a.x * scale + offsetX;
    const ay = a.y * scale + offsetY;
    const bx = b.x * scale + offsetX;
    const by = b.y * scale + offsetY;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;

    const dxp = mx - cx;
    const dyp = my - cy;
    const len = Math.hypot(dxp, dyp) || 1;
    const off = 5;
    const tx = mx + (dxp / len) * off;
    const ty = my + (dyp / len) * off;

    const label = `${lengthM.toFixed(2)} m`;
    const w = doc.getTextWidth(label) + 4;
    const h = 4.5;
    doc.setFillColor(...PPW_INK);
    doc.rect(tx - w / 2, ty - h / 2, w, h, 'F');
    doc.setTextColor(...PPW_WHITE);
    doc.text(label, tx, ty + 1.4, { align: 'center' });
  }
}

function drawProducts(
  doc: jsPDF,
  items: PdfPlacedItem[],
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  for (const it of items) {
    drawProduct(doc, it, scale, offsetX, offsetY);
  }
}

function drawProduct(
  doc: jsPDF,
  it: PdfPlacedItem,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  const r = ((it.rotation % 360) + 360) % 360;
  const swap = r === 90 || r === 270;
  const footprintW = swap ? it.widthM : it.lengthM;
  const footprintH = swap ? it.lengthM : it.widthM;

  const cxM = it.xM + footprintW / 2;
  const cyM = it.yM + footprintH / 2;
  const cx = cxM * scale + offsetX;
  const cy = cyM * scale + offsetY;
  const wPx = it.lengthM * scale;
  const hPx = it.widthM * scale;

  const fill = fillForCategory(it.category);
  const border = borderForCategory(it.category);

  const rad = (r * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: Array<[number, number]> = [
    [-wPx / 2, -hPx / 2],
    [wPx / 2, -hPx / 2],
    [wPx / 2, hPx / 2],
    [-wPx / 2, hPx / 2],
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);

  const start = corners[0];
  const deltas: number[][] = [];
  for (let i = 1; i < corners.length; i++) {
    deltas.push([corners[i][0] - corners[i - 1][0], corners[i][1] - corners[i - 1][1]]);
  }
  deltas.push([corners[0][0] - corners[3][0], corners[0][1] - corners[3][1]]);

  doc.setFillColor(...fill);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.35);
  doc.lines(deltas, start[0], start[1], [1, 1], 'FD', true);

  const shortSide = Math.min(wPx, hPx);
  if (shortSide < 6) return;

  doc.setTextColor(...PPW_INK);
  const fitWidth = shortSide - 2;
  const nameFont = pickFontForWidth(doc, it.productName, fitWidth, 9, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(nameFont);
  const nameOut = truncateText(doc, it.productName, fitWidth);
  doc.text(nameOut, cx, cy - 1.2, { align: 'center' });

  if (shortSide >= 9) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(Math.max(5.5, nameFont - 2));
    const dimOut = truncateText(doc, it.dimensionsLabel, fitWidth);
    doc.text(dimOut, cx, cy + 2.4, { align: 'center' });
  }
  if (shortSide >= 13 && it.sku) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(Math.max(5, nameFont - 3));
    doc.setTextColor(...PPW_SLATE);
    const skuOut = truncateText(doc, it.sku, fitWidth);
    doc.text(skuOut, cx, cy + 5.4, { align: 'center' });
  }
}

function pickFontForWidth(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
): number {
  doc.setFont('helvetica', 'bold');
  let size = startSize;
  while (size > minSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) return size;
    size -= 0.5;
  }
  return minSize;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '';
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = '...';
  let s = text;
  while (s.length > 0 && doc.getTextWidth(s + ellipsis) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s.length === 0 ? '' : s + ellipsis;
}

function drawScaleBar(doc: jsPDF, x: number, y: number, scale: number): void {
  const seg = scale * 1;
  const h = 2.2;
  doc.setDrawColor(...PPW_INK);
  doc.setLineWidth(0.3);
  doc.setFillColor(...PPW_INK);
  doc.rect(x, y, seg, h, 'F');
  doc.setFillColor(...PPW_WHITE);
  doc.rect(x + seg, y, seg, h, 'FD');
  doc.setDrawColor(...PPW_INK);
  doc.rect(x, y, seg, h);
  doc.rect(x + seg, y, seg, h);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PPW_INK);
  doc.text('0', x, y + h + 3, { align: 'center' });
  doc.text('1 m', x + seg, y + h + 3, { align: 'center' });
  doc.text('2 m', x + seg * 2, y + h + 3, { align: 'center' });
}

function drawNorthArrow(doc: jsPDF, cx: number, cy: number): void {
  const r = 5;
  doc.setDrawColor(...PPW_SLATE);
  doc.setLineWidth(0.3);
  doc.setFillColor(...PPW_WHITE);
  doc.circle(cx, cy, r, 'FD');
  doc.setFillColor(...PPW_CORAL);
  doc.setDrawColor(...PPW_INK);
  doc.setLineWidth(0.2);
  doc.triangle(cx, cy - r + 1, cx - 1.6, cy + 1.6, cx + 1.6, cy + 1.6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...PPW_INK);
  doc.text('N', cx, cy - r - 0.6, { align: 'center' });
}

function drawDimensionLines(
  doc: jsPDF,
  polygon: Array<{ x: number; y: number }>,
  scale: number,
  offsetX: number,
  offsetY: number,
  box: PlanBox,
): void {
  const b = bounds(polygon);
  doc.setDrawColor(...PPW_SLATE);
  doc.setLineWidth(0.25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PPW_SLATE);

  const yBaseline = b.maxY * scale + offsetY + 5;
  if (yBaseline < box.y + box.h - 2) {
    doc.line(b.minX * scale + offsetX, yBaseline, b.maxX * scale + offsetX, yBaseline);
    const x0 = Math.floor(b.minX);
    const x1 = Math.ceil(b.maxX);
    for (let gx = x0; gx <= x1; gx++) {
      if (gx < b.minX - 0.01 || gx > b.maxX + 0.01) continue;
      const px = gx * scale + offsetX;
      doc.line(px, yBaseline - 1.2, px, yBaseline + 1.2);
      doc.text(`${gx} m`, px, yBaseline + 4.5, { align: 'center' });
    }
  }

  const xBaseline = b.minX * scale + offsetX - 5;
  if (xBaseline > box.x + 2) {
    doc.line(xBaseline, b.minY * scale + offsetY, xBaseline, b.maxY * scale + offsetY);
    const y0 = Math.floor(b.minY);
    const y1 = Math.ceil(b.maxY);
    for (let gy = y0; gy <= y1; gy++) {
      if (gy < b.minY - 0.01 || gy > b.maxY + 0.01) continue;
      const py = gy * scale + offsetY;
      doc.line(xBaseline - 1.2, py, xBaseline + 1.2, py);
      doc.text(`${gy} m`, xBaseline - 2, py + 1, { align: 'right' });
    }
  }
}

function drawLegend(
  doc: jsPDF,
  x: number,
  y: number,
  usedCategories: string[],
): void {
  const labels: Record<string, string> = {
    'ice-bath': 'Ice Bath',
    'sleep-pod': 'Sleep Pod',
    'ergo-chair': 'Ergo Chair',
    plant: 'Plant',
    'eco-office-kit': 'Eco Office',
  };
  if (usedCategories.length === 0) return;
  let lx = x;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  for (const cat of usedCategories) {
    const fill = fillForCategory(cat);
    const border = borderForCategory(cat);
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.rect(lx, y - 2.6, 3.5, 3.5, 'FD');
    doc.setTextColor(...PPW_INK);
    const label = labels[cat] ?? cat;
    doc.text(label, lx + 4.5, y);
    lx += doc.getTextWidth(label) + 10;
  }
}

// =====================================================================
// Room page
// =====================================================================

function drawRoomPage(
  doc: jsPDF,
  room: PdfRoom,
  roomIndex: number,
  currency: Currency,
): void {
  drawHeader(doc, `Floor Plan  -  ${room.name}`);
  drawRoomTitleBlock(doc, room, roomIndex);

  const planBox: PlanBox = {
    x: MARGIN,
    y: 54,
    w: A4_W - MARGIN * 2,
    h: 175,
  };

  doc.setDrawColor(...PPW_STONE);
  doc.setLineWidth(0.2);
  doc.setFillColor(...PPW_WHITE);
  doc.rect(planBox.x, planBox.y, planBox.w, planBox.h, 'FD');

  const { scale, offsetX, offsetY } = fitScale(room.polygon, planBox);

  drawWalls(doc, room.polygon, scale, offsetX, offsetY);
  drawGrid(doc, room.polygon, scale, offsetX, offsetY);

  doc.setDrawColor(...PPW_INK);
  doc.setLineWidth(1.2);
  const ptsForStroke: number[][] = room.polygon.map((v) => [
    v.x * scale + offsetX,
    v.y * scale + offsetY,
  ]);
  for (let i = 0; i < ptsForStroke.length; i++) {
    const a = ptsForStroke[i];
    const b = ptsForStroke[(i + 1) % ptsForStroke.length];
    doc.line(a[0], a[1], b[0], b[1]);
  }

  drawProducts(doc, room.placedItems, scale, offsetX, offsetY);
  drawWallLabels(doc, room.polygon, scale, offsetX, offsetY);
  drawDimensionLines(doc, room.polygon, scale, offsetX, offsetY, planBox);

  drawScaleBar(doc, planBox.x + 4, planBox.y + planBox.h - 9, scale);
  drawNorthArrow(doc, planBox.x + planBox.w - 8, planBox.y + 8);

  const usedCats = Array.from(
    new Set(room.placedItems.map((p) => p.category).filter((c): c is string => !!c)),
  );
  if (usedCats.length > 0) {
    drawLegend(doc, planBox.x + 28, planBox.y + planBox.h - 5, usedCats);
  }

  if (room.products.length > 0) {
    autoTable(doc, {
      startY: planBox.y + planBox.h + 4,
      head: [['SKU', 'Product', 'Qty', 'Dimensions', 'Unit', 'Total']],
      body: room.products.map((p) => [
        p.sku,
        p.name,
        String(p.quantity),
        p.dimensions,
        formatCurrencyPdf(p.unitPriceDisplay, currency),
        formatCurrencyPdf(p.lineTotalDisplay, currency),
      ]),
      theme: 'grid',
      headStyles: { fillColor: PPW_TEAL, textColor: PPW_WHITE, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: PPW_INK },
      alternateRowStyles: { fillColor: PPW_SAND },
      styles: { cellPadding: 1.6 },
      margin: { left: MARGIN, right: MARGIN },
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...PPW_SLATE);
    doc.setFontSize(9);
    doc.text(
      'No products placed in this room.',
      MARGIN,
      planBox.y + planBox.h + 12,
    );
  }

  drawFooter(doc);
}

// =====================================================================
// Summary page
// =====================================================================

function drawSummaryPage(doc: jsPDF, input: OrderPdfInput): void {
  drawHeader(doc, 'Itemised Order Summary');

  const merged = new Map<string, PdfProductLine>();
  for (const r of input.property.rooms) {
    for (const p of r.products) {
      const existing = merged.get(p.sku);
      if (existing) {
        existing.quantity += p.quantity;
        existing.lineTotalDisplay += p.lineTotalDisplay;
      } else {
        merged.set(p.sku, { ...p });
      }
    }
  }
  const flat = Array.from(merged.values());

  const subtotal = flat.reduce((acc, p) => acc + p.lineTotalDisplay, 0);
  const shipping = input.shipping ?? 0;

  autoTable(doc, {
    startY: 42,
    head: [['SKU', 'Product', 'Qty', 'Dimensions', 'Supplier', 'Unit', 'Total']],
    body: flat.map((p) => [
      p.sku,
      p.name,
      String(p.quantity),
      p.dimensions,
      p.supplier ?? '-',
      formatCurrencyPdf(p.unitPriceDisplay, input.currency),
      formatCurrencyPdf(p.lineTotalDisplay, input.currency),
    ]),
    theme: 'grid',
    headStyles: { fillColor: PPW_TEAL, textColor: PPW_WHITE, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: PPW_INK },
    alternateRowStyles: { fillColor: PPW_SAND },
    styles: { cellPadding: 2 },
    margin: { left: MARGIN, right: MARGIN },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = ((doc as any).lastAutoTable?.finalY ?? 80) + 8;

  const totalsW = 80;
  const totalsX = A4_W - MARGIN - totalsW;
  doc.setDrawColor(...PPW_STONE);
  doc.setLineWidth(0.3);

  function row(label: string, value: string, bold = false): void {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(...(bold ? PPW_INK : PPW_SLATE));
    doc.text(label, totalsX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PPW_INK);
    doc.text(value, totalsX + totalsW, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  }

  row('Subtotal', formatCurrencyPdf(subtotal, input.currency));
  row('Shipping', shipping > 0 ? formatCurrencyPdf(shipping, input.currency) : 'Calculated at install');
  doc.setDrawColor(...PPW_TEAL);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y - 2, totalsX + totalsW, y - 2);
  y += 1;
  row('Grand total', formatCurrencyPdf(input.total, input.currency), true);

  y += 6;
  doc.setFillColor(...PPW_SAND);
  doc.roundedRect(MARGIN, y, A4_W - MARGIN * 2, 32, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PPW_TEAL);
  doc.text('Payment & next steps', MARGIN + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PPW_INK);
  doc.text(`Order reference: ${input.orderId}`, MARGIN + 4, y + 12);
  doc.text(`Payment currency: ${input.currency}`, MARGIN + 4, y + 16.5);
  doc.text(
    '1. The PPW install team will email you within 24 hours.',
    MARGIN + 4,
    y + 21,
  );
  doc.text(
    '2. Shipping confirmation and install date follow once stock lands.',
    MARGIN + 4,
    y + 25.5,
  );
  doc.text(
    '3. Bring this PDF on install day - the team uses it onsite.',
    MARGIN + 4,
    y + 30,
  );

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...PPW_SLATE);
  doc.text(
    'Questions? victor@ppwellness.co  -  ppwellness.co/contact',
    A4_W / 2,
    A4_H - 22,
    { align: 'center' },
  );

  drawFooter(doc);
}

// =====================================================================
// Public entry point
// =====================================================================

export function generatePlanPdf(input: OrderPdfInput): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  drawCover(doc, input);
  input.property.rooms.forEach((room, i) => {
    doc.addPage();
    drawRoomPage(doc, room, i, input.currency);
  });
  doc.addPage();
  drawSummaryPage(doc, input);
  return doc.output('blob');
}

export function triggerPdfDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
