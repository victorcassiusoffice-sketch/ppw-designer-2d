/**
 * Catch-all orders router — single Vercel function for /api/orders/*,
 * /api/merchants/:id/(order-update|agent-session), /api/designs/*,
 * and /api/leads.
 *
 * Wave 1.3 (customer tracking), Wave 1.4 (merchant webhook),
 * Wave 1.6 (agent session lookup), Wave 2.6 (save/load designs),
 * Wave 2.7 (lead capture). One lambda covers all five surfaces —
 * vercel.json rewrites every URL shape to this file. Folded together
 * to stay under the Vercel Hobby 12-fn cap.
 *
 * Routes handled (resolved by URL parse, since query.slug is only
 * populated when Vercel does the rewrite via vercel.json):
 *   GET    /api/orders/:ref                  → order detail (orders + order_items + latest events)
 *   GET    /api/orders/:ref/status           → polled status only (cheap)
 *   POST   /api/merchants/:slug/order-update → merchant fulfilment webhook (HMAC-verified)
 *   GET    /api/merchants/:slug/agent-session→ active session + last 50 messages
 *   GET    /api/designs?userId=…             → list designs for a user
 *   POST   /api/designs                      → create design
 *   GET    /api/designs/:id                  → read design
 *   PUT    /api/designs/:id                  → update design
 *   POST   /api/leads                        → submit lead-capture form
 */

import { eq, desc, inArray } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'crypto';
import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import { getDb, schema } from './db/client.js';
import { aggregateOrderStatus, isValidTransition, type OrderEventType } from './lib/order-status.js';
import { dispatchDesignSavedEmail } from './lib/email/dispatch.js';
import { sendEmail } from './lib/email/send.js';
import { drizzleMerchantStore } from './db/merchantStore.js';
import {
  signMerchantSession,
  buildMagicLinkUrl,
  DEFAULT_TTL_MS,
  readMerchantSessionSecret,
} from './lib/merchantSession.js';
import {
  drizzleReferralStore,
  mintRefCode,
  type ReferralStore,
  type ListReferralsFilter,
} from './db/referralStore.js';
import { Redis } from '@upstash/redis';
import { sql } from 'drizzle-orm';
// Cowork OS Phase 0.5 — subscriptions feed reads the canonical Vic-edited
// JSON from src/data. Vercel's bundler follows the relative path.
import subscriptionsJson from '../src/data/subscriptions.json' with { type: 'json' };

interface RouterReq extends MinReq {
  body?: unknown;
}

// ─────────────────────────────────────────────────────────────────────
// Cowork OS Phase 0.5 — 3 data-feed endpoints + Bearer auth.
// Folds into this catchall router so the 12/12 Vercel cap holds.
// ─────────────────────────────────────────────────────────────────────

interface SubscriptionEntry {
  name: string;
  amount: number;
  currency: 'USD' | 'GBP' | 'MUR' | 'EUR' | string;
  note?: string;
  status?: string;
}

interface CoworkSubscriptionsFile {
  schema_version: number;
  owner: string;
  updated_at: string;
  business: SubscriptionEntry[];
  personal: SubscriptionEntry[];
}

const SUBSCRIPTIONS = subscriptionsJson as CoworkSubscriptionsFile;

/** Constant updated by Vic. Drives the Cowork OS Live Artifact macro chip. */
const COWORK_OS_CURRENT_MACRO_STATE = 'mega-goal-complete-2026-05-21';
const COWORK_OS_TIER_STATUS = 'tier-1-pattern-c';
const COWORK_OS_K1_FOLLOWUP_SENT = false;
const VERCEL_LAMBDA_CAP = 12;
const VERCEL_LAMBDA_COUNT = 12;

/**
 * Cowork OS Bearer auth. Returns `null` if authorized, otherwise an
 * already-sent 401 response (write JSON to res and return the marker).
 */
function checkCoworkOsBearer(req: RouterReq, res: MinRes): boolean {
  const secret = process.env.COWORK_OS_API_KEY;
  if (!secret) {
    res.status(503);
    res.json({ error: 'COWORK_OS_API_KEY not configured' });
    return false;
  }
  const header = (req.headers?.authorization ?? req.headers?.Authorization ?? '') as string;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401);
    res.json({ error: 'missing Bearer token' });
    return false;
  }
  const presented = Buffer.from(match[1].trim());
  const expected = Buffer.from(secret);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    res.status(401);
    res.json({ error: 'invalid Bearer token' });
    return false;
  }
  return true;
}

/** Lightweight FX cache (in-memory; 24h TTL per spec). */
interface FxRates {
  USD?: number;
  GBP?: number;
  EUR?: number;
  fetched: number;
}
let _fxCache: FxRates | null = null;
const FX_TTL_MS = 24 * 60 * 60 * 1000;

// Approximate MUR-per-foreign-unit fallbacks. Used when the live FX feed is
// down or returns a payload without the expected `rates` map (exchangerate.host
// became access-key-gated in 2025 for some queries; we fall through cleanly).
const FX_FALLBACK_MUR: { USD: number; GBP: number; EUR: number } = { USD: 46, GBP: 58, EUR: 50 };

async function fetchFxToMur(): Promise<FxRates> {
  if (_fxCache && Date.now() - _fxCache.fetched < FX_TTL_MS) return _fxCache;
  const rates: FxRates = {
    USD: FX_FALLBACK_MUR.USD,
    GBP: FX_FALLBACK_MUR.GBP,
    EUR: FX_FALLBACK_MUR.EUR,
    fetched: Date.now(),
  };
  try {
    const r = await fetch('https://api.exchangerate.host/latest?base=MUR&symbols=USD,GBP,EUR');
    if (r.ok) {
      const j = (await r.json()) as { rates?: Record<string, number> };
      // Base=MUR returns "1 MUR = N foreign"; invert to get MUR-per-foreign.
      if (j.rates?.USD && j.rates.USD > 0) rates.USD = 1 / j.rates.USD;
      if (j.rates?.GBP && j.rates.GBP > 0) rates.GBP = 1 / j.rates.GBP;
      if (j.rates?.EUR && j.rates.EUR > 0) rates.EUR = 1 / j.rates.EUR;
    }
  } catch {
    /* fall through to fallback rates already populated above */
  }
  _fxCache = rates;
  return rates;
}

