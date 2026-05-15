/**
 * Catch-all orders router — single Vercel function for /api/orders/*
 * and /api/merchants/:id/order-update.
 *
 * Wave 1.3 (customer tracking) + Wave 1.4 (merchant webhook). One
 * lambda covers both surfaces — vercel.json rewrites both URL shapes
 * to this file.
 *
 * Routes handled (resolved by URL parse, since query.slug is only
 * populated when Vercel does the rewrite via vercel.json):
 *   GET    /api/orders/:ref                  → order detail (orders + order_items + latest events)
 *   GET    /api/orders/:ref/status           → polled status only (cheap)
 *   POST   /api/merchants/:slug/order-update → merchant fulfilment webhook (HMAC-verified)
 */

import { eq, desc, inArray } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'crypto';
import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import { getDb, schema } from './db/client.js';
import { aggregateOrderStatus, isValidTransition, type OrderEventType } from './lib/order-status.js';
import { Redis } from '@upstash/redis';

interface RouterReq extends MinReq {
  body?: unknown;
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

    res.status(404);
    res.json({ error: `unknown merchants action: ${action ?? '(empty)'}` });
    return;
  }

  res.status(404);
  res.json({ error: 'unknown route' });
}

export default withSentry(rawHandler);
