import { z } from 'zod';

/** Portable subset of the existing authenticated product-create contract. */
export const ImportProductSchema = z.object({
  sku: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(1).max(200),
  category: z.enum(['cardio', 'recovery', 'sauna', 'flooring', 'walls', 'decor', 'furniture', 'lighting', 'outdoor', 'eco']),
  priceMinor: z.number().int().min(0).max(1_000_000_000),
  currency: z.enum(['MUR', 'USD', 'EUR', 'GBP']),
  widthMm: z.number().int().positive().max(100_000),
  depthMm: z.number().int().positive().max(100_000),
  heightMm: z.number().int().positive().max(100_000),
  description: z.string().trim().max(5000).optional(),
  imageUrl: z.string().url().max(500).refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS image URL').optional(),
  inStockQty: z.number().int().min(0).max(1_000_000).optional(),
  powerW: z.number().int().min(0).max(100_000).optional(),
  pvWp: z.number().int().min(0).max(5000).optional(),
  batteryWh: z.number().int().min(0).max(1_000_000).optional(),
  inverterW: z.number().int().min(0).max(1_000_000).optional(),
}).strict();
export type ImportProduct = z.infer<typeof ImportProductSchema>;
export const CATALOG_TEMPLATE: ImportProduct[] = [{ sku: 'YOUR-CHAIR-001', name: 'Your garden chair', category: 'outdoor', priceMinor: 450000, currency: 'MUR', widthMm: 600, depthMm: 650, heightMm: 850, inStockQty: 0, description: 'Replace this example with your verified product data.' }];
const NUMBER_FIELDS = new Set(['priceMinor', 'widthMm', 'depthMm', 'heightMm', 'inStockQty', 'powerW', 'pvWp', 'batteryWh', 'inverterW']);

/** Quoted CSV fields, doubled quotes, CRLF and embedded newlines are supported. */
export function parseCatalogCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') { quoted = false; closed = true; } else field += c; continue; }
    if (c === '"') { if (field || closed) throw new Error('Invalid CSV quote. Quote the entire field.'); quoted = true; }
    else if (c === ',') { row.push(field); field = ''; closed = false; }
    else if (c === '\n' || c === '\r') { row.push(field); if (row.some(value => value.trim())) rows.push(row); row = []; field = ''; closed = false; if (c === '\r' && text[i + 1] === '\n') i++; }
    else { if (closed && c.trim()) throw new Error('Unexpected text after a quoted CSV field.'); if (!closed) field += c; }
  }
  if (quoted) throw new Error('A CSV quotation is not closed.');
  row.push(field); if (row.some(value => value.trim())) rows.push(row);
  const headers = rows.shift()?.map(value => value.trim().replace(/^\uFEFF/, ''));
  if (!headers?.length || new Set(headers).size !== headers.length || headers.some(h => !h)) throw new Error('Use unique, non-empty column names.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has a different number of columns.`);
    return Object.fromEntries(headers.flatMap((key, i) => values[i].trim() === '' ? [] : [[key, NUMBER_FIELDS.has(key) ? Number(values[i].trim()) : values[i].trim()]]));
  });
}

export function validateCatalogImport(text: string): { products: ImportProduct[]; errors: string[] } {
  if (text.length > 1_000_000) return { products: [], errors: ['Use a file smaller than 1 MB.'] };
  try {
    const trimmed = text.trim().replace(/^\uFEFF/, '');
    const raw: unknown = trimmed.startsWith('[') || trimmed.startsWith('{') ? JSON.parse(trimmed) : parseCatalogCsv(trimmed);
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) return { products: [], errors: ['Supply an array or CSV with 1–50 products per batch.'] };
    const products: ImportProduct[] = []; const errors: string[] = []; const skus = new Set<string>();
    raw.forEach((value, index) => {
      const parsed = ImportProductSchema.safeParse(value);
      if (!parsed.success) { errors.push(...parsed.error.issues.map(issue => `Row ${index + 1} · ${issue.path.join('.')}: ${issue.message}`)); return; }
      if (skus.has(parsed.data.sku)) errors.push(`Row ${index + 1} · duplicate SKU ${parsed.data.sku}`);
      skus.add(parsed.data.sku); products.push(parsed.data);
    });
    return { products, errors };
  } catch (error) { return { products: [], errors: [error instanceof Error ? error.message : 'The file could not be read.'] }; }
}

export function merchantEmbedCode(origin: string): string {
  const host = new URL(origin).origin;
  return `<iframe src="${host}/embed/designer?view=3d&panel=ai" title="Design your home" style="width:100%;height:760px;border:0" loading="lazy" allowfullscreen></iframe>`;
}