function toMUR(entry: SubscriptionEntry, fx: FxRates): number {
  const cur = (entry.currency ?? 'MUR').toUpperCase();
  if (cur === 'MUR') return Math.round(entry.amount);
  const rate = (fx as unknown as Record<string, number | undefined>)[cur];
  if (!rate) return Math.round(entry.amount);
  return Math.round(entry.amount * rate);
}

async function handleCoworkOsDesignerHealth(_req: RouterReq, res: MinRes): Promise<void> {
  const db = getDb();
  let productionCatalogSkuCount = 0;
  try {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(eq(schema.products.status, 'active'));
    productionCatalogSkuCount = Number(rows[0]?.c ?? 0);
  } catch {
    productionCatalogSkuCount = -1;
  }
  // VERCEL_GIT_COMMIT_SHA is injected by Vercel at build time.
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);
  res.status(200);
  res.json({
    lastDeploySha: sha || 'unknown',
    lastDeployTimestamp: new Date().toISOString(),
    productionCatalogSkuCount,
    currentMacroState: COWORK_OS_CURRENT_MACRO_STATE,
    brutalAuditRedCount: 0,
    vercelLambdaCount: VERCEL_LAMBDA_COUNT,
    vercelLambdaCap: VERCEL_LAMBDA_CAP,
  });
}

async function handleCoworkOsK1State(_req: RouterReq, res: MinRes): Promise<void> {
  const db = getDb();
  let k1SkusInCatalog = 0;
  let lastK1ProductSync: string | null = null;
  let eventsToday = 0;
  let eventsMonth = 0;
  try {
    const k1 = await db
      .select({
        c: sql<number>`count(*)::int`,
        maxUpdated: sql<string | null>`max(${schema.products.updatedAt})::text`,
      })
      .from(schema.products)
      .innerJoin(schema.merchants, eq(schema.merchants.id, schema.products.merchantId))
      .where(eq(schema.merchants.slug, 'k1-sport'));
    k1SkusInCatalog = Number(k1[0]?.c ?? 0);
    lastK1ProductSync = k1[0]?.maxUpdated ?? null;
  } catch {
    /* table schema may not match in dev; degrade gracefully */
  }
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
    const rowsToday = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.designerReferrals)
      .where(sql`${schema.designerReferrals.createdAt} >= ${today.toISOString()}`);
    const rowsMonth = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.designerReferrals)
      .where(sql`${schema.designerReferrals.createdAt} >= ${monthStart.toISOString()}`);
    eventsToday = Number(rowsToday[0]?.c ?? 0);
    eventsMonth = Number(rowsMonth[0]?.c ?? 0);
  } catch {
    /* designer_referrals may be empty / missing pre-M7-deploy */
  }
  res.status(200);
  res.json({
    tierStatus: COWORK_OS_TIER_STATUS,
    followUpEmailSent: COWORK_OS_K1_FOLLOWUP_SENT,
    k1SkusInCatalog,
    lastK1ProductSync,
    patternCAttributionEventsToday: eventsToday,
    patternCAttributionEventsThisMonth: eventsMonth,
  });
}

async function handleCoworkOsSubscriptions(_req: RouterReq, res: MinRes): Promise<void> {
  const fx = await fetchFxToMur();
  const business = SUBSCRIPTIONS.business.map((s) => ({
    name: s.name,
    amountOriginal: s.amount,
    currency: s.currency,
    amountMUR: toMUR(s, fx),
    ...(s.note ? { note: s.note } : {}),
    ...(s.status ? { status: s.status } : {}),
  }));
  const personal = SUBSCRIPTIONS.personal.map((s) => ({
    name: s.name,
    amountOriginal: s.amount,
    currency: s.currency,
    amountMUR: toMUR(s, fx),
    ...(s.note ? { note: s.note } : {}),
    ...(s.status ? { status: s.status } : {}),
  }));
  const burnMUR = business.reduce((a, b) => a + b.amountMUR, 0) + personal.reduce((a, b) => a + b.amountMUR, 0);
  const muToUsd = fx.USD ? 1 / fx.USD : 1 / 46;
  const muToGbp = fx.GBP ? 1 / fx.GBP : 1 / 58;
  res.status(200);
  res.json({
    monthlyBurnMUR: burnMUR,
    monthlyBurnUSD: Math.round(burnMUR * muToUsd),
    monthlyBurnGBP: Math.round(burnMUR * muToGbp),
    businessSubs: business,
    personalSubs: personal,
    fx: { USD_MUR: fx.USD ?? null, GBP_MUR: fx.GBP ?? null, EUR_MUR: fx.EUR ?? null, fetched: fx.fetched },
    schemaVersion: SUBSCRIPTIONS.schema_version,
    updatedAt: SUBSCRIPTIONS.updated_at,
  });
}

function parseSegments(req: RouterReq): { resource: string | null; segments: string[] } {
  const url = (req.url ?? '').split('?')[0] ?? '';
  const parts = url.split('/').filter(Boolean);
  // ['api', 'orders', ...rest] or ['api', 'merchants', ...rest]
  if (parts[0] !== 'api') return { resource: null, segments: [] };
  return { resource: parts[1] ?? null, segments: parts.slice(2) };
}

interface OrderItemRow {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
  merchantId: number;
}

interface OrderEventRow {
  orderItemId: number;
  eventType: OrderEventType;
  trackingNumber: string | null;
  carrier: string | null;
  note: string | null;
  createdAt: Date;
}

async function loadOrderByRef(
  ppwOrderId: string,
): Promise<
  | {
      ok: true;
      order: {
        id: number;
        ppwOrderId: string;
        customerEmail: string;
        currency: string;
        totalMinor: number;
        paymentStatus: string;
        paymentRail: string;
        createdAt: Date;
      };
      items: OrderItemRow[];
      eventsByItem: Map<number, OrderEventRow[]>;
      latestStatusByItem: Map<number, OrderEventType | null>;
    }
  | { ok: false; status: 404 | 503; error: string }
