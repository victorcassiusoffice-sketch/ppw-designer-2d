/**
 * Plan PDF generator — client-side jsPDF.
 *
 * Renders a multi-page PDF that the customer can download from
 * /order/success and the install team can print on the day.
 *
 * Layout:
 *   - Page 1: Cover (text "Peak Performance Wellness" logo + order meta)
 *   - Page 2+: One per room — name, floor plan image (if available),
 *              and a table of products placed in that room.
 *   - Final page: Summary — grand total + footer with next steps.
 *
 * NO commission percentages anywhere — this is customer-facing.
 *
 * `generatePlanPdf` is pure-ish: it takes an `OrderPdfInput` and
 * returns a Blob. The caller is responsible for triggering download.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Currency } from '../data/products.schema';

/** Input shape — kept independent of zustand stores so this fn is testable. */
export interface OrderPdfInput {
  orderId: string;
  date: number;
  customerName: string;
  customerEmail: string;
  currency: Currency;
  total: number;
  property: {
    name: string;
    rooms: Array<{
      id: string;
      name: string;
      /** Optional PNG/JPEG data URL of the floor plan (from Konva stage.toDataURL()). */
      floorPlanDataUrl?: string;
      products: Array<{
        sku: string;
        name: string;
        quantity: number;
        dimensions: string; // e.g. "220 × 100 × 90 cm"
        unitPriceDisplay: number;
        lineTotalDisplay: number;
      }>;
    }>;
  };
}

const PPW_TEAL: [number, number, number] = [31, 74, 74];
const PPW_INK: [number, number, number] = [31, 58, 58];
const PPW_SLATE: [number, number, number] = [90, 101, 102];
const PPW_SAND: [number, number, number] = [244, 239, 227];
const PPW_STONE: [number, number, number] = [229, 225, 216];

const CURRENCY_PREFIX: Record<Currency, string> = {
  MUR: 'Rs ',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

function fmt(value: number, currency: Currency): string {
  const digits = currency === 'MUR' ? 0 : 2;
  const rounded = value.toFixed(digits);
  return `${CURRENCY_PREFIX[currency]}${rounded}`;
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

function drawHeader(doc: jsPDF, title: string): void {
  // Brand strip
  doc.setFillColor(...PPW_TEAL);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PEAK PERFORMANCE WELLNESS', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Tamarin · Mauritius · ppwellness.co', 14, 17);
  doc.setTextColor(...PPW_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 14, 34);
}

function drawFooter(doc: jsPDF): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...PPW_STONE);
  doc.setLineWidth(0.2);
  doc.line(14, h - 18, w - 14, h - 18);
  doc.setTextColor(...PPW_SLATE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Questions: victor@ppwellness.co · Next steps will arrive by email within 24h · Terms: ppwellness.co/terms',
    14,
    h - 12,
  );
  doc.text(`Page ${doc.getNumberOfPages()}`, w - 14, h - 12, { align: 'right' });
}

