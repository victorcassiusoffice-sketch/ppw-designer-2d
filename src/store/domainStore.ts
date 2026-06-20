/**
 * domainStore — the active configurator domain (DESIGNER-EXPANSION P4).
 *
 * P1 added the domain *registry* seam (`src/lib/domain/`) but never wired a
 * runtime "which domain is the user building?" state. P4 needs it (the domain
 * picker "enters the builder for that domain" by setting this store), so the
 * active-domain state lands here.
 *
 * Resolution order on boot:
 *   1. an explicit, VALID `?domain=` URL param  (deep-link wins)
 *   2. the persisted last-used domain           (localStorage)
 *   3. DEFAULT_DOMAIN (wellness-room)            (fallback)
 *
 * Untrusted strings (`?domain=junk`) fall back to wellness-room — never throw.
 *
 * FIREWALL: this is ADDITIVE. The live wellness-room `/` + `/designer` routes
 * do NOT read this store, so today's wellness experience is byte-for-byte
 * unchanged. Only the new domain picker + per-domain builder shell consume it.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_DOMAIN, isDomainId } from '../lib/domain';
import type { DomainId } from '../lib/domain';

/**
 * Pure resolver: map a raw `?domain=` value to a valid DomainId, falling back
 * to wellness-room for missing / junk / proto-pollution input. Exported so the
 * boot behaviour ("?domain=car→car, junk→wellness, none→wellness") is unit
 * testable without a store or a DOM.
 */
export function resolveDomainParam(raw: string | null | undefined): DomainId {
  if (typeof raw === 'string' && isDomainId(raw)) return raw;
  return DEFAULT_DOMAIN;
}

/**
 * Read the active domain from a location-like search string (e.g.
 * `?domain=car`). Returns the resolved DomainId, or null when no `domain`
 * param is present at all (so callers can distinguish "deep-link" from
 * "no opinion" and defer to the persisted value).
 */
export function readDomainFromSearch(search: string): DomainId | null {
  const params = new URLSearchParams(search);
  if (!params.has('domain')) return null;
  return resolveDomainParam(params.get('domain'));
}

export interface DomainState {
  /** The domain the builder is currently configured for. */
  activeDomain: DomainId;
  /** Switch the active domain (validated by the caller / picker). */
  setDomain: (id: DomainId) => void;
  /** Reset to the wellness-room default. */
  resetDomain: () => void;
}

export const useDomainStore = create<DomainState>()(
  persist(
    (set) => ({
      activeDomain: DEFAULT_DOMAIN,
      setDomain: (id) => set({ activeDomain: id }),
      resetDomain: () => set({ activeDomain: DEFAULT_DOMAIN }),
    }),
    {
      name: 'ppw_active_domain_v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ activeDomain: state.activeDomain }),
      // Harden against a corrupt / tampered persisted value.
      merge: (persisted, current) => {
        const p = persisted as Partial<DomainState> | undefined;
        const domain =
          p && typeof p.activeDomain === 'string' && isDomainId(p.activeDomain)
            ? p.activeDomain
            : current.activeDomain;
        return { ...current, activeDomain: domain };
      },
    },
  ),
);

/**
 * Apply a deep-linked `?domain=` to the store, if present and valid. Call this
 * from the domain builder shell on mount so a deep link wins over the persisted
 * value. A no-op when there is no `domain` param (persisted value stands).
 * Returns the domain in effect after the call.
 */
export function initDomainFromLocation(search: string): DomainId {
  const fromUrl = readDomainFromSearch(search);
  if (fromUrl) {
    useDomainStore.getState().setDomain(fromUrl);
    return fromUrl;
  }
  return useDomainStore.getState().activeDomain;
}