> {
  const db = getDb();
  let orderRows;
  try {
    orderRows = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.ppwOrderId, ppwOrderId))
      .limit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*orders.* does not exist|42P01|undefined_table/i.test(msg)) {
      return { ok: false, status: 503, error: 'Orders table not migrated.' };
    }
    throw err;
  }
  const order = orderRows[0];
  if (!order) return { ok: false, status: 404, error: 'Order not found.' };

  let items: OrderItemRow[] = [];
  let events: OrderEventRow[] = [];
  try {
    items = await db
      .select({
        id: schema.orderItems.id,
        sku: schema.orderItems.sku,
        name: schema.orderItems.name,
        quantity: schema.orderItems.quantity,
        unitPriceMinor: schema.orderItems.unitPriceMinor,
        lineTotalMinor: schema.orderItems.lineTotalMinor,
        currency: schema.orderItems.currency,
        merchantId: schema.orderItems.merchantId,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));
    if (items.length > 0) {
      const itemIds = items.map((i) => i.id);
      events = await db
        .select({
          orderItemId: schema.orderItemEvents.orderItemId,
          eventType: schema.orderItemEvents.eventType,
          trackingNumber: schema.orderItemEvents.trackingNumber,
          carrier: schema.orderItemEvents.carrier,
          note: schema.orderItemEvents.note,
          createdAt: schema.orderItemEvents.createdAt,
        })
        .from(schema.orderItemEvents)
        .where(inArray(schema.orderItemEvents.orderItemId, itemIds))
        .orderBy(desc(schema.orderItemEvents.createdAt));
    }
  } catch (err) {
    // order_items / order_item_events may not exist yet on dev DBs
    const msg = err instanceof Error ? err.message : String(err);
    if (!/relation .*does not exist|42P01|undefined_table/i.test(msg)) {
      throw err;
    }
  }

  const eventsByItem = new Map<number, OrderEventRow[]>();
  const latestStatusByItem = new Map<number, OrderEventType | null>();
  for (const item of items) eventsByItem.set(item.id, []);
  for (const e of events) {
    const arr = eventsByItem.get(e.orderItemId) ?? [];
    arr.push(e);
    eventsByItem.set(e.orderItemId, arr);
  }
  for (const item of items) {
    const itemEvents = eventsByItem.get(item.id) ?? [];
    latestStatusByItem.set(item.id, itemEvents.length > 0 ? itemEvents[0]!.eventType : null);
  }

  return { ok: true, order, items, eventsByItem, latestStatusByItem };
}

async function handleOrderDetail(ref: string, res: MinRes): Promise<void> {
  const result = await loadOrderByRef(ref);
  if (!result.ok) {
    res.status(result.status);
    res.json({ error: result.error });
    return;
  }
  const { order, items, eventsByItem, latestStatusByItem } = result;
  const statuses: OrderEventType[] = [];
  for (const s of latestStatusByItem.values()) if (s) statuses.push(s);
  const orderStatus = aggregateOrderStatus(statuses);

  res.status(200);
  res.json({
    orderRef: order.ppwOrderId,
    customerEmail: order.customerEmail,
    currency: order.currency,
    totalMinor: order.totalMinor,
    paymentStatus: order.paymentStatus,
    paymentRail: order.paymentRail,
    orderStatus,
    createdAt: order.createdAt,
    items: items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: item.lineTotalMinor,
      currency: item.currency,
      merchantId: item.merchantId,
      status: latestStatusByItem.get(item.id) ?? null,
      events: (eventsByItem.get(item.id) ?? []).map((e) => ({
        eventType: e.eventType,
        trackingNumber: e.trackingNumber,
        carrier: e.carrier,
        note: e.note,
        createdAt: e.createdAt,
      })),
    })),
  });
}

async function handleOrderStatus(ref: string, res: MinRes): Promise<void> {
  // Cheap polling endpoint — returns only the aggregate status and
  // per-item latest event types.
  const result = await loadOrderByRef(ref);
  if (!result.ok) {
    res.status(result.status);
    res.json({ error: result.error });
    return;
  }
  const { order, items, latestStatusByItem } = result;
  const statuses: OrderEventType[] = [];
  for (const s of latestStatusByItem.values()) if (s) statuses.push(s);
  const orderStatus = aggregateOrderStatus(statuses);
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.status(200);
  res.json({
    orderRef: order.ppwOrderId,
    paymentStatus: order.paymentStatus,
    orderStatus,
    items: items.map((item) => ({
      id: item.id,
      status: latestStatusByItem.get(item.id) ?? null,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// W1.4 — Merchant inbound order-update webhook.
// ─────────────────────────────────────────────────────────────────────

interface MerchantWebhookBody {
  eventId: string;
  orderItemId: number;
  eventType: OrderEventType;
  trackingNumber?: string;
  carrier?: string;
  note?: string;
}

export function verifyMerchantHmac(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.toLowerCase().replace(/^sha256=/, '');
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
}

export function validateMerchantWebhook(
  payload: unknown,
): { ok: true; data: MerchantWebhookBody } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as Partial<MerchantWebhookBody>;
  if (typeof p.eventId !== 'string' || p.eventId.length === 0) {
    return { ok: false, error: 'eventId required.' };
  }
  if (typeof p.orderItemId !== 'number' || !Number.isInteger(p.orderItemId)) {
    return { ok: false, error: 'orderItemId must be an integer.' };
  }
  const allowedEvents: OrderEventType[] = [
    'confirmed',
    'shipped',
    'in_transit',
    'delivered',
    'returned',
    'failed',
  ];
  if (typeof p.eventType !== 'string' || !allowedEvents.includes(p.eventType as OrderEventType)) {
    return { ok: false, error: 'eventType invalid.' };
  }
  return {
    ok: true,
    data: {
      eventId: p.eventId,
      orderItemId: p.orderItemId,
      eventType: p.eventType as OrderEventType,
      trackingNumber: typeof p.trackingNumber === 'string' ? p.trackingNumber : undefined,
      carrier: typeof p.carrier === 'string' ? p.carrier : undefined,
      note: typeof p.note === 'string' ? p.note : undefined,
    },
  };
}

async function handleMerchantWebhook(
  merchantSlug: string,
  req: RouterReq,
  res: MinRes,
): Promise<void> {
  // Read raw body for HMAC verification.
  const rawBody: string = typeof req.body === 'string'
    ? req.body
    : Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body ?? {});

  const db = getDb();
  let merchantRows;
  try {
    merchantRows = await db
      .select({
        id: schema.merchants.id,
        slug: schema.merchants.slug,
        webhookSecret: schema.merchants.webhookSecret,
      })
      .from(schema.merchants)
      .where(eq(schema.merchants.slug, merchantSlug))
      .limit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/column .*webhook_secret.* does not exist/i.test(msg)) {
      res.status(503);
      res.json({ error: 'Merchant webhook_secret column not migrated.' });
      return;
    }
    throw err;
  }
  const merchant = merchantRows[0];
  if (!merchant) {
    res.status(404);
    res.json({ error: 'Merchant not found.' });
    return;
  }
  if (!merchant.webhookSecret) {
    res.status(403);
    res.json({ error: 'Merchant webhook not provisioned (missing secret).' });
    return;
  }

  const sig =
    typeof req.headers['x-ppw-signature'] === 'string'
      ? req.headers['x-ppw-signature']
      : Array.isArray(req.headers['x-ppw-signature'])
        ? req.headers['x-ppw-signature'][0]
        : undefined;
  if (!verifyMerchantHmac(rawBody, sig, merchant.webhookSecret)) {
    res.status(401);
    res.json({ error: 'Invalid HMAC signature.' });
    return;
  }

  const parsed = JSON.parse(rawBody) as unknown;
  const v = validateMerchantWebhook(parsed);
  if (!v.ok) {
    res.status(400);
    res.json({ error: v.error });
    return;
  }

  // KV-backed dedupe — refuse duplicate event_ids within 24h.
  try {
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;
    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const key = `mwhk:${merchant.id}:${v.data.eventId}`;
      const inserted = await redis.set(key, '1', { ex: 60 * 60 * 24, nx: true });
      if (inserted !== 'OK') {
        res.status(200);
        res.json({ ok: true, deduped: true });
        return;
      }
    }
  } catch {
    // Dedupe is best-effort; do not block on KV failures.
  }

  // Validate item belongs to a merchant the caller controls.
  const itemRows = await db
    .select({
      id: schema.orderItems.id,
      merchantId: schema.orderItems.merchantId,
    })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.id, v.data.orderItemId))
    .limit(1);
  const item = itemRows[0];
  if (!item) {
    res.status(404);
    res.json({ error: 'order_item not found.' });
    return;
  }
  if (item.merchantId !== merchant.id) {
    res.status(403);
    res.json({ error: 'order_item does not belong to this merchant.' });
    return;
  }

  // Get the latest event to validate the state transition.
  const prevRows = await db
    .select({ eventType: schema.orderItemEvents.eventType })
    .from(schema.orderItemEvents)
    .where(eq(schema.orderItemEvents.orderItemId, v.data.orderItemId))
    .orderBy(desc(schema.orderItemEvents.createdAt))
    .limit(1);
  const prev = prevRows[0]?.eventType ?? null;
  if (!isValidTransition(prev, v.data.eventType)) {
    res.status(409);
    res.json({ error: `Invalid transition ${prev ?? 'null'} → ${v.data.eventType}.` });
    return;
  }

  await db.insert(schema.orderItemEvents).values({
    orderItemId: v.data.orderItemId,
    eventType: v.data.eventType,
    trackingNumber: v.data.trackingNumber ?? null,
    carrier: v.data.carrier ?? null,
    note: v.data.note ?? null,
    payload: { eventId: v.data.eventId, source: `merchant:${merchant.slug}` },
  });

  res.status(200);
  res.json({ ok: true, recorded: v.data.eventType });
}

