/**
 * Wellness-Designer-App (c) part 2 — pure-fn decision logic tests.
 *
 * `decideProductFormSubmit` is the form-state → POST-payload translator.
 * Tested directly (no jsdom, no React) — the vitest config is
 * `environment: 'node'`. The component-level wiring (file picker →
 * upload helper → fetch) is covered by the Playwright spec.
 */

import { describe, it, expect } from 'vitest';
import {
  decideProductFormSubmit,
  EMPTY_FORM,
  MAX_IMAGE_BYTES,
  PRODUCT_CATEGORIES,
  CURRENCIES,
} from '../MerchantAddProductPage';

function withDefaults(overrides: Partial<typeof EMPTY_FORM>): typeof EMPTY_FORM {
  return {
    ...EMPTY_FORM,
    name: 'Vision T600E-02',
    priceMajor: '1500',
    // Width + depth are required (WD-2D top-down rebuild) — supply real
    // footprint defaults so the other assertions test their own field.
    widthMm: '900',
    depthMm: '600',
    ...overrides,
  };
}

describe('decideProductFormSubmit / valid payloads', () => {
  it('returns ok with minimal required fields', () => {
    const r = decideProductFormSubmit(withDefaults({}));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.priceMinor).toBe(150_000);
      expect(r.payload.currency).toBe('MUR');
      expect(r.payload.description).toBe(null);
      expect(r.payload.widthMm).toBe(900);
      expect(r.payload.depthMm).toBe(600);
      expect(r.payload.heightMm).toBe(null);
      expect(r.payload.ecoCertLevel).toBe('none');
    }
  });

  it('converts decimal priceMajor to integer priceMinor', () => {
    const r = decideProductFormSubmit(withDefaults({ priceMajor: '15.49' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.priceMinor).toBe(1549);
  });

  it('trims description; empty string becomes null', () => {
    const r = decideProductFormSubmit(withDefaults({ description: '   ' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.description).toBe(null);
  });

  it('passes through valid eco_cert_level enum values', () => {
    const r = decideProductFormSubmit(withDefaults({ ecoCertLevel: 'verified-certified' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.ecoCertLevel).toBe('verified-certified');
  });

  it('passes through valid dimensions as integers', () => {
    const r = decideProductFormSubmit(
      withDefaults({ widthMm: '1830', depthMm: '750', heightMm: '1400' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.widthMm).toBe(1830);
      expect(r.payload.depthMm).toBe(750);
      expect(r.payload.heightMm).toBe(1400);
    }
  });
});

describe('decideProductFormSubmit / validation errors', () => {
  it('rejects an empty name', () => {
    const r = decideProductFormSubmit(withDefaults({ name: '   ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });

  it('rejects a name over 200 characters', () => {
    const r = decideProductFormSubmit(withDefaults({ name: 'a'.repeat(201) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });

  it('rejects an unknown category', () => {
    const r = decideProductFormSubmit(
      withDefaults({ category: 'icebath' as unknown as typeof PRODUCT_CATEGORIES[number] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.category).toBeTruthy();
  });

  it('rejects an empty priceMajor', () => {
    const r = decideProductFormSubmit(withDefaults({ priceMajor: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.priceMajor).toBeTruthy();
  });

  it('rejects a negative price', () => {
    const r = decideProductFormSubmit(withDefaults({ priceMajor: '-5' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.priceMajor).toBeTruthy();
  });

  it('rejects an unknown currency', () => {
    const r = decideProductFormSubmit(
      withDefaults({ currency: 'XYZ' as unknown as typeof CURRENCIES[number] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.currency).toBeTruthy();
  });

  it('rejects a decimal width', () => {
    const r = decideProductFormSubmit(withDefaults({ widthMm: '12.5' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.widthMm).toBeTruthy();
  });

  it('rejects a missing (blank) width — footprint is required', () => {
    const r = decideProductFormSubmit(withDefaults({ widthMm: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.widthMm).toBeTruthy();
  });

  it('rejects a missing (blank) depth — footprint is required', () => {
    const r = decideProductFormSubmit(withDefaults({ depthMm: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.depthMm).toBeTruthy();
  });

  it('rejects a zero width', () => {
    const r = decideProductFormSubmit(withDefaults({ widthMm: '0' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.widthMm).toBeTruthy();
  });

  it('rejects a non-PNG/JPG image type', () => {
    const f = new File(['x'.repeat(100)], 'foo.gif', { type: 'image/gif' });
    const r = decideProductFormSubmit(withDefaults({ imageFile: f }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.imageFile).toBeTruthy();
  });

  it('accepts a valid PNG image file', () => {
    const f = new File([new Uint8Array(1024)], 'product.png', { type: 'image/png' });
    const r = decideProductFormSubmit(withDefaults({ imageFile: f }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.imageFile).toBe(f);
  });

  it('rejects an oversize image file', () => {
    // Build a synthetic File of MAX_IMAGE_BYTES + 1 bytes.
    const oversized = new File(
      [new Uint8Array(MAX_IMAGE_BYTES + 1)],
      'big.png',
      { type: 'image/png' },
    );
    const r = decideProductFormSubmit(withDefaults({ imageFile: oversized }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.imageFile).toBeTruthy();
  });

  it('reports multiple errors at once when multiple fields invalid', () => {
    const r = decideProductFormSubmit({
      ...EMPTY_FORM,
      name: '',
      priceMajor: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.priceMajor).toBeTruthy();
    }
  });
});
