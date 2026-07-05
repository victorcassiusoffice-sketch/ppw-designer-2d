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

import { randomBytes } from 'crypto';
import type { Merchant, MerchantStatus } from '../_db/schema.js';
import type { MerchantStore } from '../_db/merchantStore.js';
import {
  emailMerchantApproved,
  emailMerchantRejected,
  type SendResult,
} from './merchantEmails.js';
import { recordAudit } from './auditLog.js';

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
    /** OMS Wave 1.7 — base URL used to build the per-merchant agent URL. */
    publicBaseUrl?: string;
    /** OMS Wave 1.7 — fire-and-forget hook to insert the agent_sessions row. */
    spawnAgentSession?: (merchant: Merchant) => Promise<void>;
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

  // OMS Wave 1.7 — provision the HMAC webhook secret for the merchant
  // if one doesn't exist yet. 32 bytes of randomness → 64 hex chars.
  let withSecret: Merchant = updated;
  if (!updated.webhookSecret) {
    const secret = randomBytes(32).toString('hex');
    const setResult = await deps.store.setWebhookSecret(merchantId, secret);
    if (setResult) withSecret = setResult;
  }

  // OMS Wave 1.7 — auto-spawn an integration agent session. Failure is
  // logged in audit but doesn't roll back the approval.
  let agentSpawnError: string | null = null;
  if (deps.spawnAgentSession) {
    try {
      await deps.spawnAgentSession(withSecret);
    } catch (err) {
      agentSpawnError = err instanceof Error ? err.message : 'agent spawn failed';
    }
  }

  const baseUrl = (deps.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  const agentUrl = baseUrl ? `${baseUrl}/merchant/${withSecret.slug}/agent` : undefined;

  const send = deps.emailMerchant ?? emailMerchantApproved;
  const emailResult = await send({
    businessName: withSecret.businessName,
    contactName: withSecret.contactName,
    contactEmail: withSecret.contactEmail,
    adminUrl: '',
    merchantPortalUrl: deps.merchantPortalUrl,
    agentUrl,
  });

  // Audit trail — fire-and-await but never let a failure surface as a
  // user-visible error. recordAudit returns { ok: false } on insert
  // failure; the merchant is already approved either way.
  await recordAudit(
    admin.email,
    'merchant.approve',
    'merchant',
    String(withSecret.id),
    null,
    {
      slug: withSecret.slug,
      previousStatus: target.status,
      newStatus: withSecret.status,
      emailSent: emailResult.ok,
      webhookSecretProvisioned: !!withSecret.webhookSecret,
      agentSpawnError,
    },
  );

  return { ok: true, merchant: withSecret, emailResult };
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

  await recordAudit(
    admin.email,
    'merchant.reject',
    'merchant',
    String(updated.id),
    trimmed,
    {
      slug: updated.slug,
      previousStatus: target.status,
      newStatus: updated.status,
      emailSent: emailResult.ok,
    },
  );

  return { ok: true, merchant: updated, emailResult };
}
