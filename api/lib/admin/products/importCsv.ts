/**
 * Admin product CSV bulk-import endpoint (V3.1 M3.A.1).
 *
 * POST /api/admin/products/import-csv
 *   body: { csv: "<csv text>" } (JSON) OR raw CSV string with content-type: text/csv
 *
 * Reuses the existing `validateCreate` from products/write.ts so every
 * row that lands in the DB has been through the same shape gate the
 * single-row POST already enforces (V3.1 directive: "writes via
 * existing admin handler"). The CSV layer only adds:
 *   1. Header validation against the canonical 8-column contract.
 *   2. Per-row snake_case → camelCase mapping + dimensions_mm parse.
 *   3. Per-row Zod validation with structured error reporting.
 *   4. Per-row insert with continue-on-failure aggregation.
 *
 * Preview mode (`?preview=1`) returns the parsed + validated rows
 * without writing — useful for "show me what would happen" before
 * commit. M3.A.2 will layer all-or-nothing transactional rollback on
 * top; this ship stays continue-on-failure to keep the contract narrow.
 *
 * Folds under admin-router (no new Vercel lambda — 12/12 cap respected).
 */

import { z } from 'zod';

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { drizzleAuditWriter } from '../../auditLog.js';
import { getDb, schema } from '../../../db/client.js';

import { validateCreate, type ProductCreatePayload } from './write.js';

export const CSV_HEADERS = [
  'merchant_id',
  'sku',
  'name',
  'category',
  'price_minor',
  'currency',
  'dimensions_mm',
  'image_url',
] as const;

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

/** A single parsed CSV row keyed by canonical header name. */
export type CsvRowRecord = Record<(typeof CSV_HEADERS)[number], string>;

/**
 * Tiny CSV parser tuned for the import-csv shape: no embedded newlines
 * in quoted fields, but quoted commas + escaped doubled-quotes work.
 * Returns null on a structural error (header mismatch / missing cols);
 * blank lines are tolerated. We intentionally avoid a full csv-parse
 * dependency to keep bundle size and supply-chain risk down for one
 * admin endpoint.
 */
export function parseProductCsv(
  text: string,
): { ok: true; rows: CsvRowRecord[] } | { ok: false; error: string } {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'CSV body is empty.' };
  }
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { ok: false, error: 'CSV body is empty.' };

  const headerCells = splitCsvLine(lines[0]);
  if (headerCells.length !== CSV_HEADERS.length) {
    return {
      ok: false,
      error: `CSV header must have exactly ${CSV_HEADERS.length} columns (got ${headerCells.length}).`,
    };
  }
  const headerLower = headerCells.map((h) => h.trim().toLowerCase());
  for (let i = 0; i < CSV_HEADERS.length; i++) {
    if (headerLower[i] !== CSV_HEADERS[i]) {
      return {
        ok: false,
        error: `CSV header column ${i + 1} must be "${CSV_HEADERS[i]}" (got "${headerCells[i]}").`,
      };
    }
  }

  const rows: CsvRowRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length !== CSV_HEADERS.length) {
      return {
        ok: false,
        error: `Row ${i + 1}: expected ${CSV_HEADERS.length} cells, got ${cells.length}.`,
      };
    }
    const row = {} as CsvRowRecord;
    for (let c = 0; c < CSV_HEADERS.length; c++) {
      row[CSV_HEADERS[c]] = cells[c];
    }
    rows.push(row);
  }
  if (rows.length === 0) return { ok: false, error: 'CSV has header but no data rows.' };
  return { ok: true, rows };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"' && cur.length === 0) {
      inQuote = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

const dimensionsPattern = /^(\d{1,5})x(\d{1,5})x(\d{1,5})$/i;

/** Zod schema for the raw CSV row — coerces strings → typed payload. */
export const productCsvRowSchema = z
  .object({
    merchant_id: z
      .string()
      .trim()
      .min(1, 'merchant_id required')
      .regex(/^\d+$/, 'merchant_id must be a positive integer'),
    sku: z.string().trim().min(1, 'sku required').max(80, 'sku ≤80 chars'),
    name: z.string().trim().min(1, 'name required').max(200, 'name ≤200 chars'),
    category: z.string().trim().min(1, 'category required').max(80, 'category ≤80 chars'),
    price_minor: z
      .string()
      .trim()
      .min(1, 'price_minor required')
      .regex(/^\d+$/, 'price_minor must be a non-negative integer'),
    currency: z
      .string()
      .trim()
      .length(3, 'currency must be a 3-letter code'),
    dimensions_mm: z.string().trim().optional().or(z.literal('')),
    image_url: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((row, ctx) => {
    if (row.dimensions_mm && !dimensionsPattern.test(row.dimensions_mm)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dimensions_mm'],
        message: 'dimensions_mm must be WxDxH (e.g. 1200x800x600)',
      });
    }
    if (row.image_url && !/^https?:\/\//i.test(row.image_url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['image_url'],
        message: 'image_url must start with http:// or https://',
      });
    }
  });

export type ValidatedCsvRow = z.infer<typeof productCsvRowSchema>;

/**
 * Transform a Zod-validated CSV row into the ProductCreatePayload
 * shape that the existing validateCreate function expects.
 */
