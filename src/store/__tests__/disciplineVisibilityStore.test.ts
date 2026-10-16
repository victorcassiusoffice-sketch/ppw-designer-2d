/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_DISCIPLINES,
  ALL_VISIBILITY_PARTS,
  VIEW_PRESETS,
  normalisePartVisibility,
  productVisible,
  visibilityPreset,
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
      parts: useDisciplineVisibilityStore.getState().parts,
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
  it('migrates old preferences with all new presentation parts enabled', async () => {
    localStorage.setItem('olb-discipline-visibility-v1', JSON.stringify({ version: 0, state: { visible: { structure: false } } }));
    await useDisciplineVisibilityStore.persist.rehydrate();
    expect(useDisciplineVisibilityStore.getState().parts).toEqual(ALL_VISIBILITY_PARTS);
    expect(useDisciplineVisibilityStore.getState().visible.structure).toBe(false);
    expect(normalisePartVisibility({ routes: false, walls: 'false' })).toEqual({ ...ALL_VISIBILITY_PARTS, routes: false });
  });
  it('supports exact route-only and walls-with-services presets without hiding unrelated routes through side effects', () => {
    const store = useDisciplineVisibilityStore.getState();
    store.applyPreset('pipes');
    expect(useDisciplineVisibilityStore.getState()).toMatchObject(visibilityPreset('pipes'));
    expect(useDisciplineVisibilityStore.getState().parts).toEqual({ walls: false, floors: false, roofs: false, stairs: false, routes: true, equipment: false });
    store.applyPreset('plumbing-electrical-walls');
    const state = useDisciplineVisibilityStore.getState();
    expect(DISCIPLINES.filter(key => state.visible[key])).toEqual(['structure', 'plumbing', 'electrical']);
    expect(state.parts).toEqual({ walls: true, floors: false, roofs: false, stairs: false, routes: true, equipment: true });
    store.setPartVisible('equipment', false); store.setVisible('hvac', true);
    expect(useDisciplineVisibilityStore.getState().visible.electrical).toBe(true);
    expect(useDisciplineVisibilityStore.getState().parts.floors).toBe(false);
  });
  it('adding a wall part to a pipes-only view enables its building discipline without reintroducing floors', () => {
    const store = useDisciplineVisibilityStore.getState();
    store.applyPreset('pipes'); store.setPartVisible('walls', true);
    expect(useDisciplineVisibilityStore.getState().visible.structure).toBe(true);
    expect(useDisciplineVisibilityStore.getState().parts.floors).toBe(false);
    expect(useDisciplineVisibilityStore.getState().visible.plumbing).toBe(true);
    store.applyPreset('pipes'); store.setVisible('structure', true);
    expect(useDisciplineVisibilityStore.getState().parts).toMatchObject({ walls: true, floors: true, roofs: true, stairs: true });
  });
  it('role presets and hide-all remain reversible without writing the project or camera', () => {
    localStorage.setItem('ppw_property_v2', '{"unchanged":true}');
    localStorage.setItem('olb-camera-test', '{"zoom":2.5}');
    const store = useDisciplineVisibilityStore.getState();
    for (const preset of VIEW_PRESETS) { store.applyPreset(preset); expect(useDisciplineVisibilityStore.getState()).toMatchObject(visibilityPreset(preset)); }
    store.showNone(); expect(Object.values(useDisciplineVisibilityStore.getState().visible).some(Boolean)).toBe(false);
    store.showAll(); expect(useDisciplineVisibilityStore.getState()).toMatchObject({ visible: ALL_DISCIPLINES, parts: ALL_VISIBILITY_PARTS });
    expect(localStorage.getItem('ppw_property_v2')).toBe('{"unchanged":true}');
    expect(localStorage.getItem('olb-camera-test')).toBe('{"zoom":2.5}');
  });
  it('filters placed service equipment separately from routes and architectural finishes', () => {
    const parts = { ...ALL_VISIBILITY_PARTS, equipment: false, floors: false };
    expect(productVisible({ category: 'plumbing' }, ALL_DISCIPLINES, parts)).toBe(false);
    expect(productVisible({ category: 'lighting' }, ALL_DISCIPLINES, parts)).toBe(false);
    expect(productVisible({ category: 'flooring' }, ALL_DISCIPLINES, parts)).toBe(false);
    expect(productVisible({ category: 'walls' }, ALL_DISCIPLINES, parts)).toBe(true);
    expect(productVisible({ category: 'furniture' }, ALL_DISCIPLINES, parts)).toBe(true);
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
