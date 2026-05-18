/**
 * Sims-Parity DT-13 — bottom-strip catalog (GL1.07).
 *
 * Three vertical zones (V4-AU-1 palette throughout):
 *   1. category tab row  — 36 px
 *   2. filter chip row   — 28 px
 *   3. thumb scroll strip — 96 px
 *
 * Mobile (≤768 px viewport) collapses to a single 64 px slab with an
 * "All ▾" pill that expands into a bottom-sheet picker.
 *
 * DOM-based (not Konva) so Babylon DT-23 reuses this verbatim per
 * data-flow §6 P6.
 */

import { useEffect, useState } from 'react';
import { CatalogCategoryTabs, type CatalogCategory } from './CatalogCategoryTabs';
import { CatalogFilterChips, type CatalogFilter } from './CatalogFilterChips';
import { CatalogThumbStrip, type CatalogThumb } from './CatalogThumbStrip';

export interface CatalogStripProps {
  categories: CatalogCategory[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;

  filters: CatalogFilter[];
  activeFilters: Set<string>;
  onToggleFilter: (id: string) => void;

  thumbs: CatalogThumb[];
  onThumbDragStart: (thumb: CatalogThumb) => void;
}

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

function useIsMobile(breakpointPx = 768): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= breakpointPx,
  );
  useEffect(() => {
    function onResize(): void {
      setMobile(window.innerWidth <= breakpointPx);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpointPx]);
  return mobile;
}

export function CatalogStrip(props: CatalogStripProps): JSX.Element {
  const mobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (mobile) {
    const activeCat = props.categories.find((c) => c.id === props.activeCategory);
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open catalog"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            background: PALETTE.cream,
            borderTop: `1px solid ${PALETTE.ink}33`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            color: PALETTE.ink,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <span style={{
            display: 'inline-block', padding: '6px 14px',
            background: PALETTE.gold, color: PALETTE.ink, borderRadius: 999,
            fontWeight: 600,
          }}>
            {activeCat?.label ?? 'All'} ▾
          </span>
          <span style={{ marginLeft: 12, opacity: 0.6 }}>
            {props.thumbs.length} products
          </span>
        </button>
        {mobileOpen && (
          <MobileSheet onClose={() => setMobileOpen(false)} {...props} />
        )}
      </>
    );
  }

  return (
    <div
      role="region"
      aria-label="Product catalog"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: PALETTE.cream,
        borderTop: `1px solid ${PALETTE.ink}33`,
      }}
    >
      <CatalogCategoryTabs
        categories={props.categories}
        activeId={props.activeCategory}
        onChange={props.onCategoryChange}
      />
      <CatalogFilterChips
        filters={props.filters}
        active={props.activeFilters}
        onToggle={props.onToggleFilter}
      />
      <CatalogThumbStrip
        thumbs={props.thumbs}
        onDragStart={props.onThumbDragStart}
      />
    </div>
  );
}

function MobileSheet(props: CatalogStripProps & { onClose: () => void }): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,14,16,0.5)', zIndex: 900,
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          background: PALETTE.cream,
          width: '100%',
          padding: 16,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CatalogCategoryTabs
          categories={props.categories}
          activeId={props.activeCategory}
          onChange={(id) => {
            props.onCategoryChange(id);
            props.onClose();
          }}
        />
        <CatalogFilterChips
          filters={props.filters}
          active={props.activeFilters}
          onToggle={props.onToggleFilter}
        />
        <CatalogThumbStrip
          thumbs={props.thumbs}
          onDragStart={props.onThumbDragStart}
        />
      </div>
    </div>
  );
}
