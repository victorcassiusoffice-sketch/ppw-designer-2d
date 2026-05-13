/**
 * OMS Phase 1 — merchant lifecycle email templates.
 *
 * Five HTML templates rendered as plain strings. They share the
 * brand header / footer used by the customer order emails. Phase 2
 * swaps these for react-email components.
 *
 * Each template returns the FULL HTML document; the send wrapper in
 * api/lib/merchantEmails.ts handles Resend transport, dry-run fallback,
 * and reply-to wiring.
 */

export interface MerchantEmailData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  /** Absolute URL of the /admin/merchants queue — only used in Vic-facing emails. */
  adminUrl: string;
  /** Optional follow-up note used by rejection email. */
  rejectionReason?: string;
  /** Optional onboarding/profile URL sent to merchants on approval. */
  merchantPortalUrl?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brandHeader(): string {
  return `
    <div style="background:#1f4a4a;padding:18px 24px;color:#ffffff;border-radius:8px 8px 0 0;">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;letter-spacing:0.5px;">
        Peak Performance Wellness Marketplace
      </div>
      <div style="font-size:12px;opacity:0.85;margin-top:2px;">
        Tamarin · Mauritius · ppwellness.co
      </div>
    </div>`;
}

function brandFooter(): string {
  return `
    <div style="border-top:1px solid #e5e1d8;padding:16px 24px;margin-top:24px;color:#5a6566;font-size:11px;">
      Reply to this email and Vic will respond personally.<br/>
      Peak Performance Wellness · Tamarin, Mauritius · <a href="https://ppwellness.co" style="color:#1f4a4a;">ppwellness.co</a>
    </div>`;
}

function shell(inner: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4efe3;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f3a3a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;">
    ${brandHeader()}
    <div style="padding:24px;font-size:14px;line-height:1.55;">${inner}</div>
    ${brandFooter()}
  </div>
</body></html>`;
}

/**
 * Sent to the merchant immediately after signup, while their KYC is
 * pending. Used both in MU-gated (manual followup) and Stripe-live
 * (auto-redirect-back) paths.
 */
export function renderMerchantSignupAcknowledged(data: MerchantEmailData): { subject: string; html: string } {
  const subject = `We've received your application — ${data.businessName}`;
  const html = shell(`
    <p style="font-size:17px;margin:0 0 12px;">Thank you, ${escapeHtml(data.contactName)}.</p>
    <p>We've received your supplier application for <strong>${escapeHtml(data.businessName)}</strong>.</p>
    <p>Vic will personally review your application within 48 hours. If your Stripe KYC is still in progress, we'll wait for that to complete before contacting you.</p>
    <p style="background:#f4efe3;padding:12px;border-radius:6px;margin-top:18px;font-size:13px;">
      <strong>What happens next:</strong><br/>
      1. We verify the business details you provided.<br/>
      2. Stripe completes identity verification (if applicable).<br/>
      3. Vic emails you back with an approval or a follow-up question.
    </p>
    <p style="margin-top:20px;font-size:12px;color:#5a6566;">
      If you didn't initiate this application, you can safely ignore this email.
    </p>
  `);
  return { subject, html };
}

/**
 * Sent to Vic when a new merchant signs up. Always sent — both MU-gated
 * and Stripe-live paths.
 */
export function renderMerchantSignupAlertToVic(data: MerchantEmailData): { subject: string; html: string } {
  const subject = `[Marketplace] New supplier signup — ${data.businessName}`;
  const html = shell(`
    <h1 style="font-size:17px;margin:0 0 12px;color:#1f4a4a;">New supplier signup</h1>
    <p><strong>Business:</strong> ${escapeHtml(data.businessName)}<br/>
    <strong>Contact:</strong> ${escapeHtml(data.contactName)} &lt;${escapeHtml(data.contactEmail)}&gt;</p>
    <p>Review the application in the admin queue:</p>
    <p><a href="${escapeHtml(data.adminUrl)}" style="display:inline-block;background:#1f4a4a;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open admin queue</a></p>
    <p style="margin-top:18px;font-size:12px;color:#5a6566;">
      This is an automated alert from the OMS Phase 1 signup flow. The merchant has been notified that you'll respond within 48 hours.
    </p>
  `);
  return { subject, html };
}

