import type { MinReq, MinRes } from '../sentry.js';
import {
  context,
  ProviderError,
  searchPlace,
  solar,
  terrain,
  validatePoints,
} from './providers.js';
export async function handleSiteRequest(segments: string[], req: MinReq, res: MinRes) {
  res.setHeader('Cache-Control', 'private, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'GET only.' });
    return;
  }
  try {
    const url = new URL(req.url ?? '', 'https://onelivebuild.com');
    if ((req.url?.length ?? 0) > 16000) throw new ProviderError('Request too large.', 400);
    let data: unknown;
    if (segments[0] === 'search') data = await searchPlace(url.searchParams.get('q') ?? '');
    else if (['solar', 'context', 'terrain'].includes(segments[0])) {
      const points = validatePoints(url.searchParams.get('points'));
      data = await (segments[0] === 'solar'
        ? solar(points)
        : segments[0] === 'context'
          ? context(points)
          : terrain(points));
    } else {
      res.status(404).json({ error: 'Unknown Site provider.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-cache');
    res.status(200).json(data);
  } catch (e) {
    if (e instanceof ProviderError && e.retryAfter) res.setHeader('Retry-After', e.retryAfter);
    res
      .status(e instanceof ProviderError ? e.status : 503)
      .json({ error: e instanceof Error ? e.message : 'Provider unavailable.' });
  }
}
