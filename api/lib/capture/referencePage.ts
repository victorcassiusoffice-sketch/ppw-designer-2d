/**
 * Sims-Parity DT-02 — A4 reference-page PDF generator.
 *
 * Merchant prints this page at 100%, places it flat next to a product,
 * photographs it via the CaptureModal (DT-05), and the corner-tap
 * calibration UI (DT-06) derives `pixelsPerMm` from the four corners
 * of the A4 sheet (210 × 297 mm exact). The centred 200 × 200 mm
 * scale block is a redundant visual cross-check so the merchant can
 * eyeball the print scale before shooting.
 *
 * V4-AU-1 palette (gold/ink/cream) is used throughout for brand parity.
 * The PDF is a single A4 page, server-rendered with jspdf and served
 * with a 1-year immutable cache header.
 *
 * Tests live at `api/__tests__/referencePage.test.ts`.
 * Endpoint dispatch lives in `api/merchants-router.ts`.
 */

import { jsPDF as JsPDFCtor } from 'jspdf';

// V4-AU-1 palette — RGB triples for jspdf's setFillColor/setDrawColor APIs.
const PALETTE = {
  gold: { r: 0xc0, g: 0xa6, b: 0x7e },
  ink: { r: 0x0e, g: 0x0e, b: 0x10 },
  cream: { r: 0xf5, g: 0xef, b: 0xe6 },
} as const;

// A4 portrait in mm. The 4 corners of this page are the v1 corner-tap
// homography reference (DT-06 scaleFromMarker.ts).
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Centred 200×200 mm scale block — secondary visual scale verification.
const SCALE_BLOCK_MM = 200;

export interface ReferencePageOptions {
  /** Version tag printed in the footer for audit. */
  version?: string;
}

/**
 * Generate the A4 capture-reference PDF.
 *
 * Returns a `Uint8Array` of the raw PDF bytes. The Vercel handler
 * wraps this in a Buffer + writes the response with the right
 * Content-Type + Cache-Control headers.
 */