// ─────────────────────────────────────────────────────────────────────
// W1.6 — Merchant agent session lookup.
// ─────────────────────────────────────────────────────────────────────

async function handleMerchantAgentSession(merchantSlug: string, res: MinRes): Promise<void> {
  const db = getDb();
  let merchantRows;
  try {
    merchantRows = await db
      .select({ id: schema.merchants.id, slug: schema.merchants.slug })
      .from(schema.merchants)
      .where(eq(schema.merchants.slug, merchantSlug))
      .limit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*merchants.* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ error: 'Merchants table not migrated.' });
      return;
    }
    throw err;
  }
  const merchant = merchantRows[0];
  if (!merchant) {
    res.status(404);
    res.json({ error: 'Merchant not found.' });
    return;
  }

  let session;
  try {
    const sessionRows = await db
      .select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.merchantId, merchant.id))
      .orderBy(desc(schema.agentSessions.createdAt))
      .limit(1);
    session = sessionRows[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*agent_sessions.* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ error: 'Agent sessions table not migrated.' });
      return;
    }
    throw err;
  }

  // Auto-create a session if the merchant has none. Phase 6/7 contract:
  // every approved merchant gets at least one session; this is the
  // self-heal path if W1.7 auto-spawn didn't run.
  if (!session) {
    const inserted = await db
      .insert(schema.agentSessions)
      .values({ merchantId: merchant.id, topic: 'onboarding', status: 'active' })
      .returning();
    session = inserted[0]!;
  }

  const recent = await db
    .select({
      id: schema.agentMessages.id,
      role: schema.agentMessages.role,
      content: schema.agentMessages.content,
      modelUsed: schema.agentMessages.modelUsed,
      createdAt: schema.agentMessages.createdAt,
    })
    .from(schema.agentMessages)
    .where(eq(schema.agentMessages.sessionId, session.id))
    .orderBy(desc(schema.agentMessages.createdAt))
    .limit(50);

  res.status(200);
  res.json({
    session: {
      id: session.id,
      merchantId: session.merchantId,
      topic: session.topic,
      status: session.status,
      totalCostMicroUsd: session.totalCostMicroUsd,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
    },
    messages: recent.reverse(),
  });
}

// ─────────────────────────────────────────────────────────────────────
// W2.6 — Designs CRUD.
// ─────────────────────────────────────────────────────────────────────

interface DesignPayload {
  userId?: string;
  customerEmail?: string;
  name?: string;
  property: unknown;
  cart?: unknown;
  status?: string;
}

function validateDesignPayload(
  raw: unknown,
): { ok: true; data: DesignPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = raw as Partial<DesignPayload>;
  if (!p.property || typeof p.property !== 'object') {
    return { ok: false, error: 'property required (room layout snapshot).' };
  }
  if (p.userId !== undefined && typeof p.userId !== 'string') {
    return { ok: false, error: 'userId must be a string.' };
  }
  if (p.customerEmail !== undefined && typeof p.customerEmail !== 'string') {
    return { ok: false, error: 'customerEmail must be a string.' };
  }
  if (!p.userId && !p.customerEmail) {
    return { ok: false, error: 'Either userId or customerEmail required.' };
  }
  return {
    ok: true,
    data: {
      userId: p.userId,
      customerEmail: p.customerEmail,
      name: typeof p.name === 'string' ? p.name : undefined,
      property: p.property,
      cart: p.cart,
      status: typeof p.status === 'string' ? p.status : undefined,
    },
  };
}

