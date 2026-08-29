/**
 * FloatingCluster — the on-canvas contextual control cluster for the
 * selected object (PARITY-MATRIX M6 + flagship F1/F3).
 *
 * This is THE fix for "rotation opens in a new screen": on touch the
 * manipulation surface used to be the full-screen slide-up DetailsPanel
 * modal. Now selecting an object shows this small cluster anchored to the
 * object ON the canvas — rotate / duplicate / delete / info / confirm all
 * happen inline, zero screen changes, matching the Sims-2 mobile spec §5.
 *
 * Rendered as a DOM overlay sibling of the Konva Stage (inside RoomCanvas,
 * where the viewport transform lives). Additive — the Konva stable-lock
 * render-core (26c144c) is untouched. The cluster only reads the selection
 * and calls the existing placementActions helpers + haptics.
 *
 * Anchoring: positioned above the object's AABB centre; flips below when
 * near the top edge; clamped horizontally within the canvas + safe-area so
 * every button stays tappable and clear of the dragging finger (spec §9).
 * Buttons are ≥48 px (Android) touch targets (spec §9 / M17).
 *
 * Button set (commit-with-undo reconciliation, see PARITY-MATRIX adaptation
 * #2): ⟳ rotate 90° · ⧉ duplicate · trash delete · ⓘ details · ✓ confirm.
 * The spec's ✗ cancel maps to delete for a just-placed item (it is already
 * committed with a 5 s Undo); ✓ keeps + deselects.
 *
 * Chrome register (toolbar contract 2026-08-29): the cluster is a chrome
 * popover (CHROME_BG + CHROME_RIM, radius 12, popover shadow) carrying the
 * SAME control recipes as CartStrip / DetailsPanel — rest = charcoal glyph
 * on chrome, active/confirm = ink fill + paper glyph, destructive = clay rim
 * (hover fills clay + white). Nothing else in the designer's palette.
 */
import type { ReactNode } from 'react';
import { useDesignStore } from '../store/designStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { getProductById } from '../data/products';
import {
  rotateSelected,
  duplicateSelected,
  deleteSelected,
  deselect,
  toggleSelectedLight,
  fillFloorWithSelected,
  ROTATION_STEP_COARSE_DEG,
} from '../lib/placementActions';
import { haptic } from '../lib/haptics';
import { emitsLight } from './lighting';
import { isFlooringProduct } from './flooringLattice';
import { CHROME_BG, CHROME_RIM } from './blueprintTheme';

// ---------------------------------------------------------------------------
// Chrome recipe (toolbar contract 2026-08-29) — same strings as CartStrip /
// DetailsPanel so the cluster is the same control set as every other
// surface. Icon-only variant: the shared CTRL_BASE minus its px-3 (the
// 48 px square comes from the inline width/height the M17 test reads).
// ---------------------------------------------------------------------------
const CTRL_BASE =
  'inline-flex items-center justify-center rounded-lg text-[12px] font-medium leading-none ' +
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] ' +
  'active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:opacity-40';
/** Rest: chrome ground + rim; hover: CHROME_HOVER_BG + darker rim. */
const CTRL_REST =
  `${CTRL_BASE} border border-ppw-rim bg-ppw-chrome text-ppw-charcoal ` +
  'hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
/** Active / tool-on: ink fill, paper text. */
const CTRL_ACTIVE = `${CTRL_BASE} border border-ppw-inkDeep bg-ppw-inkDeep text-ppw-paper`;
/** Destructive: terracotta rim; hover fills terracotta with white text. */
const CTRL_DANGER =
  `${CTRL_BASE} border border-ppw-clay bg-ppw-chrome text-ppw-charcoal ` +
  'hover:bg-ppw-clay hover:text-white';

/** Popover shadow from the contract (12 px blur, ink at 18 %). */
const POPOVER_SHADOW = '0 12px 32px rgba(42,41,38,0.18)';