export function generateReferencePagePdf(opts: ReferencePageOptions = {}): Uint8Array {
  const version = opts.version ?? 'v1';

  // jspdf typings are sparse — locally re-declare the runtime surface
  // we use, same pattern as src/lib/planPdf.ts.
  type jsPDF = InstanceType<typeof JsPDFCtor> & {
    setLineWidth: (w: number) => jsPDF;
    setDrawColor: (r: number, g: number, b: number) => jsPDF;
    setFillColor: (r: number, g: number, b: number) => jsPDF;
    setTextColor: (r: number, g: number, b: number) => jsPDF;
    setFont: (font: string, style?: string) => jsPDF;
    setFontSize: (size: number) => jsPDF;
    rect: (x: number, y: number, w: number, h: number, style?: string) => jsPDF;
    line: (x1: number, y1: number, x2: number, y2: number) => jsPDF;
    text: (text: string, x: number, y: number, opts?: Record<string, unknown>) => jsPDF;
    output: (type: 'arraybuffer') => ArrayBuffer;
  };

  const doc = new JsPDFCtor({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  }) as jsPDF;

  // ─── 1. Cream-tint margin background (subtle, lets the white centre
  // calibration zone stand out for the corner-tap homography). ──────
  doc.setFillColor(PALETTE.cream.r, PALETTE.cream.g, PALETTE.cream.b);
  doc.rect(0, 0, A4_WIDTH_MM, 18, 'F'); // top margin
  doc.rect(0, A4_HEIGHT_MM - 18, A4_WIDTH_MM, 18, 'F'); // bottom margin

  // ─── 2. Gold inset frame — visual outline tracing the A4 page edge
  // ~2 mm inside. This is the calibration target the merchant taps in
  // DT-06. The exact corners are at (2, 2), (208, 2), (208, 295), (2, 295). ──
  doc.setDrawColor(PALETTE.gold.r, PALETTE.gold.g, PALETTE.gold.b);
  doc.setLineWidth(0.4);
  doc.rect(2, 2, A4_WIDTH_MM - 4, A4_HEIGHT_MM - 4);

  // Corner crosshairs — gold "+" marks at each of the four inset corners
  // so the merchant tapping a finger on a 1024×768 phone preview has a
  // clear sub-mm target. 8 mm long arms each.
  const corners: Array<[number, number]> = [
    [2, 2],
    [A4_WIDTH_MM - 2, 2],
    [2, A4_HEIGHT_MM - 2],
    [A4_WIDTH_MM - 2, A4_HEIGHT_MM - 2],
  ];
  doc.setLineWidth(0.8);
  for (const [cx, cy] of corners) {
    doc.line(cx - 4, cy, cx + 4, cy);
    doc.line(cx, cy - 4, cx, cy + 4);
  }

  // ─── 3. Title block. ──────────────────────────────────────────────
  doc.setTextColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PPW Wellness · Capture Reference Page', A4_WIDTH_MM / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Print this A4 page at 100% scale (no fit-to-page). Lay it flat beside your product, then run the in-app capture flow.',
    A4_WIDTH_MM / 2,
    16.5,
    { align: 'center' },
  );

  // ─── 4. Centred 200×200 mm scale block — secondary verification. ──
  // Its top-left is at ((210-200)/2, (297-200)/2) = (5, 48.5). Outlined
  // in ink with a 1.0 mm stroke; corner ticks in gold. Inside, two
  // axis labels "200 mm" along top + left edges.
  const sbX = (A4_WIDTH_MM - SCALE_BLOCK_MM) / 2; // 5
  const sbY = (A4_HEIGHT_MM - SCALE_BLOCK_MM) / 2; // 48.5
  doc.setDrawColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.setLineWidth(0.6);
  doc.rect(sbX, sbY, SCALE_BLOCK_MM, SCALE_BLOCK_MM);

  // Gold corner ticks on the scale block — 6 mm arms inset.
  doc.setDrawColor(PALETTE.gold.r, PALETTE.gold.g, PALETTE.gold.b);
  doc.setLineWidth(1.0);
  const sbCorners: Array<[number, number]> = [
    [sbX, sbY],
    [sbX + SCALE_BLOCK_MM, sbY],
    [sbX, sbY + SCALE_BLOCK_MM],
    [sbX + SCALE_BLOCK_MM, sbY + SCALE_BLOCK_MM],
  ];
  for (const [cx, cy] of sbCorners) {
    doc.line(cx - 3, cy, cx + 3, cy);
    doc.line(cx, cy - 3, cx, cy + 3);
  }

  // Scale-block centre crosshair — final eyeball target.
  const cx = sbX + SCALE_BLOCK_MM / 2;
  const cy = sbY + SCALE_BLOCK_MM / 2;
  doc.setLineWidth(0.3);
  doc.line(cx - 8, cy, cx + 8, cy);
  doc.line(cx, cy - 8, cx, cy + 8);

  // Axis labels.
  doc.setTextColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('200 mm', sbX + SCALE_BLOCK_MM / 2, sbY - 2, { align: 'center' });
  doc.text('200 mm', sbX - 2, sbY + SCALE_BLOCK_MM / 2, { align: 'center', angle: 90 });

  // ─── 5. Instructions block — what to do after printing. ──────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const instructionsY = sbY + SCALE_BLOCK_MM + 8;
  doc.text('1. Print at 100% scale. Confirm the 200 mm block measures 200 mm with a ruler.', A4_WIDTH_MM / 2, instructionsY, { align: 'center' });
  doc.text('2. Place the printed page flat on the floor beside your product.', A4_WIDTH_MM / 2, instructionsY + 5, { align: 'center' });
  doc.text('3. Open the merchant portal and run "Capture product". Tap the four gold corners when prompted.', A4_WIDTH_MM / 2, instructionsY + 10, { align: 'center' });

  // ─── 6. Footer — version tag + page meta. ─────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.text(
    `PPW V4 · capture ref ${version} · A4 210x297 mm · scale block 200x200 mm · designer.ppwellness.co`,
    A4_WIDTH_MM / 2,
    A4_HEIGHT_MM - 6,
    { align: 'center' },
  );

  const buffer = doc.output('arraybuffer');
  return new Uint8Array(buffer);
}