/**
 * Sent to Vic when Stripe Connect reports the merchant's KYC has
 * completed and they're ready for the approval click. Same shape as
 * the signup alert but with a different lede so it doesn't get
 * confused with the first email.
 */
export function renderMerchantKycCompleteAlertToVic(data: MerchantEmailData): { subject: string; html: string } {
  const subject = `[Marketplace] KYC complete — ${data.businessName} ready for your approval`;
  const html = shell(`
    <h1 style="font-size:17px;margin:0 0 12px;color:#1f4a4a;">Merchant cleared Stripe KYC</h1>
    <p><strong>${escapeHtml(data.businessName)}</strong> has completed Stripe Connect identity verification. They're now sitting in your approval queue.</p>
    <p><a href="${escapeHtml(data.adminUrl)}" style="display:inline-block;background:#1f4a4a;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Review &amp; approve</a></p>
    <p style="margin-top:18px;font-size:12px;color:#5a6566;">
      Approving them switches their marketplace status to live; rejecting them with a reason emails the merchant the explanation.
    </p>
  `);
  return { subject, html };
}

/**
 * Sent to the merchant when Vic clicks Approve.
 */
export function renderMerchantApproved(data: MerchantEmailData): { subject: string; html: string } {
  const subject = `You're approved — welcome to the PPW Marketplace`;
  const portalLine = data.merchantPortalUrl
    ? `<p>Your merchant portal is live at <a href="${escapeHtml(data.merchantPortalUrl)}" style="color:#1f4a4a;">${escapeHtml(data.merchantPortalUrl)}</a>.</p>`
    : '<p>Vic will be in touch with the next steps on connecting your inventory.</p>';
  const html = shell(`
    <p style="font-size:17px;margin:0 0 12px;">Welcome, ${escapeHtml(data.contactName)}.</p>
    <p><strong>${escapeHtml(data.businessName)}</strong> is now live in the Peak Performance Wellness Marketplace.</p>
    ${portalLine}
    <p style="background:#f4efe3;padding:12px;border-radius:6px;margin-top:18px;font-size:13px;">
      <strong>What's next:</strong><br/>
      • Vic will follow up to confirm integration tier (Shopify connector, custom backend, or lite portal).<br/>
      • Your products will appear in the customer designer once your catalog is connected.<br/>
      • Payouts run via Stripe Connect on a 14-day hold to protect both sides during the first orders.
    </p>
    <p style="margin-top:18px;font-size:12px;color:#5a6566;">
      Welcome aboard — we're glad you're here.
    </p>
  `);
  return { subject, html };
}

/**
 * Sent to the merchant when Vic clicks Reject. Reason is mandatory at
 * the API layer; this template never renders without it.
 */
export function renderMerchantRejected(data: MerchantEmailData): { subject: string; html: string } {
  const reason = data.rejectionReason && data.rejectionReason.trim().length > 0 ? data.rejectionReason : 'We can\'t accept new suppliers in this category at this time.';
  const subject = `Update on your PPW Marketplace application`;
  const html = shell(`
    <p style="font-size:17px;margin:0 0 12px;">Hi ${escapeHtml(data.contactName)},</p>
    <p>Thank you for applying to supply on the Peak Performance Wellness Marketplace.</p>
    <p>We're unable to proceed with <strong>${escapeHtml(data.businessName)}</strong> at this time. Specifically:</p>
    <blockquote style="border-left:3px solid #1f4a4a;padding:8px 14px;background:#f4efe3;margin:12px 0;font-style:italic;">
      ${escapeHtml(reason)}
    </blockquote>
    <p>You're welcome to reapply once the underlying issue has been addressed. If you believe this decision was made in error, reply to this email and Vic will review it personally.</p>
    <p style="margin-top:18px;font-size:12px;color:#5a6566;">
      We appreciate the time you took to apply.
    </p>
  `);
  return { subject, html };
}
