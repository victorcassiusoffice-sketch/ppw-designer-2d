/**
 * api/lib/email/templates.ts — V4 M9.A.3 customer-loop email templates.
 *
 * Four shared templates rendered as plain HTML strings. The send wrappers
 * (in api/lib/email.ts + api/lib/merchantEmails.ts) handle Resend transport,
 * dry-run fallback, and reply-to wiring; this module is content-only so it
 * stays unit-testable without network mocks.
 *
 * Canonical brand palette per V4-AU-1 (CLOSED 2026-05-16):
 *   --gold     #C0A67E
 *   --gold-deep #987C4E
 *   --ink      #1C1C20
 *   --dark     #0E0E10
 *   --cream    #F5EFE6
 *
 * Voice per V3.1-I (CLOSED 2026-05-16): hybrid warm + formal + quirky with
 * a science-snippet P.S. line on each. Subject lines stay practical so they
 * survive inbox-list truncation at ~60 chars.
 *
 * Templates:
 *   - renderDesignSaved      — M9.A.1 trigger ("Your wellness room design")
 *   - renderOrderConfirmed   — M9.A.2 trigger (PayPal capture success)
 *   - renderMerchantOnboard  — net-new merchant welcome (companion to the
 *                              merchant lifecycle file)
 *   - renderOrderShipped     — fulfilment event → tracking URL surface
 *
 * `api/lib/email-templates.ts` (5 merchant lifecycle templates) STAYS as-is
 * — that file shipped pre-canon and is queued for canonical-palette rebind
 * under W0.D.19 / M9.B.* follow-ups. Splitting prevents a single failed
 * rebind from blocking the customer-loop ship.
 */

const PALETTE = {
  gold: '#C0A67E',
  goldDeep: '#987C4E',
  ink: '#1C1C20',
  dark: '#0E0E10',
  cream: '#F5EFE6',
} as const;

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
    <div style="background:${PALETTE.dark};padding:20px 24px;color:${PALETTE.cream};border-radius:8px 8px 0 0;">
      <div style="font-family:'Syne ExtraBold','Georgia',serif;font-size:22px;font-weight:800;letter-spacing:0.5px;color:${PALETTE.gold};">
        Peak Performance Wellness
      </div>
      <div style="font-size:12px;opacity:0.78;margin-top:4px;">
        Tamarin · Mauritius · ppwellness.co
      </div>
    </div>`;
}

function brandFooter(scienceSnippet: string): string {
  const snippet = escapeHtml(scienceSnippet);
  return `
    <div style="border-top:1px solid rgba(192,166,126,0.25);padding:18px 24px;margin-top:24px;color:${PALETTE.ink};opacity:0.72;font-size:11px;line-height:1.55;">
      <div style="margin-bottom:6px;"><strong style="color:${PALETTE.goldDeep};">P.S.</strong> ${snippet}</div>
      Reply to this email and Vic will respond personally.<br/>
      Peak Performance Wellness · Tamarin, Mauritius · <a href="https://ppwellness.co" style="color:${PALETTE.goldDeep};">ppwellness.co</a>
    </div>`;
}

function shell(inner: string, scienceSnippet: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${PALETTE.cream};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${PALETTE.ink};">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;">
    ${brandHeader()}
    <div style="padding:24px;font-size:15px;line-height:1.6;">${inner}</div>
    ${brandFooter(scienceSnippet)}
  </div>
</body></html>`;
}

export interface DesignSavedData {
  customerName: string;
  designName: string;
  designUrl: string;
  cartSummary?: { itemCount: number; subtotalMur: number };
}

export function renderDesignSaved(data: DesignSavedData): { subject: string; html: string } {
  const subject = `Your wellness room design — ${data.designName}`;
  const cartLine = data.cartSummary
    ? `<p style="background:${PALETTE.cream};padding:12px;border-radius:6px;margin-top:18px;font-size:14px;">
        Your design currently lists <strong>${data.cartSummary.itemCount} item${data.cartSummary.itemCount === 1 ? '' : 's'}</strong> at a subtotal of <strong>MUR ${data.cartSummary.subtotalMur.toLocaleString('en-GB')}</strong>. The full quote with per-merchant breakdown is one click away.
       </p>`
    : '';
  const html = shell(
    `
    <p style="font-size:17px;margin:0 0 12px;color:${PALETTE.ink};">${escapeHtml(data.customerName)},</p>
    <p>We've saved your wellness room design <strong>${escapeHtml(data.designName)}</strong>. Pick it up exactly where you left off — no account required, no countdown.</p>
    <p style="margin-top:18px;text-align:center;">
      <a href="${escapeHtml(data.designUrl)}" style="display:inline-block;background:${PALETTE.gold};color:${PALETTE.dark};padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.3px;">Open my design</a>
    </p>
    ${cartLine}
    <p style="margin-top:18px;font-size:13px;color:${PALETTE.goldDeep};">
      If this wasn't you, you can safely ignore this email — nothing was charged and the design link expires on its own.
    </p>
    `,
    'Deep fascia heals fastest in environments your nervous system reads as safe. Rooms you design intentionally do that work for you.',
  );
  return { subject, html };
}

export interface OrderConfirmedData {
  customerName: string;
  orderRef: string;
  totalMur: number;
  currency: string;
  trackingUrl: string;
  merchantBreakdown: Array<{ merchantName: string; itemCount: number; subtotalMur: number }>;
}

