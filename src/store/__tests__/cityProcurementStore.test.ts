/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { useCityProcurementStore } from '../cityProcurementStore';
import { createCityProcurementPackage, createCityProcurementPlan } from '../../designer/cityProcurement';

beforeEach(() => { localStorage.clear(); useCityProcurementStore.setState({ plans: {}, cloud: {} }); });
describe('private City procurement draft persistence', () => {
  it('keeps recipient packages separate per project and through hydration', async () => {
    const store = useCityProcurementStore.getState(); const one = store.ensurePlan('city-one', 'One');
    store.ensurePlan('city-two', 'Two');
    store.upsertPackage('city-one', { ...createCityProcurementPackage('Supplier', 'Water'), recipientEmail: 'orders@example.com' });
    const saved = localStorage.getItem('ppw_city_procurement_v1');
    expect(useCityProcurementStore.getState().plans['city-two'].packages).toHaveLength(0);
    useCityProcurementStore.setState({ plans: {}, cloud: {} }); localStorage.setItem('ppw_city_procurement_v1', saved!);
    await useCityProcurementStore.persist.rehydrate();
    expect(useCityProcurementStore.getState().plans['city-one']).toMatchObject({ id: one.id, packages: [{ recipientEmail: 'orders@example.com' }] });
    expect(localStorage.getItem('ppw_property_v2')).toBeNull();
  });
  it('drops stale cloud revision when replacing a local plan with a different identity', () => {
    const store = useCityProcurementStore.getState(); store.ensurePlan('city-one', 'One');
    store.setCloud('city-one', { merchantSlug: 'alpha', revision: 3, savedAt: '2026-10-13T00:00:00Z' });
    store.setPlan(createCityProcurementPlan('city-one', 'New city'));
    expect(useCityProcurementStore.getState().cloud['city-one']).toBeUndefined();
  });
  it('removes private schedules explicitly and rejects malformed imported drafts', () => {
    const store = useCityProcurementStore.getState(); const plan = store.ensurePlan('city-one', 'One');
    expect(() => store.setPlan({ ...plan, packages: [{ id: 'bad' }] } as unknown as typeof plan)).toThrow();
    expect(useCityProcurementStore.getState().plans['city-one']).toEqual(plan);
    store.removePlan('city-one'); expect(useCityProcurementStore.getState().plans['city-one']).toBeUndefined();
    expect(() => store.ensurePlan('__proto__', 'Invalid')).toThrow();
  });
});
