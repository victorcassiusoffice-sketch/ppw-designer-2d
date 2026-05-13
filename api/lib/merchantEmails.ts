/**
 * Resend transport for merchant lifecycle emails.
 *
 * Mirrors the customer-order transport in api/lib/email.ts:
 *   - Lazy client with `RESEND_API_KEY` env read
 *   - Dry-run fallback (logs payload, returns ok) when key is missing
 *     so local dev / CI runs the whole flow without an account
 *   - Reply-to is always `victor@ppwellness.co`
 *
 * Phase 2 will: (a) batch alerts to Vic if more than 1 merchant signs
 * up in 5 min, (b) move to react-email components, (c) add unsubscribe
 * links once the marketing flow exists.
 */

// NOTE: Resend SDK is intentionally imported via dynamic `await import('resend')`
// inside `send()` rather than at the top of the module. Importing at top-level
// crashed the Vercel @vercel/node@3.2.29 lambda on cold start (FUNCTION_INVOCATION_FAILED)
// — likely an ESM/CJS interop issue with the current runtime + Resend 4.8. Moving
// the import inside the async function defers the load until the path is actually hit,
// which lets the function module itself load cleanly.
import {
  renderMerchantApproved,
  renderMerchantKycCompleteAlertToVic,
  renderMerchantRejected,
  renderMerchantSignupAcknowledged,
  renderMerchantSignupAlertToVic,
  type MerchantEmailData,
} from './email-templates.js';

type ResendClient = {
  emails: {
    send(args: {
      from: string;
      to: string;
      subject: string;
      html: string;
      replyTo?: string;
    }): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
};

export const VIC_EMAIL = 'victor@ppwellness.co';
export const FROM_EMAIL = 'Peak Performance Wellness Marketplace <victor@ppwellness.co>';

export interface SendResult {
  ok: boolean;
  id?: string;
  loggedOnly?: boolean;
  error?: string;
}

let _resend: ResendClient | null = null;

async function getResend(): Promise<ResendClient | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim().length === 0) return null;
  if (!_resend) {
    const mod = await import('resend');
    const Ctor = (mod as { Resend: new (apiKey: string) => ResendClient }).Resend;
    _resend = new Ctor(key);
  }
  return _resend;
}

/** Test-only: reset cached Resend client so subsequent reads re-read env. */
export function _resetMerchantEmailClientForTests(): void {
  _resend = null;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function send(args: SendArgs): Promise<SendResult> {
  const client = await getResend();
  if (!client) {
    // Local dev: log instead of send so the whole flow stays functional
    // without a Resend account.
    // eslint-disable-next-line no-console
    console.log('[merchant-email:dry-run]', {
      to: args.to,
      subject: args.subject,
      htmlLength: args.html.length,
    });
    return { ok: true, loggedOnly: true };
  }
  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo ?? VIC_EMAIL,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function emailMerchantSignupAcknowledged(data: MerchantEmailData): Promise<SendResult> {
  const { subject, html } = renderMerchantSignupAcknowledged(data);
  return send({ to: data.contactEmail, subject, html });
}

export async function emailVicNewSignup(data: MerchantEmailData): Promise<SendResult> {
  const { subject, html } = renderMerchantSignupAlertToVic(data);
  return send({ to: VIC_EMAIL, subject, html });
}

export async function emailVicKycComplete(data: MerchantEmailData): Promise<SendResult> {
  const { subject, html } = renderMerchantKycCompleteAlertToVic(data);
  return send({ to: VIC_EMAIL, subject, html });
}

export async function emailMerchantApproved(data: MerchantEmailData): Promise<SendResult> {
  const { subject, html } = renderMerchantApproved(data);
  return send({ to: data.contactEmail, subject, html });
}

export async function emailMerchantRejected(data: MerchantEmailData): Promise<SendResult> {
  const { subject, html } = renderMerchantRejected(data);
  return send({ to: data.contactEmail, subject, html });
}
