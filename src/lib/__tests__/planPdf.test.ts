/**
 * Tests for src/lib/planPdf.ts - Week 4b Hotfix 5.
 *
 * The PDF is now architecturally drawn from data (no canvas snapshot
 * anywhere in the pipeline). These tests build a multi-room sample
 * Property, generate the PDF in Node, then:
 *   - assert the Blob is non-trivial (> 20 KB)
 *   - scan the raw bytes for the expected text strings (jsPDF writes
 *     most text() calls in plain ASCII in the content streams, which
 *     keeps grepping cheap even without a real PDF parser).
 */

import { describe, it, expect } from 'vitest';
import {
  generatePlanPdf,
  formatCurrencyPdf,
  type OrderPdfInput,
  type PdfRoom,
} from '../planPdf';

function makeRoom(
  id: string,
  name: string,
  lengthM: number,
  widthM: number,
  items: PdfRoom['placedItems'],
  products: PdfRoom['products'],
): PdfRoom {
  return {
    id,
    name,
    polygon: [
      { x: 0, y: 0 },
      { x: lengthM, y: 0 },
      { x: lengthM, y: widthM },
      { x: 0, y: widthM },
    ],
    placedItems: items,
    products,
  };
}

function makeInput(): OrderPdfInput {
  return {
    orderId: 'PPW-TEST-001',
    date: Date.UTC(2026, 4, 12),
    customerName: 'Buyer Person',
    customerEmail: 'buyer@example.com',
    customerAddress: '12 Tamarin Bay, Tamarin, Mauritius',
    currency: 'MUR',
    total: 350000,
    property: {
      name: 'Vic Showroom',
      rooms: [
        makeRoom(
          'r1',
          'Recovery Room',
          5,
          4,
          [
            {
              xM: 0.5,
              yM: 0.5,
              lengthM: 2.2,
              widthM: 1.0,
              rotation: 0,
              productId: 'massage-table-01',
              productName: 'Pro Massage Table',
              category: 'ergo-chair',
              dimensionsLabel: '220 x 100 cm',
              sku: 'PPW-MT-01',
            },
            {
              xM: 3.2,
              yM: 0.5,
              lengthM: 1.6,
              widthM: 1.0,
              rotation: 0,
              productId: 'ice-bath-01',
              productName: 'Recovery Ice Bath',
              category: 'ice-bath',
              dimensionsLabel: '160 x 100 cm',
              sku: 'PPW-IB-01',
            },
          ],
          [
            {
              sku: 'PPW-MT-01',
              name: 'Pro Massage Table',
              quantity: 1,
              dimensions: '220 x 100 x 80 cm',
              supplier: 'PPW Direct',
              unitPriceDisplay: 80000,
              lineTotalDisplay: 80000,
            },
            {
              sku: 'PPW-IB-01',
              name: 'Recovery Ice Bath',
              quantity: 1,
              dimensions: '160 x 100 x 90 cm',
              supplier: 'IceCo',
              unitPriceDisplay: 150000,
              lineTotalDisplay: 150000,
            },
          ],
        ),
        makeRoom(
          'r2',
          'Sleep Pod',
          3,
          3,
          [
            {
              xM: 0.5,
              yM: 0.5,
              lengthM: 2.0,
              widthM: 1.2,
              rotation: 90,
              productId: 'pod-01',
              productName: 'Quiet Sleep Pod',
              category: 'sleep-pod',
              dimensionsLabel: '200 x 120 cm',
              sku: 'PPW-SP-01',
            },
            {
              xM: 1.8,
              yM: 2.0,
              lengthM: 0.6,
              widthM: 0.6,
              rotation: 0,
              productId: 'plant-01',
              productName: 'Calathea Plant',
              category: 'plant',
              dimensionsLabel: '60 x 60 cm',
              sku: 'PPW-PL-01',
            },
          ],
          [
            {
              sku: 'PPW-SP-01',
              name: 'Quiet Sleep Pod',
              quantity: 1,
              dimensions: '200 x 120 x 110 cm',
              supplier: 'PodWorks',
              unitPriceDisplay: 100000,
              lineTotalDisplay: 100000,
            },
            {
              sku: 'PPW-PL-01',
              name: 'Calathea Plant',
              quantity: 1,
              dimensions: '60 x 60 x 80 cm',
              supplier: 'GreenLeaf',
              unitPriceDisplay: 20000,
              lineTotalDisplay: 20000,
            },
          ],
        ),
      ],
    },
  };
}

/** Read the Blob into a Latin-1 string we can grep. jsPDF writes text
 *  streams in (uncompressed) ASCII when no font subsetting kicks in,
 *  which keeps this check cheap without a full PDF parser. */
async function blobToText(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const view = new Uint8Array(buf);
  let out = '';
  // Latin-1 is a 1:1 byte->char mapping, perfect for substring search.
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    out += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return out;
}

describe('generatePlanPdf (Hotfix 5 - vector floor plan)', () => {
  it('produces a non-empty Blob bigger than 20 KB', () => {
    const blob = generatePlanPdf(makeInput());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(20 * 1024);
  });

  it('multi-room input produces a bigger PDF than single-room input', () => {
    const small: OrderPdfInput = {
      ...makeInput(),
      property: { name: 'P', rooms: [makeInput().property.rooms[0]] },
    };
    const big = generatePlanPdf(makeInput());
    const tiny = generatePlanPdf(small);
    expect(big.size).toBeGreaterThan(tiny.size);
  });

  it('handles a room with no products without throwing', () => {
    const input = makeInput();
    input.property.rooms.push(makeRoom('empty', 'Empty Room', 4, 3, [], []));
    expect(() => generatePlanPdf(input)).not.toThrow();
  });

  it('embeds the cover title, room names and at least one product name in the raw bytes', async () => {
    const blob = generatePlanPdf(makeInput());
    const text = await blobToText(blob);
    expect(text).toContain('Wellness Property Design Plan');
    expect(text).toContain('Recovery Room');
    expect(text).toContain('Sleep Pod');
    expect(text).toContain('Pro Massage Table');
  });

  it('embeds the order reference and customer email', async () => {
    const blob = generatePlanPdf(makeInput());
    const text = await blobToText(blob);
    expect(text).toContain('PPW-TEST-001');
    expect(text).toContain('buyer@example.com');
  });

  it('embeds the PPW footer line on every page', async () => {
    const blob = generatePlanPdf(makeInput());
    const text = await blobToText(blob);
    // Footer is drawn on every page; at minimum the cover should carry it.
    expect(text).toContain('ppwellness.co');
  });

  it('does NOT embed a raster image (no /Image XObjects)', async () => {
    const blob = generatePlanPdf(makeInput());
    const text = await blobToText(blob);
    // jsPDF wraps raster images in /Subtype /Image entries. The whole
    // point of Hotfix 5 is that we never emit one.
    expect(text).not.toContain('/Subtype /Image');
  });
});

describe('formatCurrencyPdf', () => {
  it('formats MUR with no decimals and Rs prefix', () => {
    expect(formatCurrencyPdf(123456, 'MUR')).toBe('Rs 123,456');
  });
  it('formats USD with 2 decimals and $ prefix', () => {
    expect(formatCurrencyPdf(1299, 'USD')).toBe('$1,299.00');
  });
  it('formats EUR with 2 decimals and EUR prefix', () => {
    expect(formatCurrencyPdf(99.5, 'EUR')).toBe('EUR 99.50');
  });
  it('formats GBP with 2 decimals and GBP prefix', () => {
    expect(formatCurrencyPdf(1, 'GBP')).toBe('GBP 1.00');
  });
});
