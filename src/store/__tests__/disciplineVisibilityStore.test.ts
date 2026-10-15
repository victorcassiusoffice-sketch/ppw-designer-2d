/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_DISCIPLINES,
  DISCIPLINES,
  normaliseDisciplineVisibility,
  productDiscipline,
  serviceFixtureDiscipline,
  serviceSystemDiscipline,
} from '../../designer/disciplineVisibility';
import { useDisciplineVisibilityStore } from '../disciplineVisibilityStore';

beforeEach(() => {
  localStorage.clear();
  useDisciplineVisibilityStore.getState().showAll();
});
describe('discipline visibility is independently persisted presentation state', () => {
  it('normalizes partial or malformed saved data without hiding new disciplines', () => {
    expect(
      normaliseDisciplineVisibility({ plumbing: false, hvac: 'false', futureKey: false }),
    ).toEqual({ ...ALL_DISCIPLINES, plumbing: false });
    for (const bad of [null, undefined, 'none', 4, []])
      expect(normaliseDisciplineVisibility(bad)).toEqual(ALL_DISCIPLINES);
  });
  it('only and showAll are reversible, preserve actions, and do not write the project save key', async () => {
    const store = useDisciplineVisibilityStore.getState();
    store.only('plumbing');
    expect(
      DISCIPLINES.filter((key) => useDisciplineVisibilityStore.getState().visible[key]),
    ).toEqual(['plumbing']);
    const saved = localStorage.getItem('olb-discipline-visibility-v1')!;
    expect(JSON.parse(saved).state).toEqual({
      visible: useDisciplineVisibilityStore.getState().visible,
    });
    store.showAll();
    expect(useDisciplineVisibilityStore.getState().visible).toEqual(ALL_DISCIPLINES);
    localStorage.setItem('olb-discipline-visibility-v1', saved);
    await useDisciplineVisibilityStore.persist.rehydrate();
    expect(
      DISCIPLINES.filter((key) => useDisciplineVisibilityStore.getState().visible[key]),
    ).toEqual(['plumbing']);
    expect(typeof useDisciplineVisibilityStore.getState().showAll).toBe('function');
    expect(localStorage.getItem('ppw_property_v2')).toBeNull();
  });
  it('migrates a partial persisted visibility object and retains ordinary setters', async () => {
    localStorage.setItem(
      'olb-discipline-visibility-v1',
      JSON.stringify({ version: 0, state: { visible: { solar: false } } }),
    );
    await useDisciplineVisibilityStore.persist.rehydrate();
    expect(useDisciplineVisibilityStore.getState().visible).toEqual({
      ...ALL_DISCIPLINES,
      solar: false,
    });
    useDisciplineVisibilityStore.getState().setVisible('fire', false);
    expect(useDisciplineVisibilityStore.getState().visible).toEqual({
      ...ALL_DISCIPLINES,
      solar: false,
      fire: false,
    });
  });
  it('keeps distinct service disciplines and known product families separate', () => {
    expect(serviceSystemDiscipline('fire-water')).toBe('fire');
    expect(serviceSystemDiscipline('data')).toBe('security');
    expect(serviceSystemDiscipline('refrigerant')).toBe('hvac');
    expect(serviceSystemDiscipline('cold-water')).toBe('plumbing');
    expect(serviceFixtureDiscipline('fire-extinguisher')).toBe('fire');
    expect(serviceFixtureDiscipline('network-switch')).toBe('security');
    expect(serviceFixtureDiscipline('extractor-fan')).toBe('hvac');
    expect(productDiscipline({ category: 'solar' })).toBe('solar');
    expect(productDiscipline({ category: 'plumbing' })).toBe('plumbing');
    expect(productDiscipline({ category: 'flooring' })).toBe('structure');
    expect(productDiscipline(undefined)).toBe('furniture');
  });
});
