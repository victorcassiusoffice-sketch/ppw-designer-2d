/**
 * Thin fetch wrappers around `/api/designs` (M1.C.6) and `/api/leads`
 * (M1.C.7). Both endpoints already live in `api/orders.ts`; this file
 * is the client-side façade so `TopBar.tsx` + `MyDesignsPage.tsx` can
 * call into them without re-typing the payload shape.
 *
 * Errors are surfaced as Promise rejections with a normalised
 * `{ message }`; callers decide whether to swallow (Save is
 * fire-and-forget per the MVP) or toast (My Designs + Request Quote
 * should surface failures so the user can retry).
 */

import type { Property } from '../store/propertyStore';

export interface ApiDesign {
  id: number;
  userId: string | null;
  customerEmail: string | null;
  name: string;
  property: Property;
  cart: unknown | null;
  status: 'draft' | 'submitted' | 'quoted' | string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDesignInput {
  /** customerEmail is required when userId is absent (anonymous flow). */
  customerEmail?: string;
  /** userId comes from Clerk when signed in; not used today on Designer. */
  userId?: string;
  name: string;
  property: Property;
  cart?: unknown;
  status?: 'draft' | 'submitted' | 'quoted';
}

async function readBody(response: Response): Promise<unknown> {
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return null;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === 'string') return e;
  }
  return fallback;
}

/** POST /api/designs — create a new design row. */
export async function saveDesignToApi(input: SaveDesignInput): Promise<ApiDesign> {
  const response = await fetch('/api/designs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Save failed (${response.status})`));
  }
  const out = (body as { design?: ApiDesign } | null)?.design;
  if (!out) throw new Error('Save returned no design payload.');
  return out;
}

/** GET /api/designs?email=... — list a customer's designs (newest first). */
export async function listDesignsByEmail(email: string): Promise<ApiDesign[]> {
  const url = `/api/designs?email=${encodeURIComponent(email)}`;
  const response = await fetch(url, { method: 'GET' });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Load failed (${response.status})`));
  }
  const designs = (body as { designs?: ApiDesign[] } | null)?.designs;
  return Array.isArray(designs) ? designs : [];
}

/** GET /api/designs/:id — read a single design. */
export async function getDesignById(id: number): Promise<ApiDesign | null> {
  const response = await fetch(`/api/designs/${id}`, { method: 'GET' });
  if (response.status === 404) return null;
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Read failed (${response.status})`));
  }
  return (body as { design?: ApiDesign } | null)?.design ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Leads (M1.C.7).
// ─────────────────────────────────────────────────────────────────────

export interface SubmitLeadInput {
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  designId?: number;
  property?: Property;
  cartQuote?: unknown;
  message?: string;
  source?: string;
}

export interface ApiLead {
  id: number;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  designId: number | null;
  property: Property | null;
  cartQuote: unknown | null;
  message: string | null;
  source: string;
  createdAt: string;
}

/** POST /api/leads — submit a Request-Quote lead. */
export async function submitLead(input: SubmitLeadInput): Promise<ApiLead> {
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Submit failed (${response.status})`));
  }
  const lead = (body as { lead?: ApiLead } | null)?.lead;
  if (!lead) throw new Error('Submit returned no lead payload.');
  return lead;
}
