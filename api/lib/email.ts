/**
 * Email service — Resend.
 *
 * If `RESEND_API_KEY` is unset (local dev, CI), we log the payload to
 * console and return success. This lets us run the whole flow without
 * an account.
 *
 * Phase 2: swap inline HTML for react-email templates + add unsubscribe
 * + per-region locale handling.
 *
 * Domain `ppwellness.co` must be verified in Resend before live emails
 * actually send. See VERCEL-DEPLOY-GUIDE.md.
 */

import { Resend } from 'resend';
import type { OrderSummary, CustomerInfo, Currency } from './orderTypes';

const VIC_EMAIL = 'victor@ppwellness.co';
const FROM_EMAIL = 'Peak Performance Wellness <victor@ppwellness.co>';

export interface SendResult {
  ok: boolean;
  /** Resend message id (if real send). */
  id?: string;
  /** Local-dev marker — we printed instead of sending. */
  loggedOnly?: boolean;
  error?: string;
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim().length === 0) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

/** Reset cached client — test-only. */
export function _resetEmailClientForTests(): void {
  _resend = null;
}

const CURRENCY_SYMBOL: Record<Currency, string> = {
  MUR: 'Rs ',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function formatMoney(amount: number, currency: Currency): string {
  const digits = currency === 'MUR' ? 0 : 2;
  const rounded = amount.toFixed(digits);
  return `${CURRENCY_SYMBOL[currency]}${rounded}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Brand header — reused across templates. */
function brandHeader(): string {
  return `
    <div style="background:#1f4a4a;padding:18px 24px;color:#ffffff;border-radius:8px 8px 0 0;">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;letter-spacing:0.5px;">
        Peak Performance Wellness
      </div>
      <div style="font-size:12px;opacity:0.85;margin-top:2px;">
        Tamarin · Mauritius · ppwellness.co
      </div>
    </div>`;
}

function brandFooter(): string {
  return `
    <div style="border-top:1px solid #e5e1d8;padding:16px 24px;margin-top:24px;color:#5a6566;font-size:11px;">
      Questions? Reply directly to this email — it reaches Vic.<br/>
      Peak Performance Wellness · Tamarin, Mauritius · <a href="https://ppwellness.co" style="color:#1f4a4a;">ppwellness.co</a>
    </div>`;
}

function linesTable(order: OrderSummary): string {
  const rows = order.lines
    .map((l) => {
      const lineTotal = (l.unitAmount * l.quantity) / (l.currency === 'MUR' ? 1 : 100);
      const unit = l.unitAmount / (l.currency === 'MUR' ? 1 : 100);
      return `
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e1d8;">${escapeHtml(l.name)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e1d8;text-align:center;">${l.quantity}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e1d8;text-align:right;">${formatMoney(unit, l.currency)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e1d8;text-align:right;">${formatMoney(lineTotal, l.currency)}</td>
        </tr>`;
    })
    .join('');
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;">
      <thead>
        <tr style="background:#f4efe3;color:#1f4a4a;">
          <th style="padding:8px 6px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Product</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Unit</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:10px 6px;text-align:right;font-weight:bold;border-top:2px solid #1f4a4a;">Total</td>
          <td style="padding:10px 6px;text-align:right;font-weight:bold;border-top:2px solid #1f4a4a;">${formatMoney(order.total, order.currency)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function propertyBlock(order: OrderSummary): string {
  if (!order.property || order.property.rooms.length === 0) return '';
  const rows = order.property.rooms
    .map((r) => `<li>${escapeHtml(r.name)} <span style="color:#5a6566;">— ${r.itemCount} item${r.itemCount === 1 ? '' : 's'}</span></li>`)
    .join('');
  return `
    <div style="margin-top:18px;padding:12px;background:#f4efe3;border-radius:6px;">
      <p style="margin:0;font-size:12px;font-weight:bold;color:#1f4a4a;">Property: ${escapeHtml(order.property.name)}</p>
      <ul style="margin:6px 0 0 18px;padding:0;font-size:12px;color:#1f3a3a;">${rows}</ul>
    </div>`;
}

export function renderOrderConfirmationHtml(customer: CustomerInfo, order: OrderSummary): string {
  return `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f4efe3;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f3a3a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;">
    ${brandHeader()}
    <div style="padding:24px;">
      <p style="font-size:18px;margin:0 0 8px;">Thank you, ${escapeHtml(customer.name)}.</p>
      <p style="font-size:13px;margin:0;color:#5a6566;">
        Your order has been received. Reference: <strong style="font-family:Menlo,monospace;color:#1f4a4a;">${escapeHtml(order.id)}</strong>
      </p>
      ${linesTable(order)}
      ${propertyBlock(order)}
      <div style="margin-top:20px;padding:14px;border:1px solid #e5e1d8;border-radius:6px;">
        <p style="margin:0 0 6px;font-weight:bold;font-size:13px;">What happens next</p>
        <ol style="margin:0 0 0 18px;padding:0;font-size:12px;line-height:1.7;color:#1f3a3a;">
          <li>Our install team will email you within 24 hours.</li>
          <li>We'll confirm shipping for your region and lock in a delivery window.</li>
          <li>Once your products land in country, we schedule the install.</li>
          <li>Your floor plan PDF was generated at order time — we'll bring it on install day.</li>
        </ol>
      </div>
    </div>
    ${brandFooter()}
  </div>
</body></html>`;
}

export function renderVicAlertHtml(order: OrderSummary): string {
  const { customer } = order;
  return `
<!doctype html>
<html><body style="margin:0;padding:0;font-family:Menlo,monospace;color:#1f3a3a;background:#ffffff;">
  <div style="max-width:640px;margin:0 auto;padding:18px;">
    <h1 style="margin:0 0 10px;font-size:18px;color:#1f4a4a;">New order · ${escapeHtml(order.id)}</h1>
    <p style="margin:0 0 12px;font-size:13px;">
      <strong>${escapeHtml(customer.name)}</strong> · ${escapeHtml(customer.email)} · ${escapeHtml(customer.phone)}<br/>
      ${escapeHtml(customer.addressLine1)}${customer.addressLine2 ? ', ' + escapeHtml(customer.addressLine2) : ''}<br/>
      ${escapeHtml(customer.city)} ${escapeHtml(customer.postcode)} · ${escapeHtml(customer.country)}
    </p>
    <p style="margin:0 0 6px;font-size:13px;"><strong>Total:</strong> ${formatMoney(order.total, order.currency)}</p>
    ${linesTable(order)}
    ${propertyBlock(order)}
    ${customer.notes ? `<p style="margin-top:16px;font-size:12px;background:#f4efe3;padding:10px;border-radius:6px;"><strong>Notes:</strong><br/>${escapeHtml(customer.notes)}</p>` : ''}
    <p style="margin-top:18px;font-size:11px;color:#5a6566;">Stripe Dashboard → Payments to view the charge.</p>
  </div>
</body></html>`;
}

async function send(args: {
  to: string;
  subject: string;
  html: string;
  /** Optional reply-to override. */
  replyTo?: string;
}): Promise<SendResult> {
  const client = getResend();
  if (!client) {
    // Local dev: log instead of send.
    // eslint-disable-next-line no-console
    console.log('[email:dry-run]', {
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
      replyTo: args.replyTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function sendOrderConfirmation(
  customer: CustomerInfo,
  order: OrderSummary,
): Promise<SendResult> {
  if (!customer.email) {
    return { ok: false, error: 'Customer email missing.' };
  }
  return send({
    to: customer.email,
    subject: `Your PPWellness order · ${order.id}`,
    html: renderOrderConfirmationHtml(customer, order),
    replyTo: VIC_EMAIL,
  });
}

export async function sendOrderAlertToVic(
  _customer: CustomerInfo,
  order: OrderSummary,
): Promise<SendResult> {
  return send({
    to: VIC_EMAIL,
    subject: `[PPW] New order ${order.id} · ${formatMoney(order.total, order.currency)} · ${order.customer.name}`,
    html: renderVicAlertHtml(order),
  });
}

export async function sendPaymentFailedAlertToVic(args: {
  customerEmail?: string;
  orderId?: string;
  reason?: string;
  amount?: number;
  currency?: Currency;
}): Promise<SendResult> {
  const subject = `[PPW] Payment FAILED${args.orderId ? ' · ' + args.orderId : ''}`;
  const html = `
<!doctype html>
<html><body style="font-family:Menlo,monospace;padding:18px;">
  <h1 style="font-size:16px;color:#a14040;">Payment failed</h1>
  <p>Order: <strong>${escapeHtml(args.orderId ?? '(unknown)')}</strong></p>
  <p>Customer: ${escapeHtml(args.customerEmail ?? '(unknown)')}</p>
  ${args.amount !== undefined && args.currency ? `<p>Amount attempted: ${formatMoney(args.amount, args.currency)}</p>` : ''}
  <p>Reason: ${escapeHtml(args.reason ?? '(no detail from Stripe)')}</p>
  <p style="font-size:11px;color:#5a6566;">Check Stripe Dashboard → Payments → Failed.</p>
</body></html>`;
  return send({ to: VIC_EMAIL, subject, html });
}
