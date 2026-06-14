import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { merchants, merchantDocuments, admins, merchantStatusEnum } from '../db/schema';

/**
 * The schema module must import cleanly (drizzle-orm resolved, all
 * pg-core helpers present) and expose the columns / enum values the
 * rest of the code depends on. This test deliberately stays at the
 * structural level — round-trip persistence tests sit behind the Neon
 * driver and run from `scripts/migrate.ts` against a real DB.
 */

describe('merchants schema', () => {
  it('exposes the canonical column set', () => {
    const cols = Object.keys(getTableColumns(merchants)).sort();
    const expected = [
      'approvedAt',
      'approvedBy',
      'brandName',
      'businessName',
      'contactEmail',
      'contactName',
      'contactPhone',
      'country',
      'createdAt',
      'estimatedMonthlyVolume',
      'goLiveAt',
      'id',
      'kycStatus',
      'notes',
      'onboardingStep',
      'payoutMethod',
      'productCategories',
      'referralNotes',
      'rejectedAt',
      'rejectedReason',
      'slug',
      'status',
      'stripeConnectAccountId',
      'updatedAt',
      'webhookSecret',
      'website',
    ].sort();
    expect(cols).toEqual(expected);
  });

  it('locks the status enum order — matches the SQL migration', () => {
    const values = (merchantStatusEnum as unknown as { enumValues: string[] }).enumValues;
    expect(values).toEqual([
      'pending_signup',
      'awaiting_kyc',
      'kyc_complete',
      'pending_admin_approval',
      'approved',
      'rejected',
      'suspended',
    ]);
  });
});

describe('merchant_documents schema', () => {
  it('exposes the expected columns', () => {
    const cols = Object.keys(getTableColumns(merchantDocuments)).sort();
    expect(cols).toEqual(['blobUrl', 'docType', 'id', 'merchantId', 'uploadedAt'].sort());
  });
});

describe('admins schema', () => {
  it('exposes the expected columns', () => {
    const cols = Object.keys(getTableColumns(admins)).sort();
    expect(cols).toEqual(['clerkUserId', 'createdAt', 'email', 'id', 'role'].sort());
  });
});
