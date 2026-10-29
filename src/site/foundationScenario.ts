import {
  estimateFoundation,
  normaliseFoundation,
  type FoundationModel,
} from '../designer/foundation';
/** Re-run the unchanged estimator on a detached, explicit elevation scenario. */
export function foundationScenario(
  model: FoundationModel | undefined,
  concrete: Parameters<typeof estimateFoundation>[1],
  shiftM: number,
) {
  if (!model?.enabled || !model.elements.length)
    throw new Error('Unavailable: draw and enable a foundation first.');
  if (!Number.isFinite(shiftM)) throw new Error('Enter a finite foundation datum shift.');
  const copy: FoundationModel = JSON.parse(JSON.stringify(model));
  copy.elements = copy.elements.map((e) => ({
    ...e,
    topElevationM: e.topElevationM + shiftM,
    ...(e.excavation
      ? { excavation: { ...e.excavation, topElevationM: e.excavation.topElevationM + shiftM } }
      : {}),
  }));
  copy.bores = copy.bores?.map((b) => ({ ...b, topElevationM: b.topElevationM + shiftM }));
  if (!normaliseFoundation(copy))
    throw new Error('Scenario is outside the existing foundation estimator limits.');
  return {
    baseline: estimateFoundation(model, concrete),
    scenario: estimateFoundation(copy, concrete),
    shiftM,
    note: 'A uniform datum shift changes elevation, not dimensions or quantities. No founding depth, bearing capacity or reinforcement is inferred from terrain.',
  };
}