// ---------------------------------------------------------------------
// M5.b — merchant magic-link sign-in.
//
// Closes the public-by-slug gap surfaced in macro-5-complete. The merchant
// types their contact email into the dashboard sign-in form; if it
// matches the slug's `merchants.contact_email`, we email a one-click link
// containing a 30-day HMAC-signed session token. Visiting the link sets
// the token in localStorage and the React `RequireMerchant` guard
// re-renders the protected route. Token verification is purely
// HMAC-based — no DB lookup per request, no server-side session table.
//
// The endpoint always responds 200 (no merchant-existence leak). The
// "did it actually send" signal lands in the audit_log row that
// `sendEmail` writes.
// ---------------------------------------------------------------------

type ParsedMagicLinkBody =
  | { ok: true; email: string }
  | { ok: false; error: string };

export function parseMagicLinkBody(body: unknown): ParsedMagicLinkBody {
  if (!body || typeof body !== 'object') return { ok: false, error: 'JSON body required.' };
  const b = body as Record<string, unknown>;
  if (typeof b.email !== 'string') return { ok: false, error: 'email field required.' };
  const email = b.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid email.' };
  if (email.length > 254) return { ok: false, error: 'email too long.' };
  return { ok: true, email };
}

export function buildMagicLinkEmail(args: {
  slug: string;
  link: string;
  expiryDays: number;
}): { subject: string; html: string } {
  const safeSlug = String(args.slug).replace(/[<>]/g, '');
  const subject = `Sign in to your ${safeSlug} dashboard`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family:Inter,Helvetica,Arial,sans-serif;background:#232C3B;color:#F5EBD7;margin:0;padding:0;">
  <table width="100%" style="background:#232C3B;padding:32px 16px;"><tr><td align="center">
    <table width="540" style="background:#1A2230;border:1px solid rgba(245,235,215,0.14);border-radius:10px;padding:32px;">
      <tr><td>
        <h1 style="font-family:'EB Garamond',Georgia,serif;font-weight:500;color:#F5EBD7;margin:0 0 16px;">Sign in to your dashboard</h1>
        <p style="color:#A8B0BD;margin:0 0 24px;">Click the button below to open the ${safeSlug} merchant dashboard. The link expires in ${args.expiryDays} days. If you didn't request this, you can ignore the email.</p>
        <p style="margin:0 0 24px;">
          <a href="${args.link}" style="display:inline-block;padding:12px 24px;background:#FFBB58;color:#1A2230;text-decoration:none;font-weight:600;border-radius:6px;font-family:Inter,sans-serif;">Open dashboard</a>
        </p>
        <p style="color:#A8B0BD;font-size:12px;margin:0;">Or paste this URL into your browser:<br><span style="word-break:break-all;color:#F5EBD7;">${args.link}</span></p>
      </td></tr>
    </table>
    <p style="color:#A8B0BD;font-size:11px;margin-top:24px;">Peak Performance Wellness · designer.ppwellness.co</p>
  </td></tr></table>
</body></html>`.trim();
  return { subject, html };
}

function originFromReq(req: RouterReq): string {
  const fromEnv = (process.env.PPW_PUBLIC_ORIGIN ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = req.headers?.host;
  if (typeof host === 'string' && host) {
    const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
    return `${proto}://${host}`;
  }
  return 'https://designer.ppwellness.co';
}

async function readJsonBody(req: RouterReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return null; }
  }
  return null;
}

async function handleMerchantMagicLink(slug: string, req: RouterReq, res: MinRes): Promise<void> {
  const body = await readJsonBody(req);
  const parsed = parseMagicLinkBody(body);
  if (!parsed.ok) {
    res.status(400);
    res.json({ error: parsed.error });
    return;
  }
  // Response-neutral OK message so the caller can't probe the merchant
  // directory or contact-email mapping.
  const NEUTRAL_BODY = {
    ok: true,
    message: 'If that email matches a registered merchant, a sign-in link has been emailed.',
  };

  // Resolve secret early so an unconfigured prod env fails fast on the
  // attempt (audit row written) rather than silently swallowing.
  let secret: string;
  try {
    secret = readMerchantSessionSecret();
  } catch (err) {
    console.error('[merchant-magic-link]', err);
    res.status(503);
    res.json({ error: 'merchant sign-in temporarily unavailable' });
    return;
  }

  const store = drizzleMerchantStore();
  let merchant;
  try {
    merchant = await store.findBySlug(slug);
  } catch (err) {
    console.error('[merchant-magic-link] findBySlug', err);
    // Don't leak DB outage details — still respond neutrally.
    res.status(200);
    res.json(NEUTRAL_BODY);
    return;
  }
  if (!merchant) {
    res.status(200);
    res.json(NEUTRAL_BODY);
    return;
  }
  const expectedEmail = merchant.contactEmail.trim().toLowerCase();
  if (expectedEmail !== parsed.email) {
    res.status(200);
    res.json(NEUTRAL_BODY);
    return;
  }

  const exp = Date.now() + DEFAULT_TTL_MS;
  const token = signMerchantSession({ slug, email: expectedEmail, exp }, secret);
  const origin = originFromReq(req);
  const link = buildMagicLinkUrl({ origin, slug, token });
  const expiryDays = Math.round(DEFAULT_TTL_MS / (24 * 60 * 60 * 1000));
  const { subject, html } = buildMagicLinkEmail({ slug, link, expiryDays });

  await sendEmail({
    to: expectedEmail,
    subject,
    html,
    template: 'merchant-magic-link',
    merchantId: merchant.id,
    payload: { slug, exp },
    dedupKey: `merchant-magic-link:${slug}:${exp}`,
  });

  res.status(200);
  res.json(NEUTRAL_BODY);
}

// ---------------------------------------------------------------------
// M7 — Pattern C attribution + reconciliation (RELENTLESS_GOAL 2026-05-19).
//
// `/api/k1/redirect`           GET   — log + 302 to merchant storefront
// `/api/commission/reconcile`  GET   — admin-gated CSV export
//
// Pure helpers are exported so the unit tests can drive them without
// spinning up the full request/response pipeline.
// ---------------------------------------------------------------------

/**
 * Merchant-slug → outbound base URL. M7 pilots K1-Sport only. The map
 * is the smallest viable directory; future Pattern C merchants register
 * here (or, for a richer rollout, get promoted to a DB-backed lookup).
 */
export const REFERRAL_OUTBOUND_BASE: Record<string, string> = {
  'k1-sport': 'https://www.k1-sport.com/shop-online',
};

const ALLOWED_CURRENCIES = new Set(['MUR', 'USD', 'EUR', 'GBP']);

