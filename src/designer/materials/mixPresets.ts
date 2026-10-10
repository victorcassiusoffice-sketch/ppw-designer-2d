import type { VolumeMix } from './types';

/** User-selectable estimating scenarios, deliberately not named strength grades.
 * Supplier/engineer batch data replaces these loose-volume parts and yield factors. */
export const MIX_SCENARIOS = {
  mortar: [[1, 3, 0], [1, 4, 0], [1, 5, 0], [1, 6, 0]],
  concrete: [[1, 1.5, 3], [1, 2, 3], [1, 2, 4], [1, 3, 6]],
} as const;
export function mixScenarioKey(mix: VolumeMix) { return `${mix.cement}:${mix.sand}:${mix.aggregate}`; }
export function applyMixScenario(mix: VolumeMix, key: string, kind: keyof typeof MIX_SCENARIOS): VolumeMix {
  const selected = MIX_SCENARIOS[kind].find(parts => parts.join(':') === key);
  return selected ? { ...mix, cement: selected[0], sand: selected[1], aggregate: selected[2] } : mix;
}
