import { describe, expect, it } from 'vitest';
import { CityProcurementPlanSchema, cityProcurementCsv, createCityProcurementPackage, createCityProcurementPlan } from '../cityProcurement';

function fixture() {
  const plan = createCityProcurementPlan('city-1', 'City plan');
  plan.packages.push({ ...createCityProcurementPackage('Supplier', 'Lighting'), lines: [{ id: 'line-1', productRef: 'SOL-1', description: 'Solar streetlight', quantity: 4, unit: 'each' }] });
  return plan;
}
describe('City procurement schedule contract', () => {
  it('holds a draft with no invented order or invoice state', () => {
    const plan = fixture(); expect(CityProcurementPlanSchema.parse(plan)).toEqual(plan);
    expect(CityProcurementPlanSchema.safeParse({ ...plan, status: 'sent' }).success).toBe(false);
  });
  it('rejects impossible civil dates and delivery before ordering', () => {
    for (const date of ['2026-02-29', '2026-04-31', '13/10/2026', '2026-10-13T00:00Z', '1900-01-01']) {
      const plan = fixture(); plan.packages[0].orderOn = date;
      expect(CityProcurementPlanSchema.safeParse(plan).success).toBe(false);
    }
    const plan = fixture(); Object.assign(plan.packages[0], { orderOn: '2026-10-20', deliveryOn: '2026-10-19' });
    expect(CityProcurementPlanSchema.safeParse(plan).success).toBe(false);
  });
  it('allows proforma dates before ordering without a timezone shift', () => {
    const plan = fixture(); Object.assign(plan.packages[0], { orderOn: '2026-10-20', invoiceOn: '2026-10-18', deliveryOn: '2026-10-21', recipientEmail: 'orders@example.com', invoiceRecipientEmail: 'accounts@example.com', state: 'reviewed' });
    expect(CityProcurementPlanSchema.parse(plan).packages[0].invoiceOn).toBe('2026-10-18');
  });
  it('requires recipients, dates and equipment for reviewed packages', () => {
    const plan = fixture(); plan.packages[0].state = 'reviewed';
    expect(CityProcurementPlanSchema.safeParse(plan).success).toBe(false);
    plan.packages[0].state = 'draft'; plan.packages[0].recipientEmail = 'x\r\nbcc:other@example.com';
    expect(CityProcurementPlanSchema.safeParse(plan).success).toBe(false);
  });
  it('rejects duplicate line/package identifiers and invalid quantities', () => {
    const plan = fixture(); plan.packages[0].lines.push({ ...plan.packages[0].lines[0] });
    expect(CityProcurementPlanSchema.safeParse(plan).success).toBe(false);
    plan.packages[0].lines.pop(); plan.packages.push({ ...plan.packages[0] });
    expect(CityProcurementPlanSchema.safeParse(plan).success).toBe(false);
    for (const quantity of [0, -1, NaN, Infinity, 1e10]) {
      const item = fixture(); item.packages[0].lines[0].quantity = quantity;
      expect(CityProcurementPlanSchema.safeParse(item).success).toBe(false);
    }
  });
  it('does not accept browser prices or claimed dispatch confirmations', () => {
    const plan = fixture();
    expect(CityProcurementPlanSchema.safeParse({ ...plan, packages: [{ ...plan.packages[0], state: 'ordered' }] }).success).toBe(false);
    expect(CityProcurementPlanSchema.safeParse({ ...plan, packages: [{ ...plan.packages[0], lines: [{ ...plan.packages[0].lines[0], unitPrice: 1 }] }] }).success).toBe(false);
  });
  it('exports no recipients by default and escapes spreadsheet formulas', () => {
    const plan = fixture(); Object.assign(plan.packages[0], { supplierName: '=WEBSERVICE("example")', recipientEmail: 'orders@example.com', invoiceRecipientEmail: 'accounts@example.com' });
    const csv = cityProcurementCsv(plan);
    expect(csv).not.toContain('orders@example.com'); expect(csv).not.toContain('accounts@example.com'); expect(csv).toContain("'=WEBSERVICE");
    expect(csv).toContain('manual-review-required'); expect(cityProcurementCsv(plan, true)).toContain('orders@example.com');
  });
});
