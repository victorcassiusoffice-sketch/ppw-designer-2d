import { id } from './contract';
import { request, isShared } from './remote';
import { usePilots, photoBytes } from './store';
import { siteFrames } from './mediaExtras';

// Resolve on each visit. Shared bytes never enter browser persistence or a saved build.
export async function wallSource(plan: string, slug: string, siteId: string, last?: string) {
  if (![plan, slug, siteId].every((v) => id.safeParse(v).success)) return null;
  if (isShared(slug)) {
    const frame = await request<{ plan?: string; frame: string | null }>(
      '/' + slug + '/site-wall/' + siteId,
    );
    if (frame.plan !== plan || !frame.frame) return null;
    const key = [slug, siteId, frame.frame].join(':');
    if (key === last) return { key };
    const res = await fetch('/api/pilots/' + slug + '/photos/' + frame.frame, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return { key, bytes: await res.blob() };
  }
  const p = usePilots.getState().pilots.find((x) => x.slug === slug);
  if (!p) return null;
  const site = p.sites.find((s) => s.id === siteId && s.plan === plan && s.photoWall);
  if (!site) return null;
  const frame = siteFrames(p, siteId).slice(-1)[0];
  if (!frame) return null;
  const key = [slug, siteId, frame.id].join(':');
  if (key === last) return { key };
  return { key, bytes: await photoBytes(frame, p) };
}
