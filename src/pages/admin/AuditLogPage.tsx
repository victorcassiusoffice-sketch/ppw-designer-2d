/**
 * /admin/audit-log — OMS Wave 4.11 surface.
 *
 * Reads last 200 audit_log rows; filterable by action exact-match and
 * actor email substring. Wires to the shared UX kit for skeletons +
 * error states.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { ErrorBanner, SkeletonGrid, EmptyState } from '../../components/uxKit';

interface AuditRow {
  id: number;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  payload: unknown;
  createdAt: string;
}

interface AuditResponse {
  total: number;
  truncated: boolean;
  rows: AuditRow[];
}

export default function AuditLogPage(): JSX.Element {
  const { getToken } = useAuth();
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const qs = new URLSearchParams();
      if (actionFilter) qs.set('action', actionFilter);
      if (actorFilter) qs.set('actor', actorFilter);
      const res = await fetch(`/api/admin/audit-log?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setData(j as AuditResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [getToken, actionFilter, actorFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const uniqueActions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.action);
    return Array.from(s).sort();
  }, [rows]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Audit log</h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Last 200 admin-initiated mutations, most recent first.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter by action"
          style={{ padding: 6, border: '1px solid #d1d5db', borderRadius: 4 }}
        >
          <option value="">All actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by actor email"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          aria-label="Filter by actor email"
          style={{ padding: 6, border: '1px solid #d1d5db', borderRadius: 4, flex: 1, minWidth: 200 }}
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{ padding: '6px 12px' }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => void load()} />}

      {loading && !data && <SkeletonGrid rows={6} />}

      {data && data.rows.length === 0 && !loading && (
        <EmptyState
          title="No audit entries match these filters"
          message="Try clearing filters or waiting for admin activity to populate the log."
        />
      )}

      {data && data.rows.length > 0 && (
        <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: 10 }}>When</th>
                <th style={{ padding: 10 }}>Actor</th>
                <th style={{ padding: 10 }}>Action</th>
                <th style={{ padding: 10 }}>Target</th>
                <th style={{ padding: 10 }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: 10 }}>{r.actorEmail}</td>
                  <td style={{ padding: 10, fontFamily: 'monospace' }}>{r.action}</td>
                  <td style={{ padding: 10 }}>
                    {r.targetType}:{r.targetId}
                  </td>
                  <td style={{ padding: 10, color: '#6b7280' }}>{r.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.truncated && (
            <p style={{ padding: 12, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
              Showing first 200 rows. Apply filters to narrow.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
