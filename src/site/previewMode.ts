/** Loaded only with Site. The server's existing healthcheck owns the environment decision. */
let verifiedPreview = false;

export function previewLiveRequested(pathname: string, search: string): boolean {
  const query = new URLSearchParams(search);
  return /^\/demo(?:\/|$)/.test(pathname) && query.get('site') === '1' && query.get('live') === '1';
}

export function clearPreviewLive(): void {
  verifiedPreview = false;
}

export function isOfflineDemo(): boolean {
  const { pathname, search } = window.location;
  return (
    /^\/demo(?:\/|$)/.test(pathname) && !(verifiedPreview && previewLiveRequested(pathname, search))
  );
}

export async function verifyPreviewLive(
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<boolean> {
  verifiedPreview = false;
  if (!previewLiveRequested(window.location.pathname, window.location.search)) return false;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 8000);
  try {
    const response = await request('/api/healthcheck', {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
      return false;
    const body: unknown = await response.json();
    verifiedPreview =
      !controller.signal.aborted &&
      !!body &&
      typeof body === 'object' &&
      'env' in body &&
      body.env === 'preview';
    return verifiedPreview;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