/**
 * Response shape header constants. The 1-year immutable cache directive
 * is binding per DT-02 exit criteria — the PDF body is deterministic
 * given the same `version` tag, so CDN caching is safe and necessary
 * (zero-cost edge delivery for a static-ish asset).
 */
export const REFERENCE_PAGE_HEADERS = {
  contentType: 'application/pdf',
  cacheControl: 'public, max-age=31536000, immutable',
  contentDisposition: 'inline; filename="ppw-capture-reference.pdf"',
} as const;

export const REFERENCE_PAGE_V2_HEADERS = {
  contentType: 'application/pdf',
  cacheControl: 'public, max-age=31536000, immutable',
  contentDisposition: 'inline; filename="ppw-capture-reference-v2.pdf"',
} as const;

/**
 * Sims-Parity DT-20 — v2 ArUco-marker reference PDF.
 *
 * Same A4 sheet, but the four corner crosshairs are replaced by four
 * 5×5 ArUco markers with VC-1 LOCKED IDs `[0, 1, 2, 3]` (TL, TR, BR,
 * BL). `detectMarker.ts` uses identical IDs.
 *
 * The marker bitmaps are stamped into the PDF as small image rects
 * from a precomputed binary grid. Each marker is 24 mm × 24 mm so
 * the camera resolves the 5×5 grid even at typical phone distance.
 */
export function generateReferencePageV2Pdf(opts: ReferencePageOptions = {}): Uint8Array {
  const version = opts.version ?? 'v2';

  type jsPDF = InstanceType<typeof JsPDFCtor> & {
    setLineWidth: (w: number) => jsPDF;
    setDrawColor: (r: number, g: number, b: number) => jsPDF;
    setFillColor: (r: number, g: number, b: number) => jsPDF;
    setTextColor: (r: number, g: number, b: number) => jsPDF;
    setFont: (font: string, style?: string) => jsPDF;
    setFontSize: (size: number) => jsPDF;
    rect: (x: number, y: number, w: number, h: number, style?: string) => jsPDF;
    line: (x1: number, y1: number, x2: number, y2: number) => jsPDF;
    text: (text: string, x: number, y: number, opts?: Record<string, unknown>) => jsPDF;
    output: (type: 'arraybuffer') => ArrayBuffer;
  };

  const doc = new JsPDFCtor({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  }) as jsPDF;

  doc.setFillColor(PALETTE.cream.r, PALETTE.cream.g, PALETTE.cream.b);
  doc.rect(0, 0, A4_WIDTH_MM, 18, 'F');
  doc.rect(0, A4_HEIGHT_MM - 18, A4_WIDTH_MM, 18, 'F');

  doc.setDrawColor(PALETTE.gold.r, PALETTE.gold.g, PALETTE.gold.b);
  doc.setLineWidth(0.4);
  doc.rect(2, 2, A4_WIDTH_MM - 4, A4_HEIGHT_MM - 4);

  // Stamp 4 ArUco markers — 24×24 mm each — at the inset corners.
  // The markers are drawn as a 5×5 grid of solid filled cells using
  // a deterministic-per-id bit pattern (5x5 dictionary-derived).
  const MARKER_SIZE_MM = 24;
  const corners: Array<{ id: number; cx: number; cy: number }> = [
    { id: 0, cx: 10, cy: 10 },                                    // TL
    { id: 1, cx: A4_WIDTH_MM - 10 - MARKER_SIZE_MM, cy: 10 },      // TR
    { id: 2, cx: A4_WIDTH_MM - 10 - MARKER_SIZE_MM, cy: A4_HEIGHT_MM - 10 - MARKER_SIZE_MM }, // BR
    { id: 3, cx: 10, cy: A4_HEIGHT_MM - 10 - MARKER_SIZE_MM },    // BL
  ];

  for (const c of corners) {
    drawArucoMarker(doc, c.id, c.cx, c.cy, MARKER_SIZE_MM);
  }

  // Title block.
  doc.setTextColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PPW Wellness · Capture Reference v2 (ArUco)', A4_WIDTH_MM / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Print at 100%. Auto-pose calibration — no corner tapping required.',
    A4_WIDTH_MM / 2,
    16.5,
    { align: 'center' },
  );

  // Centred 200×200 mm scale block (same as v1).
  const sbX = (A4_WIDTH_MM - SCALE_BLOCK_MM) / 2;
  const sbY = (A4_HEIGHT_MM - SCALE_BLOCK_MM) / 2;
  doc.setDrawColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.setLineWidth(0.6);
  doc.rect(sbX, sbY, SCALE_BLOCK_MM, SCALE_BLOCK_MM);
  doc.setTextColor(PALETTE.ink.r, PALETTE.ink.g, PALETTE.ink.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('200 mm', sbX + SCALE_BLOCK_MM / 2, sbY - 2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `PPW V4 · capture ref ${version} · A4 210x297 mm · ArUco IDs [0,1,2,3] (VC-1 locked) · designer.ppwellness.co`,
    A4_WIDTH_MM / 2,
    A4_HEIGHT_MM - 6,
    { align: 'center' },
  );

  const buffer = doc.output('arraybuffer');
  return new Uint8Array(buffer);
}

