/** Trusted deployment policy. Request bodies, origins and query flags cannot opt out. */
export function isShowcaseDeployment(): boolean {
  return process.env.VERCEL_ENV === 'preview' || /^(1|true)$/i.test(process.env.DEMO_ONLY?.trim() ?? '');
}

export const SHOWCASE_NOTICE = 'Demo only — orders, payments, quote requests and email submissions are disabled.';

interface ShowcaseResponse {
  setHeader(name: string, value: string): void;
  status(code: number): unknown;
  json(body: unknown): void;
}

/** Call before reading a payment body, creating clients, writing data or sending mail. */
export function rejectShowcaseTransaction(res: ShowcaseResponse): boolean {
  if (!isShowcaseDeployment()) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(403);
  res.json({ error: SHOWCASE_NOTICE, code: 'SHOWCASE_READ_ONLY' });
  return true;
}