export function renderOrderConfirmed(data: OrderConfirmedData): { subject: string; html: string } {
  const subject = `Order confirmed — ${data.orderRef}`;
  const rows = data.merchantBreakdown
    .map(
      (row) =>
        `<tr><td style="padding:6px 0;color:${PALETTE.ink};">${escapeHtml(row.merchantName)}</td><td style="padding:6px 0;color:${PALETTE.ink};text-align:right;">${row.itemCount}× · MUR ${row.subtotalMur.toLocaleString('en-GB')}</td></tr>`,
    )
    .join('');
  const html = shell(
    `
    <p style="font-size:17px;margin:0 0 12px;color:${PALETTE.ink};">Thank you, ${escapeHtml(data.customerName)}.</p>
    <p>Your order <strong>${escapeHtml(data.orderRef)}</strong> is confirmed. Total charged: <strong>${escapeHtml(data.currency)} ${data.totalMur.toLocaleString('en-GB')}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;">
      <thead><tr><th style="text-align:left;padding:6px 0;border-bottom:1px solid ${PALETTE.gold};color:${PALETTE.goldDeep};">Per merchant</th><th style="text-align:right;padding:6px 0;border-bottom:1px solid ${PALETTE.gold};color:${PALETTE.goldDeep};">Items / subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;text-align:center;">
      <a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;background:${PALETTE.gold};color:${PALETTE.dark};padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.3px;">Track this order</a>
    </p>
    <p style="margin-top:18px;font-size:13px;color:${PALETTE.goldDeep};">
      Each merchant ships their portion separately — you'll get a tracking update per shipment as it leaves their warehouse.
    </p>
    `,
    'Buying intentionally is itself a regulating signal — your autonomic system reads "decision made" as permission to stand down from vigilance.',
  );
  return { subject, html };
}

export interface MerchantOnboardData {
  contactName: string;
  brandName: string;
  portalUrl: string;
  agentUrl: string;
}

export function renderMerchantOnboard(data: MerchantOnboardData): { subject: string; html: string } {
  const subject = `Welcome to the PPW Marketplace — ${data.brandName}`;
  const html = shell(
    `
    <p style="font-size:17px;margin:0 0 12px;color:${PALETTE.ink};">Welcome, ${escapeHtml(data.contactName)}.</p>
    <p><strong>${escapeHtml(data.brandName)}</strong> is now live on the Peak Performance Wellness Marketplace. Your portal is ready to take its first product spec.</p>
    <p style="margin:18px 0;background:${PALETTE.cream};padding:14px;border-radius:6px;">
      <strong style="color:${PALETTE.goldDeep};">Two paths to your first listing:</strong><br/>
      • <strong>Self-service portal:</strong> <a href="${escapeHtml(data.portalUrl)}" style="color:${PALETTE.goldDeep};">${escapeHtml(data.portalUrl)}</a><br/>
      • <strong>Talk to the agent:</strong> <a href="${escapeHtml(data.agentUrl)}" style="color:${PALETTE.goldDeep};">${escapeHtml(data.agentUrl)}</a> — describe a product in plain English, the agent extracts the spec, you confirm before it goes live.
    </p>
    <p style="margin-top:14px;">Vic will personally check in within 7 days to make sure the path you chose is working. Reply to this email any time — you'll reach a human, not a queue.</p>
    `,
    'Mauritian eco-wellness sits at a unique convergence of climate, fascia-rich movement traditions, and modern science. Your products carry that signal further.',
  );
  return { subject, html };
}

export interface OrderShippedData {
  customerName: string;
  orderRef: string;
  merchantName: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  estimatedArrival?: string;
}

export function renderOrderShipped(data: OrderShippedData): { subject: string; html: string } {
  const subject = `Shipped — ${data.orderRef} from ${data.merchantName}`;
  const etaLine = data.estimatedArrival
    ? `<p style="margin-top:8px;">Estimated arrival: <strong>${escapeHtml(data.estimatedArrival)}</strong>.</p>`
    : '';
  const html = shell(
    `
    <p style="font-size:17px;margin:0 0 12px;color:${PALETTE.ink};">${escapeHtml(data.customerName)},</p>
    <p><strong>${escapeHtml(data.merchantName)}</strong>'s portion of order <strong>${escapeHtml(data.orderRef)}</strong> is on its way.</p>
    <p style="margin:14px 0;background:${PALETTE.cream};padding:12px;border-radius:6px;font-size:14px;">
      <strong>${escapeHtml(data.carrier)}</strong> tracking: <code style="background:#ffffff;padding:2px 6px;border-radius:3px;font-family:ui-monospace,Menlo,Consolas,monospace;">${escapeHtml(data.trackingNumber)}</code>
    </p>
    ${etaLine}
    <p style="margin-top:20px;text-align:center;">
      <a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;background:${PALETTE.gold};color:${PALETTE.dark};padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:0.3px;">Track this shipment</a>
    </p>
    <p style="margin-top:18px;font-size:13px;color:${PALETTE.goldDeep};">
      Other merchants on the same order ship separately and will email you their own tracking when their parcel leaves.
    </p>
    `,
    "Anticipation activates the same dopamine pathway as receipt. The wait isn't lost time — it's part of the protocol.",
  );
  return { subject, html };
}
