/**
 * OMS Wave 5.2 — merchant onboarding E2E (Playwright).
 *
 * /suppliers form → admin approves (via API to skip Clerk login) →
 * merchant receives URL → opens /merchant/[id]/agent → completes
 * guided onboarding → status flips.
 *
 * Skipped on CI until Vic runs `npx playwright install` and provides
 * an admin Clerk token in PPW_E2E_ADMIN_TOKEN.
 */

import { test, expect } from '@playwright/test';

test.describe('Merchant onboarding', () => {
  test('signup → approve → agent page loads', async ({ page, request }) => {
    test.skip(
      !process.env.PPW_E2E_ADMIN_TOKEN,
      'PPW_E2E_ADMIN_TOKEN required for admin approve step.',
    );

    const businessName = `E2E Co ${Date.now().toString(36)}`;
    const contactEmail = `e2e+merchant+${Date.now()}@ppwellness.co`;

    await page.goto('/suppliers');
    await page.getByLabel(/Business name/i).fill(businessName);
    await page.getByLabel(/Brand name/i).fill(businessName);
    await page.getByLabel(/Contact name/i).fill('Auto Test');
    await page.getByLabel(/Contact email/i).fill(contactEmail);
    await page.getByLabel(/Contact phone/i).fill('+23012345678');
    await page.getByRole('button', { name: /Submit application/i }).click();
    await expect(page).toHaveURL(/\/suppliers\/signup\/complete/);

    // Use the admin API directly to approve.
    const list = await request.get('/api/admin/merchants', {
      headers: { Authorization: `Bearer ${process.env.PPW_E2E_ADMIN_TOKEN}` },
    });
    expect(list.status()).toBe(200);
    const j = (await list.json()) as { merchants?: Array<{ id: number; contactEmail: string; slug: string }> };
    const target = (j.merchants ?? []).find((m) => m.contactEmail === contactEmail);
    expect(target).toBeDefined();
    if (!target) return;

    const approve = await request.post(`/api/admin/merchants/${target.slug}/approve`, {
      headers: { Authorization: `Bearer ${process.env.PPW_E2E_ADMIN_TOKEN}` },
      data: { merchantId: target.id },
    });
    expect(approve.status()).toBe(200);

    // Visit the merchant agent page.
    await page.goto(`/merchant/${target.slug}/agent`);
    await expect(page.getByRole('heading', { name: /Integration agent/i })).toBeVisible();
  });
});
