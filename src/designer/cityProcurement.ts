import { z } from 'zod';

/** Civil dates avoid moving Mauritius delivery dates when viewed in another timezone. */
const CivilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '2020-01-01' && value <= '2200-12-31';
}, 'Use a valid calendar date between 2020 and 2200.');
const Recipient = z.union([z.literal(''), z.string().trim().max(254).email()]);
const Label = z.string().trim().min(1).max(200);
export const CityProcurementUnitSchema = z.enum(['each', 'm', 'm2', 'm3', 'kg', 'kW', 'kWh']);
export type CityProcurementUnit = z.infer<typeof CityProcurementUnitSchema>;
export const CityProcurementLineSchema = z.object({
  id: z.string().min(1).max(100), productRef: z.string().max(200), description: Label,
  quantity: z.number().finite().positive().max(1e9), unit: CityProcurementUnitSchema,
}).strict();
export type CityProcurementLine = z.infer<typeof CityProcurementLineSchema>;
export const CityProcurementPackageSchema = z.object({
  id: z.string().uuid(), supplierName: Label, category: z.string().trim().min(1).max(80),
  orderOn: CivilDate.nullable(), invoiceOn: CivilDate.nullable(), deliveryOn: CivilDate.nullable(),
  recipientEmail: Recipient, invoiceRecipientEmail: Recipient,
  lines: z.array(CityProcurementLineSchema).max(200), notes: z.string().max(2000),
  state: z.enum(['draft', 'reviewed']),
}).strict().superRefine((value, ctx) => {
  if (value.orderOn && value.deliveryOn && value.deliveryOn < value.orderOn) ctx.addIssue({ code: 'custom', path: ['deliveryOn'], message: 'Delivery cannot precede ordering.' });
  if (new Set(value.lines.map(line => line.id)).size !== value.lines.length) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Line identifiers must be unique.' });
  if (value.state === 'reviewed') {
    for (const field of ['orderOn', 'invoiceOn', 'deliveryOn', 'recipientEmail', 'invoiceRecipientEmail'] as const) {
      if (!value[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'Complete this field before marking the package reviewed.' });
    }
    if (!value.lines.length) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Add equipment before marking the package reviewed.' });
  }
});
export type CityProcurementPackage = z.infer<typeof CityProcurementPackageSchema>;
export const CityProcurementPlanSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), projectId: z.string().trim().min(1).max(100).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value), 'Invalid project identifier.'),
  name: Label, timezone: z.literal('Indian/Mauritius'), packages: z.array(CityProcurementPackageSchema).max(100),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.packages.map(pkg => pkg.id)).size !== value.packages.length) ctx.addIssue({ code: 'custom', path: ['packages'], message: 'Package identifiers must be unique.' });
  if (value.packages.reduce((n, pkg) => n + pkg.lines.length, 0) > 1000) ctx.addIssue({ code: 'custom', path: ['packages'], message: 'A plan supports up to 1,000 equipment lines.' });
});
export type CityProcurementPlan = z.infer<typeof CityProcurementPlanSchema>;
export const CITY_PROCUREMENT_EXECUTION = 'manual-review-required' as const;
export const CityProcurementRecordSchema = z.object({
  plan: CityProcurementPlanSchema, revision: z.number().int().positive(), updatedAt: z.string().datetime(),
  execution: z.literal(CITY_PROCUREMENT_EXECUTION),
}).strict();
export type CityProcurementRecord = z.infer<typeof CityProcurementRecordSchema>;
export const CityProcurementWriteSchema = z.object({
  expectedRevision: z.number().int().min(0).max(2147483646), requestId: z.string().uuid(), plan: CityProcurementPlanSchema,
}).strict();
export type CityProcurementWrite = z.infer<typeof CityProcurementWriteSchema>;
export function validateCityProcurementPlan(value: unknown) { return CityProcurementPlanSchema.safeParse(value); }
export function createCityProcurementPlan(projectId: string, name: string): CityProcurementPlan {
  return CityProcurementPlanSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), projectId, name, timezone: 'Indian/Mauritius', packages: [] });
}
export function createCityProcurementPackage(supplierName: string, category: string): CityProcurementPackage {
  return { id: crypto.randomUUID(), supplierName, category, orderOn: null, invoiceOn: null, deliveryOn: null, recipientEmail: '', invoiceRecipientEmail: '', lines: [], notes: '', state: 'draft' };
}

/** Explicit user export. Recipients are opt-in; spreadsheet formula injection is escaped. */
export function cityProcurementCsv(plan: CityProcurementPlan, includeRecipients = false): string {
  const cell = (value: string | number | null) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: Array<Array<string | number | null>> = [[
    'Project', 'Supplier', 'Category', 'Product reference', 'Equipment', 'Quantity', 'Unit', 'Order date', 'Invoice target date', 'Delivery date', 'Timezone', 'State', 'Execution',
    ...(includeRecipients ? ['Order recipient email', 'Invoice recipient email'] : []),
  ]];
  for (const pkg of CityProcurementPlanSchema.parse(plan).packages) {
    for (const line of pkg.lines.length ? pkg.lines : [null]) rows.push([
      plan.name, pkg.supplierName, pkg.category, line?.productRef ?? '', line?.description ?? '', line?.quantity ?? '', line?.unit ?? '', pkg.orderOn, pkg.invoiceOn, pkg.deliveryOn, plan.timezone, pkg.state, CITY_PROCUREMENT_EXECUTION,
      ...(includeRecipients ? [pkg.recipientEmail, pkg.invoiceRecipientEmail] : []),
    ]);
  }
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