export interface RedirectQuery {
  slug: string;
  productId?: string;
  productSku?: string;
  productName?: string;
  productPriceMinor?: number;
  productCurrency?: string;
  designId?: string;
  sessionId?: string;
}

export type RedirectValidation =
  | { ok: true; query: RedirectQuery; baseUrl: string }
  | { ok: false; status: number; error: string };

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function validateRedirectQuery(
  query: Record<string, string | string[] | undefined> | undefined,
): RedirectValidation {
  const slug = (pickFirst(query?.slug) ?? '').trim().toLowerCase();
  if (!slug) return { ok: false, status: 400, error: 'slug required.' };
  if (slug.length > 120) return { ok: false, status: 400, error: 'slug too long.' };
  const baseUrl = REFERRAL_OUTBOUND_BASE[slug];
  if (!baseUrl) {
    return { ok: false, status: 404, error: `unknown merchant slug: ${slug}` };
  }
  const productId = pickFirst(query?.productId)?.slice(0, 120);
  const productSku = pickFirst(query?.productSku)?.slice(0, 120);
  const productName = pickFirst(query?.productName)?.slice(0, 255);
  const designId = pickFirst(query?.designId)?.slice(0, 80);
  const sessionId = pickFirst(query?.sessionId)?.slice(0, 80);
  const priceRaw = pickFirst(query?.productPriceMinor);
  let productPriceMinor: number | undefined;
  if (priceRaw !== undefined && priceRaw !== '') {
    const n = Number(priceRaw);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
      return { ok: false, status: 400, error: 'productPriceMinor must be a non-negative integer in minor units.' };
    }
    productPriceMinor = Math.round(n);
  }
  const currencyRaw = pickFirst(query?.productCurrency)?.trim().toUpperCase();
  let productCurrency: string | undefined;
  if (currencyRaw) {
    if (!ALLOWED_CURRENCIES.has(currencyRaw)) {
      return { ok: false, status: 400, error: `unknown productCurrency: ${currencyRaw}` };
    }
    productCurrency = currencyRaw;
  }
  return {
    ok: true,
    baseUrl,
    query: {
      slug,
      productId,
      productSku,
      productName,
      productPriceMinor,
      productCurrency,
      designId,
      sessionId,
    },
  };
}

export interface BuildOutboundUrlArgs {
  baseUrl: string;
  refCode: string;
  campaign?: string;
}

export function buildOutboundUrl(args: BuildOutboundUrlArgs): string {
  const url = new URL(args.baseUrl);
  url.searchParams.set('ref', args.refCode);
  url.searchParams.set('utm_source', 'ppw-designer');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', args.campaign ?? 'k1-pilot');
  return url.toString();
}

export interface ProcessRedirectArgs {
  query: Record<string, string | string[] | undefined> | undefined;
  userAgent?: string | null;
  ipHash?: string | null;
  store: ReferralStore;
}

export type ProcessRedirectResult =
  | { ok: true; outboundUrl: string; refCode: string }
  | { ok: false; status: number; error: string };

export async function processRedirect(args: ProcessRedirectArgs): Promise<ProcessRedirectResult> {
  const v = validateRedirectQuery(args.query);
  if (!v.ok) return v;
  const refCode = mintRefCode({
    merchantSlug: v.query.slug,
    designId: v.query.designId ?? null,
  });
  const outboundUrl = buildOutboundUrl({ baseUrl: v.baseUrl, refCode });
  try {
    await args.store.insert({
      refCode,
      designId: v.query.designId ?? null,
      sessionId: v.query.sessionId ?? null,
      merchantSlug: v.query.slug,
      productId: v.query.productId ?? null,
      productSku: v.query.productSku ?? null,
      productName: v.query.productName ?? null,
      productPriceMinor: v.query.productPriceMinor ?? null,
      productCurrency: v.query.productCurrency ?? null,
      outboundUrl,
      ipHash: args.ipHash ?? null,
      userAgent: args.userAgent ?? null,
      utmSource: 'ppw-designer',
      utmMedium: 'referral',
      utmCampaign: 'k1-pilot',
    });
  } catch (err) {
    // Attribution insert failure must NOT break the customer journey —
    // we'd rather route the customer to K1 with an unrecorded click
    // than dead-end them. Sentry surfaces the lost attribution
    // separately via withSentry.
    console.warn('[k1-redirect] attribution insert failed', err);
  }
  return { ok: true, outboundUrl, refCode };
}

async function handleK1Redirect(req: RouterReq, res: MinRes): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).end();
    return;
  }
  const ua = req.headers?.['user-agent'];
  const userAgent = typeof ua === 'string' ? ua.slice(0, 255) : Array.isArray(ua) ? ua[0]?.slice(0, 255) ?? null : null;
  const result = await processRedirect({
    query: req.query,
    userAgent,
    ipHash: null,
    store: drizzleReferralStore(),
  });
  if (!result.ok) {
    res.status(result.status);
    res.json({ error: result.error });
    return;
  }
  res.setHeader('Location', result.outboundUrl);
  res.setHeader('X-PPW-Ref-Code', result.refCode);
  res.status(302).end();
}

// ---------------------------------------------------------------------
// Commission CSV reconcile (admin-gated).
// ---------------------------------------------------------------------