/**
 * Same stroke drawing as DetailsPanel's TrashIcon, scaled to the 48 px
 * button. The old `🗑` was a COLOUR emoji: it ignores CSS `color`, so the
 * destructive rim/glyph contract could never apply to it on a real phone.
 */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export interface FloatingClusterProps {
  /** Selected item AABB top-left, in CSS px relative to the canvas container. */
  itemLeftPx: number;
  itemTopPx: number;
  itemWidthPx: number;
  /** Canvas container size (for edge-flip + clamp). */
  containerW: number;
  containerH: number;
}

const BTN = 48; // ≥48 dp touch target (spec §9 / M17)
const GAP = 14;

/**
 * Flip-below threshold. On phones (<md) the top-right readout chip sits at
 * y≈125–165 and the top-left mode buttons above it, so a cluster whose
 * computed top would land above 176 px would overlap that chip by a few px
 * (measured ~5 px at 390 wide, 2026-08-29). Flipping below the item at that
 * height keeps the cluster clear. Tablets (≥md) keep the original 8 px
 * safe-area threshold. Read at render (the cluster re-renders on every
 * selection / drag frame); guarded for jsdom + SSR where matchMedia is
 * absent.
 */
const FLIP_THRESHOLD_PHONE = 176;
const FLIP_THRESHOLD_TABLET = 8;

function flipThreshold(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return FLIP_THRESHOLD_PHONE;
  }
  return window.matchMedia('(min-width: 768px)').matches
    ? FLIP_THRESHOLD_TABLET
    : FLIP_THRESHOLD_PHONE;
}

interface ClusterBtn {
  key: string;
  label: string;
  glyph: ReactNode;
  testid: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'confirm' | 'active';
}

