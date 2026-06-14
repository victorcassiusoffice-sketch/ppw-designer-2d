/**
 * Phase 5 (BACKEND-RUN-ORDER-2026-06-11) — merchant self-serve bulk
 * catalog upload (the bulk path; the AI-agent product-add is the easy
 * path). REUSES the admin CSV pipeline (parseProductCsv + validateCsvRows)
 * and the merchant CREATE (createMerchantProduct) — no duplication.
 *
 * Friendlier-than-Amazon: the CSV's merchant_id column is IGNORED — the
 * authenticated slug owns every row, so merchants never need to know
 * their numeric id (a placeholder is injected before validation).
 *
 * Preview mode validates + previews without writing; commit mode inserts
 * each valid row via the existing merchant CREATE (SKU/dims/price checks
 * reused). Folded into merchants-router — NO new Vercel function.
 */

import { parseProductCsv, validateCsvRows } from '../admin/products/importCsv.js';
import { createMerchantProduct, type CreateProductResult } from '../../products.js';

/** Placeholder merchant_id injected so the merchant CSV can omit it. */
const PLACEHOLDER_MERCHANT_ID = '1';

export interface BulkRowError {
  rowNumber: number;
  error: string;
}

export interface BulkPreviewResult {
  ok: boolean;
  status: number;
  error?: string;
  totalRows?: number;
  validCount?: number;
  invalid?: BulkRowError[];
  /** Echo of the valid rows (sku + name) for the merchant to confirm. */
  preview?: Array<{ rowNumber: number; sku: string; name: string; priceMinor: number; currency: string }>;
}

/** Parse + validate the CSV; do NOT write. */
export function previewBulkUpload(csvText: string): BulkPreviewResult {
  const parsed = parseProductCsv(csvText);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  // The merchant_id column is ignored — inject a valid placeholder so the
  // shared validator (which requires a positive-int merchant_id) passes.
  for (const row of parsed.rows) row.merchant_id = PLACEHOLDER_MERCHANT_ID;
  const results = validateCsvRows(parsed.rows);
  const invalid = results
    .filter((r): r is Extract<typeof r, { ok: false }> => !r.ok)
    .map((r) => ({ rowNumber: r.rowNumber, error: r.error }));
  const valid = results.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
  return {
    ok: true,
    status: 200,
    totalRows: results.length,
    validCount: valid.length,
    invalid,
    preview: valid.map((r) => ({
      rowNumber: r.rowNumber,
      sku: r.payload.sku,
      name: r.payload.name,
      priceMinor: r.payload.priceMinor,
      currency: r.payload.currency,
    })),
  };
}

export interface BulkCommitResult {
  ok: boolean;
  status: number;
  error?: string;
  created?: Array<{ rowNumber: number; sku: string; id: number }>;
  failed?: BulkRowError[];
}

export type CreateProductFn = (slug: string, payload: unknown) => Promise<CreateProductResult>;

/**
 * Validate then insert every valid row for the authenticated merchant.
 * Validation failures + per-row insert failures are reported, never
 * thrown — a bad row doesn't abort the batch. `createProduct` is
 * injectable for tests; defaults to the real merchant CREATE.
 */
export async function commitBulkUpload(
  slug: string,
  csvText: string,
  opts: { createProduct?: CreateProductFn } = {},
): Promise<BulkCommitResult> {
  if (!slug) return { ok: false, status: 400, error: 'slug required' };
  const parsed = parseProductCsv(csvText);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  for (const row of parsed.rows) row.merchant_id = PLACEHOLDER_MERCHANT_ID;
  const results = validateCsvRows(parsed.rows);

  const createProduct = opts.createProduct ?? ((s, p) => createMerchantProduct(s, p));
  const created: Array<{ rowNumber: number; sku: string; id: number }> = [];
  const failed: BulkRowError[] = [];

  for (const r of results) {
    if (!r.ok) {
      failed.push({ rowNumber: r.rowNumber, error: r.error });
      continue;
    }
    // Map the validated admin-shape payload onto the strict merchant
    // CREATE schema (drop merchantId/status — the slug owns the row).
    const p = r.payload;
    const payload: Record<string, unknown> = {
      sku: p.sku,
      name: p.name,
      category: p.category,
      priceMinor: p.priceMinor,
      currency: p.currency,
    };
    if (p.description != null) payload.description = p.description;
    if (p.widthMm != null) payload.widthMm = p.widthMm;
    if (p.depthMm != null) payload.depthMm = p.depthMm;
    if (p.heightMm != null) payload.heightMm = p.heightMm;
    if (p.weightG != null) payload.weightG = p.weightG;
    if (p.imageUrl != null) payload.imageUrl = p.imageUrl;
    if (p.region != null) payload.region = p.region;

    try {
      const res = await createProduct(slug, payload);
      if (res.ok && res.product) {
        created.push({ rowNumber: r.rowNumber, sku: res.product.sku, id: res.product.id });
      } else {
        failed.push({ rowNumber: r.rowNumber, error: res.error ?? `create failed (${res.status})` });
      }
    } catch (err) {
      failed.push({ rowNumber: r.rowNumber, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ok: true, status: created.length > 0 ? 201 : 200, created, failed };
}
