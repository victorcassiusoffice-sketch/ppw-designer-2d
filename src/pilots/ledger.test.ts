import { expect, it } from 'vitest';
import {
  exchange,
  lineTotal,
  ledgerSummary,
  ledgerCsv,
  costCsv,
  rateCsv,
  allowedMarks,
  minorDigits,
  type Row,
  type Ledger,
  settings,
} from './ledger';
const line: Row<'budget_line'> = {
  id: 'line',
  type: 'budget_line',
  version: 2,
  heading: 'works',
  kind: 'ordinary',
  label: 'Test',
  costType: 'Supply',
  unit: 'unit',
  units: '2.5',
  unitValue: 101,
  number: '1.2',
  direct: true,
  flags: [],
  note: '',
};
const cost: Row<'cost_row'> = {
  id: 'cost',
  type: 'cost_row',
  version: 2,
  costType: 'supply',
  vehicle: false,
  line: 'line',
  whose: 'lead',
  paidBy: 'lead',
  thirdParty: 'Trial',
  ownerSupplies: false,
  description1: 'Test material',
  description2: 'Test activity',
  documentKind: 'receipt',
  documentRef: 'Ref',
  documentDate: '2026-03-02',
  accountingRef: 'Book',
  means: 'transfer',
  activity: 'step',
  amount: 99,
  tax: 0,
  taxNotRecoverable: false,
  currency: 'USD',
  commitDate: '2026-03-01',
  activityDate: '2026-03-02',
  paymentDate: '2026-03-04',
  funding: 'in the budget',
  finalReport: false,
  note: '',
  state: 'paid',
  proofs: [],
};
it('rounds the rational conversion once and sums eligible rows only', () => {
  expect(lineTotal(line)).toBe(253);
  expect(exchange(99, '2', 2, 2)).toBe(50);
  expect(exchange(-99, '2', 2, 2)).toBe(-50);
  expect(exchange(1255, '2', 3, 2)).toBe(63);
  const rows: Ledger[] = [
    line,
    cost,
    { ...cost, id: 'outside', funding: 'outside the grant' },
    ...(['committed', 'invoiced', 'claimed', 'accepted'] as const).map((state, i) => ({
      ...cost,
      id: state,
      state,
      amount: [20, 40, 80, 100][i],
    })),
    {
      id: 'result',
      version: 2,
      type: 'row_entry',
      kind: 'funder result',
      costId: 'accepted',
      date: '2026-04-01',
      eligible: 34,
    },
    {
      id: 'rate',
      type: 'rate_month',
      version: 2,
      month: '2026-03',
      currency: 'USD',
      rate: '2',
      source: 'Trial table',
    },
    {
      id: 'period',
      version: 2,
      type: 'period',
      number: 1,
      start: '2026-03-01',
      end: '2026-03-31',
      due: '2026-04-05',
      final: true,
    },
  ];
  expect(ledgerSummary(rows, 'EUR', 0, { claimed: { converted: 40 } })).toEqual({
    planned: 253,
    committed: 10,
    invoiced: 20,
    paid: 50,
    claimed: 40,
    accepted: 34,
    spent: 124,
    remaining: 129,
    outside: 50,
  });
  expect(rateCsv(rows, 'USD')).toBe('month,rate,source\r\n2026-03,2,Trial table\r\n');
  const csv = costCsv(rows, 'EUR', [{ id: 'step', title: 'Inspect' }], {});
  expect(csv.split('\r\n')[0]).toBe(
    'month,date,third party,document number,description 1,description 2,debit,currency,exchange rate,EUR,means of payment,cost item,line reference,activity,period,comments,verification date,amount eligible,difference,funder comments',
  );
  expect(csv.split('\r\n')[1]).toBe(
    '202603,2026-03-02,Trial,Ref,Test material,Test activity,0.99,USD,2,0.50,transfer,works,1.2,Inspect,Period 1,,,,,',
  );
  expect(ledgerCsv([['a,b', '"x"']])).toBe('"a,b","""x"""\r\n');
  expect(minorDigits.JPY).toBe(0);
});
it('validates marks and requires a real pilot time zone', () => {
  expect(allowedMarks('tester', { invoices: true, staff: false, partner: false })).toBe(true);
  expect(allowedMarks('viewer', { invoices: true, staff: false, partner: false })).toBe(false);
  expect(allowedMarks('tester', { invoices: true, staff: true, partner: false })).toBe(false);
  expect(
    settings.safeParse({
      id: 'ledger-settings',
      version: 2,
      type: 'settings',
      timeZone: 'Nowhere/example',
    }).success,
  ).toBe(false);
});