export function FloatingCluster({
  itemLeftPx,
  itemTopPx,
  itemWidthPx,
  containerW,
  containerH,
}: FloatingClusterProps) {
  const selectedInstanceId = useDesignStore((s) => s.selectedInstanceId);
  const placedItems = useDesignStore((s) => s.placedItems);
  const setInfoOpen = useDesignerUIStore((s) => s.setInfoOpen);

  const selected = placedItems.find((i) => i.instanceId === selectedInstanceId);
  if (!selected) return null;
  const product = getProductById(selected.productId);
  if (!product) return null;

  const lightOn = selected.lightOn ?? true;

  const buttons: ClusterBtn[] = [
    {
      key: 'rotate',
      label: 'Rotate 90°',
      glyph: '⟳',
      testid: 'cluster-rotate',
      // rotateSelected / duplicateSelected / deleteSelected fire their own
      // haptics (placementActions), so cluster handlers don't double-fire.
      onClick: () => rotateSelected(ROTATION_STEP_COARSE_DEG),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      glyph: '⧉',
      testid: 'cluster-duplicate',
      onClick: () => duplicateSelected(),
    },
    ...(isFlooringProduct(product)
      ? [
          {
            key: 'fill',
            label: 'Fill floor',
            glyph: '▦',
            testid: 'cluster-fill-floor',
            onClick: () => {
              fillFloorWithSelected();
            },
          } satisfies ClusterBtn,
        ]
      : []),
    ...(emitsLight(product)
      ? [
          {
            key: 'light',
            label: lightOn ? 'Light off' : 'Light on',
            glyph: '☼',
            testid: 'cluster-light',
            // Tool-on state = the ONE pressed look (ink fill + paper glyph).
            tone: lightOn ? 'active' : 'default',
            onClick: () => {
              toggleSelectedLight();
            },
          } satisfies ClusterBtn,
        ]
      : []),
    {
      key: 'info',
      label: 'Details',
      glyph: 'ⓘ',
      testid: 'cluster-info',
      onClick: () => setInfoOpen(true),
    },
    {
      key: 'delete',
      label: 'Delete',
      glyph: <TrashIcon />,
      testid: 'cluster-delete',
      tone: 'danger',
      onClick: () => deleteSelected(),
    },
    {
      key: 'confirm',
      label: 'Done',
      glyph: '✓',
      testid: 'cluster-confirm',
      tone: 'confirm',
      onClick: () => {
        deselect();
        haptic('select');
      },
    },
  ];

  // Cluster intrinsic size (single horizontal row).
  const clusterW = buttons.length * BTN + (buttons.length - 1) * 6 + 12;
  const clusterH = BTN + 12;

  // Anchor above the object's AABB centre; flip below if it would clip the
  // top safe area (phones: the readout-chip band, see flipThreshold);
  // clamp horizontally inside the container.
  const centreX = itemLeftPx + itemWidthPx / 2;
  let left = centreX - clusterW / 2;
  left = Math.max(8, Math.min(left, containerW - clusterW - 8));

  const aboveTop = itemTopPx - GAP - clusterH;
  const flipBelow = aboveTop < flipThreshold();
  const top = flipBelow ? itemTopPx - GAP + GAP * 2 : aboveTop;
  // When flipping below, sit just under the AABB top + a little (we don't
  // have the precise height here, so a fixed offset keeps it clear of the
  // finger which is on the body). Clamp to container bottom safe-area.
  const clampedTop = Math.max(8, Math.min(top, containerH - clusterH - 8));

  // M7 (Customer-UI fix 2026-05-31) — keep the cluster clear of the top-right
  // floating button column (Reset / Share render / Capture / area + cost +
  // count badges). If the cluster box would intrude into that zone, shove it
  // left so its controls are never hidden under those buttons.
  const TOPRIGHT_W = 140;
  const TOPRIGHT_H = 210;
  if (clampedTop < TOPRIGHT_H && left + clusterW > containerW - TOPRIGHT_W) {
    left = Math.max(8, containerW - TOPRIGHT_W - clusterW - 8);
  }

  // M6 (Customer-UI fix 2026-05-31) — fold device safe-area insets into the
  // FINAL CSS position so the cluster never lands under the notch / home-
  // indicator. The numeric clamps above keep it inside the canvas box; these
  // env() terms add the per-device insets on top.
  const leftCss = `max(calc(8px + env(safe-area-inset-left)), min(${left}px, calc(${containerW - clusterW}px - 8px - env(safe-area-inset-right))))`;
  const topCss = `max(calc(8px + env(safe-area-inset-top)), min(${clampedTop}px, calc(${containerH - clusterH}px - 8px - env(safe-area-inset-bottom))))`;

  const toneClass = (tone: ClusterBtn['tone']): string => {
    switch (tone) {
      case 'danger':
        return CTRL_DANGER;
      case 'confirm':
      case 'active':
        return CTRL_ACTIVE;
      default:
        return CTRL_REST;
    }
  };

  return (
    <div
      data-testid="floating-cluster"
      role="toolbar"
      aria-label="Selected item controls"
      className="pointer-events-auto absolute z-40 flex items-center gap-1.5 rounded-xl px-1.5 py-1.5"
      style={{
        left: leftCss,
        top: topCss,
        background: CHROME_BG,
        border: `1px solid ${CHROME_RIM}`,
        boxShadow: POPOVER_SHADOW,
        // Keep clear of notch / home-indicator if the cluster lands near an
        // edge (RoomCanvas clamps within the container, this is belt-and-braces).
        touchAction: 'none',
      }}
      // Stop taps/drags on the cluster from bubbling to the Stage (which
      // would deselect / pan).
      onPointerDown={(e) => e.stopPropagation()}
    >
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          data-testid={b.testid}
          aria-label={b.label}
          title={b.label}
          onClick={(e) => {
            e.stopPropagation();
            b.onClick();
          }}
          className={`${toneClass(b.tone)} text-lg font-semibold active:scale-95`}
          style={{
            width: BTN,
            height: BTN,
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">{b.glyph}</span>
        </button>
      ))}
    </div>
  );
}
