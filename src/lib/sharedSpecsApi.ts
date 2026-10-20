import {
  SharedSpecRecordSchema,
  type SharedSpecCreate,
  type SharedSpecWrite,
  type SharedSpecChanges,
  type SharedSpecProjectSummary,
} from '../designer/sharedSpecsContract';

export class SharedSpecApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export function sharedSpecsApi(getToken: () => Promise<string | null>) {
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const token = await getToken();
    if (!token) throw new SharedSpecApiError('Sign in to access a shared project.', 401);
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`/api/shared-projects${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
        cache: 'no-store',
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok)
        throw new SharedSpecApiError(
          typeof data.error === 'string' ? data.error : 'Shared project request failed.',
          response.status,
          typeof data.code === 'string' ? data.code : undefined,
        );
      return data;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError')
        throw new SharedSpecApiError(
          'Connection timed out. A save may have reached the server; refresh before retrying.',
          408,
        );
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    list: async () => (await request('')).projects as SharedSpecProjectSummary[],
    read: async (id: string) =>
      SharedSpecRecordSchema.parse(await request(`/${encodeURIComponent(id)}`)),
    create: async (value: SharedSpecCreate) =>
      SharedSpecRecordSchema.parse(await request('', 'POST', value)),
    write: async (id: string, value: SharedSpecWrite) =>
      SharedSpecRecordSchema.parse(
        await request(`/${encodeURIComponent(id)}/changes`, 'POST', value),
      ),
    changes: async (id: string, after: number) =>
      (await request(
        `/${encodeURIComponent(id)}/changes?after=${after}`,
      )) as unknown as SharedSpecChanges,
    revision: async (id: string, revision: number) =>
      SharedSpecRecordSchema.parse(
        await request(`/${encodeURIComponent(id)}/revisions/${revision}`),
      ),
  };
}
export type SharedSpecsApi = ReturnType<typeof sharedSpecsApi>;
