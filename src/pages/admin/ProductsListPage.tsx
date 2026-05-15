/**
 * /admin/products — Phase 3 product catalog admin.
 *
 * List view with status + category filters, inline "New product" form.
 * Edit/delete via row buttons. Soft-deletes only (status='archived').
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

export interface AdminProductRow {
  id: number;
  merchantId: number;
  merchantBrandName: string | null;
  sku: string;
  name: string;
  category: string;
  status: 'draft' | 'active' | 'archived' | 'out_of_stock';
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCT_STATUS_FILTERS = [
  'all',
  'draft',
  'active',
  'archived',
  'out_of_stock',
] as const;

export interface ProductFilterState {
  status: string;
  category: string;
  search: string;
}

export function applyProductFilters(
  rows: AdminProductRow[],
  f: ProductFilterState,
): AdminProductRow[] {
  const term = f.search.trim().toLowerCase();
  const cat = f.category.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (cat && r.category.toLowerCase() !== cat) return false;
    if (term && !`${r.sku} ${r.name} ${r.merchantBrandName ?? ''}`.toLowerCase().includes(term))
      return false;
    return true;
  });
}

interface NewProductFormState {
  merchantId: string;
  sku: string;
  name: string;
  category: string;
  priceMinor: string;
  currency: string;
}

const EMPTY_FORM: NewProductFormState = {
  merchantId: '',
  sku: '',
  name: '',
  category: '',
  priceMinor: '',
  currency: 'USD',
};

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function ProductsListPage(): JSX.Element {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilterState>({ status: 'all', category: '', search: '' });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewProductFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/products?limit=200', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { items: AdminProductRow[] };
      setRows(j.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => applyProductFilters(rows, filter), [rows, filter]);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getToken();
      const payload = {
        merchantId: Number(form.merchantId),
        sku: form.sku,
        name: form.name,
        category: form.category,
        priceMinor: Number(form.priceMinor),
        currency: form.currency,
      };
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setForm(EMPTY_FORM);
      setShowNew(false);
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function archive(row: AdminProductRow) {
    if (!confirm(`Archive "${row.name}" (${row.sku})?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/products?id=${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Archive failed.');
    }
  }

  async function setStatus(row: AdminProductRow, status: AdminProductRow['status']) {
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/products?id=${row.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Products</h1>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          style={{ padding: '8px 16px', background: '#0F766E', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer' }}
        >
          {showNew ? 'Cancel' : '+ New product'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={submitNew} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16, background: '#f5f5f4', borderRadius: 8, marginBottom: 16 }}>
          <input required placeholder="Merchant ID (numeric)" type="number" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} />
          <input required placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Category (e.g. ice_baths)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input required placeholder="Price (minor units)" type="number" value={form.priceMinor} onChange={(e) => setForm({ ...form, priceMinor: e.target.value })} />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="MUR">MUR</option>
          </select>
          <button type="submit" disabled={submitting} style={{ gridColumn: 'span 3', padding: '10px 16px', background: '#0F766E', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer' }}>
            {submitting ? 'Creating…' : 'Create product'}
          </button>
          {submitError && <div style={{ gridColumn: 'span 3', color: '#b91c1c' }}>{submitError}</div>}
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {PRODUCT_STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter((f) => ({ ...f, status: s }))}
            style={{
              padding: '6px 12px',
              border: filter.status === s ? '2px solid #0F766E' : '1px solid #d1d5db',
              background: filter.status === s ? '#ccfbf1' : 'white',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
        <input
          placeholder="Filter by category"
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          style={{ padding: 6, marginLeft: 12 }}
        />
        <input
          placeholder="Search SKU/name/brand"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          style={{ padding: 6, flex: 1, minWidth: 200 }}
        />
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>SKU</th>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Brand</th>
            <th style={{ padding: 8 }}>Category</th>
            <th style={{ padding: 8 }}>Price</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.sku}</td>
              <td style={{ padding: 8 }}>{r.name}</td>
              <td style={{ padding: 8 }}>{r.merchantBrandName ?? `#${r.merchantId}`}</td>
              <td style={{ padding: 8 }}>{r.category}</td>
              <td style={{ padding: 8 }}>{formatPrice(r.priceMinor, r.currency)}</td>
              <td style={{ padding: 8 }}>
                <select
                  value={r.status}
                  onChange={(e) => setStatus(r, e.target.value as AdminProductRow['status'])}
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                  <option value="out_of_stock">out_of_stock</option>
                </select>
              </td>
              <td style={{ padding: 8 }}>
                <button type="button" onClick={() => archive(r)} style={{ padding: '4px 8px' }}>
                  Archive
                </button>
              </td>
            </tr>
          ))}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No products match the filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
