/**
 * OMS Phase 1 — Drizzle schema for marketplace merchants.
 *
 * Tables:
 *   - merchants            : every applicant + approved supplier
 *   - merchant_documents   : KYC / proof uploads per merchant
 *   - admins               : Clerk users authorised for /admin
 *
 * The status enum tracks merchant lifecycle:
 *   pending_signup        : freshly inserted (Stripe Connect MU still gated → manual followup)
 *   awaiting_kyc          : Stripe Connect account created, merchant redirected to Stripe-hosted KYC
 *   kyc_complete          : Stripe webhook reports details_submitted + charges_enabled
 *   pending_admin_approval: webhook flipped status (alias of kyc_complete once Vic notified) — split out for queue clarity
 *   approved              : Vic clicked Approve in /admin
 *   rejected              : Vic clicked Reject (with reason in notes)
 *   suspended             : auto-suspended (Phase 8) or manual admin action
 *
 * Migrations live next to this file in `api/_db/migrations/*.sql`.
 * Apply via `scripts/migrate.ts` (uses @neondatabase/serverless).
 *
 * Phase 1 chooses Drizzle over Prisma for:
 *   - Smaller serverless cold-start footprint (no Prisma engine binary).
 *   - First-class Neon HTTP driver compatibility.
 *   - Schema-as-TypeScript without a separate codegen step.
 */

import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  pgEnum,
  integer,
  uniqueIndex,
  index,
  bigint,
  bigserial,
  jsonb,
  boolean,
  numeric,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const merchantStatusEnum = pgEnum('merchant_status', [
  'pending_signup',
  'awaiting_kyc',
  'kyc_complete',
  'pending_admin_approval',
  'approved',
  'rejected',
  'suspended',
]);

export const merchantDocumentTypeEnum = pgEnum('merchant_document_type', [
  'distributor_agreement',
  'invoice',
  'business_registration',
  'other',
]);

export const adminRoleEnum = pgEnum('admin_role', ['super_admin', 'reviewer']);

export const merchants = pgTable(
  'merchants',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull(),
    businessName: varchar('business_name', { length: 200 }).notNull(),
    brandName: varchar('brand_name', { length: 200 }).notNull(),
    contactName: varchar('contact_name', { length: 200 }).notNull(),
    contactEmail: varchar('contact_email', { length: 320 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 40 }).notNull(),
    country: varchar('country', { length: 4 }).notNull().default('MU'),
    website: varchar('website', { length: 500 }),
    productCategories: text('product_categories').notNull(), // comma-separated; Phase 2 → jsonb array
    estimatedMonthlyVolume: varchar('estimated_monthly_volume', { length: 80 }),
    referralNotes: text('referral_notes'),
    stripeConnectAccountId: varchar('stripe_connect_account_id', { length: 80 }),
    /** OMS Wave 1.4 — HMAC shared secret for /api/merchants/:slug/order-update. Null until Vic approves. */
    webhookSecret: varchar('webhook_secret', { length: 64 }),
    status: merchantStatusEnum('status').notNull().default('pending_signup'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: varchar('approved_by', { length: 320 }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedReason: text('rejected_reason'),
  },
  (t) => ({
    slugIdx: uniqueIndex('merchants_slug_idx').on(t.slug),
    contactEmailIdx: index('merchants_contact_email_idx').on(t.contactEmail),
    statusIdx: index('merchants_status_idx').on(t.status),
    stripeAcctIdx: index('merchants_stripe_acct_idx').on(t.stripeConnectAccountId),
  }),
);

export const merchantDocuments = pgTable(
  'merchant_documents',
  {
    id: serial('id').primaryKey(),
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    docType: merchantDocumentTypeEnum('doc_type').notNull(),
    blobUrl: varchar('blob_url', { length: 1000 }).notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantIdx: index('merchant_documents_merchant_idx').on(t.merchantId),
  }),
);

export const admins = pgTable(
  'admins',
  {
    id: serial('id').primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 80 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    role: adminRoleEnum('role').notNull().default('reviewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clerkIdIdx: uniqueIndex('admins_clerk_user_id_idx').on(t.clerkUserId),
    emailIdx: uniqueIndex('admins_email_idx').on(t.email),
  }),
);

// Convenience exports for inserts/selects.
export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type MerchantStatus = Merchant['status'];

export type MerchantDocument = typeof merchantDocuments.$inferSelect;
export type NewMerchantDocument = typeof merchantDocuments.$inferInsert;

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