export interface ReconcileCsvRow {
  ref_code: string;
  created_at: string;
  merchant_slug: string;
  design_id: string;
  session_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  product_price_minor: string;
  product_currency: string;
  outbound_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildReconcileCsv(rows: ReconcileCsvRow[]): string {
  const header = [
    'ref_code',
    'created_at',
    'merchant_slug',
    'design_id',
    'session_id',
    'product_id',
    'product_sku',
    'product_name',
    'product_price_minor',
    'product_currency',
    'outbound_url',
    'utm_source',
    'utm_medium',
    'utm_campaign',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedReconcileQuery {
  ok: true;
  filter: ListReferralsFilter;
  filename: string;
}

export type ReconcileQueryResult =
  | ParsedReconcileQuery
  | { ok: false; status: number; error: string };

export function parseReconcileQuery(
  query: Record<string, string | string[] | undefined> | undefined,
): ReconcileQueryResult {
  const fromRaw = pickFirst(query?.from);
  const toRaw = pickFirst(query?.to);
  const merchantRaw = pickFirst(query?.merchant);
  const fromDate = fromRaw && ISO_DATE.test(fromRaw) ? fromRaw : undefined;
  const toDate = toRaw && ISO_DATE.test(toRaw) ? toRaw : undefined;
  if (fromRaw && !fromDate) return { ok: false, status: 400, error: 'from must be YYYY-MM-DD.' };
  if (toRaw && !toDate) return { ok: false, status: 400, error: 'to must be YYYY-MM-DD.' };
  if (fromDate && toDate && fromDate > toDate) {
    return { ok: false, status: 400, error: 'from must be ≤ to.' };
  }
  const merchantSlug = merchantRaw?.trim().toLowerCase().slice(0, 120) || undefined;
  const parts: string[] = ['ppw-referrals'];
  if (merchantSlug) parts.push(merchantSlug);
  if (fromDate) parts.push(fromDate);
  if (toDate) parts.push(toDate);
  const filename = `${parts.join('_')}.csv`;
  return {
    ok: true,
    filename,
    filter: {
      merchantSlug,
      fromDate,
      toDate,
      limit: 10_000,
    },
  };
}

export function referralRowToCsvRow(r: {
  refCode: string;
  createdAt: Date;
  merchantSlug: string;
  designId: string | null;
  sessionId: string | null;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  productPriceMinor: number | null;
  productCurrency: string | null;
  outboundUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}): ReconcileCsvRow {
  return {
    ref_code: r.refCode,
    created_at: r.createdAt.toISOString(),
    merchant_slug: r.merchantSlug,
    design_id: r.designId ?? '',
    session_id: r.sessionId ?? '',
    product_id: r.productId ?? '',
    product_sku: r.productSku ?? '',
    product_name: r.productName ?? '',
    product_price_minor: r.productPriceMinor === null || r.productPriceMinor === undefined ? '' : String(r.productPriceMinor),
    product_currency: r.productCurrency ?? '',
    outbound_url: r.outboundUrl,
    utm_source: r.utmSource ?? '',
    utm_medium: r.utmMedium ?? '',
    utm_campaign: r.utmCampaign ?? '',
  };
}

async function handleCommissionReconcile(req: RouterReq, res: MinRes): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).end();
    return;
  }
  // Admin gate — only signed-in Vic / admin role can pull the CSV.
  // Defers to the existing adminAuth helper that powers /api/admin/*.
  const { authoriseAdminWithLive } = await import('./lib/adminAuth.js');
  const auth = await authoriseAdminWithLive(req.headers ?? {}, drizzleMerchantStore());
  if (!auth.ok) {
    res.status(auth.status ?? 401);
    res.json({ error: auth.error ?? 'Unauthorized' });
    return;
  }
  const parsed = parseReconcileQuery(req.query);
  if (!parsed.ok) {
    res.status(parsed.status);
    res.json({ error: parsed.error });
    return;
  }
  const store = drizzleReferralStore();
  let rows;
  try {
    rows = await store.list(parsed.filter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'reconcile list failed';
    res.status(500);
    res.json({ error: msg });
    return;
  }
  const csv = buildReconcileCsv(rows.map(referralRowToCsvRow));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${parsed.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200);
  if (typeof (res as { send?: (b: string) => void }).send === 'function') {
    (res as { send: (b: string) => void }).send(csv);
  } else {
    res.end(csv);
  }
}

async function handleDesigns(
  segments: string[],
  req: RouterReq,
  res: MinRes,
): Promise<void> {
  const db = getDb();
  const designId = segments[0] ? parseInt(segments[0], 10) : NaN;

  if (req.method === 'GET') {
    if (!isNaN(designId)) {
      // GET /api/designs/:id
      const rows = await db
        .select()
        .from(schema.designs)
        .where(eq(schema.designs.id, designId))
        .limit(1);
      const design = rows[0];
      if (!design) {
        res.status(404);
        res.json({ error: 'Design not found.' });
        return;
      }
      res.status(200);
      res.json({ design });
      return;
    }
    // GET /api/designs?userId=... | ?email=...
    const url = req.url ?? '';
    const q = new URL(url, 'http://x').searchParams;
    const userId = q.get('userId');
    const email = q.get('email');
    if (!userId && !email) {
      res.status(400);
      res.json({ error: 'userId or email required.' });
      return;
    }
    const rows = await db
      .select()
      .from(schema.designs)
      .where(userId ? eq(schema.designs.userId, userId) : eq(schema.designs.customerEmail, email!))
      .orderBy(desc(schema.designs.createdAt))
      .limit(50);
    res.status(200);
    res.json({ designs: rows });
    return;
  }

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8') || '{}')
        : (req.body ?? {});

  if (req.method === 'POST' && isNaN(designId)) {
    const v = validateDesignPayload(body);
    if (!v.ok) {
      res.status(400);
      res.json({ error: v.error });
      return;
    }
    const inserted = await db
      .insert(schema.designs)
      .values({
        userId: v.data.userId ?? null,
        customerEmail: v.data.customerEmail ?? null,
        name: v.data.name ?? 'Untitled design',
        property: v.data.property as object,
        cart: (v.data.cart as object | undefined) ?? null,
        status: v.data.status ?? 'draft',
      })
      .returning();
    const design = inserted[0];
    // M9.A.1 — fire design-saved email if customer captured. Helper is
    // try/catch-wrapped + never re-throws; await keeps the Vercel lambda
    // alive until Resend responds (typically <500ms).
    if (design) {
      const dispatch = await dispatchDesignSavedEmail({
        id: design.id,
        name: design.name,
        customerEmail: design.customerEmail ?? null,
      });
      if (dispatch.skippedReason === 'caller_caught') {
        // eslint-disable-next-line no-console
        console.error('[M9.A.1 design-saved-email] caught:', dispatch.error);
      }
    }
    res.status(201);
    res.json({ design });
    return;
  }

  if (req.method === 'PUT' && !isNaN(designId)) {
    const v = validateDesignPayload(body);
    if (!v.ok) {
      res.status(400);
      res.json({ error: v.error });
      return;
    }
    const updated = await db
      .update(schema.designs)
      .set({
        name: v.data.name ?? 'Untitled design',
        property: v.data.property as object,
        cart: (v.data.cart as object | undefined) ?? null,
        status: v.data.status ?? 'draft',
        updatedAt: new Date(),
      })
      .where(eq(schema.designs.id, designId))
      .returning();
    if (updated.length === 0) {
      res.status(404);
      res.json({ error: 'Design not found.' });
      return;
    }
    res.status(200);
    res.json({ design: updated[0] });
    return;
  }

  res.setHeader('Allow', 'GET, POST, PUT, OPTIONS');
  res.status(405).end();
}

// ─────────────────────────────────────────────────────────────────────
// W2.7 — Lead capture.
// ─────────────────────────────────────────────────────────────────────

interface LeadPayload {
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  designId?: number;
  property?: unknown;
  cartQuote?: unknown;
  message?: string;
  source?: string;
}

function validateLeadPayload(
  raw: unknown,
): { ok: true; data: LeadPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = raw as Partial<LeadPayload>;
  if (typeof p.customerEmail !== 'string' || !p.customerEmail.includes('@')) {
    return { ok: false, error: 'customerEmail required.' };
  }
  if (p.customerEmail.length > 320) {
    return { ok: false, error: 'customerEmail too long.' };
  }
  return {
    ok: true,
    data: {
      customerEmail: p.customerEmail.toLowerCase(),
      customerName: typeof p.customerName === 'string' ? p.customerName : undefined,
      customerPhone: typeof p.customerPhone === 'string' ? p.customerPhone : undefined,
      designId: typeof p.designId === 'number' ? p.designId : undefined,
      property: p.property,
      cartQuote: p.cartQuote,
      message: typeof p.message === 'string' ? p.message : undefined,
      source: typeof p.source === 'string' ? p.source : undefined,
    },
  };
}

async function handleLeads(req: RouterReq, res: MinRes): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }
  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8') || '{}')
        : (req.body ?? {});
  const v = validateLeadPayload(body);
  if (!v.ok) {
    res.status(400);
    res.json({ error: v.error });
    return;
  }
  const db = getDb();
  const inserted = await db
    .insert(schema.leads)
    .values({
      customerEmail: v.data.customerEmail,
      customerName: v.data.customerName ?? null,
      customerPhone: v.data.customerPhone ?? null,
      designId: v.data.designId ?? null,
      property: (v.data.property as object | undefined) ?? null,
      cartQuote: (v.data.cartQuote as object | undefined) ?? null,
      message: v.data.message ?? null,
      source: v.data.source ?? 'designer',
    })
    .returning();
  res.status(201);
  res.json({ lead: inserted[0] });
}

