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
 * #2): ⟳ rotate 90° · ⧉ duplicate · 🗑 delete · ⓘ details · ✓ confirm.
 * The spec's ✗ cancel maps to 🗑 for a just-placed item (it is already
 * committed with a 5 s Undo); ✓ keeps + deselects.
 */
import { useDesignStore } from '../store/designStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { getProductById } from '../data/products';
import {
  rotateSelected,
  duplicateSelected,
  deleteSelected,
  deselect,
  toggleSelectedLight,
  ROTATION_STEP_COARSE_DEG,
} from '../lib/placementActions';
import { haptic } from '../lib/haptics';
import { emitsLight } from './lighting';

// Paper register (Sims world 2026-08-29): charcoal ink on paper, teal accent.
const NAVY = '#2A2926';
const GOLD = '#3D8F79';
const CREAM = '#F8F5EE';
const CORAL = '#C9553F';

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

interface ClusterBtn {
  key: string;
  label: string;
  glyph: string;
  testid: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'confirm';
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
    ...(emitsLight(product)
      ? [
          {
            key: 'light',
            label: (selected.lightOn ?? true) ? 'Light off' : 'Light on',
            glyph: '☼',
            testid: 'cluster-light',
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
      glyph: '🗑',
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
  // top safe area; clamp horizontally inside the container.
  const centreX = itemLeftPx + itemWidthPx / 2;
  let left = centreX - clusterW / 2;
  left = Math.max(8, Math.min(left, containerW - clusterW - 8));

  const aboveTop = itemTopPx - GAP - clusterH;
  const flipBelow = aboveTop < 8;
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

  return (
    <div
      data-testid="floating-cluster"
      role="toolbar"
      aria-label="Selected item controls"
      className="pointer-events-auto absolute z-40 flex items-center gap-1.5 rounded-2xl px-1.5 py-1.5 shadow-xl"
      style={{
        left: leftCss,
        top: topCss,
        background: NAVY,
        border: `2px solid ${GOLD}`,
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
          className="flex items-center justify-center rounded-xl text-lg font-semibold transition active:scale-95"
          style={{
            width: BTN,
            height: BTN,
            color: b.tone === 'danger' ? '#fff' : b.tone === 'confirm' ? NAVY : CREAM,
            background:
              b.tone === 'danger' ? CORAL : b.tone === 'confirm' ? GOLD : '#2C3849',
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">{b.glyph}</span>
        </button>
      ))}
    </div>
  );
}
