/** Tweak-05 category set — matches what K1 + downstream merchants stock. */
export const PRODUCT_CATEGORIES = [
  'cardio',
  'recovery',
  'sauna',
  'flooring',
  'walls',
  'decor',
  'furniture',
  // Sims world (2026-08-29) — passes straight through the catalog adapter.
  'lighting',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const ECO_CERT_OPTIONS = [
  { value: 'none', label: 'Not certified' },
  { value: 'self-declared', label: 'Self-declared' },
  { value: 'third-party-claimed', label: 'Third-party claimed' },
  { value: 'verified-certified', label: 'Verified / certified' },
] as const;

export const CURRENCIES = ['MUR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;

export interface ProductFormState {
  name: string;
  description: string;
  category: ProductCategory;
  priceMajor: string; // user types e.g. "1500" — meaning 1500 MUR
  currency: Currency;
  ecoCertLevel: 'none' | 'self-declared' | 'third-party-claimed' | 'verified-certified';
  widthMm: string;
  depthMm: string;
  heightMm: string;
  // Eco / solar (2026-09-04): optional energy figures. Read off the product
  // page by the scrape, or typed here. Stored when migration 0029 is live.
  powerW: string;
  pvWp: string;
  batteryWh: string;
  inverterW: string;
  imageFile: File | null;
}

export const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  category: 'cardio',
  priceMajor: '',
  currency: 'MUR',
  ecoCertLevel: 'none',
  widthMm: '',
  depthMm: '',
  heightMm: '',
  powerW: '',
  pvWp: '',
  batteryWh: '',
  inverterW: '',
  imageFile: null,
};

/**
 * Pure-fn — given a form state, returns either the POST body payload or
 * a list of field-level validation errors. No DOM, no fetch.
 */
export interface SubmitDecisionOk {
  ok: true;
  payload: {
    name: string;
    description: string | null;
    category: ProductCategory;
    priceMinor: number;
    currency: Currency;
    ecoCertLevel: ProductFormState['ecoCertLevel'];
    // Footprint width + depth are REQUIRED (WD-2D top-down rebuild
    // 2026-07-10): the deterministic footprint normaliser + the to-scale
    // 0.5 m-grid placement both depend on a real W×D, so it can no longer
    // be blank/free-typed. Height stays optional (shadow only).
    widthMm: number;
    depthMm: number;
    heightMm: number | null;
    powerW: number | null;
    pvWp: number | null;
    batteryWh: number | null;
    inverterW: number | null;
  };
  imageFile: File | null;
}
export interface SubmitDecisionErr {
  ok: false;
  errors: Record<string, string>;
}

export function decideProductFormSubmit(state: ProductFormState): SubmitDecisionOk | SubmitDecisionErr {
  const errors: Record<string, string> = {};

  const name = state.name.trim();
  if (!name) errors.name = 'Required.';
  if (name.length > 200) errors.name = 'Max 200 characters.';

  if (!(PRODUCT_CATEGORIES as readonly string[]).includes(state.category)) {
    errors.category = 'Invalid category.';
  }

  const priceMajor = state.priceMajor.trim();
  if (!priceMajor) {
    errors.priceMajor = 'Required.';
  } else {
    const n = Number(priceMajor);
    if (!Number.isFinite(n) || n < 0) errors.priceMajor = 'Must be a non-negative number.';
  }

  if (!(CURRENCIES as readonly string[]).includes(state.currency)) {
    errors.currency = 'Invalid currency.';
  }

  function parseDim(s: string): number | null | 'invalid' {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return 'invalid';
    return n;
  }
  const w = parseDim(state.widthMm);
  const d = parseDim(state.depthMm);
  const h = parseDim(state.heightMm);
  // Width + depth REQUIRED and positive (footprint drives to-scale placement
  // + the top-down normaliser). Height optional (shadow geometry only).
  if (w === 'invalid') errors.widthMm = 'Whole positive mm.';
  else if (w === null) errors.widthMm = 'Required — real footprint width in mm.';
  else if (w <= 0) errors.widthMm = 'Must be greater than 0.';
  if (d === 'invalid') errors.depthMm = 'Whole positive mm.';
  else if (d === null) errors.depthMm = 'Required — real footprint depth in mm.';
  else if (d <= 0) errors.depthMm = 'Must be greater than 0.';
  if (h === 'invalid') errors.heightMm = 'Whole non-negative mm.';
  // Energy (2026-09-04): optional, whole non-negative numbers.
  const pw = parseDim(state.powerW);
  const wp = parseDim(state.pvWp);
  const bwh = parseDim(state.batteryWh);
  const iw = parseDim(state.inverterW);
  if (pw === 'invalid') errors.powerW = 'Whole watts, e.g. 1500.';
  if (wp === 'invalid') errors.pvWp = 'Whole watt-peak, e.g. 450.';
  if (bwh === 'invalid') errors.batteryWh = 'Whole watt-hours, e.g. 5000.';
  if (iw === 'invalid') errors.inverterW = 'Whole watts, e.g. 5000.';

  if (state.imageFile) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(state.imageFile.type)) {
      errors.imageFile = 'PNG or JPG only.';
    } else if (state.imageFile.size > MAX_IMAGE_BYTES) {
      errors.imageFile = 'Max 5 MB.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const priceMinor = Math.round(Number(priceMajor) * 100);

  return {
    ok: true,
    payload: {
      name,
      description: state.description.trim() ? state.description.trim() : null,
      category: state.category,
      priceMinor,
      currency: state.currency,
      ecoCertLevel: state.ecoCertLevel,
      // w and d are guaranteed valid positive numbers here (guarded above).
      widthMm: w as number,
      depthMm: d as number,
      heightMm: h === null || h === 'invalid' ? null : h,
      powerW: typeof pw === 'number' ? pw : null,
      pvWp: typeof wp === 'number' ? wp : null,
      batteryWh: typeof bwh === 'number' ? bwh : null,
      inverterW: typeof iw === 'number' ? iw : null,
    },
    imageFile: state.imageFile,
  };
}