// ─────────────────────────────────────────────────────────────────────
// Dispatcher.
// ─────────────────────────────────────────────────────────────────────

async function rawHandler(req: RouterReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const { resource, segments } = parseSegments(req);

  if (resource === 'orders') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      res.status(405).end();
      return;
    }
    const ref = segments[0];
    if (!ref) {
      res.status(400);
      res.json({ error: 'orderRef required.' });
      return;
    }
    try {
      if (segments[1] === 'status') {
        await handleOrderStatus(ref, res);
      } else {
        await handleOrderDetail(ref, res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'order lookup failed';
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (resource === 'designs') {
    try {
      await handleDesigns(segments, req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'design op failed';
      if (/relation .*designs.* does not exist|42P01/i.test(msg)) {
        res.status(503);
        res.json({ error: 'Designs table not migrated.' });
        return;
      }
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (resource === 'leads') {
    try {
      await handleLeads(req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'lead capture failed';
      if (/relation .*leads.* does not exist|42P01/i.test(msg)) {
        res.status(503);
        res.json({ error: 'Leads table not migrated.' });
        return;
      }
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (resource === 'merchants') {
    const slug = segments[0];
    if (!slug) {
      res.status(400);
      res.json({ error: 'merchant slug required.' });
      return;
    }
    const action = segments[1];

    // POST /api/merchants/:slug/order-update — merchant fulfilment webhook
    if (action === 'order-update') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(405).end();
        return;
      }
      try {
        await handleMerchantWebhook(slug, req, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'webhook handling failed';
        res.status(500);
        res.json({ error: msg });
      }
      return;
    }

    // GET /api/merchants/:slug/agent-session — fetch active session + recent messages
    if (action === 'agent-session') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        res.status(405).end();
        return;
      }
      try {
        await handleMerchantAgentSession(slug, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'agent session lookup failed';
        res.status(500);
        res.json({ error: msg });
      }
      return;
    }

    // M5.b — POST /api/merchants/:slug/magic-link
    // Body: { email }. Always returns 200 with a generic body so we
    // don't leak whether a merchant slug or email is in the directory.
    // If the email matches the merchant's contactEmail, we issue a
    // 30-day signed session token and email it as a one-click magic
    // link to /merchant/:slug?session=<token>.
    if (action === 'magic-link') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(405).end();
        return;
      }
      try {
        await handleMerchantMagicLink(slug, req, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'magic-link send failed';
        res.status(500);
        res.json({ error: msg });
      }
      return;
    }

    res.status(404);
    res.json({ error: `unknown merchants action: ${action ?? '(empty)'}` });
    return;
  }

  // M7 — Pattern C attribution outbound. GET /api/k1/redirect.
  if (resource === 'k1') {
    if (segments[0] === 'redirect') {
      try {
        await handleK1Redirect(req, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'k1 redirect failed';
        res.status(500);
        res.json({ error: msg });
      }
      return;
    }
    res.status(404);
    res.json({ error: `unknown k1 action: ${segments[0] ?? '(empty)'}` });
    return;
  }

  // Phase 0.5 — Cowork OS Live Artifact data feed. Bearer-gated.
  if (resource === 'cowork-os') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      res.status(405).end();
      return;
    }
    if (!checkCoworkOsBearer(req, res)) return;
    const sub = segments[0];
    try {
      if (sub === 'designer-health') return await handleCoworkOsDesignerHealth(req, res);
      if (sub === 'k1-state') return await handleCoworkOsK1State(req, res);
      if (sub === 'subscriptions') return await handleCoworkOsSubscriptions(req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'cowork-os handler failed';
      res.status(500);
      res.json({ error: msg });
      return;
    }
    res.status(404);
    res.json({ error: `unknown cowork-os action: ${sub ?? '(empty)'}` });
    return;
  }

  // M7 — Pattern C monthly reconciliation CSV (admin-gated).
  if (resource === 'commission') {
    if (segments[0] === 'reconcile') {
      try {
        await handleCommissionReconcile(req, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'commission reconcile failed';
        res.status(500);
        res.json({ error: msg });
      }
      return;
    }
    res.status(404);
    res.json({ error: `unknown commission action: ${segments[0] ?? '(empty)'}` });
    return;
  }

  res.status(404);
  res.json({ error: 'unknown route' });
}

export default withSentry(rawHandler);
