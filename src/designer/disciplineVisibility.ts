/** Presentation only. Never filter the canonical project passed to calculations or exports. */
export const DISCIPLINES = ['structure', 'furniture', 'foundation', 'plumbing', 'electrical', 'hvac', 'fire', 'security', 'landscape', 'solar'] as const;
export type Discipline = typeof DISCIPLINES[number];
export type DisciplineVisibility = Record<Discipline, boolean>;
export const ALL_DISCIPLINES: DisciplineVisibility = Object.fromEntries(DISCIPLINES.map(key => [key, true])) as DisciplineVisibility;
export function serviceSystemDiscipline(system: string): Discipline {
  if (system === 'electrical') return 'electrical';
  if (system === 'data') return 'security';
  if (system === 'ventilation' || system === 'refrigerant') return 'hvac';
  if (system === 'fire-water') return 'fire';
  return 'plumbing';
}
export function serviceFixtureDiscipline(kind: string): Discipline {
  if (['air-conditioner', 'outdoor-ac', 'air-grille', 'extractor-fan'].includes(kind)) return 'hvac';
  if (['sprinkler', 'fire-extinguisher'].includes(kind)) return 'fire';
  if (['security-camera', 'network-switch'].includes(kind)) return 'security';
  if (kind === 'electrical-board') return 'electrical';
  return 'plumbing';
}
/** Existing catalogue categories and known service-product families; no name-based geometry mutation. */
export function productDiscipline(product: { id?: string; category?: string } | undefined): Discipline {
  const category = product?.category ?? '';
  const id = product?.id ?? '';
  if (category === 'solar' || /solar-panel|pv-panel/.test(id)) return 'solar';
  if (category === 'lighting' || category === 'electrical') return 'electrical';
  if (category === 'plumbing' || /duraco.*tank|service-pipe|espace.*(?:toilet|sink|bidet)/.test(id)) return 'plumbing';
  if (category === 'plant' || category === 'outdoor') return 'landscape';
  if (category === 'flooring' || category === 'walls') return 'structure';
  return 'furniture';
}
export function normaliseDisciplineVisibility(value: unknown): DisciplineVisibility {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(DISCIPLINES.map(key => [key, typeof object[key] === 'boolean' ? object[key] : true])) as DisciplineVisibility;
}
