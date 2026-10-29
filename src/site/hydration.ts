import { normaliseSite, usePropertyStore, type Site } from '../store/propertyStore';
import { normaliseGeoSite, type GeoSite } from './types';
import { installCanvasSiteAdapter } from '../components/canvasSiteBridge';
import { projectSiteForCanvas } from './planAdapter';

// JSON cannot carry frozen objects. Only canonical, detached copies are frozen
// for the plan overlay; a persisted or newly imported extension starts inert.
const accepted = new WeakSet<object>();
const warnings = new Map<string, string>();
const planProjection = (site: Site | null) => {
  const world = site?.world;
  return world && typeof world === 'object' && accepted.has(world)
    ? projectSiteForCanvas(world as GeoSite) : undefined;
};
function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function validateWorld(value: unknown): GeoSite | undefined {
  const world = normaliseGeoSite(value);
  if (!world) return;
  freezeTree(world);
  accepted.add(world);
  return world;
}

export function normaliseHydratedSite(value: unknown): Site | undefined {
  const site = normaliseSite(value);
  if (!site || site.world === undefined) return site;
  const world = validateWorld(site.world);
  if (!world) return;
  return { ...site, world };
}

export function siteHydrationWarning(): string | undefined {
  return warnings.get(usePropertyStore.getState().property.id);
}

/** Runs only after the caller's first-picture/plan-paint boundary or explicit Site entry. */
export function hydrateCurrentSite(): void {
  installCanvasSiteAdapter(planProjection);
  const { property } = usePropertyStore.getState();
  const raw = property.site?.world;
  if (raw === undefined || (raw !== null && typeof raw === 'object' && accepted.has(raw))) return;
  const clean = normaliseHydratedSite(property.site);
  let site: Site | undefined;
  if (clean) {
    site = clean;
    warnings.delete(property.id);
  } else {
    // Remove only the failed extension after validation; retain the legacy plot.
    const legacy = { ...property.site };
    delete legacy.world;
    site = normaliseSite(legacy);
    warnings.set(
      property.id,
      'Saved Site data could not be verified. Its geographic figures were withheld; the legacy plot is retained.',
    );
  }
  usePropertyStore.setState({ property: { ...property, site } });
}

/** Handles later imports, setSite calls and persist rehydration without an update loop. */
export function startSiteHydration(): () => void {
  let active = true;
  let updating = false;
  const update = () => {
    if (!active || updating) return;
    updating = true;
    try {
      hydrateCurrentSite();
    } finally {
      updating = false;
    }
  };
  const unsubscribe = usePropertyStore.subscribe(update);
  update();
  return () => {
    active = false;
    unsubscribe();
  };
}
