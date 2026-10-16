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
  if (category === 'security' || category === 'data') return 'security';
  if (category === 'hvac' || category === 'ventilation' || category === 'air-conditioning') return 'hvac';
  if (category === 'fire') return 'fire';
  if (category === 'plumbing' || /duraco.*tank|service-pipe|espace.*(?:toilet|sink|bidet)/.test(id)) return 'plumbing';
  if (category === 'plant' || category === 'outdoor') return 'landscape';
  if (category === 'flooring' || category === 'walls') return 'structure';
  return 'furniture';
}
export function normaliseDisciplineVisibility(value: unknown): DisciplineVisibility {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(DISCIPLINES.map(key => [key, typeof object[key] === 'boolean' ? object[key] : true])) as DisciplineVisibility;
}

/** Independent presentation parts: walls can remain visible without hiding service pipes behind floors. */
export const VISIBILITY_PARTS = ['walls', 'floors', 'roofs', 'stairs', 'routes', 'equipment'] as const;
export type VisibilityPart = typeof VISIBILITY_PARTS[number];
export type PartVisibility = Record<VisibilityPart, boolean>;
export const ALL_VISIBILITY_PARTS: PartVisibility = Object.fromEntries(VISIBILITY_PARTS.map(key => [key, true])) as PartVisibility;
export const VIEW_PRESETS = ['all', 'pipes', 'plumbing-electrical-walls', 'architect', 'engineer', 'plumber', 'electrician', 'client'] as const;
export type ViewPreset = typeof VIEW_PRESETS[number];
export interface VisibilitySelection { visible: DisciplineVisibility; parts: PartVisibility }
export function normalisePartVisibility(value: unknown): PartVisibility {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(VISIBILITY_PARTS.map(key => [key, typeof object[key] === 'boolean' ? object[key] : true])) as PartVisibility;
}
export function visibilityPreset(id: ViewPreset): VisibilitySelection {
  const disciplines: Record<ViewPreset, readonly Discipline[]> = {
    all: DISCIPLINES,
    pipes: ['plumbing'],
    'plumbing-electrical-walls': ['structure', 'plumbing', 'electrical'],
    architect: ['structure', 'foundation', 'furniture', 'landscape', 'solar'],
    engineer: ['structure', 'foundation', 'plumbing', 'electrical', 'hvac', 'fire', 'security', 'solar'],
    plumber: ['structure', 'foundation', 'plumbing'],
    electrician: ['structure', 'electrical', 'security', 'solar'],
    client: ['structure', 'furniture', 'landscape', 'solar'],
  };
  const parts = { ...ALL_VISIBILITY_PARTS };
  if (id === 'pipes') for (const key of VISIBILITY_PARTS) parts[key] = key === 'routes';
  if (['plumbing-electrical-walls', 'engineer', 'plumber', 'electrician'].includes(id)) {
    parts.floors = false; parts.roofs = false; parts.stairs = false;
  }
  return { visible: Object.fromEntries(DISCIPLINES.map(key => [key, disciplines[id].includes(key)])) as DisciplineVisibility, parts };
}
export function isVisibilityPreset(id: string): id is ViewPreset { return (VIEW_PRESETS as readonly string[]).includes(id); }
export function productVisible(product: { id?: string; category?: string } | undefined, visible: DisciplineVisibility, parts: PartVisibility): boolean {
  const discipline = productDiscipline(product);
  if (!visible[discipline]) return false;
  if (product?.category === 'flooring') return parts.floors;
  if (product?.category === 'walls') return parts.walls;
  return !['plumbing', 'electrical', 'hvac', 'fire', 'security'].includes(discipline) || parts.equipment;
}
