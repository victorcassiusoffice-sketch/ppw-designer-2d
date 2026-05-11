/**
 * checkoutStore — Week 3.
 *
 * Holds the customer info form between navigations. Backed by
 * sessionStorage so a refresh doesn't wipe what the user typed.
 * Persistence: `ppw_checkout_v1`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { detectRegion, COUNTRY_OPTIONS } from '../lib/region';

export interface CheckoutFormValues {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  notes: string;
}

export const EMPTY_FORM: CheckoutFormValues = {
  name: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postcode: '',
  country: 'MU',
  notes: '',
};

interface CheckoutState {
  form: CheckoutFormValues;
  setField: <K extends keyof CheckoutFormValues>(field: K, value: CheckoutFormValues[K]) => void;
  resetForm: () => void;
}

function initialForm(): CheckoutFormValues {
  const detected = detectRegion();
  const country = COUNTRY_OPTIONS.some((c) => c.code === detected) ? detected : 'MU';
  return { ...EMPTY_FORM, country };
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      form: initialForm(),
      setField: (field, value) =>
        set((s) => ({ form: { ...s.form, [field]: value } })),
      resetForm: () => set({ form: initialForm() }),
    }),
    {
      name: 'ppw_checkout_v1',
      storage: createJSONStorage(() =>
        typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage,
      ),
    },
  ),
);

/** Form validation helpers (exported for unit tests). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+]?[0-9 ()\-]{6,20}$/;

export interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export function validateCheckoutForm(form: CheckoutFormValues): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.name.trim()) errors.name = 'Required.';
  if (!form.email.trim()) {
    errors.email = 'Required.';
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Doesn’t look like an email address.';
  }
  if (!form.phone.trim()) {
    errors.phone = 'Required.';
  } else if (!PHONE_RE.test(form.phone.trim())) {
    errors.phone = 'Use international format (e.g. +230 5 123 4567).';
  }
  if (!form.addressLine1.trim()) errors.addressLine1 = 'Required.';
  if (!form.city.trim()) errors.city = 'Required.';
  if (!form.postcode.trim()) errors.postcode = 'Required.';
  if (!form.country.trim()) errors.country = 'Required.';
  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