// ─────────────────────────────────────────────────────────────────────
// OMS Phase 2 — admin portal additions.
//
// payout_queue: rows scheduled for batch payout to merchants. Phase 4
// will wire the actual disbursement worker; Phase 2 ships the table +
// admin viewer.
//
// audit_log: every admin-initiated mutation gets a row. Used for the
// admin activity feed and forensic queries.
// ─────────────────────────────────────────────────────────────────────


export const payoutStatusEnum = pgEnum('payout_status', [
  'queued',
  'processing',
  'sent',
  'failed',
]);

export const paymentRailEnum = pgEnum('payment_rail', [
  'stripe',
  'paypal',
  'mips',
  'mcb_juice',
  'bank_transfer',
]);

export const payoutQueue = pgTable(
  'payout_queue',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: bigint('merchant_id', { mode: 'number' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    amountMinor: integer('amount_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    rail: paymentRailEnum('rail').notNull(),
    status: payoutStatusEnum('status').notNull().default('queued'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    externalPayoutId: varchar('external_payout_id', { length: 120 }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('payout_queue_status_idx').on(t.status, t.scheduledFor),
    merchantIdx: index('payout_queue_merchant_idx').on(t.merchantId),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorEmail: varchar('actor_email', { length: 320 }).notNull(),
    action: varchar('action', { length: 120 }).notNull(),
    targetType: varchar('target_type', { length: 80 }).notNull(),
    targetId: varchar('target_id', { length: 120 }).notNull(),
    reason: text('reason'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('audit_log_actor_idx').on(t.actorEmail, t.createdAt),
    targetIdx: index('audit_log_target_idx').on(t.targetType, t.targetId),
  }),
);

export type PayoutQueueRow = typeof payoutQueue.$inferSelect;
export type NewPayoutQueueRow = typeof payoutQueue.$inferInsert;
export type PayoutStatus = PayoutQueueRow['status'];
export type PaymentRail = PayoutQueueRow['rail'];

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;

// ─────────────────────────────────────────────────────────────────────
// OMS Phase 1.5 — payment rails + webhook idempotency.
//
// orders: multi-rail order ledger (PayPal, Stripe, MIPS, MCB Juice, etc.)
// webhook_events: dedupe table for idempotent webhook processing
// ─────────────────────────────────────────────────────────────────────

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'authorised',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
]);

export const orders = pgTable(
  'orders',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ppwOrderId: varchar('ppw_order_id', { length: 120 }).notNull().unique(),
    customerEmail: varchar('customer_email', { length: 320 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    totalMinor: integer('total_minor').notNull(),
    paymentRail: paymentRailEnum('payment_rail').notNull(),
    paymentRailOrderId: varchar('payment_rail_order_id', { length: 120 }),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    customerEmailIdx: index('orders_customer_email_idx').on(t.customerEmail),
    paymentRailIdx: index('orders_payment_rail_idx').on(t.paymentRail, t.paymentStatus),
  }),
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    source: varchar('source', { length: 40 }).notNull(),
    eventId: varchar('event_id', { length: 120 }).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processed: boolean('processed').notNull().default(false),
    processingError: text('processing_error'),
    payload: jsonb('payload').notNull(),
  },
  (t) => ({
    sourceEventUnique: uniqueIndex('webhook_events_source_event_unique').on(t.source, t.eventId),
    unprocessedIdx: index('webhook_events_unprocessed_idx').on(t.processed, t.receivedAt),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type PaymentStatus = Order['paymentStatus'];

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

// ─────────────────────────────────────────────────────────────────────
// OMS Phase 3 — product catalog + suppliers.
//
// products: per-merchant catalog rows. Stored in metric units so that
//   future phases (Phase 8 designer) can place them on the canvas.
// suppliers: fulfilment-side records under each merchant. 1:N for now;
//   Phase 4 may flatten to N:M when dropship lands.
// supplier_products: m:n linking — which supplier fulfils which product
//   at what cost + lead time.
// ─────────────────────────────────────────────────────────────────────

export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'active',
  'archived',
  'out_of_stock',
]);

// V4 W0.D.2 — eco-cert tier ENUM (V4-DA-1 CLOSED).
export const ecoCertLevelEnum = pgEnum('eco_cert_level', [
  'none',
  'self-declared',
  'third-party-claimed',
  'verified-certified',
]);

export const supplierStatusEnum = pgEnum('supplier_status', [
  'pending',
  'active',
  'suspended',
]);

export const suppliers = pgTable(
  'suppliers',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: bigint('merchant_id', { mode: 'number' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    contactEmail: varchar('contact_email', { length: 320 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 40 }),
    country: varchar('country', { length: 2 }).notNull(),
    status: supplierStatusEnum('status').notNull().default('pending'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantNameUnique: uniqueIndex('suppliers_merchant_name_idx').on(t.merchantId, t.name),
    merchantIdx: index('suppliers_merchant_idx').on(t.merchantId),
  }),
);

export const products = pgTable(
  'products',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: bigint('merchant_id', { mode: 'number' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    description: text('description'),
    widthMm: integer('width_mm'),
    depthMm: integer('depth_mm'),
    heightMm: integer('height_mm'),
    weightG: integer('weight_g'),
    priceMinor: integer('price_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    imageUrl: varchar('image_url', { length: 500 }),
    status: productStatusEnum('status').notNull().default('draft'),
    region: varchar('region', { length: 40 }),
    // V4 W0.D.2 — catalog-filter columns (DA §02 + ME §03 refinements).
    ecoCertLevel: ecoCertLevelEnum('eco_cert_level').notNull().default('none'),
    inStockQty: integer('in_stock_qty').notNull().default(0),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    supplierRating: integer('supplier_rating'),
    // V4 W0.D.9 — supplier_rating refresh watermark (refresh-supplier-rating cron).
    supplierRatingRefreshedAt: timestamp('supplier_rating_refreshed_at', { withTimezone: true }),
    // Sims-Parity DT-01 — Konva GL1.04 vs GL1.04b shadow-path gate.
    photoAlphaClean: boolean('photo_alpha_clean').notNull().default(false),
    // Sims-Parity DT-01 — FK to active capture audit row. NULL = legacy / pre-capture.
    captureScaleLockId: uuid('capture_scale_lock_id').references(
      () => productCaptureScaleLocks.scaleLockId,
      { onDelete: 'set null' },
    ),
    // Sims-Parity DT-26 — per-SKU hero-glTF flag. V8=NO so default
    // stays FALSE forever until external 3D artist spend unblocks.
    useGltf: boolean('use_gltf').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantSkuUnique: uniqueIndex('products_merchant_sku_idx').on(t.merchantId, t.sku),
    merchantStatusIdx: index('products_merchant_status_idx').on(t.merchantId, t.status),
    categoryStatusIdx: index('products_category_status_idx').on(t.category, t.status),
    // V4 W0.D.2 — composite partial catalog-filter index (full DESC NULLS LAST +
    // WHERE predicate lives in the SQL migration; Drizzle entry here exists for
    // type inference + the W0.D.7 schema-mirror metadata path).
    catalogFilterIdx: index('products_catalog_filter_idx').on(
      t.status,
      t.ecoCertLevel,
      t.supplierRating,
      t.priceMinor,
    ),
    captureScaleLockIdx: index('products_capture_scale_lock_idx').on(t.captureScaleLockId),
  }),
);

// ─────────────────────────────────────────────────────────────────────
// Sims-Parity DT-01 — capture scale-lock audit table (migration 0024).
//
// One row per accepted phone-capture session. Anchors a HMAC-signed
// pixels-per-mm + RMS error + path tag for every merchant product photo.
// The row is never hard-deleted; VC-2 lifecycle is invalidated_at +
// invalidation_reason set on dim-edit without re-capture (DT-09).
//
// silhouette_bbox_px is stored JSONB-nullable so DT-11 GL1.01b crop can
// read it via the products → scale-lock FK without denormalising.
// Shape: { x: int, y: int, width: int, height: int } (pixels).
// ─────────────────────────────────────────────────────────────────────

export const capturePathEnum = pgEnum('capture_path', [
  'a4-corner-tap',
  'aruco',
  'webxr-plane',
]);

export const productCaptureScaleLocks = pgTable(
  'product_capture_scale_locks',
  {
    scaleLockId: uuid('scale_lock_id').primaryKey().default(sql`gen_random_uuid()`),
    merchantId: bigint('merchant_id', { mode: 'number' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    path: capturePathEnum('path').notNull(),
    pixelsPerMm: numeric('pixels_per_mm', { precision: 10, scale: 4 }).notNull(),
    rmsCalibrationError: numeric('rms_calibration_error', { precision: 10, scale: 4 }).notNull(),
    hmacSignature: varchar('hmac_signature', { length: 128 }).notNull(),
    silhouetteBboxPx: jsonb('silhouette_bbox_px'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
    invalidationReason: varchar('invalidation_reason', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantIdx: index('pcsl_merchant_idx').on(t.merchantId, t.createdAt),
    activeIdx: index('pcsl_active_idx').on(t.merchantId),
  }),
);

export type ProductCaptureScaleLock = typeof productCaptureScaleLocks.$inferSelect;
export type NewProductCaptureScaleLock = typeof productCaptureScaleLocks.$inferInsert;
export type CapturePath = ProductCaptureScaleLock['path'];

export const supplierProducts = pgTable(
  'supplier_products',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    supplierId: bigint('supplier_id', { mode: 'number' })
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    supplierSku: varchar('supplier_sku', { length: 80 }),
    costMinor: integer('cost_minor').notNull(),
    costCurrency: varchar('cost_currency', { length: 3 }).notNull(),
    leadTimeDays: integer('lead_time_days').notNull().default(7),
    primarySupplier: boolean('primary_supplier').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    supplierProductUnique: uniqueIndex('supplier_products_supplier_product_idx').on(
      t.supplierId,
      t.productId,
    ),
    productIdx: index('supplier_products_product_idx').on(t.productId),
  }),
);

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplierStatus = Supplier['status'];

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductStatus = Product['status'];

export type SupplierProduct = typeof supplierProducts.$inferSelect;
export type NewSupplierProduct = typeof supplierProducts.$inferInsert;

// ─────────────────────────────────────────────────────────────────────
// OMS Phase 4 — marketplace order_items.
//
// Per-supplier line items for orders. Customer pays the orders.total_minor
// via PayPal Standard (or future MIPS/MCB Juice/PayPal Marketplaces);
// each order_items row tracks the per-merchant + per-supplier slice for
// payout disbursement.
// ─────────────────────────────────────────────────────────────────────

export const orderItems = pgTable(
  'order_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    merchantId: bigint('merchant_id', { mode: 'number' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'restrict' }),
    supplierId: bigint('supplier_id', { mode: 'number' }).references(() => suppliers.id, { onDelete: 'set null' }),
    productId: bigint('product_id', { mode: 'number' }).references(() => products.id, { onDelete: 'set null' }),
    sku: varchar('sku', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: integer('unit_price_minor').notNull(),
    lineTotalMinor: integer('line_total_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    payoutStatus: payoutStatusEnum('payout_status').notNull().default('queued'),
    payoutId: bigint('payout_id', { mode: 'number' }).references(() => payoutQueue.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('order_items_order_idx').on(t.orderId),
    merchantStatusIdx: index('order_items_merchant_idx').on(t.merchantId, t.payoutStatus),
    supplierIdx: index('order_items_supplier_idx').on(t.supplierId),
    payoutIdx: index('order_items_payout_idx').on(t.payoutId),
  }),
);

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// ─────────────────────────────────────────────────────────────────────
// OMS Phase 5 — order fulfilment events.
// ─────────────────────────────────────────────────────────────────────

export const orderEventTypeEnum = pgEnum('order_event_type', [
  'confirmed',
  'shipped',
  'in_transit',
  'delivered',
  'returned',
  'failed',
]);

export const orderItemEvents = pgTable(
  'order_item_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderItemId: bigint('order_item_id', { mode: 'number' })
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    eventType: orderEventTypeEnum('event_type').notNull(),
    trackingNumber: varchar('tracking_number', { length: 120 }),
    carrier: varchar('carrier', { length: 80 }),
    note: text('note'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemIdx: index('order_item_events_item_idx').on(t.orderItemId, t.createdAt),
    typeIdx: index('order_item_events_type_idx').on(t.eventType),
  }),
);

export type OrderItemEvent = typeof orderItemEvents.$inferSelect;
export type NewOrderItemEvent = typeof orderItemEvents.$inferInsert;
export type OrderEventType = OrderItemEvent['eventType'];

// ─────────────────────────────────────────────────────────────────────
// OMS Wave 1.5 — Merchant Integration Agent session persistence.
//
// Stores per-session running cost so the admin dashboard can track
// $50/mo OpenRouter cap per oms_merchant_agent_stack.md.
// Cost stored in micro-dollars (1e-6 USD) to dodge float drift.
// ─────────────────────────────────────────────────────────────────────

export const agentModelEnum = pgEnum('agent_model', ['gemini-flash', 'claude-sonnet']);

export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: bigint('merchant_id', { mode: 'number' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    topic: varchar('topic', { length: 200 }).notNull().default('onboarding'),
    status: varchar('status', { length: 40 }).notNull().default('active'),
    totalCostMicroUsd: bigint('total_cost_micro_usd', { mode: 'number' }).notNull().default(0),
    geminiCostMicroUsd: bigint('gemini_cost_micro_usd', { mode: 'number' }).notNull().default(0),
    sonnetCostMicroUsd: bigint('sonnet_cost_micro_usd', { mode: 'number' }).notNull().default(0),
    totalInputTokens: bigint('total_input_tokens', { mode: 'number' }).notNull().default(0),
    totalOutputTokens: bigint('total_output_tokens', { mode: 'number' }).notNull().default(0),
    messageCount: integer('message_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantIdx: index('agent_sessions_merchant_idx').on(t.merchantId, t.createdAt),
    statusIdx: index('agent_sessions_status_idx').on(t.status),
  }),
);

export const agentMessages = pgTable(
  'agent_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sessionId: bigint('session_id', { mode: 'number' })
      .notNull()
      .references(() => agentSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    modelUsed: agentModelEnum('model_used'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costMicroUsd: bigint('cost_micro_usd', { mode: 'number' }),
    fallbackReason: text('fallback_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('agent_messages_session_idx').on(t.sessionId, t.createdAt),
  }),
);

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;

// ─────────────────────────────────────────────────────────────────────
// OMS Wave 2.6 + 2.7 — Designer save/load + lead capture.
// ─────────────────────────────────────────────────────────────────────

export const designs = pgTable(
  'designs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: varchar('user_id', { length: 80 }),
    customerEmail: varchar('customer_email', { length: 320 }),
    name: varchar('name', { length: 200 }).notNull().default('Untitled design'),
    property: jsonb('property').notNull(),
    cart: jsonb('cart'),
    status: varchar('status', { length: 40 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('designs_user_idx').on(t.userId, t.createdAt),
    emailIdx: index('designs_email_idx').on(t.customerEmail, t.createdAt),
  }),
);

export const leads = pgTable(
  'leads',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    customerEmail: varchar('customer_email', { length: 320 }).notNull(),
    customerName: varchar('customer_name', { length: 200 }),
    customerPhone: varchar('customer_phone', { length: 40 }),
    designId: bigint('design_id', { mode: 'number' }).references(() => designs.id, {
      onDelete: 'set null',
    }),
    property: jsonb('property'),
    cartQuote: jsonb('cart_quote'),
    message: text('message'),
    source: varchar('source', { length: 80 }).notNull().default('designer'),
    status: varchar('status', { length: 40 }).notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index('leads_email_idx').on(t.customerEmail, t.createdAt),
    statusIdx: index('leads_status_idx').on(t.status, t.createdAt),
  }),
);

export type Design = typeof designs.$inferSelect;
export type NewDesign = typeof designs.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

// M7 (RELENTLESS_GOAL 2026-05-19) — Pattern C attribution layer.
// One row per outbound click from the designer to a merchant's
// external storefront. The product_* + price_* columns are
// intentionally denormalised — the referral row is self-contained for
// monthly reconciliation even if the catalogue entry later changes.
export const designerReferrals = pgTable(
  'designer_referrals',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    refCode: varchar('ref_code', { length: 80 }).notNull().unique(),
    designId: varchar('design_id', { length: 80 }),
    sessionId: varchar('session_id', { length: 80 }),
    merchantSlug: varchar('merchant_slug', { length: 120 }).notNull(),
    productId: varchar('product_id', { length: 120 }),
    productSku: varchar('product_sku', { length: 120 }),
    productName: varchar('product_name', { length: 255 }),
    productPriceMinor: integer('product_price_minor'),
    productCurrency: varchar('product_currency', { length: 8 }),
    outboundUrl: text('outbound_url').notNull(),
    ipHash: varchar('ip_hash', { length: 80 }),
    userAgent: varchar('user_agent', { length: 255 }),
    utmSource: varchar('utm_source', { length: 80 }),
    utmMedium: varchar('utm_medium', { length: 80 }),
    utmCampaign: varchar('utm_campaign', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantCreatedIdx: index('designer_referrals_merchant_created_idx').on(t.merchantSlug, t.createdAt),
    designIdx: index('designer_referrals_design_idx').on(t.designId),
  }),
);

export type DesignerReferral = typeof designerReferrals.$inferSelect;
export type NewDesignerReferral = typeof designerReferrals.$inferInsert;

// V4 W0.D.1 — migration tracking table (ME §03.5 / V4-ME-1 CLOSED 2026-05-16).
// Drizzle entry kept for the schema-mirror parity check; the table itself is
// owned + populated by scripts/migrate.ts, not by application code.
export const schemaMigrations = pgTable('schema_migrations', {
  version: varchar('version', { length: 40 }).primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
});
