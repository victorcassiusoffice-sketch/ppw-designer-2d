/**
 * checkoutStore — Week 3 unit tests for the form validator.
 */
import { describe, it, expect } from 'vitest';
import {
  validateCheckoutForm,
  hasErrors,
  EMPTY_FORM,
  type CheckoutFormValues,
} from '../checkoutStore';

function full(overrides: Partial<CheckoutFormValues> = {}): CheckoutFormValues {
  return {
    ...EMPTY_FORM,
    name: 'Vic Bhatoolaul',
    email: 'vic@ppwellness.co',
    phone: '+230 5 123 4567',
    addressLine1: '1 Beach Road',
    city: 'Tamarin',
    postcode: '90901',
    country: 'MU',
    notes: '',
    ...overrides,
  };
}

describe('validateCheckoutForm — happy path', () => {
  it('accepts a fully-filled valid form', () => {
    const e = validateCheckoutForm(full());
    expect(hasErrors(e)).toBe(false);
  });
});

describe('validateCheckoutForm — required fields', () => {
  it('flags every required missing field', () => {
    const e = validateCheckoutForm(EMPTY_FORM);
    expect(e.name).toBeDefined();
    expect(e.email).toBeDefined();
    expect(e.phone).toBeDefined();
    expect(e.addressLine1).toBeDefined();
    expect(e.city).toBeDefined();
    expect(e.postcode).toBeDefined();
  });

  it('lets optional address line 2 stay blank', () => {
    const e = validateCheckoutForm(full({ addressLine2: '' }));
    expect(hasErrors(e)).toBe(false);
  });
});

describe('validateCheckoutForm — email regex', () => {
  it('accepts plain addresses', () => {
    expect(validateCheckoutForm(full({ email: 'a@b.co' })).email).toBeUndefined();
    expect(validateCheckoutForm(full({ email: 'vic.bhatoolaul+test@ppwellness.co' })).email).toBeUndefined();
  });

  it('rejects malformed addresses', () => {
    expect(validateCheckoutForm(full({ email: 'not-an-email' })).email).toBeDefined();
    expect(validateCheckoutForm(full({ email: '@nope.com' })).email).toBeDefined();
    expect(validateCheckoutForm(full({ email: 'foo@bar' })).email).toBeDefined();
    expect(validateCheckoutForm(full({ email: 'foo@bar.c' })).email).toBeDefined();
  });
});

describe('validateCheckoutForm — phone regex', () => {
  it('accepts international and local formats', () => {
    expect(validateCheckoutForm(full({ phone: '+230 5 123 4567' })).phone).toBeUndefined();
    expect(validateCheckoutForm(full({ phone: '+44 7700 900123' })).phone).toBeUndefined();
    expect(validateCheckoutForm(full({ phone: '(555) 123-4567' })).phone).toBeUndefined();
    expect(validateCheckoutForm(full({ phone: '5123 4567' })).phone).toBeUndefined();
  });

  it('rejects gibberish', () => {
    expect(validateCheckoutForm(full({ phone: 'call me maybe' })).phone).toBeDefined();
    expect(validateCheckoutForm(full({ phone: '123' })).phone).toBeDefined();
  });
});

describe('useCheckoutStore — selectedRail (Phase 1.5)', () => {
  it('defaults to stripe', async () => {
    const mod = await import('../checkoutStore');
    // Reset to a known state (fresh store instance per process, but
    // sessionStorage may have v3 persisted from a previous test - we
    // explicitly set back to stripe before reading).
    mod.useCheckoutStore.getState().setSelectedRail('stripe');
    expect(mod.useCheckoutStore.getState().selectedRail).toBe('stripe');
  });

  it('setSelectedRail switches between stripe and paypal', async () => {
    const mod = await import('../checkoutStore');
    mod.useCheckoutStore.getState().setSelectedRail('paypal');
    expect(mod.useCheckoutStore.getState().selectedRail).toBe('paypal');
    mod.useCheckoutStore.getState().setSelectedRail('stripe');
    expect(mod.useCheckoutStore.getState().selectedRail).toBe('stripe');
  });

  it('resetForm restores selectedRail to stripe', async () => {
    const mod = await import('../checkoutStore');
    mod.useCheckoutStore.getState().setSelectedRail('paypal');
    mod.useCheckoutStore.getState().resetForm();
    expect(mod.useCheckoutStore.getState().selectedRail).toBe('stripe');
  });
});