/**
 * Deterministic 5×5 bit pattern per marker ID. v1: distinct
 * non-symmetric patterns for IDs 0–3 so the detector can
 * disambiguate orientation. Each cell is 1 bit (black/white).
 *
 * These are simplified patterns — production js-aruco2 expects
 * the standard dictionary patterns; the demo PDF here aims for
 * a recognisable corner-anchor rather than fidelity to a full
 * dictionary set. DT-20 follow-up will swap to a real dictionary
 * via the js-aruco2 reference patterns once Vic prints + tests.
 */
const ARUCO_PATTERNS: Record<number, number[][]> = {
  0: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  1: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 1, 1],
    [1, 1, 0, 0, 1],
    [1, 0, 0, 1, 1],
    [1, 1, 1, 1, 1],
  ],
  2: [
    [1, 1, 1, 1, 1],
    [1, 1, 0, 0, 1],
    [1, 0, 0, 1, 1],
    [1, 1, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  3: [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1],
  ],
};

function drawArucoMarker(
  doc: InstanceType<typeof JsPDFCtor>,
  id: number,
  xMm: number,
  yMm: number,
  sizeMm: number,
): void {
  const pattern = ARUCO_PATTERNS[id];
  if (!pattern) return;
  const cell = sizeMm / 5;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (pattern[r][c] === 0) {
        // 0 = black cell. jspdf defaults fill to black.
        (doc as InstanceType<typeof JsPDFCtor>).setFillColor(0, 0, 0);
      } else {
        (doc as InstanceType<typeof JsPDFCtor>).setFillColor(255, 255, 255);
      }
      (doc as InstanceType<typeof JsPDFCtor>).rect(
        xMm + c * cell,
        yMm + r * cell,
        cell,
        cell,
        'F',
      );
    }
  }
  // Faint ink border so the marker quad is visible even before printing.
  (doc as InstanceType<typeof JsPDFCtor>).setDrawColor(0, 0, 0);
  (doc as InstanceType<typeof JsPDFCtor>).setLineWidth(0.2);
  (doc as InstanceType<typeof JsPDFCtor>).rect(xMm, yMm, sizeMm, sizeMm);
}
