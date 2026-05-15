/**
 * /admin/suppliers — Phase 3 supplier admin.
 *
 * List + inline create + status flip + soft-suspend.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

export interface AdminSupplierRow {
  id: number;
  merchantId: number;
  merchantBrandName: string | null;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
  country: string;
  status: 'pending' | 'active' | 'suspended';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SUPPLIER_STATUS_FILTERS = ['all', 'pending', 'active', 'suspended'] as const;

export interface SupplierFilterState {
  status: string;
  search: string;
}

export function applySupplierFilters(
  rows: AdminSupplierRow[],
  f: SupplierFilterState,
): AdminSupplierRow[] {
  const term = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (term && !`${r.name} ${r.contactEmail} ${r.merchantBrandName ?? ''}`.toLowerCase().includes(term))
      return false;
    return true;
  });
}

interface NewSupplierFormState {
  merchantId: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
}

const EMPTY_FORM: NewSupplierFormState = {
  merchantId: '',
  name: '',
  contactEmail: '',
  contactPhone: '',
  country: 'MU',
};

export default function SuppliersListPage(): JSX.Element {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<AdminSupplierRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SupplierFilterState>({ status: 'all', search: '' });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewSupplierFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/suppliers?limit=200', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { items: AdminSupplierRow[] };
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

  const filtered = useMemo(() => applySupplierFilters(rows, filter), [rows, filter]);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getToken();
      const payload = {
        merchantId: Number(form.merchantId),
        name: form.name,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || null,
        country: form.country,
      };
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
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

  async function setStatus(row: AdminSupplierRow, status: AdminSupplierRow['status']) {
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/suppliers?id=${row.id}`, {
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

  async function suspend(row: AdminSupplierRow) {
    if (!confirm(`Suspend "${row.name}"?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/suppliers?id=${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Suspend failed.');
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Suppliers</h1>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          style={{ padding: '8px 16px', background: '#0F766E', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer' }}
        >
          {showNew ? 'Cancel' : '+ New supplier'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={submitNew} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16, background: '#f5f5f4', borderRadius: 8, marginBottom: 16 }}>
          <input required placeholder="Merchant ID" type="number" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} />
          <input required placeholder="Supplier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Contact email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <input placeholder="Contact phone (optional)" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          <input required placeholder="Country (2-letter)" maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <button type="submit" disabled={submitting} style={{ gridColumn: 'span 3', padding: '10px 16px', background: '#0F766E', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer' }}>
            {submitting ? 'Creating…' : 'Create supplier'}
          </button>
          {submitError && <div style={{ gridColumn: 'span 3', color: '#b91c1c' }}>{submitError}</div>}
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {SUPPLIER_STATUS_FILTERS.map((s) => (
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
          placeholder="Search name/email/brand"
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
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Brand</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Country</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: 8 }}>{r.name}</td>
              <td style={{ padding: 8 }}>{r.merchantBrandName ?? `#${r.merchantId}`}</td>
              <td style={{ padding: 8 }}>{r.contactEmail}</td>
              <td style={{ padding: 8 }}>{r.country}</td>
              <td style={{ padding: 8 }}>
                <select value={r.status} onChange={(e) => setStatus(r, e.target.value as AdminSupplierRow['status'])}>
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
              </td>
              <td style={{ padding: 8 }}>
                <button type="button" onClick={() => suspend(r)} style={{ padding: '4px 8px' }}>
                  Suspend
                </button>
              </td>
            </tr>
          ))}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No suppliers match the filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
