import { describe, expect, it } from 'vitest';
import { CATALOG_TEMPLATE, validateCatalogImport, merchantEmbedCode, catalogPublishPayload } from '../catalogImport';
describe('merchant catalog handoff',()=>{
  it('retains optional supplier metadata in downloads but sends only supported stock quantity to the current server', () => {
    const row = { ...CATALOG_TEMPLATE[0], availability: 'on-order', lead_time_days: 12, stock_qty: 0, last_checked: '2026-10-22' };
    const parsed = validateCatalogImport(JSON.stringify([row]));
    expect(parsed.errors).toEqual([]); expect(parsed.products[0].last_checked).toBe('2026-10-22');
    const payload = catalogPublishPayload(parsed.products[0]);
    expect(payload.inStockQty).toBe(0); expect(payload).not.toHaveProperty('availability'); expect(payload).not.toHaveProperty('last_checked'); expect(payload).not.toHaveProperty('lead_time_days');
  });
  it('rejects contradictory quantities, false in-stock zero, negative lead times and impossible check dates', () => {
    for (const edit of [{ stock_qty: 3, inStockQty: 4 }, { availability: 'in-stock', stock_qty: 0 }, { lead_time_days: -1 }, { last_checked: '2026-02-31' }]) {
      expect(validateCatalogImport(JSON.stringify([{ ...CATALOG_TEMPLATE[0], ...edit }])).errors.length).toBeGreaterThan(0);
    }
  });
  it('validates an explicit minor-unit price and measured dimensions',()=>{const result=validateCatalogImport(JSON.stringify(CATALOG_TEMPLATE));expect(result.errors).toEqual([]);expect(result.products[0].priceMinor).toBe(450000);});
  it('parses quoted commas, doubled quotes, CRLF and blank optional cells',()=>{const csv='sku,name,category,priceMinor,currency,widthMm,depthMm,heightMm,description\r\nCHAIR-1,"Chair, ""Garden""",outdoor,125000,MUR,500,600,800,\r\n';const result=validateCatalogImport(csv);expect(result.errors).toEqual([]);expect(result.products[0].name).toBe('Chair, "Garden"');expect(result.products[0].description).toBeUndefined();});
  it('rejects duplicate SKUs and invalid dimensional or currency data',()=>{expect(validateCatalogImport(JSON.stringify([...CATALOG_TEMPLATE,...CATALOG_TEMPLATE])).errors.join()).toContain('duplicate SKU');for(const edit of [{widthMm:0},{heightMm:-1},{currency:'XYZ'},{priceMinor:1.5},{priceMinor:Infinity}])expect(validateCatalogImport(JSON.stringify([{...CATALOG_TEMPLATE[0],...edit}])).errors.length).toBeGreaterThan(0);});
  it('rejects unsafe image schemes, unknown fields, large batches and malformed CSV',()=>{expect(validateCatalogImport(JSON.stringify([{...CATALOG_TEMPLATE[0],imageUrl:'javascript:alert(1)'}])).errors.length).toBeGreaterThan(0);expect(validateCatalogImport(JSON.stringify([{...CATALOG_TEMPLATE[0],webhookSecret:'not-allowed'}])).errors.length).toBeGreaterThan(0);expect(validateCatalogImport(JSON.stringify(Array(51).fill(CATALOG_TEMPLATE[0]))).errors[0]).toContain('1–50');expect(validateCatalogImport('name,name\na,b').errors[0]).toContain('unique');expect(validateCatalogImport('sku,name\na,"unclosed').errors[0]).toContain('not closed');});
  it('produces a first-party embed, omitting URL path or query inputs',()=>{const code=merchantEmbedCode('https://designer.ppwellness.co/anything?x=1');expect(code).toContain('https://designer.ppwellness.co/embed/designer?view=3d&panel=ai');expect(code).not.toContain('anything');});
});

