/**
 * Pure-business-logic core for the Phase 1 admin merchant actions:
 *   - list pending merchants
 *   - approve
 *   - reject
 *
 * Vercel handlers in `api/admin/*` wire dependencies (auth, store,
 * emails) and call these functions. Tests inject fakes.
 *
 * Phase 1 is a STUB — listing only surfaces `pending_admin_approval`
 * merchants (the Stripe-cleared queue). Phase 2 will expand to a full
 * portal with filters/search, audit log, and bulk actions.
 */

import type { Merchant, MerchantStatus } from '../db/schema';
import type { MerchantStore } from '../db/merchantStore';
import {
  emailMerchantApproved,
  emailMerchantRejected,
  type SendResult,
} from './merchantEmails';

const PENDING_STATUSES: MerchantStatus[] = ['pending_admin_approval'];

export interface AdminContext {
  email: string;
  role: 'super_admin' | 'reviewer';
}

export async function listPendingMerchants(store: MerchantStore): Promise<Merchant[]> {
  const rows = await store.listByStatus(PENDING_STATUSES);
  return rows.sort((a, b) => +a.createdAt - +b.createdAt);
}

export type ApproveOutcome =
  | { ok: true; merchant: Merchant; emailResult: SendResult }
  | { ok: false; status: 404 | 409 | 500; error: string };

export async function approveMerchant(
  merchantId: number,
  admin: AdminContext,
  deps: {
    store: MerchantStore;
    emailMerchant?: (args: Parameters<typeof emailMerchantApproved>[0]) => Promise<SendResult>;
    merchantPortalUrl?: string;
  },
): Promise<ApproveOutcome> {
  const target = await deps.store.findById(merchantId);
  if (!target) return { ok: false, status: 404, error: 'Merchant not found.' };
  if (target.status === 'approved') {
    return { ok: false, status: 409, error: 'Merchant is already approved.' };
  }
  if (target.status === 'rejected' || target.status === 'suspended') {
    return {
      ok: false,
      status: 409,
      error: `Cannot approve merchant in status "${target.status}".`,
    };
  }

  const updated = await deps.store.updateStatus(merchantId, 'approved', {
    approvedAt: new Date(),
    approvedBy: admin.email,
  });
  if (!updated) return { ok: false, status: 500, error: 'Approve write failed.' };

  const send = deps.emailMerchant ?? emailMerchantApproved;
  const emailResult = await send({
    businessName: updated.businessName,
    contactName: updated.contactName,
    contactEmail: updated.contactEmail,
    adminUrl: '',
    merchantPortalUrl: deps.merchantPortalUrl,
  });
  return { ok: true, merchant: updated, emailResult };
}

export type RejectOutcome =
  | { ok: true; merchant: Merchant; emailResult: SendResult }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string };

export async function rejectMerchant(
  merchantId: number,
  reason: string,
  admin: AdminContext,
  deps: {
    store: MerchantStore;
    emailMerchant?: (args: Parameters<typeof emailMerchantRejected>[0]) => Promise<SendResult>;
  },
): Promise<RejectOutcome> {
  void admin;
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < 5) {
    return { ok: false, status: 400, error: 'A rejection reason is required (5+ chars).' };
  }

  const target = await deps.store.findById(merchantId);
  if (!target) return { ok: false, status: 404, error: 'Merchant not found.' };
  if (target.status === 'rejected') {
    return { ok: false, status: 409, error: 'Merchant is already rejected.' };
  }
  if (target.status === 'approved') {
    return { ok: false, status: 409, error: 'Cannot reject an already-approved merchant.' };
  }

  const updated = await deps.store.updateStatus(merchantId, 'rejected', {
    rejectedAt: new Date(),
    rejectedReason: trimmed,
  });
  if (!updated) return { ok: false, status: 500, error: 'Reject write failed.' };

  const send = deps.emailMerchant ?? emailMerchantRejected;
  const emailResult = await send({
    businessName: updated.businessName,
    contactName: updated.contactName,
    contactEmail: updated.contactEmail,
    adminUrl: '',
    rejectionReason: trimmed,
  });
  return { ok: true, merchant: updated, emailResult };
}
