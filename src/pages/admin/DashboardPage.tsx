/**
 * /admin/dashboard — Phase 7 KPI dashboard.
 *
 * Renders top-line counts + revenue from /api/admin/stats. No chart
 * library — minimal LCD-style summary cards. Phase 8 may add real charts
 * once the data shape stabilises.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface StatBucket {
  total: number;
  byStatus: Record<string, number>;
}

interface DashboardData {
  merchants: StatBucket;
  products: StatBucket;
  suppliers: StatBucket;
  orders: StatBucket;
  payouts: StatBucket;
  revenue: { totalMinor: number; byCurrency: Record<string, number> };
  generatedAt: string;
  schemaMissing: string[];
}

function StatusBreakdown({ bucket }: { bucket: StatBucket }) {
  const entries = Object.entries(bucket.byStatus);
  if (entries.length === 0) return <p style={{ color: '#9ca3af', fontSize: 12 }}>—</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
      {entries.map(([k, v]) => (
        <li key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ color: '#6b7280' }}>{k}</span>
          <strong>{v}</strong>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, total, children }: { title: string; total: number; children?: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: 'white' }}>
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>{total}</div>
      {children}
    </div>
  );
}

export default function DashboardPage(): JSX.Element {
  const { getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as DashboardData;
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Dashboard</h1>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ padding: '6px 12px' }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {data?.schemaMissing && data.schemaMissing.length > 0 && (
        <div style={{ padding: 12, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6, marginBottom: 16 }}>
          Some tables not yet provisioned: {data.schemaMissing.join(', ')}
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <Card title="Merchants" total={data.merchants.total}>
              <StatusBreakdown bucket={data.merchants} />
            </Card>
            <Card title="Products" total={data.products.total}>
              <StatusBreakdown bucket={data.products} />
            </Card>
            <Card title="Suppliers" total={data.suppliers.total}>
              <StatusBreakdown bucket={data.suppliers} />
            </Card>
            <Card title="Orders" total={data.orders.total}>
              <StatusBreakdown bucket={data.orders} />
            </Card>
            <Card title="Payouts" total={data.payouts.total}>
              <StatusBreakdown bucket={data.payouts} />
            </Card>
            <Card title="Revenue (captured)" total={Math.floor(data.revenue.totalMinor / 100)}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
                {Object.entries(data.revenue.byCurrency).map(([k, v]) => (
                  <li key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <strong>{(v / 100).toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p style={{ color: '#9ca3af', fontSize: 12 }}>
            Generated at {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
