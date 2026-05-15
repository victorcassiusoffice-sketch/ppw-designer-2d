/**
 * checkoutStore — Week 3, updated Hotfix 2 (Week 4b), extended Phase 1.5.
 *
 * Holds the customer info form between navigations + the selected
 * payment rail. Backed by sessionStorage so a refresh doesn't wipe
 * what the user typed.
 *
 * Persistence keys:
 *   - v1 (Week 3)              : original schema
 *   - v2 (Hotfix 2, Week 4b)   : bumped to drop stale country='GB' guesses
 *   - v3 (Phase 1.5, PayPal)   : adds selectedRail; bumping the key wipes
 *                                older sessions so the field always
 *                                materialises with the new default.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

/** Which payment rail the customer has selected. */
export type PaymentRail = 'stripe' | 'paypal';

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
  selectedRail: PaymentRail;
  setField: <K extends keyof CheckoutFormValues>(field: K, value: CheckoutFormValues[K]) => void;
  setSelectedRail: (rail: PaymentRail) => void;
  resetForm: () => void;
}

/**
 * The Checkout form's Country field always defaults to Mauritius — PPW's
 * home market. The Currency switcher still uses browser locale detection,
 * but the Country here is the shipping address and should not flip to
 * e.g. `GB` just because the browser locale is `en-GB`. Users in other
 * markets will change it explicitly from the dropdown.
 */
function initialForm(): CheckoutFormValues {
  return { ...EMPTY_FORM };
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      form: initialForm(),
      selectedRail: 'stripe',
      setField: (field, value) =>
        set((s) => ({ form: { ...s.form, [field]: value } })),
      setSelectedRail: (rail) => set({ selectedRail: rail }),
      resetForm: () => set({ form: initialForm(), selectedRail: 'stripe' }),
    }),
    {
      name: 'ppw_checkout_v3',
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
