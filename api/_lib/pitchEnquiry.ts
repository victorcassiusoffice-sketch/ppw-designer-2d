import { createHash } from 'crypto';
import { z } from 'zod';
import { getDb, schema } from '../_db/client.js';
import { buildLimiter, getClientIp } from './rateLimit.js';
import type { MinReq, MinRes } from './sentry.js';

export const pitchEnquirySchema = z.object({
  audience: z.enum(['developers', 'merchants', 'construction']),
  purpose: z.enum(['project', 'feedback', 'physical-meeting']),
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  company: z.string().trim().max(160).default(''),
  phone: z.string().trim().max(40).default(''),
  message: z.string().trim().min(10).max(2400),
  location: z.string().trim().max(180).default(''),
  availability: z.string().trim().max(180).default(''),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
}).strict().superRefine((value, context) => {
  if (value.purpose === 'physical-meeting' && !value.location) context.addIssue({ code: 'custom', path: ['location'], message: 'Tell us where you would like to meet.' });
});

const limiter = buildLimiter('pitch-enquiry', 5, 600);
const fallback = new Map<string, { count: number; expires: number }>();
/** Instance-local protection remains in place when shared Redis is unavailable. */
export async function checkPitchEnquiryLimit(ip: string) {
  const key = createHash('sha256').update(ip).digest('hex');
  const verdict = await limiter.check(key);
  if (!verdict.reason || verdict.reason === 'limited') return verdict;
  const now = Date.now();
  for (const [entryKey, entry] of fallback) if (entry.expires <= now) fallback.delete(entryKey);
  const previous = fallback.get(key);
  if (!previous && fallback.size >= 1000) return { success: false, retryAfterSec: 600 };
  const entry = previous ?? { count: 0, expires: now + 600_000 };
  entry.count += 1;
  fallback.set(key, entry);
  return { success: entry.count <= 5, retryAfterSec: Math.max(1, Math.ceil((entry.expires - now) / 1000)) };
}

/** Business feedback only. Never creates orders, sends emails or books a meeting. */
export async function handlePitchEnquiry(req: MinReq, res: MinRes, readBody: () => Promise<unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS'); res.status(405).end(); return;
  }
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  if (origin) {
    let sameOrigin = false;
    try { sameOrigin = typeof origin === 'string' && typeof host === 'string' && new URL(origin).host === host; } catch { /* Invalid origins are rejected. */ }
    if (!sameOrigin) { res.status(403); res.json({ error: 'Open this form on the PPW presentation site.' }); return; }
  }
  const limit = await checkPitchEnquiryLimit(getClientIp({ headers: req.headers ?? {} }));
  if (!limit.success) { res.setHeader('Retry-After', String(limit.retryAfterSec)); res.status(429); res.json({ error: 'Too many requests. Please try again in a few minutes.' }); return; }
  if (Number(req.headers?.['content-length'] ?? 0) > 12_000) { res.status(413); res.json({ error: 'Your request is too long.' }); return; }
  let raw: unknown;
  try { raw = await readBody(); } catch { raw = null; }
  const parsed = pitchEnquirySchema.safeParse(raw);
  if (!parsed.success) { res.status(400); res.json({ error: 'Check your name, email, message and permission to contact you. Physical meetings also need a location.' }); return; }
  const data = parsed.data;
  try {
    const inserted = await getDb().insert(schema.leads).values({
      customerEmail: data.email, customerName: data.name, customerPhone: data.phone || null,
      source: `pitch:${data.audience}:${data.purpose}`,
      message: [`Purpose: ${data.purpose}`, `Company: ${data.company || 'Not supplied'}`, ...(data.purpose === 'physical-meeting' ? [`Meeting location: ${data.location}`, `Availability: ${data.availability || 'To arrange'}`, 'Meeting requested, not confirmed.'] : []), 'Contact permission: explicitly given on the pitch form.', '', data.message].join('\n'),
      status: 'new',
    }).returning({ id: schema.leads.id });
    if (!inserted[0]?.id) throw new Error('No receipt');
    // Never return the submitted personal information or any other lead.
    res.status(201); res.json({ receipt: `PPW-${inserted[0].id}`, status: 'received' });
  } catch {
    res.status(503); res.json({ error: 'Your request could not be saved. Download your request or use the meeting link; nothing has been booked.' });
  }
}
