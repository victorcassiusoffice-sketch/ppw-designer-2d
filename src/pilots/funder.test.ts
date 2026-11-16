import { describe, expect, it } from 'vitest';
import {
  buyingFlags,
  exceeds,
  funderSet,
  paymentClock,
  planValues,
  ratio,
  staffCost,
} from './funder';
import { ledgerRow, type Ledger, type Row } from './ledger';
const parse = (r: Record<string, unknown>) => ledgerRow.parse({ version: 2, ...r });
const settings = parse({
  type: 'settings',
  id: 'ledger-settings',
  timeZone: 'Indian/Mauritius',
  flatPercent: '7.5',
  maximumGrant: 610,
  grantPercent: '80',
  lowerBand: '10',
  upperBand: '25',
  committeeSize: 3,
  assetValue: 200,
});
const line = (id: string, kind: string, unitValue: number, direct = false) =>
  parse({
    id,
    type: 'budget_line',
    heading: 'heading',
    number: id,
    label: id,
    kind,
    costType: 'supply',
    unit: 'unit',
    units: '1',
    unitValue,
    direct,
    flags: [],
    note: '',
  });
const cost = (id: string, amount: number, state: string) =>
  parse({
    type: 'cost_row',
    id,
    vehicle: false,
    line: 'direct',
    costType: 'supply',
    documentKind: 'receipt',
    documentDate: '2026-03-01',
    documentRef: 'doc',
    activity: 'step',
    activityDate: '2026-03-01',
    commitDate: '2026-03-01',
    paymentDate: '2026-03-07',
    amount,
    currency: 'EUR',
    whose: 'lead',
    paidBy: 'lead',
    thirdParty: 'Trial',
    description1: 'Panel',
    description2: 'Installation',
    accountingRef: 'ref',
    means: 'transfer',
    tax: 0,
    taxNotRecoverable: false,
    funding: 'in the budget',
    finalReport: false,
    state,
    proofs: [],
    note: '',
  });
const period = parse({
  type: 'period',
  id: 'period',
  number: 1,
  start: '2026-03-01',
  end: '2026-03-31',
  due: '2026-04-15',
  final: true,
});
const payment = parse({
  type: 'payment_row',
  id: 'payment',
  label: 'First payment',
  receivedAmount: 1000,
  receivedDate: '2026-02-17',
}) as Row<'payment_row'>;
describe('contract calculations', () => {
  it('uses a single division for each staff cost and cuts displayed ratios', () => {
    expect(staffCost(8199, 101, 1, '0.5', '2')).toBe(2075);
    expect(() => staffCost(100, 0, 0, '2', '1')).toThrow();
    expect(() => staffCost(1, 0, 0, '0', '0')).toThrow();
    expect(ratio(10001, 100000)).toBe('10.00');
    expect(exceeds(10001, 100000, '10')).toBe(true);
    expect(exceeds(10000, 100000, '10')).toBe(false);
  });
  it('keeps request stops, month boundaries and receipt confirmation independent', () => {
    const row = {
      ...payment,
      requestReceived: '2026-01-31',
      stops: [{ notice: '2026-02-02', restart: '2026-02-04' }],
    };
    expect(paymentClock(row, '2026-02-07', 5, 2)).toEqual({
      elapsed: 5,
      stopped: 2,
      due: '2026-02-07',
      confirmBy: '2026-02-19',
      deemedAccepted: false,
    });
    expect(paymentClock(row, '2026-02-08', 5)?.deemedAccepted).toBe(true);
    expect(paymentClock({ ...row, replyDate: '2026-02-03' }, '2026-02-08', 5)?.deemedAccepted).toBe(
      false,
    );
  });
  it('uses direct claimed costs for flat rate; accepted results replace one cost only', () => {
    const rows = [
      settings,
      line('direct', 'ordinary', 1000, true),
      line('indirect', 'ordinary', 200),
      line('flat', 'flat rate', 0),
      line('reserve', 'contingency', 100),
      period,
      payment,
      cost('a', 400, 'accepted'),
      cost('b', 200, 'claimed'),
      parse({
        id: 'accepted-a',
        type: 'row_entry',
        kind: 'funder result',
        costId: 'a',
        date: '2026-04-10',
        eligible: 300,
      }),
    ];
    const snap = { a: { converted: 400, period: 1 }, b: { converted: 200, period: 1 } },
      s = funderSet(rows, 'EUR', snap, '2026-04-20', 'period');
    expect(planValues(rows).total).toBe(1375);
    expect(s.flat).toBe(38);
    expect(s.base).toBe(538);
    expect(s.grant).toBe(430);
    expect(s.balance).toBe(-570);
    expect(s.projected).toBe(true);
    expect(s.balanceLabel).toBe('Projected: below payments received');
    expect(s.adjustedMax).toBe(530);
    const capped = funderSet(
      rows
        .map<Ledger>((r) => (r.type === 'settings' ? { ...r, maximumGrant: 100 } : r))
        .concat(
          parse({ id: 'cut', type: 'cut', amount: 3, reasonFile: 'proof', date: '2026-05-01' }),
        ),
      'EUR',
      snap,
      '2026-05-01',
    );
    expect(capped.grant).toBe(97);
    expect(capped.profitWithGrant.surplus).toBe(0);
  });
  it('assigns exact edge values per owner and flags committees, basis and split purchases', () => {
    const table = parse({
      id: 'bands',
      type: 'band_table',
      purchaseType: 'supply',
      edges: [
        { value: 100, lower: true },
        { value: 200, lower: false },
        { value: 300, lower: false },
      ],
      bands: [1, 2, 3, 4].map((n) => ({ providers: n, procedure: 'p' + n })),
      includeTax: false,
      committeeFrom: 300,
    });
    const procurement = parse({
      id: 'plan',
      type: 'procurement_plan',
      file: 'file',
      sent: '2026-03-01',
      noObjection: '2026-03-02',
      approvalFile: 'approval',
    });
    const check = (id: string, value: number) =>
      parse({
        type: 'buying_check',
        id,
        ownerBids: false,
        procedure: value === 100 ? 'p1' : 'p4',
        consulted: value === 100 ? 1 : 4,
        offerCount: 1,
        outcome: 'passed',
        purchaseType: 'supply',
        value,
        plan: 'plan',
        supplier: 'Sample',
        afterSales: true,
        awardBasis: 'best value',
        committee: ['One', 'Two', 'Three'],
        tender: 'tender',
        committeeReport: 'report',
      }) as Row<'buying_check'>;
    const a = check('a', 100),
      b = check('b', 300),
      base: Ledger[] = [settings, table, procurement];
    expect(buyingFlags(a, [...base, a])).toEqual([]);
    expect(buyingFlags(b, [...base, b])).toEqual([]);
    expect(buyingFlags({ ...b, committee: ['One', 'Two'] }, base)).toContain(
      'Committee check failed',
    );
    expect(buyingFlags({ ...b, afterSales: false }, base)).toContain('Award basis failed');
    expect(buyingFlags({ ...b, consulted: 3 }, base)).toContain('Too few providers');
    expect(buyingFlags(a, [...base, a, b])).toContain('Possible split purchase');
  });
});
