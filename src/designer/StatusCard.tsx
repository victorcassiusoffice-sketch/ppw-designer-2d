/**
 * Sims-Parity DT-15 — GL1.09 status card (top-left).
 *
 * Three KPIs: room value (Rs), items placed, floor area (m²).
 */
import type { RoomStats } from './useRoomStats';

export interface StatusCardProps {
  stats: RoomStats;
}

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

export function StatusCard({ stats }: StatusCardProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Room statistics"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 700,
        background: 'rgba(245, 239, 230, 0.92)',
        border: `1px solid ${PALETTE.gold}`,
        borderRadius: 8,
        padding: '10px 14px',
        color: PALETTE.ink,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(14,14,16,0.15)',
        display: 'flex',
        gap: 16,
      }}
    >
      <Kpi label="Room value" value={`Rs ${stats.totalValueMur.toLocaleString('en-MU')}`} />
      <Kpi label="Items" value={String(stats.itemCount)} />
      <Kpi label="Floor area" value={`${stats.floorAreaM2.toFixed(1)} m²`} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(14,14,16,0.5)' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#0E0E10' }}>{value}</div>
    </div>
  );
}