export function csvRowToCreatePayload(row: ValidatedCsvRow): Record<string, unknown> {
  const out: Record<string, unknown> = {
    merchantId: Number(row.merchant_id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    priceMinor: Number(row.price_minor),
    currency: row.currency,
  };
  if (row.dimensions_mm) {
    const m = dimensionsPattern.exec(row.dimensions_mm);
    if (m) {
      out.widthMm = Number(m[1]);
      out.depthMm = Number(m[2]);
      out.heightMm = Number(m[3]);
    }
  }
  if (row.image_url) {
    out.imageUrl = row.image_url;
  }
  return out;
}

export type RowValidationResult =
  | { rowNumber: number; ok: true; payload: ProductCreatePayload }
  | { rowNumber: number; ok: false; error: string };

/**
 * Run the full validate pipeline (Zod CSV-row check → camelCase
 * transform → validateCreate shape gate) on each parsed row.
 */
export function validateCsvRows(rows: CsvRowRecord[]): RowValidationResult[] {
  const results: RowValidationResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // header is row 1
    const parsed = productCsvRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      results.push({
        rowNumber,
        ok: false,
        error: parsed.error.issues
          .map((iss) => `${iss.path.join('.') || 'row'}: ${iss.message}`)
          .join('; '),
      });
      continue;
    }
    const payloadInput = csvRowToCreatePayload(parsed.data);
    const checked = validateCreate(payloadInput);
    if (!checked.ok) {
      results.push({ rowNumber, ok: false, error: checked.error });
      continue;
    }
    results.push({ rowNumber, ok: true, payload: checked.data });
  }
  return results;
}

async function readJsonBody(req: MinimalReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function extractCsvText(req: MinimalReq, parsedBody: unknown): string | null {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  if (contentType.includes('text/csv')) {
    const b = req.body;
    if (typeof b === 'string') return b;
    if (Buffer.isBuffer(b)) return b.toString('utf8');
  }
  if (parsedBody && typeof parsedBody === 'object') {
    const csv = (parsedBody as { csv?: unknown }).csv;
    if (typeof csv === 'string') return csv;
  }
  return null;
}

function isPreview(req: MinimalReq): boolean {
  const v = req.query?.preview;
  const raw = Array.isArray(v) ? v[0] : v;
  return raw === '1' || raw === 'true';
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }

  let store;
  try {
    store = drizzleMerchantStore();
  } catch {
    res.status(500);
    res.json({ error: 'Database unavailable.' });
    return;
  }

  const auth = await authoriseAdminWithLive(req.headers, store);
  if (!auth.ok) {
    res.status(auth.status);
    res.json({ error: auth.error });
    return;
  }

  const parsedBody = await readJsonBody(req);
  const csvText = extractCsvText(req, parsedBody);
  if (csvText === null) {
    res.status(400);
    res.json({ error: 'Provide CSV via JSON { csv: "..." } or text/csv body.' });
    return;
  }

  const parse = parseProductCsv(csvText);
  if (!parse.ok) {
    res.status(400);
    res.json({ error: parse.error });
    return;
  }

  const validations = validateCsvRows(parse.rows);
  const validCount = validations.filter((v) => v.ok).length;
  const errors: { rowNumber: number; error: string }[] = [];
  const okRows: { rowNumber: number; payload: ProductCreatePayload }[] = [];
  for (const v of validations) {
    if (v.ok) okRows.push({ rowNumber: v.rowNumber, payload: v.payload });
    else errors.push({ rowNumber: v.rowNumber, error: v.error });
  }

  if (isPreview(req)) {
    res.status(200);
    res.json({
      mode: 'preview',
      totalRows: parse.rows.length,
      validRows: validCount,
      invalidRows: validations.length - validCount,
      errors,
      preview: okRows,
    });
    return;
  }

  const audit = drizzleAuditWriter();
  const db = getDb();
  const inserted: { rowNumber: number; id: number; sku: string; merchantId: number }[] = [];
  const insertErrors: { rowNumber: number; error: string }[] = [...errors];

  for (const v of validations) {
    if (!v.ok) continue;
    try {
      const rows = await db.insert(schema.products).values(v.payload).returning();
      const row = rows[0];
      inserted.push({
        rowNumber: v.rowNumber,
        id: Number(row.id),
        sku: row.sku,
        merchantId: Number(row.merchantId),
      });
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'products.import_csv',
        targetType: 'product',
        targetId: String(row.id),
        payload: { sku: row.sku, merchantId: row.merchantId, source: 'csv', rowNumber: v.rowNumber },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'insert failed';
      const friendly = /duplicate key|unique constraint/i.test(msg)
        ? `A product with sku "${v.payload.sku}" already exists for merchant ${v.payload.merchantId}.`
        : msg;
      insertErrors.push({ rowNumber: v.rowNumber, error: friendly });
    }
  }

  res.status(insertErrors.length === 0 ? 200 : 207);
  res.json({
    mode: 'commit',
    totalRows: parse.rows.length,
    insertedRows: inserted.length,
    failedRows: insertErrors.length,
    inserted,
    errors: insertErrors,
  });
}
