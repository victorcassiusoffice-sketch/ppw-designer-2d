import type { LinkPackage } from '../designer/link/exchange';
import type { PilotJob } from './buildRecord';
export async function jobFromPackage(
  row: LinkPackage,
  site: string,
  step: string,
): Promise<PilotJob> {
  const exchange = row.sends[row.sends.length - 1],
    quote = exchange?.quotes[exchange.quotes.length - 1];
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([row.draft.projectId, row.draft.id])),
  );
  const id =
    'trade-' + Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
  return {
    id,
    site,
    step,
    title: row.draft.title,
    scope: row.draft.scope.slice(0, 500),
    trade: row.draft.trade,
    progress: row.sends
      .flatMap((s) =>
        s.statuses.map((st) => ({
          state: st.state,
          date: (st.on ?? st.createdAt).slice(0, 10),
          note: st.note.slice(0, 500),
        })),
      )
      .slice(-40),
    ...(quote
      ? {
          quote: {
            trade: row.draft.trade,
            validUntil: quote.pack.validUntil,
            state: quote.decision?.choice ?? 'received',
          },
        }
      : {}),
  };
}
