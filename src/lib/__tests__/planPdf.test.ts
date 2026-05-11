/**
 * Tests for src/lib/planPdf.ts — jsPDF runs in Node fine; we just
 * verify the output is a non-empty Blob and that multi-room input
 * produces a larger PDF than single-room.
 */

import { describe, it, expect } from 'vitest';
import { generatePlanPdf, type OrderPdfInput } from '../planPdf';

function makeInput(rooms: number, productsPerRoom: number): OrderPdfInput {
  return {
    orderId: 'PPW-TEST-001',
    date: Date.UTC(2026, 4, 11),
    customerName: 'Buyer Person',
    customerEmail: 'buyer@example.com',
    currency: 'MUR',
    total: 99998,
    property: {
      name: 'Vic Showroom',
      rooms: Array.from({ length: rooms }, (_, i) => ({
        id: `r${i}`,
        name: `Room ${i + 1}`,
        products: Array.from({ length: productsPerRoom }, (_, j) => ({
          sku: `SKU-${i}-${j}`,
          name: `Product ${j + 1}`,
          quantity: 1 + j,
          dimensions: '120 × 80 × 60 cm',
          unitPriceDisplay: 24999,
          lineTotalDisplay: 24999 * (1 + j),
        })),
      })),
    },
  };
}

describe('generatePlanPdf', () => {
  it('produces a non-empty Blob', () => {
    const blob = generatePlanPdf(makeInput(1, 2));
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000); // a real PDF, not an empty doc
  });

  it('multi-room input produces a bigger PDF than single-room', () => {
    const small = generatePlanPdf(makeInput(1, 1));
    const big = generatePlanPdf(makeInput(5, 4));
    expect(big.size).toBeGreaterThan(small.size);
  });

  it('handles an empty room without throwing', () => {
    const input = makeInput(1, 0);
    expect(() => generatePlanPdf(input)).not.toThrow();
  });
});