function drawCover(doc: jsPDF, input: OrderPdfInput): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  // Sand backdrop
  doc.setFillColor(...PPW_SAND);
  doc.rect(0, 0, w, h, 'F');
  // Teal top band
  doc.setFillColor(...PPW_TEAL);
  doc.rect(0, 0, w, 70, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('PEAK PERFORMANCE', w / 2, 30, { align: 'center' });
  doc.text('WELLNESS', w / 2, 42, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Wellness Room Plan', w / 2, 55, { align: 'center' });

  // Order meta block
  doc.setTextColor(...PPW_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(input.property.name, w / 2, 100, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Prepared for ${input.customerName}`, w / 2, 110, { align: 'center' });

  const metaY = 130;
  doc.setFontSize(10);
  doc.setTextColor(...PPW_SLATE);
  doc.text('Order reference', 60, metaY);
  doc.text('Date', 60, metaY + 8);
  doc.text('Rooms', 60, metaY + 16);
  doc.text('Total', 60, metaY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PPW_INK);
  doc.text(input.orderId, 110, metaY);
  doc.text(formatDate(input.date), 110, metaY + 8);
  doc.text(String(input.property.rooms.length), 110, metaY + 16);
  doc.text(fmt(input.total, input.currency), 110, metaY + 24);

  // Spacer line
  doc.setDrawColor(...PPW_TEAL);
  doc.setLineWidth(0.6);
  doc.line(w / 2 - 40, h - 50, w / 2 + 40, h - 50);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...PPW_SLATE);
  doc.setFontSize(9);
  doc.text('Thank you. The install team will be in touch within 24 hours.', w / 2, h - 40, {
    align: 'center',
  });
}

function drawRoomPage(doc: jsPDF, room: OrderPdfInput['property']['rooms'][number], roomIndex: number, currency: Currency): void {
  drawHeader(doc, `Room ${roomIndex + 1}: ${room.name}`);

  let y = 44;
  if (room.floorPlanDataUrl) {
    try {
      // Image — fit into ~120mm × 80mm box.
      const maxW = doc.internal.pageSize.getWidth() - 28;
      const maxH = 80;
      doc.addImage(room.floorPlanDataUrl, 'PNG', 14, y, maxW, maxH, undefined, 'FAST');
      y += maxH + 6;
    } catch {
      // jsPDF throws on malformed data URLs — fall through silently.
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...PPW_SLATE);
      doc.setFontSize(9);
      doc.text('Floor plan image unavailable.', 14, y + 6);
      y += 12;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...PPW_SLATE);
    doc.setFontSize(9);
    doc.text('Floor plan rendered separately — see designer URL.', 14, y + 6);
    y += 12;
  }

  if (room.products.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...PPW_SLATE);
    doc.setFontSize(10);
    doc.text('No products placed in this room.', 14, y + 10);
    drawFooter(doc);
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [['SKU', 'Product', 'Qty', 'Dimensions', 'Unit', 'Total']],
    body: room.products.map((p) => [
      p.sku,
      p.name,
      String(p.quantity),
      p.dimensions,
      fmt(p.unitPriceDisplay, currency),
      fmt(p.lineTotalDisplay, currency),
    ]),
    theme: 'grid',
    headStyles: { fillColor: PPW_TEAL, textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: PPW_INK },
    alternateRowStyles: { fillColor: PPW_SAND },
    styles: { cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);
}

function drawSummaryPage(doc: jsPDF, input: OrderPdfInput): void {
  drawHeader(doc, 'Order summary');
  let y = 50;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PPW_SLATE);

  const rows = input.property.rooms.map((r) => {
    const roomTotal = r.products.reduce((acc, p) => acc + p.lineTotalDisplay, 0);
    const itemCount = r.products.reduce((acc, p) => acc + p.quantity, 0);
    return [r.name, String(itemCount), fmt(roomTotal, input.currency)];
  });

  autoTable(doc, {
    startY: y,
    head: [['Room', 'Items', 'Subtotal']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: PPW_TEAL, textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 10, textColor: PPW_INK },
    margin: { left: 14, right: 14 },
  });

  // jsPDF autotable exposes the cursor on the doc — peek where it landed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 10;

  doc.setDrawColor(...PPW_TEAL);
  doc.setLineWidth(0.4);
  doc.line(14, lastY, doc.internal.pageSize.getWidth() - 14, lastY);
  y = lastY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PPW_INK);
  doc.text('Grand total', 14, y);
  doc.text(fmt(input.total, input.currency), doc.internal.pageSize.getWidth() - 14, y, {
    align: 'right',
  });
  y += 10;

  // Next steps box
  doc.setFillColor(...PPW_SAND);
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 38, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PPW_TEAL);
  doc.text('What happens next', 18, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PPW_INK);
  const steps = [
    '1. The PPW install team will email you within 24 hours.',
    '2. We confirm shipping for your region and lock a delivery window.',
    '3. Once your products land in country, we schedule the install.',
    '4. We bring this PDF on install day — please keep it accessible.',
  ];
  steps.forEach((s, i) => doc.text(s, 18, y + 14 + i * 5));

  drawFooter(doc);
}

export function generatePlanPdf(input: OrderPdfInput): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawCover(doc, input);
  input.property.rooms.forEach((room, i) => {
    doc.addPage();
    drawRoomPage(doc, room, i, input.currency);
  });
  doc.addPage();
  drawSummaryPage(doc, input);
  return doc.output('blob');
}

/** Trigger a browser download for a generated PDF blob. */
export function triggerPdfDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free the object URL after the click — small delay keeps Safari happy.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
