import { z } from 'zod';
import { id, roles } from './contract.js';

export const currencies = ['EUR', 'MUR', 'GBP', 'USD'] as const;
export const categories = ['works', 'materials', 'people', 'travel', 'equipment', 'other'] as const;
export const payStates = ['not agreed', 'agreed', 'invoiced', 'paid'] as const;
export const lineStates = ['planned', 'committed', 'paid'] as const;
export const currency = z.enum(currencies);
const amount = z.number().finite().int().min(0).max(1000000000000),
  note = z.string().trim().max(200);
export const budget = z
  .object({
    type: z.literal('budget_line'),
    id,
    label: z.string().trim().min(1).max(80),
    currency,
    category: z.enum(categories),
    planned: amount,
    committed: amount,
    spent: amount,
    state: z.enum(lineStates),
    note,
  })
  .strict();
export const pay = z
  .object({
    type: z.literal('pay_row'),
    id,
    memberId: id,
    role: z.enum(roles),
    from: id,
    agreed: amount,
    state: z.enum(payStates),
    note,
  })
  .strict();
export const money = z.discriminatedUnion('type', [budget, pay]);
export type Budget = z.infer<typeof budget>;
export type Pay = z.infer<typeof pay>;
export type Money = z.infer<typeof money>;
export type MoneyBook = {
  revision: number;
  currency: z.infer<typeof currency> | null;
  rows: Money[];
};
export const managesMoney = (owner: boolean, role: string | null) =>
  owner || role === 'lead' || role === 'coordinator';
export const readsMoney = (owner: boolean, role: string | null) => managesMoney(owner,role) || role === "checker";
export function totals(rows: Budget[]) {
  return rows.reduce(
    (t, r) => ({
      planned: t.planned + r.planned,
      committed: t.committed + r.committed,
      spent: t.spent + r.spent,
      remaining: t.remaining + r.planned - r.spent,
    }),
    { planned: 0, committed: 0, spent: 0, remaining: 0 },
  );
}
export function minor(v: string) {
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(v))
    throw Error('Use a nonnegative amount with up to two decimal places.');
  const [a, b = ''] = v.split('.');
  return amount.parse(Number(a) * 100 + Number(b.padEnd(2, '0')));
}
export const display = (v: number, code: string) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'code',
  }).format(v / 100);
export function csvCell(v: string) {
  return '"' + (/^[\s]*[=+\-@\t\r]/.test(v) ? "'" : '') + v.replace(/"/g, '""') + '"';
}
