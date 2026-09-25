import { describe, expect, it } from 'vitest';
import { deliveryStudy, examplePartnerShare, quantityStudy } from '../workflowModel';

describe('local delivery workflow study', () => {
  it('works backwards through approval, procurement, delivery, installation and curing dependencies', () => {
    const study = deliveryStudy('2026-12-18', 'matte', 14, '2026-11-20')!;
    expect(study.totalDays).toBe(23);
    expect(study.marginDays).toBe(5);
    expect(study.steps.map((step) => [step.id, step.date])).toEqual([
      ['approval', '2026-11-25'], ['procure', '2026-11-27'], ['deliver', '2026-12-11'],
      ['install', '2026-12-13'], ['inspect', '2026-12-16'], ['handover', '2026-12-18'],
    ]);
    expect(study.steps.every((step) => step.dependency.length > 0)).toBe(true);
  });
  it('moves the approval window earlier for longer finish and supplier allowances', () => {
    const matte = deliveryStudy('2026-12-18', 'matte', 14, '2026-11-20')!;
    const mineral = deliveryStudy('2026-12-18', 'mineral', 14, '2026-11-20')!;
    const delayed = deliveryStudy('2026-12-18', 'mineral', 18, '2026-11-20')!;
    expect(mineral.marginDays).toBe(matte.marginDays - 5);
    expect(mineral.steps[mineral.steps.length - 1]?.date).toBe(matte.steps[matte.steps.length - 1]?.date);
    expect(delayed.marginDays).toBe(-4);
  });
  it('uses calendar dates across year boundaries and rounds partial lead days up', () => {
    const study = deliveryStudy('2027-01-10', 'satin', 3.2, '2026-12-20')!;
    expect(study.latestApproval).toBe('2026-12-27');
    expect(study.totalDays).toBe(14);
  });
  it.each([
    ['2026-02-30', '2026-01-01', 3], ['not-a-date', '2026-01-01', 3],
    ['2026-12-18', '', 3], ['2026-12-18', '2026-01-01', -1],
    ['2026-12-18', '2026-01-01', Number.NaN], ['2026-12-18', '2026-01-01', 121],
  ])('rejects invalid inputs: %s / %s / %s', (deadline, approved, lead) => {
    expect(deliveryStudy(deadline as string, 'matte', lead as number, approved as string)).toBeNull();
  });
});

describe('local quantity and partner examples', () => {
  it('rounds paint quantities to whole packs without hiding the volume needed', () => {
    expect(quantityStudy(42, 2, 12)).toEqual({ litres: 7, packs: 3, boughtLitres: 7.5 });
    expect(quantityStudy(0, 2, 12)).toEqual({ litres: 0, packs: 0, boughtLitres: 0 });
    expect(quantityStudy(42, 2, 0)).toBeNull();
    expect(quantityStudy(-1, 2, 12)).toBeNull();
  });
  it('calculates only an illustrative agreed share and rejects impossible rates', () => {
    expect(examplePartnerShare(25000, 5)).toBe(1250);
    expect(examplePartnerShare(123.45, 2.5)).toBe(3.09);
    expect(examplePartnerShare(25000, 101)).toBeNull();
    expect(examplePartnerShare(-1, 5)).toBeNull();
    expect(examplePartnerShare(25000, Number.NaN)).toBeNull();
  });
});
