/**
 * Sims-Parity DT-13 — category tab row (36 px).
 *
 * Active tab gets gold #C0A67E underline + bold ink text.
 */
export interface CatalogCategory {
  id: string;
  label: string;
}

export interface CatalogCategoryTabsProps {
  categories: CatalogCategory[];
  activeId: string;
  onChange: (id: string) => void;
}

export function CatalogCategoryTabs(props: CatalogCategoryTabsProps): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Product categories"
      style={{
        height: 36,
        display: 'flex',
        gap: 4,
        alignItems: 'stretch',
        padding: '0 12px',
        borderBottom: '1px solid rgba(14,14,16,0.1)',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {props.categories.map((c) => {
        const active = c.id === props.activeId;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => props.onChange(c.id)}
            style={{
              padding: '0 12px',
              border: 'none',
              borderBottom: `2px solid ${active ? '#C0A67E' : 'transparent'}`,
              background: 'transparent',
              color: '#0E0E10',
              fontWeight: active ? 600 : 400,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
