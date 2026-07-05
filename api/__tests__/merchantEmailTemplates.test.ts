import { describe, it, expect } from 'vitest';
import {
  renderMerchantApproved,
  renderMerchantKycCompleteAlertToVic,
  renderMerchantRejected,
  renderMerchantSignupAcknowledged,
  renderMerchantSignupAlertToVic,
  type MerchantEmailData,
} from '../_lib/email-templates';

const SAMPLE: MerchantEmailData = {
  businessName: 'Aurora Wellness Ltd',
  contactName: 'Jane Doe',
  contactEmail: 'jane@aurora.example',
  adminUrl: 'https://designer.ppwellness.co/admin/merchants',
};

describe('merchant lifecycle email templates', () => {
  it('signup acknowledgement contains the contact name and business name', () => {
    const { subject, html } = renderMerchantSignupAcknowledged(SAMPLE);
    expect(subject).toContain('Aurora Wellness Ltd');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Aurora Wellness Ltd');
    expect(html).toContain('48 hours');
  });

  it('signup-alert-to-Vic contains the admin URL', () => {
    const { subject, html } = renderMerchantSignupAlertToVic(SAMPLE);
    expect(subject).toContain('New supplier signup');
    expect(html).toContain(SAMPLE.adminUrl);
  });

  it('kyc-complete alert references the merchant + admin URL', () => {
    const { subject, html } = renderMerchantKycCompleteAlertToVic(SAMPLE);
    expect(subject).toContain('KYC complete');
    expect(html).toContain('Aurora Wellness Ltd');
    expect(html).toContain(SAMPLE.adminUrl);
  });

  it('approved email greets the merchant and mentions Stripe Connect', () => {
    const { subject, html } = renderMerchantApproved({
      ...SAMPLE,
      merchantPortalUrl: 'https://designer.ppwellness.co/merchant/aurora',
    });
    expect(subject).toMatch(/approved/i);
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Stripe Connect');
    expect(html).toContain('https://designer.ppwellness.co/merchant/aurora');
  });

  it('approved email gracefully falls back when no portal URL given', () => {
    const { html } = renderMerchantApproved(SAMPLE);
    expect(html).toContain("Vic will be in touch");
  });

  it('rejection email contains the reason verbatim, escaped', () => {
    const { html } = renderMerchantRejected({
      ...SAMPLE,
      rejectionReason: 'Category currently overstocked & not aligned <strategy>',
    });
    expect(html).toContain('overstocked');
    // The reason text must be HTML-escaped.
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;strategy&gt;');
    expect(html).not.toContain('<strategy>');
  });

  it('rejection email falls back to a generic line when no reason given', () => {
    const { html } = renderMerchantRejected({ ...SAMPLE });
    expect(html).toMatch(/at this time/i);
  });

  it('all templates open with the brand header', () => {
    const samples = [
      renderMerchantSignupAcknowledged(SAMPLE).html,
      renderMerchantSignupAlertToVic(SAMPLE).html,
      renderMerchantKycCompleteAlertToVic(SAMPLE).html,
      renderMerchantApproved(SAMPLE).html,
      renderMerchantRejected({ ...SAMPLE, rejectionReason: 'because' }).html,
    ];
    for (const html of samples) {
      expect(html).toContain('Peak Performance Wellness Marketplace');
      expect(html).toContain('ppwellness.co');
    }
  });
});
