import { normaliseSite, usePropertyStore, type Site } from '../store/propertyStore';
import { normaliseGeoSite, type GeoSite } from './types';
import { installCanvasSiteAdapter } from '../components/canvasSiteBridge';
import { projectSiteForCanvas } from './planAdapter';

// JSON cannot carry frozen objects. Only canonical, detached copies are frozen
// for the plan overlay; a persisted or newly imported extension starts inert.
const accepted = new WeakSet<object>();
// A plot on the map this build could not verify: checked once, not again on every change of the design.
const refused = new WeakSet<object>();
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
  if (raw === undefined) {
    // A plot on the map that was kept aside, because a build could not verify it, is offered to this build again.
    const aside = property.unread?.siteWorld;
    if (!property.site || aside === null || typeof aside !== 'object' || refused.has(aside)) return;
    const world = validateWorld(aside);
    if (!world) {
      refused.add(aside);
      return;
    }
    const next = { ...property, site: { ...property.site, world } };
    const unread = { ...property.unread };
    delete unread.siteWorld;
    if (Object.keys(unread).length > 0) next.unread = unread;
    else delete next.unread;
    warnings.delete(property.id);
    usePropertyStore.setState({ property: next });
    return;
  }
  if (raw !== null && typeof raw === 'object' && accepted.has(raw)) return;
  const clean = normaliseHydratedSite(property.site);
  const next = { ...property };
  if (clean) {
    next.site = clean;
    warnings.delete(property.id);
  } else {
    // Remove only the failed extension after validation; retain the legacy plot.
    const legacy = { ...property.site };
    delete legacy.world;
    next.site = normaliseSite(legacy);
    // The plot on the map is not dropped any more: it is kept aside as it was stored, under `unread.siteWorld`,
    // shown nowhere and used by nothing, and a build that can verify it gets it back.
    if (raw !== null && typeof raw === 'object') {
      refused.add(raw);
      next.unread = { ...property.unread, siteWorld: raw };
    }
    warnings.set(
      property.id,
      'Saved Site data could not be verified. Its geographic figures were withheld; the legacy plot is retained.',
    );
  }
  usePropertyStore.setState({ property: next });
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
