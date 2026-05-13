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
 * Migrations live next to this file in `api/db/migrations/*.sql`.
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
} from 'drizzle-orm/pg-core';

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
