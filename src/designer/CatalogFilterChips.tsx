/**
 * Sims-Parity DT-13 — filter chip row (28 px).
 *
 * Multi-select pill chips. Active = gold fill + ink text.
 */
export interface CatalogFilter {
  id: string;
  label: string;
}

export interface CatalogFilterChipsProps {
  filters: CatalogFilter[];
  active: Set<string>;
  onToggle: (id: string) => void;
}

export function CatalogFilterChips(props: CatalogFilterChipsProps): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Catalog filters"
      style={{
        height: 28,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '0 12px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {props.filters.map((f) => {
        const on = props.active.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            onClick={() => props.onToggle(f.id)}
            style={{
              padding: '2px 10px',
              borderRadius: 999,
              border: `1px solid ${on ? '#C0A67E' : 'rgba(14,14,16,0.2)'}`,
              background: on ? '#C0A67E' : 'transparent',
              color: on ? '#0E0E10' : 'rgba(14,14,16,0.7)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
