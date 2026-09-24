import { WallSurfaceOptions } from './WallSurfaceOptions';
import { constructionHex } from '../designer/wallConstruction';
/**
 * TopBar — designer chrome, rebuilt to the toolbar contract (2026-08-29).
 *
 * Audit: docs/sims-world-2026-08-29/audit-2026-08-29b/ — at 1366 the
 * Rectangle|Draw segment was flex-shrunk to 9 px and Draw was unclickable;
 * with the door tool on, Save/Load/Quote/Help fell off the right edge.
 *
 * Layout (md+): ONE 52 px row, flex-nowrap, five groups left → right:
 *   1 IDENTITY   brand tile · rooms trigger (the only group that may shrink)
 *   2 BUILD      Walls · Door · Floor · Measure   (segmented, ink when on)
 *   3 ROOM&PLAN  Box | Custom · Storeys · Plot
 *   4 VIEW       Snap · Grid · 3D · Undo/Redo
 *   5 COMMERCE   Currency · Cart · Request quote (the ONE gold CTA) · More
 * Door options live in a 40 px sub-bar under the row while the door tool
 * is on. The Floor tool (2026-08-30) gets a DOCKED 272 px panel on the right
 * edge (fixed, header-bottom → dock-top) rather than a popover over the room:
 * the popover sat on 17 % of the auto-centred room at 1366 and the first
 * click hit its own Erase button. The panel publishes `--floor-panel-w` on
 * <html> (0px when closed) so the canvas insets its fit around it.
 * Every popover is portaled to <body> and positioned from its
 * anchor's rect, so the middle rail can fall back to `overflow-x:auto`
 * without ever clipping a dropdown.
 *
 * Responsive tiers: ≥1536 all labels · 1280–1535 ROOM&PLAN + VIEW icon-only
 * (labels → title tooltips) · 768–1279 ROOM&PLAN collapses into a "Room"
 * popover and VIEW into a "View" popover (BUILD goes icon-only too — at
 * 1024 the labels do not fit). The Box|Custom segment stays inline at every
 * width so `room-draw-toggle` is always directly clickable.
 *
 * <md: a 56 px strip — brand · rooms · Walls (the Custom half) · hamburger —
 * and a full-height right sheet (portal) holding every mobile control.
 *
 * Invariants (Playwright strict mode): every data-testid renders ONCE. The
 * collapsed Room / View groups render the SAME fragment either inline or
 * inside their popover, decided by a JS media query, never both.
 *
 * Carryover: CurrencySwitcher · Cart badge Link · Save/Load v2 under
 * `ppw_properties_v2` · L/W inputs only edit the active room AND only when
 * its polygon is rectangular · rooms dropdown state lifted to App.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useDesignStore, isActiveRoomRectangle } from '../store/designStore';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignsStore } from '../store/designsStore';
import { useToastStore } from '../store/toastStore';
import { useHistoryStore } from '../store/historyStore';
import {
  useDesignerUIStore,
  PRECISION_STEP_M,
  SNAP_UNIT_ORDER,
  SNAP_UNIT_LABEL,
} from '../store/designerUIStore';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { isDrawnPolygon } from '../designer/roomLayout';
import { floorTargetRoom } from '../designer/floorTarget';
// Sims world (2026-08-29): storeys + land plot live on the property.
import {
  activeLevelIdOf,
  isOutdoorRoom,
  levelsOf,
  nextLevelName,
  visibleRooms,
  roomsOnLevel,
  isRoofLevel,
  roofLevelOf,
  storeyLevels,
} from '../designer/levels';
// Roof (eco / solar 2026-09-04): slab area for the Storeys row + Roof button.
import { roofAreaM2 } from '../designer/roof';
// Energy readout (eco / solar 2026-09-04): docked aside + phone sheet section.
import { EnergyPanel, EnergySummary } from './EnergyPanel';
import { ToolPanelHeader } from './ToolPanelHeader';
import { performUndo, performRedo } from '../lib/undoIntent';
// Polish (2026-08-29): "New plan" under More — PageTabs is hidden while there
// is a single plan, so this is how a second plan gets started.
import { createPage, switchToPage } from '../lib/pages';
import { activeDemo, setActiveDemo } from '../demo/demoCatalog';
import {
  DEFAULT_WALL_HEIGHT_M,
  MAX_WALL_HEIGHT_M,
  MIN_WALL_HEIGHT_M,
  WALL_PAINTS,
  DEFAULT_PAINT_WASTE_PCT,
  MAX_PAINT_COATS,
  MAX_PAINT_WASTE_PCT,
  MIN_PAINT_COATS,
  TINTED_PAINT_WASTE_PCT,
  brandHasColourChart,
  brandIdOfPaint,
  brandsWithPaints,
  coloursForPaint,
  findPaintBrandById,
  findWallPaintById,
  isPaintTintable,
  loadPaintColourChart,
  normalisePaintColourHex,
  paintsForBrand,
  primerForBrand,
  resolveWallColourHex,
  tinsForPaintColour,
  BARE_PLASTER_HEX,
  type PaintColour,
  type WallPaint,
} from '../data/wallPaints';
import { SOFAP_COLOUR_DISCLAIMER } from '../data/sofapColours';
import { TINTEX_COLOUR_DISCLAIMER } from '../data/tintexColours';
import { coatsFor, deriveWallPaintOrders, exteriorPaintAreaM2, litresForArea, paintableEdgeAreaM2, tinsForLitres, wallPaintBreakdown, wastePctFor } from '../designer/wallPaintCalc';
// Wall paint tints + the Sims-style 3D room view (2026-09-14).
import { applyWallPaintBrush, brushColour, brushLabel, brushPaintId } from '../designer/wallPaintBrush';
import { applyFloorPaintBrush } from '../designer/floorPaintBrush';
import { applyCladdingBrush, claddingBrushId, claddingBrushLabel } from '../designer/claddingBrush';
import { deriveCladdingOrders } from '../designer/claddingCalc';
import { CLADDING_DEMO_DISCLAIMER, CLADDING_PRODUCTS, findCladdingProduct } from '../data/claddingCatalog';
import { RoomView3D } from './RoomView3D';
import './houseToolPanels.css';
import { FLOOR_MATERIALS, findFloorMaterialById, type FloorMaterial } from '../data/floorMaterials';
import { productImageForSku } from '../data/products';
// Floor tool (2026-08-30): the docked panel prices the active room's floor
// with the SAME derivation the cart uses (roomFloorOrders → units × MUR
// price → display currency), so the panel and the cart can never disagree.
import { roomFloorOrders } from '../designer/floorTiles';
import { convert } from '../lib/fx';
import { formatCurrency } from '../lib/currency';
import { useCurrencyStore } from '../store/currencyStore';
import { useWallStore } from '../store/wallStore';
import { useCart } from '../store/cartStore';
import { CurrencySwitcher } from './CurrencySwitcher';
import {
  getCachedCustomerEmail,
  promptForCustomerEmail,
} from '../lib/customerIdentity';
import { saveDesignToApi, submitLead } from '../lib/designsApi';
import {
  CHROME_BG,
  CHROME_RAIL_BG,
  CHROME_RIM,
  CHROME_TEXT,
  CHROME_TEXT_2,
} from '../designer/blueprintTheme';

export interface TopBarProps {
  drawMode: boolean;
  setDrawMode: (v: boolean) => void;
  /** Mobile UX (fix/mobile-ux-v1) — Rooms drawer state lifted to App. */
  roomsMenuOpen?: boolean;
  setRoomsMenuOpen?: (v: boolean) => void;
  /**
   * Polish B / V4-AU-1 conflict resolution: the 3D-preview toggle
   * migrates from the canvas top-right slot (now reserved for the
   * MiniCartPill) into the TopBar overflow menu.
   */
  threeDPreview?: boolean;
  setThreeDPreview?: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Class recipes — literal strings so Tailwind's scanner sees every utility.
// ---------------------------------------------------------------------------

/** 40 px control: rim at rest, hover wash, inset press, focus ring. */
const BTN =
  'inline-flex h-10 min-w-[40px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[12px] font-medium leading-none transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40';
const BTN_REST =
  'border-ppw-rim bg-ppw-chrome text-[#37362f] hover:border-[rgba(42,41,38,0.35)] hover:bg-[#f3f1ec]';
const BTN_ON = 'border-ppw-inkDeep bg-ppw-inkDeep text-ppw-paper';
const BTN_CTA =
  'border-ppw-gold bg-ppw-gold font-semibold text-ppw-navy hover:brightness-105 disabled:opacity-60';
/** Square 40 icon button (Grid, Undo, Redo, More). */
const BTN_ICON = 'w-10 px-0';
/** Segment inside a rimmed group: no own rim, inset focus ring. */
const SEG =
  'inline-flex h-10 min-w-[40px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 text-[12px] font-medium leading-none transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40';
const SEG_REST = 'bg-ppw-chrome text-[#37362f] hover:bg-[#f3f1ec]';
const SEG_ON = 'bg-ppw-inkDeep text-ppw-paper';
/** Radio half that is CHECKED but not live (Box at rest): rail wash + semibold,
    never ink — ink is reserved for a tool that is on / a popover that is open. */
const SEG_CHECKED = 'bg-ppw-rail font-semibold text-[#37362f] hover:bg-[#f3f1ec]';
/** Ink primary — commits a setting (Lock plot). Same recipe as CartStrip's
    CTRL_INK so the two surfaces are one control set; gold stays for Request quote. */
const BTN_INK = 'border-ppw-inkDeep bg-ppw-inkDeep font-semibold text-ppw-paper hover:brightness-110';
const SEG_GROUP = 'inline-flex shrink-0 overflow-hidden rounded-lg border border-ppw-rim divide-x divide-ppw-rim';
/** 36 px popover row. Colour is inherited from the popover (CHROME_TEXT) so
    the ON state's paper text is the only colour utility on the row. */
const ROW =
  'flex min-h-[36px] w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] font-medium transition-colors duration-[120ms] ease-out motion-reduce:transition-none hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';
const ROW_ON = 'bg-ppw-inkDeep text-ppw-paper hover:bg-ppw-inkDeep';
/** 48 px sheet row (mobile). */
const SHEET_ROW =
  'flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium transition-colors duration-[120ms] ease-out motion-reduce:transition-none hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';
const SHEET_ROW_ON = 'bg-ppw-inkDeep text-ppw-paper hover:bg-ppw-inkDeep';
const CAPTION = 'px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em]';
/** Floor tool (2026-08-30): docked panel width, also published as `--floor-panel-w`. */
const FLOOR_PANEL_W = 272;
/** 40 px chip inside the Floor panel — chrome recipe (CartStrip / DetailsPanel CTRL_*). */
const CHIP =
  'inline-flex h-10 min-w-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[12px] font-medium leading-none transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40';
const CHIP_REST = 'border-ppw-rim bg-ppw-chrome text-ppw-charcoal hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
const CHIP_ON = 'border-ppw-inkDeep bg-ppw-inkDeep font-semibold text-ppw-paper';
/** Destructive: terracotta rim + charcoal label at rest; Erase-on keeps the rim and adds a clay wash. */
const CHIP_DANGER = 'border-ppw-clay bg-ppw-chrome text-ppw-charcoal hover:bg-[#f3f1ec]';
const CHIP_DANGER_ON = 'border-ppw-clay bg-[rgba(201,85,63,0.14)] font-semibold text-ppw-charcoal';
/** Group divider: a 1 px rim with 4 px either side up to xl, 8 from 2xl,
    12 from 1700 (all on the 4/8/12 spacing ladder). Polish (2026-08-29):
    measured at 1366 the six ROOM&PLAN / VIEW labels + Walls + Quote need
    every one of the 5 × 8 px the old `mx-2` spent. */
const DIVIDER = 'mx-1 h-6 w-px shrink-0 bg-ppw-rim 2xl:mx-2 min-[1700px]:mx-3';
const INPUT =
  'h-10 rounded-lg border border-ppw-rim bg-ppw-chrome px-2 text-right text-[12px] font-semibold tabular-nums text-[#37362f] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';

// ---------------------------------------------------------------------------
// Icons — inline 16 px SVGs, stroke currentColor 1.6, round caps.
// ---------------------------------------------------------------------------

type IconName =
  | 'list'
  | 'cursor'
  | 'hammer'
  | 'pen'
  | 'door'
  | 'roller'
  | 'tiles'
  | 'ruler'
  | 'box'
  | 'polygon'
  | 'swatch'
  | 'storeys'
  | 'plot'
  | 'snap'
  | 'grid'
  | 'cube'
  | 'undo'
  | 'redo'
  | 'cart'
  | 'more'
  | 'menu'
  | 'close'
  | 'view'
  | 'room'
  | 'send'
  | 'roof'
  | 'sun'
  | 'bolt';

const ICON_PATHS: Record<IconName, string> = {
  list: 'M3 4h10M3 8h10M3 12h10',
  // Select/Move (P2 2026-08-31): the classic arrow pointer, so the user
  // always has a visible way back to grabbing / rotating / deleting an object.
  cursor: 'M3 2L3 12L5.6 9.4L7.2 13L8.7 12.3L7.1 8.9L10.5 8.9Z',
  pen: 'M3 13l1-3.5L11 2.5l2.5 2.5-7 7L3 13zM9.5 4l2.5 2.5',
  door: 'M4 14V2h8v12M4 14h8M10 8.5v.5',
  roller: 'M2.5 3.5h9a1 1 0 011 1v1.5a1 1 0 01-1 1h-9a1 1 0 01-1-1V4.5a1 1 0 011-1zM12.5 5h1.5v3H8v2M8 10v3.5',
  // Floor tool (2026-08-30): a 2 × 2 tile lattice, not the paint roller —
  // the customer lays tiles they buy, they do not paint.
  tiles: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  ruler: 'M2 11l9-9 3 3-9 9-3-3zM5 8l1.5 1.5M7 6l1.5 1.5M9 4l1.5 1.5',
  box: 'M2.5 3.5h11v9h-11z',
  polygon: 'M3 3h6l4 4v6H3zM9 3v4h4',
  swatch: 'M2.5 2.5h11v11h-11zM2.5 8h11M8 2.5v11',
  storeys: 'M2 5l6-3 6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3',
  plot: 'M2.5 2.5h3M10.5 2.5h3M2.5 13.5h3M10.5 13.5h3M2.5 2.5v3M2.5 10.5v3M13.5 2.5v3M13.5 10.5v3',
  snap: 'M4 2v6a4 4 0 008 0V2M4 2h2M10 2h2M4 6h2M10 6h2',
  grid: 'M2 6h12M2 10h12M6 2v12M10 2v12',
  cube: 'M8 2l5.5 3v6L8 14l-5.5-3V5L8 2zM8 8l5.5-3M8 8v6M8 8L2.5 5',
  undo: 'M3 7h7a3 3 0 010 6H7M3 7l3-3M3 7l3 3',
  redo: 'M13 7H6a3 3 0 000 6h3M13 7l-3-3M13 7l-3 3',
  cart: 'M2 3h2l1.5 7h6.5l1.5-5H5M6.5 13a.5.5 0 100 .01M11.5 13a.5.5 0 100 .01',
  more: 'M8 3.5v.01M8 8v.01M8 12.5v.01',
  menu: 'M2 4h12M2 8h12M2 12h12',
  close: 'M4 4l8 8M12 4l-8 8',
  view: 'M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4zM8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  room: 'M2.5 13.5v-8l5.5-3 5.5 3v8h-11zM6.5 13.5v-4h3v4',
  send: 'M2.5 8l11-5.5-3 11-2.5-4.5L2.5 8z',
  // Remove tool (2026-08-31): a sledgehammer — head top-right, handle down-left.
  hammer: 'M8.5 2.5l5 5-2 2-5-5zM6.5 7l-4 4.5 1.5 1.5 4.5-4z',
  // Eco / solar (2026-09-04): a flat slab with a panel on it (roof), a sun,
  // and a bolt for the energy readout.
  roof: 'M2 9.5l6-5 6 5M3.5 8.5v5h9v-5M6 10.5h4v2H6z',
  sun: 'M8 5.25a2.75 2.75 0 100 5.5 2.75 2.75 0 000-5.5zM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1',
  bolt: 'M9 1.5L3.5 9h4l-.5 5.5L12 7H8z',
};

function Icon({ name, size = 16, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={ICON_PATHS[name]}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers — media query + portal popover. Kept in this file (P1 owns
// only TopBar.tsx).
// ---------------------------------------------------------------------------

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

interface PopoverProps {
  anchor: RefObject<HTMLElement>;
  open: boolean;
  /** Outside-click + Esc close. Omit for popovers tied to tool state. */
  onClose?: () => void;
  width: number;
  align?: 'left' | 'right';
  children: ReactNode;
  className?: string;
  /** DOM id — the trigger points at it with `aria-controls`. */
  id: string;
  /** `dialog` for pickers / panels, `menu` for the More list. */
  role?: 'dialog' | 'menu';
  /** Accessible name for the dialog / menu. */
  label: string;
  /**
   * `mounted`: render in place (fixed-positioned, so an `overflow` rail never
   * clips it) and keep it in the DOM with `hidden` while closed — used for the
   * Room-size popover so the L/W inputs stay the first number inputs on the
   * page (units.spec reads their min/step without opening anything).
   */
  mode?: 'portal' | 'mounted';
}

/**
 * Portal popover: fixed-positioned from the anchor's rect, radius 12, rim,
 * 8 px padding, drop shadow. Re-measures on resize/scroll. Clicks inside ANY
 * popover or the sheet never count as "outside" so nested pickers (a Snap
 * picker inside the collapsed View popover) do not close their parent.
 */
function Popover({
  anchor,
  open,
  onClose,
  width,
  align = 'left',
  children,
  className = '',
  mode = 'portal',
  id,
  role = 'dialog',
  label,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = () => {
      const r = anchor.current?.getBoundingClientRect();
      // Polish (2026-08-29): an anchor that is `display:none` at this width
      // (the md+ Paint segment on the phone) reports a 0×0 rect at 0,0 — a
      // popover glued to the top-left corner is worse than none. Stay unmounted.
      if (!r || (r.width === 0 && r.height === 0)) {
        setPos(null);
        return;
      }
      const vw = window.innerWidth;
      let left = align === 'right' ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, vw - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, anchor, width, align]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (anchor.current?.contains(t)) return;
      if (t.closest('[data-ppw-popover],[data-ppw-sheet]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchor]);

  const shown = open && !!pos;
  if (mode === 'portal' && (!shown || typeof document === 'undefined')) return null;
  const node = (
    <div
      ref={ref}
      id={id}
      role={role}
      aria-label={label}
      data-ppw-popover=""
      hidden={!shown}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width,
        zIndex: 40,
        background: CHROME_BG,
        color: CHROME_TEXT,
        borderColor: CHROME_RIM,
        boxShadow: '0 12px 32px rgba(42,41,38,0.18)',
      }}
      className={`max-h-[calc(100vh-80px)] overflow-y-auto rounded-xl border p-2 ${className}`}
    >
      {children}
    </div>
  );
  if (mode === 'mounted') return node;
  return createPortal(node, document.body);
}

// ---------------------------------------------------------------------------

export function TopBar({
  drawMode,
  setDrawMode,
  roomsMenuOpen = false,
  setRoomsMenuOpen,
  threeDPreview = false,
  setThreeDPreview,
}: TopBarProps) {
  const navigate = useNavigate();
  const room = useDesignStore((s) => s.roomDimensions);
  const setRoom = useDesignStore((s) => s.setRoomDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const placedItems = useDesignStore((s) => s.placedItems);

  const property = usePropertyStore((s) => s.property);
  const resetToDefault = usePropertyStore((s) => s.resetToDefault);
  const loadProperty = usePropertyStore((s) => s.loadProperty);

  const designs = useDesignsStore((s) => s.designs);
  const currentId = useDesignsStore((s) => s.currentId);
  const savePropertyAs = useDesignsStore((s) => s.savePropertyAs);
  const setCurrent = useDesignsStore((s) => s.setCurrent);
  const removeSavedDesign = useDesignsStore((s) => s.remove);

  const pushToast = useToastStore((s) => s.push);
  // Merchant demo pill (2026-09-05) — read at render; App activates the demo
  // synchronously before this component ever mounts, and leaving reloads.
  const demoPill = activeDemo();

  const cart = useCart();
  const activeRoomIsRect = isActiveRoomRectangle();

  // Tweak 07 (Phase A.0) — undo/redo wiring. Subscribe via state shape
  // so disabled-states track the stack length.
  const pastLength = useHistoryStore((s) => s.past.length);
  const futureLength = useHistoryStore((s) => s.future.length);
  // Live in-flight draw state, so the undo button reflects the SHARED ladder
  // rather than only the history stack. Without this the button sits disabled
  // while a polygon is being drawn on an empty history - looking dead at the
  // exact moment undo is most useful.
  const drawInFlight = useDrawProgressStore((s) => s.enabled && s.vertices.length > 0);
  // DRAWN rooms only — a fresh canvas always holds one blank seed room, and
  // reporting "1 room" over an empty plan is wrong. Outdoor containers are
  // not rooms either (Sims world 2026-08-29).
  const drawnRoomCount = visibleRooms(property.rooms).filter((r) => isDrawnPolygon(r.polygon)).length;

  // Storeys (Sims world 2026-08-29). The active level is a property field;
  // the popover lists every level, adds one, renames inline, deletes empty
  // ones. PageUp / PageDown walk the same list from the keyboard.
  const levels = levelsOf(property);
  const activeLevelId = activeLevelIdOf(property);
  const activeLevel = levels.find((l) => l.id === activeLevelId) ?? levels[0];
  // Roof (eco / solar 2026-09-04). One level on top of the building; the
  // wall tools refuse it (a roof has no walls) and the Roof button toggles
  // between it and the top storey.
  const onRoof = isRoofLevel(activeLevel);
  const ensureRoofLevel = usePropertyStore((s) => s.ensureRoofLevel);
  const addLevel = usePropertyStore((s) => s.addLevel);
  const renameLevel = usePropertyStore((s) => s.renameLevel);
  const removeLevel = usePropertyStore((s) => s.removeLevel);
  const setActiveLevel = usePropertyStore((s) => s.setActiveLevel);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [levelEditId, setLevelEditId] = useState<string | null>(null);
  const [levelDraft, setLevelDraft] = useState('');

  // Land plot (Sims world 2026-08-29). Locks the world to a W x D rectangle:
  // rooms, walls and items must stay inside it, and the readout shows how
  // much of the plot is built.
  const site = property.site ?? null;
  const setSite = usePropertyStore((s) => s.setSite);
  const [landOpen, setLandOpen] = useState(false);
  const [landW, setLandW] = useState(site ? String(site.widthM) : '20');
  const [landD, setLandD] = useState(site ? String(site.depthM) : '15');

  function commitLevelRename() {
    if (levelEditId) renameLevel(levelEditId, levelDraft.trim() || 'Level');
    setLevelEditId(null);
    setLevelDraft('');
  }

  function handleAddLevel() {
    const id = addLevel(nextLevelName(levels));
    pushToast(`Added ${nextLevelName(levels)} — you are now on it`, 'success');
    setLevelEditId(null);
    return id;
  }

  function handleRemoveLevel(id: string) {
    const ok = removeLevel(id);
    pushToast(
      // "Storey", not "floor": the Floor tool owns that word now.
      ok ? 'Storey removed' : 'Clear that storey first — it still has rooms or walls',
      ok ? 'info' : 'warn',
    );
  }

  function applyLand() {
    const w = Number(landW);
    const d = Number(landD);
    if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) {
      pushToast('Enter the plot width and depth in metres.', 'warn');
      return;
    }
    setSite({ widthM: w, depthM: d, originM: site?.originM ?? { x: 0, y: 0 } });
    pushToast(`Plot locked at ${w} × ${d} m`, 'success');
    setLandOpen(false);
  }

  function clearLand() {
    setSite(null);
    pushToast('Plot cleared — unlimited land', 'info');
    setLandOpen(false);
  }
  // Mobile Safari long-press confirm — Tweak 07 §7. A first tap arms;
  // a second tap within 1500ms fires. Desktop fires immediately.
  const [mobileUndoArmed, setMobileUndoArmed] = useState(false);
  const isCoarsePointer =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  function handleUndoClick() {
    if (isCoarsePointer && !mobileUndoArmed) {
      setMobileUndoArmed(true);
      pushToast('Tap Undo again to confirm', 'info', 1500);
      window.setTimeout(() => setMobileUndoArmed(false), 1500);
      return;
    }
    setMobileUndoArmed(false);
    // Route through the shared undo ladder, NOT straight into the history
    // store. Mid-draw this steps back one vertex instead of reaching past the
    // in-flight polygon into the global history - which is what made the
    // button and Ctrl+Z disagree.
    performUndo();
  }

  // 2026-06-01 — Wall tool, folded in from the removed ModeStrip. Wall
  // reads/toggles the wall-draw FSM directly (no local mode state):
  // pressed === FSM not idle.
  //
  // 2026-06-09 — the TopBar "Clear" button was retired in favour of the
  // two always-visible STICKY clear buttons pinned to the canvas
  // (ClearControls: "Clear products" / "Clear all"). The full-room
  // `clearActiveRoomContents` helper still lives in lib/clearActions for
  // any future caller, but the toolbar no longer hosts a third clear.
  const wallDrawPhase = useWallStore((s) => s.draw.phase);
  const setWallDraw = useWallStore((s) => s.setDraw);
  const wallActive = wallDrawPhase !== 'idle';

  // Openings tool (2026-08-28). Lives on designerUIStore.tool so it is
  // mutually exclusive with the other build tools by construction.
  const tool = useDesignerUIStore((s) => s.tool);
  const setTool = useDesignerUIStore((s) => s.setTool);
  const doorDraft = useDesignerUIStore((s) => s.doorDraft);
  const setDoorDraft = useDesignerUIStore((s) => s.setDoorDraft);
  const toggleDoorFacing = useDesignerUIStore((s) => s.toggleDoorFacing);
  const toggleDoorHand = useDesignerUIStore((s) => s.toggleDoorHand);
  const doorActive = tool === 'door';
  const measureActive = tool === 'measure';
  const floorPaintActive = tool === 'floor';
  const wallPaintActive = tool === 'wallpaint';
  const claddingActive = tool === 'cladding';
  const removeActive = tool === 'sledgehammer';
  // Select/Move (P2 2026-08-31, complaint B). The default tool is on when
  // NOTHING else is: hand, no room-draw, no wall run, no door/floor/measure.
  const selectActive =
    tool === 'hand' &&
    !drawMode &&
    !wallActive &&
    !doorActive &&
    !floorPaintActive &&
    !wallPaintActive &&
    !claddingActive &&
    !measureActive;
  const floorDraft = useDesignerUIStore((st) => st.floorDraft);
  const setFloorDraft = useDesignerUIStore((st) => st.setFloorDraft);
  const wallPaintDraft = useDesignerUIStore((st) => st.wallPaintDraft);
  const setWallPaintDraft = useDesignerUIStore((st) => st.setWallPaintDraft);
  const claddingDraft = useDesignerUIStore((st) => st.claddingDraft);
  const setCladdingDraft = useDesignerUIStore((st) => st.setCladdingDraft);
  // 3D Mode (2026-09-17): the room view is a mode of the whole designer.
  const viewMode = useDesignerUIStore((st) => st.viewMode);
  const setViewMode = useDesignerUIStore((st) => st.setViewMode);
  // Optional: P2 may publish the in-flight stroke's tile count so the live
  // line can read "+n tiles" mid-drag. Read defensively — the field is not
  // part of this store's contract yet, and 0 is the honest fallback.
  const floorPreviewCount = useDesignerUIStore(
    (st) => (st as unknown as { floorPreviewCount?: number }).floorPreviewCount ?? 0,
  );

  // Floor tool (2026-08-30). ONE tool named "Floor": the old whole-room
  // "Finish" picker and the per-tile "Paint" brush are folded into it. Room
  // scope lays the whole ACTIVE room in one action; both actions live on the
  // property store so they are one undo frame each.
  const fillRoomFloor = usePropertyStore((s) => s.fillRoomFloor);
  const clearRoomFloor = usePropertyStore((s) => s.clearRoomFloor);
  const paintRoomWalls = usePropertyStore((s) => s.paintRoomWalls);
  const paintFreeWall = usePropertyStore((s) => s.paintFreeWall);
  const setWallHeight = usePropertyStore((s) => s.setWallHeight);
  const setWallPaintCoats = usePropertyStore((s) => s.setWallPaintCoats);
  const setWallPaintWastePct = usePropertyStore((s) => s.setWallPaintWastePct);
  const setWallPaintPrimer = usePropertyStore((s) => s.setWallPaintPrimer);
  const setFreeWallPaintFaces = usePropertyStore((s) => s.setFreeWallPaintFaces);
  const displayCurrency = useCurrencyStore((s) => s.currency);
  const fx = useCurrencyStore((s) => s.fx);
  // Units brief (2026-08-28, D7). A popover, not a six-way segmented
  // control on desktop; the phone sheet shows the six chips in one row.
  const [unitOpen, setUnitOpen] = useState(false);
  const precision = useDesignerUIStore((s) => s.precision);
  const setPrecision = useDesignerUIStore((s) => s.setPrecision);
  const snapStepM = PRECISION_STEP_M[precision];

  /** Roof (2026-09-04): the wall tools have nothing to do on a slab. */
  function roofBlocksWalls(): boolean {
    if (!onRoof) return false;
    pushToast('The roof has no walls — switch to a storey to build walls, doors or paint.', 'warn');
    return true;
  }

  function handleToggleRoof() {
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    if (onRoof) {
      const storeys = storeyLevels(levels);
      setActiveLevel(storeys[storeys.length - 1]?.id ?? 'ground');
      return;
    }
    ensureRoofLevel();
    const area = roofAreaM2(usePropertyStore.getState().property);
    pushToast(
      area > 0
        ? `Roof — ${area.toFixed(0)} m² of slab. Lay solar panels, air-con, planters or flooring here.`
        : 'Roof — draw a room on a storey first; the roof follows the building.',
      'info',
    );
  }

  function handleToggleDoor() {
    if (roofBlocksWalls()) return;
    // Room-draw and wall-draw own the canvas pointer while they are live, so
    // stand them down rather than letting two tools fight over the same click.
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(doorActive ? 'hand' : 'door');
  }

  function handleToggleFloorPaint() {
    // Same three exclusions every other tool takes: wall mode lives on
    // wallStore.draw.phase, room-draw on App-level drawMode, and door/measure
    // on designerUIStore.tool. Miss one and two tools fight the same click.
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(floorPaintActive ? 'hand' : 'floor');
  }

  function handleToggleWallPaint() {
    if (roofBlocksWalls()) return;
    // Same exclusions as the Floor tool; door/floor/measure share `tool`
    // so arming this stands those down automatically.
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(wallPaintActive ? 'hand' : 'wallpaint');
  }

  function handleToggleCladding() {
    if (roofBlocksWalls()) return;
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(claddingActive ? 'hand' : 'cladding');
  }

  function handleToggleMeasure() {
    if (roofBlocksWalls()) return;
    // Same three exclusions as the door tool. Wall mode lives on
    // wallStore.draw.phase, room-draw on App-level drawMode, and the door
    // tool on designerUIStore.tool - miss one and two tools fight the same
    // Stage click.
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(measureActive ? 'hand' : 'measure');
  }

  function handleToggleWall() {
    // Sims world (2026-08-29): ONE wall pen. The old interior-wall tool
    // (wallStore, mm, never saved to the server, invisible to placement)
    // is retired; "Walls" enters the same draw mode as "Custom". A run that
    // closes becomes a room; a run that stops where it stops is kept as
    // free-standing walls (Finish walls / Alt+Enter). The canvas HUD carries
    // the instruction, so there is no entry toast (toolbar pass 2026-08-29).
    if (wallActive) setWallDraw({ phase: 'idle' });
    if (drawMode) {
      setDrawMode(false);
      return;
    }
    if (roofBlocksWalls()) return;
    setViewMode('plan');
    setDrawMode(true);
  }

  // Select/Move (P2 2026-08-31). The always-available way back to grabbing an
  // object: stand down every build tool (App-level drawMode, the wallStore
  // draw run, and the designerUIStore tool) so nothing is left half-armed.
  function handleSelect() {
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool('hand');
  }

  // Remove / demolish (2026-08-31, Vic "I can't remove walls"). Arms the
  // sledgehammer: a click on a free wall OR a placed object deletes it (both
  // wired in RoomCanvas). Toggling off returns to Select. Stands down the
  // other build tools first, like every toggle here.
  function handleToggleRemove() {
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(removeActive ? 'hand' : 'sledgehammer');
  }

  const [showHelp, setShowHelp] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const activeRoom = property.rooms.find((r) => r.id === property.activeRoomId);
  // The Floor tool works on a DRAWN, indoor room. The blank seed room and the
  // Outdoors container are not floors a customer buys tiles for.
  // The room a whole-room action acts on: the active indoor room, else the
  // indoor room the customer was in last — never Outdoors (2026-09-07).
  const lastIndoorRoomId = useDesignerUIStore((s) => s.lastIndoorRoomId);
  const floorRoom = floorTargetRoom(property.rooms, activeRoom?.id, lastIndoorRoomId);
  const floorRoomHasFloor =
    !!floorRoom && ((floorRoom.floorTiles?.length ?? 0) > 0 || !!floorRoom.floorFinish);
  const floorMaterial: FloorMaterial | undefined = findFloorMaterialById(floorDraft.materialId);
  const floorMaterialIsRoll = !!floorMaterial && floorMaterial.tile_w_m === null;
  const floorScope: 'tile' | 'room' = floorMaterialIsRoll ? 'room' : floorDraft.scope;
  // What the active room's floor costs right now — the cart's own derivation.
  const floorLive = (() => {
    if (!floorRoom) return { units: 0, cost: 0, unit: 'tile' as const };
    let units = 0;
    let cost = 0;
    let unit: 'tile' | 'roll' = 'tile';
    for (const { materialId, order } of roomFloorOrders(floorRoom)) {
      const m = findFloorMaterialById(materialId);
      if (!m) continue;
      units += order.unitsToOrder;
      cost += order.unitsToOrder * convert(m.price_per_unit_mur, 'MUR', displayCurrency, fx);
      if (m.unit === 'roll') unit = 'roll';
    }
    return { units, cost, unit };
  })();
  const floorLiveText =
    floorLive.units === 0
      ? 'No floor yet'
      : `${floorLive.units} ${floorLive.unit === 'roll' ? (floorLive.units === 1 ? 'roll' : 'rolls') : floorLive.units === 1 ? 'tile' : 'tiles'} · ${formatCurrency(floorLive.cost, displayCurrency)}`;
  /** "0.92 × 0.92 m" for a tile, "12.5 m² roll" for sheet goods. */
  const floorSizeText = (m: FloorMaterial) =>
    m.tile_w_m !== null && m.tile_h_m !== null
      ? `${m.tile_w_m} × ${m.tile_h_m} m`
      : `${m.coverage_m2_per_unit} m² roll`;
  const floorPriceText = (m: FloorMaterial) =>
    `${formatCurrency(convert(m.price_per_unit_mur, 'MUR', displayCurrency, fx), displayCurrency)} / ${m.unit}`;

  /** Choose a material: erase off; a roll forces Room scope. */
  function chooseFloorMaterial(m: FloorMaterial) {
    setFloorDraft({
      materialId: m.id,
      erase: false,
      scope: m.tile_w_m === null ? 'room' : floorDraft.scope,
    });
  }

  /**
   * The Room chip IS the action: it lays (or, with Erase on, clears) the
   * whole active room at once and then stays selected, so "fill the room"
   * is one press, never "switch scope, then find somewhere to click".
   */
  function handleFloorRoom() {
    setFloorDraft({ scope: 'room' });
    if (!floorRoom) {
      pushToast('Draw a room first — Walls', 'warn');
      return;
    }
    if (floorDraft.erase) {
      clearRoomFloor(floorRoom.id);
      pushToast(`${floorRoom.name} — floor cleared`, 'info');
      return;
    }
    if (!floorMaterial) return;
    const n = fillRoomFloor(floorRoom.id, floorMaterial.id);
    pushToast(
      floorMaterial.tile_w_m === null
        ? `${floorRoom.name} — ${floorMaterial.name} laid`
        : `${floorRoom.name} — ${n} tiles laid`,
      'success',
    );
  }

  function handleFloorClear() {
    if (!floorRoom) return;
    clearRoomFloor(floorRoom.id);
    pushToast(`${floorRoom.name} — floor cleared`, 'info');
  }

  // A roll can only be laid whole-room: if the draft lands on a roll with
  // Tile scope (a catalog card can arm the tool without touching scope),
  // snap it to Room so the canvas never gets a tile stroke it must refuse.
  useEffect(() => {
    if (floorPaintActive && floorMaterialIsRoll && floorDraft.scope === 'tile') {
      setFloorDraft({ scope: 'room' });
    }
  }, [floorPaintActive, floorMaterialIsRoll, floorDraft.scope, setFloorDraft]);

  // ------------------------------------------------------------------
  // Wall paint (Vic 2026-09-02): five real Sofap (Permoglaze) products.
  // Painted wall length × wall height − door/window openings → litres
  // (× coats ÷ coverage) → whole purchasable tins → MUR. While a wall
  // tool is armed the canvas lifts to 2.5D wall elevations (RoomCanvas).
  const wallHeightM = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M;
  const wallPaintSel: WallPaint = findWallPaintById(brushPaintId(wallPaintDraft)) ?? WALL_PAINTS[0];
  /** The tint on the brush (null = the product's base colour). */
  const wallPaintTint = brushColour(wallPaintDraft);
  const wallPaintBrushHex = resolveWallColourHex(wallPaintSel.id, wallPaintTint?.hex);
  const wallPaintColours = coloursForPaint(wallPaintSel);
  const wallPaintTintIsCustom =
    !!wallPaintTint && !wallPaintColours.some((c) => normalisePaintColourHex(c.hex) === wallPaintTint.hex);
  // Brands (2026-09-14): the panel filters products by brand once a second
  // paint company is loaded; with one brand there is nothing to switch.
  const demoBrandIds = activeDemo()?.paintBrandIds;
  const paintBrands = brandsWithPaints().filter((b) => !demoBrandIds || demoBrandIds.includes(b.id));
  const [paintBrandId, setPaintBrandId] = useState<string>(() => brandIdOfPaint(wallPaintSel));
  // The chip the user picked, else the brush's brand, else the first shown —
  // a demo that shows one brand never lands on another brand's chip.
  const paintBrand =
    paintBrands.find((b) => b.id === paintBrandId) ?? paintBrands.find((b) => b.id === brandIdOfPaint(wallPaintSel)) ?? paintBrands[0] ?? findPaintBrandById(paintBrandId);
  const wallPaintsShown = paintsForBrand(paintBrand?.id ?? paintBrands[0]?.id ?? paintBrandId).filter((paint) => wallPaintDraft.side !== 'exterior' || paint.use !== 'interior');
  const [paintBreakdownOpen, setPaintBreakdownOpen] = useState(false);
  // The short list (featured lines) by default; the rest behind "More lines".
  const [paintMoreLines, setPaintMoreLines] = useState(false);
  // The brand's full tinting chart (Sofap: 1,050 Colour Match shades) —
  // loaded on demand, filtered by family + search.
  const [paintChartOpen, setPaintChartOpen] = useState(false);
  const [paintChart, setPaintChart] = useState<PaintColour[] | null>(null);
  const [paintChartFamily, setPaintChartFamily] = useState<string>('');
  const [paintChartQuery, setPaintChartQuery] = useState('');
  const paintChartBrandId = brandIdOfPaint(wallPaintSel);
  /** What the brand calls its full chart — Sofap "Colour Match", TintEX "RAL Classic". */
  const paintChartName = findPaintBrandById(paintChartBrandId)?.chartName ?? 'colour';
  useEffect(() => {
    if (!paintChartOpen || paintChart) return;
    let alive = true;
    loadPaintColourChart(paintChartBrandId).then((rows) => {
      if (alive) setPaintChart(rows);
    });
    return () => {
      alive = false;
    };
  }, [paintChartOpen, paintChart, paintChartBrandId]);
  const paintChartFamilies = useMemo(
    () => (paintChart ? [...new Set(paintChart.map((c) => c.collection ?? ''))] : []),
    [paintChart],
  );
  const paintChartRows = useMemo(() => {
    if (!paintChart) return [];
    const q = paintChartQuery.trim().toLowerCase();
    return paintChart.filter(
      (c) =>
        (!paintChartFamily || c.collection === paintChartFamily) &&
        (!q || c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q)),
    );
  }, [paintChart, paintChartFamily, paintChartQuery]);
  const paintCoatsSetting = property.wallPaintCoats;
  const paintWasteSetting = property.wallPaintWastePct;
  const paintPrimerOn = !!property.wallPaintPrimer;
  const paintBrandPrimer = primerForBrand(paintChartBrandId);
  const vatText =
    wallPaintSel.vat_inclusive === true ? 'Prices incl. VAT' : wallPaintSel.vat_inclusive === false ? 'Prices excl. VAT' : 'VAT status not confirmed';
  const wallPaintOrders = deriveWallPaintOrders(property, wallHeightM);
  const wallPaintRows = wallPaintBreakdown(property, wallHeightM);
  const wallPaintLive = (() => {
    const orders = deriveWallPaintOrders(property, wallHeightM);
    let areaM2 = 0;
    let litres = 0;
    let costMur = 0;
    for (const o of orders) {
      areaM2 += o.areaM2;
      litres += o.litres;
      costMur += o.fill.totalMur;
    }
    return { any: orders.length > 0, areaM2, litres, cost: convert(costMur, 'MUR', displayCurrency, fx) };
  })();
  const wallPaintLiveText = !wallPaintLive.any
    ? 'No walls painted yet'
    : `${wallPaintLive.areaM2.toFixed(1)} m² · ${wallPaintLive.litres.toFixed(1)} L · ${formatCurrency(wallPaintLive.cost, displayCurrency)}`;
  /** "matt · 9 m²/L · from Rs 201.25" — one line under the name; "(est.)" when the brand publishes no spread rate. */
  const wallPaintMetaText = (p: WallPaint) =>
    `${p.finish} · ${p.coverage_m2_per_l} m²/L${p.coverage_estimated ? ' (est.)' : ''} · from ${formatCurrency(
      convert(Math.min(...p.tins.map((t) => t.priceMur)), 'MUR', displayCurrency, fx),
      displayCurrency,
    )}`;

  /**
   * Choose a paint: erase off, like choosing a floor material. A white-only
   * line drops any tint; a tintable line keeps the tint on the brush (a
   * customer picking a colour, then a finish, expects the colour to stay).
   */
  function chooseWallPaint(p: WallPaint) {
    setWallPaintDraft({ operation: 'paint' });
    if (isPaintTintable(p)) setWallPaintDraft({ paintId: p.id, erase: false });
    else setWallPaintDraft({ paintId: p.id, erase: false, colourHex: undefined, colourName: undefined });
  }

  /** Choose a tint (null = the product's base colour). */
  function chooseWallPaintColour(c: PaintColour | null) {
    setWallPaintDraft({ operation: 'paint' });
    if (!c) {
      setWallPaintDraft({ colourHex: undefined, colourName: undefined, erase: false });
      return;
    }
    setWallPaintDraft({ colourHex: normalisePaintColourHex(c.hex), colourName: c.name, erase: false });
  }

  /** A custom hex from the colour input — "tint to match" at the counter. */
  function chooseCustomWallPaintColour(hex: string) {
    setWallPaintDraft({ operation: 'paint' });
    const h = normalisePaintColourHex(hex);
    if (!h) return;
    setWallPaintDraft({ colourHex: h, colourName: undefined, erase: false });
  }

  /**
   * The 3D room view paints through the same brush as the plan — with the
   * Sims keys (Shift = whole room, Ctrl = erase) — and gets back the one
   * line it flashes as its caption.
   */
  const claddingProduct = findCladdingProduct(claddingBrushId(claddingDraft)) ?? CLADDING_PRODUCTS[0];
  const claddingLive = deriveCladdingOrders(property, wallHeightM);
  const claddingLiveText = claddingLive.length === 0
    ? 'No cladding yet'
    : claddingLive
        .map((o) => `${o.areaM2.toFixed(1)} m² · ${o.boards} boards · ${o.packs} packs`)
        .join(' · ');
  const claddingCostText = claddingLive.length === 0
    ? ''
    : formatCurrency(
        convert(claddingLive.reduce((a, o) => a + o.totalMur, 0), 'MUR', displayCurrency, fx),
        displayCurrency,
      );

  function cladFromRoomView(hit: Parameters<typeof applyCladdingBrush>[0], mods?: Parameters<typeof applyCladdingBrush>[1]): string | void {
    const r = applyCladdingBrush(hit, mods);
    if (r.message) pushToast(r.message, r.kind);
    return r.detail;
  }

  function paintFromRoomView(hit: Parameters<typeof applyWallPaintBrush>[0], mods?: Parameters<typeof applyWallPaintBrush>[1]): string | void {
    const r = applyWallPaintBrush(hit, mods);
    if (r.message) pushToast(r.message, r.kind);
    return r.detail;
  }

  /** Floor tool in 3D Mode — same brush as the plan, through ONE helper.
   *  Optional `end` is the drag-rectangle release point (Sims floor stroke). */
  function paintFloorFromRoomView(
    hit: Parameters<typeof applyFloorPaintBrush>[0],
    mods?: Parameters<typeof applyFloorPaintBrush>[1],
    end?: Parameters<typeof applyFloorPaintBrush>[2],
  ): string | void {
    const r = applyFloorPaintBrush(hit, mods, end);
    if (r.message) pushToast(r.message, r.kind);
    return r.detail;
  }
  /** What the hovered wall previews: the brush colour, or bare plaster while Erase is on. */
  const wallPaintPreviewHex = wallPaintDraft.operation === 'construction' ? constructionHex(wallPaintDraft.construction) : wallPaintDraft.erase ? BARE_PLASTER_HEX : wallPaintBrushHex;
  /**
   * The Sims' price on hover (P3, 2026-09-19): what the click would buy for
   * the wall under the brush — "VIP Satin · Pastel green ≈ 12.7 m² · 2.7 L ·
   * Rs 774" — by the same arithmetic as the quote (openings deducted, the
   * quoted coats, the contingency, the cheapest whole tins on the tint's
   * base). Erase shows nothing; the wall's own paint is described instead.
   */
  const hoverWallTag = (hit: Parameters<typeof applyWallPaintBrush>[0]): string | null => {
    if (wallPaintDraft.operation === 'construction') return brushLabel(wallPaintDraft);
    if (!hit || wallPaintDraft.erase) return null;
    let areaM2 = 0;
    if (hit.kind === 'edge' && hit.roomId && typeof hit.edgeIndex === 'number') {
      const room = property.rooms.find((r) => r.id === hit.roomId);
      if (!room) return null;
      areaM2 = wallPaintDraft.side === 'exterior' ? exteriorPaintAreaM2(room, hit.edgeIndex, wallHeightM, property.rooms) : paintableEdgeAreaM2(room, hit.edgeIndex, wallHeightM);
    } else if (hit.kind === 'free' && hit.wallId) {
      const w = property.walls?.find((x) => x.id === hit.wallId);
      if (!w) return null;
      areaM2 = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) * wallHeightM;
    }
    if (areaM2 <= 0) return null;
    const tinted = !!wallPaintTint;
    const litres = litresForArea(areaM2 * (1 + wastePctFor(tinted, property) / 100), coatsFor(wallPaintSel, property), wallPaintSel.coverage_m2_per_l);
    const fill = tinsForLitres(litres, tinsForPaintColour(wallPaintSel, wallPaintTint?.hex).tins);
    return `${brushLabel(wallPaintDraft)} ≈ ${areaM2.toFixed(1)} m² · ${litres.toFixed(1)} L · ${formatCurrency(convert(fill.totalMur, 'MUR', displayCurrency, fx), displayCurrency)}`;
  };

  /**
   * The Room chip IS the action, mirroring the Floor tool: paint (or, with
   * Erase on, strip) every wall of the active room in one press.
   */
  function handleWallPaintRoom() {
    setWallPaintDraft({ scope: 'room' });
    if (!floorRoom) {
      pushToast('Draw a room first — Walls', 'warn');
      return;
    }
    if (wallPaintDraft.operation === 'construction') {
      usePropertyStore.getState().setWallConstruction(floorRoom.id, null, wallPaintDraft.construction ?? 'plastered-brick');
      return;
    }
    if (wallPaintDraft.erase) {
      paintRoomWalls(floorRoom.id, null, null, wallPaintDraft.side);
      pushToast(`${floorRoom.name} — wall paint removed`, 'info');
      return;
    }
    paintRoomWalls(floorRoom.id, wallPaintSel.id, wallPaintTint, wallPaintDraft.side);
    pushToast(`${floorRoom.name} — every wall painted`, 'success');
  }

  const anyWallPainted =
    property.rooms.some((r) => (r.wallPaint?.length ?? 0) > 0) ||
    (property.walls ?? []).some((w) => !!w.paintId || !!w.exteriorPaint);

  function handleWallPaintClearAll() {
    for (const r of property.rooms) {
      if ((r.wallPaint?.length ?? 0) > 0) { paintRoomWalls(r.id, null); paintRoomWalls(r.id, null, null, 'exterior'); }
    }
    for (const w of property.walls ?? []) {
      if (w.paintId) paintFreeWall(w.id, null);
      if (w.exteriorPaint) paintFreeWall(w.id, null, null, 'exterior');
    }
    pushToast('Wall paint removed everywhere', 'info');
  }

  const savedList = Object.values(designs)
    .filter((d) => d.id !== '__draft__')
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  function handleSaveAs() {
    const defaultName =
      currentId && designs[currentId] ? designs[currentId].name : property.name || 'Untitled Property';
    const name = window.prompt('Save property as...', defaultName);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const id = savePropertyAs(trimmed, property);
    setCurrent(id);
    pushToast(`Saved "${trimmed}"`, 'success');

    // M1.C.6 — cloud-save sync. Only fire if we already have a cached
    // customer email so the Save UX stays one-prompt for new users.
    // First-time cloud-savers reach the API via Request Quote or the
    // dedicated "My Designs" page (both of which prompt for email).
    const email = getCachedCustomerEmail();
    if (email) {
      saveDesignToApi({
        customerEmail: email,
        name: trimmed,
        property,
        status: 'draft',
      }).then(
        () => pushToast('Synced to cloud.', 'info'),
        (err) => {
          const msg = err instanceof Error ? err.message : 'Cloud sync failed.';
          pushToast(msg, 'error');
        },
      );
    }
  }

  // M1.C.7 — Request Quote. Captures the active Property + cart-quote
  // totals and POSTs to /api/leads. Prompts for email + optional
  // message on first use; reuses the cached email afterwards.
  const [submittingQuote, setSubmittingQuote] = useState(false);
  async function handleRequestQuote() {
    if (submittingQuote) return;
    const email =
      getCachedCustomerEmail() ??
      promptForCustomerEmail("Enter your email so we can send the quote");
    if (!email) return;
    const message =
      window.prompt(
        'Any notes for the PPW team? (optional — press Enter to skip)',
        '',
      ) ?? '';

    setSubmittingQuote(true);
    try {
      await submitLead({
        customerEmail: email,
        property,
        cartQuote: {
          uniqueProductCount: cart.uniqueProductCount,
          totalItemCount: cart.totalItemCount,
          subtotal: cart.subtotal,
          subtotalByCurrency: cart.subtotalByCurrency,
        },
        message: message.trim() || undefined,
        source: 'designer',
      });
      pushToast('Quote request sent — PPW will email you soon.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Quote submit failed.';
      pushToast(msg, 'error');
    } finally {
      setSubmittingQuote(false);
    }
  }

  function handleLoad(id: string) {
    const d = designs[id];
    if (!d || !d.property) {
      pushToast('Saved entry is missing property data.', 'error');
      return;
    }
    loadProperty(d.property);
    setCurrent(id);
    pushToast(`Loaded "${d.name}"`, 'success');
    setShowLoad(false);
  }

  function handleNew() {
    if (placedItems.length > 0 || property.rooms.length > 1) {
      setConfirmingNew(true);
      return;
    }
    resetToDefault();
    setCurrent(null);
  }

  function confirmNew() {
    resetToDefault();
    setCurrent(null);
    setConfirmingNew(false);
    pushToast('New property started.', 'info');
  }

  // -------------------------------------------------------------------------
  // Toolbar pass (2026-08-29): responsive tiers + popover plumbing.
  // -------------------------------------------------------------------------
  const isXl = useMedia('(min-width: 1280px)');
  // Polish (2026-08-29): the desktop Paint palette is anchored to the md+
  // Paint segment; on the phone that segment is display:none, so the palette
  // must not mount at all (the sheet's material rows arm the brush instead).
  const isMd = useMedia('(min-width: 768px)');
  const [roomGroupOpen, setRoomGroupOpen] = useState(false);
  const [viewGroupOpen, setViewGroupOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const boxRef = useRef<HTMLButtonElement>(null);
  // Floor tool (2026-08-30): the docked panel hangs from the header's live
  // bottom edge (53 px; 93 px would be the door sub-bar, but door and floor
  // are the same `tool` field so they never coexist — measured anyway).
  const headerRef = useRef<HTMLElement>(null);
  const [floorPanelTop, setFloorPanelTop] = useState(53);
  // Phone: `ppw:open-menu {section:'floor'|'door'}` (from a canvas HUD card)
  // opens the sheet AT that section's row.
  const floorRowMobileRef = useRef<HTMLButtonElement>(null);
  const doorRowMobileRef = useRef<HTMLButtonElement>(null);
  const wallPaintRowMobileRef = useRef<HTMLButtonElement>(null);
  const energyRowMobileRef = useRef<HTMLDivElement>(null);
  const [sheetScrollTo, setSheetScrollTo] = useState<'floor' | 'door' | 'wallpaint' | 'energy' | null>(null);
  const levelsRef = useRef<HTMLButtonElement>(null);
  const landRef = useRef<HTMLButtonElement>(null);
  const snapRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const roomGroupRef = useRef<HTMLButtonElement>(null);
  const viewGroupRef = useRef<HTMLButtonElement>(null);
  // Phone: the hamburger anchors Help / Load (More is display:none there) and
  // gets focus back when the sheet closes.
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const helpAnchor = isMd ? moreRef : menuBtnRef;

  // The collapsed group popovers only exist below xl; drop them on the way up
  // so the same fragment is never asked to render in two places.
  useEffect(() => {
    if (isXl) {
      setRoomGroupOpen(false);
      setViewGroupOpen(false);
    }
  }, [isXl]);

  // Mobile sheet: Esc closes, body scroll locked while open. Focus moves to
  // the sheet's Close button on open and returns to the hamburger on close.
  useEffect(() => {
    if (!showMobileMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileMenu(false);
    };
    document.addEventListener('keydown', onKey);
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : menuBtnRef.current;
    sheetCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      // A 3D project button can open this sheet too. Do not return focus to
      // the inert plan toolbar, or steal it from the New confirmation.
      if (opener?.isConnected && !opener.closest('[inert]') && !document.querySelector('[role="dialog"][aria-modal="true"]')) opener.focus();
    };
  }, [showMobileMenu]);

  useEffect(() => {
    // A plan-only phone sheet must not survive becoming CSS-hidden on resize.
    if (isMd && viewMode !== '3d') setShowMobileMenu(false);
  }, [isMd, viewMode]);

  // "Start a new property?" — Esc cancels (Cancel also takes autoFocus).
  useEffect(() => {
    if (!confirmingNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmingNew(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmingNew]);

  // Floor panel (md+): publish its width on <html> so the canvas can inset
  // its auto-fit; 0px whenever it is closed, on the phone, or on unmount.
  const floorPanelOpen = isMd && floorPaintActive;
  // Wall paint docks the same right edge. Floor and Wall paint share the
  // `tool` field so at most ONE side panel exists — both publish the same
  // inset var for the canvas auto-fit.
  const wallPaintPanelOpen = isMd && wallPaintActive;
  const claddingPanelOpen = isMd && claddingActive;
  // Energy readout (2026-09-04): a third docked panel on the same edge. The
  // store guarantees it never coexists with a build tool.
  const energyPanelOpen = useDesignerUIStore((s) => s.energyPanelOpen);
  const setEnergyPanelOpen = useDesignerUIStore((s) => s.setEnergyPanelOpen);
  const energyPanelOpenMd = isMd && energyPanelOpen;
  const sidePanelOpen = floorPanelOpen || wallPaintPanelOpen || claddingPanelOpen || energyPanelOpenMd;
  // Energy button (electrics fix 2026-09-20, E-07): the readout used to be
  // reachable only through the canvas chip, which hides while nothing is
  // drawing power — so a customer whose merchant items read 0 W had nothing
  // to press. md+ toggles the docked panel; below md it opens the phone
  // sheet scrolled to its Energy section, the way the paint HUDs do.
  function handleToggleEnergy(): void {
    if (isMd) {
      setEnergyPanelOpen(!energyPanelOpen);
      return;
    }
    setSheetScrollTo('energy');
    setShowMobileMenu(true);
  }
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--floor-panel-w', sidePanelOpen ? `${FLOOR_PANEL_W}px` : '0px');
    return () => {
      root.style.setProperty('--floor-panel-w', '0px');
    };
  }, [sidePanelOpen]);

  // Hang the panel from the header's LIVE bottom edge.
  useLayoutEffect(() => {
    if (!sidePanelOpen) return;
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setFloorPanelTop(viewMode === '3d' ? (window.innerHeight <= 560 ? 43 : 56) : Math.round(el.getBoundingClientRect().bottom));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sidePanelOpen, viewMode]);

  // 3D Mode (2026-09-17) outlives the paint tool: putting the tool away
  // leaves the room on screen (it used to close the view). The mode
  // publishes nothing here; the overlay hangs from the header's live bottom
  // edge via `--ppw-topbar-h` so the bar stays usable while the room shows.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--ppw-topbar-h', `${Math.round(el.getBoundingClientRect().bottom)}px`);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      root.style.setProperty('--ppw-topbar-h', '0px');
    };
  }, []);
  // The roof has no walls: a storey change onto the roof stands the wall
  // tools down (they refuse to arm there, but PageUp / the Storeys popover
  // could move the focus under an armed tool).
  useEffect(() => {
    if (onRoof && (wallPaintActive || claddingActive || doorActive || floorPaintActive)) setTool('hand');
  }, [onRoof, wallPaintActive, claddingActive, doorActive, floorPaintActive, setTool]);

  // Esc = tool off while the Floor tool is on (Done does the same). Inputs
  // keep their own Esc (a level rename in progress must not lose the tool).
  useEffect(() => {
    if (!floorPaintActive && !wallPaintActive && !claddingActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      setTool('hand');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [floorPaintActive, wallPaintActive, claddingActive, setTool]);

  // Finish tools occupy a dock. Clicking other workspace chrome dismisses
  // their options; the canvas remains the intended paint target. A blank
  // canvas tap is handled by RoomView3D so orbit gestures never close a tool.
  useEffect(() => {
    if (viewMode !== '3d' || (!floorPaintActive && !wallPaintActive && !claddingActive)) return;
    const away = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('.house-tool-panel, [role="dialog"], [role="listbox"], [data-ppw-popover], [data-testid="wallpaint-3d-canvas"], [data-testid$="3d-brush-strip"]')) return;
      setTool('hand');
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [viewMode, floorPaintActive, wallPaintActive, claddingActive, setTool]);

  // `ppw:open-menu` — any surface (the phone Floor / Door HUD cards) can
  // ask for the sheet, scrolled to a section.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const section = (e as CustomEvent<{ section?: string }>).detail?.section;
      if (section === 'floor' || section === 'door' || section === 'wallpaint' || section === 'energy') setSheetScrollTo(section);
      setShowMobileMenu(true);
    };
    window.addEventListener('ppw:open-menu', onOpen);
    return () => window.removeEventListener('ppw:open-menu', onOpen);
  }, []);
  useEffect(() => {
    if (!showMobileMenu || !sheetScrollTo) return;
    // After the sheet's own open effect has moved focus to Close.
    const target =
      sheetScrollTo === 'door'
        ? doorRowMobileRef
        : sheetScrollTo === 'wallpaint'
          ? wallPaintRowMobileRef
          : sheetScrollTo === 'energy'
            ? energyRowMobileRef
            : floorRowMobileRef;
    const id = window.requestAnimationFrame(() => {
      target.current?.scrollIntoView({ block: 'start' });
      setSheetScrollTo(null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [showMobileMenu, sheetScrollTo]);

  const closeSize = useCallback(() => setSizeOpen(false), []);
  const closeLevels = useCallback(() => setLevelsOpen(false), []);
  const closeLand = useCallback(() => setLandOpen(false), []);
  const closeUnit = useCallback(() => setUnitOpen(false), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeRoomGroup = useCallback(() => setRoomGroupOpen(false), []);
  const closeViewGroup = useCallback(() => setViewGroupOpen(false), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const closeLoad = useCallback(() => setShowLoad(false), []);

  // "New plan" — the same call PageTabs makes from its "+" (PageTabs.tsx:52-54):
  // createPage promotes an unsaved draft to a real tab first, so the work on
  // screen is never stranded, then the canvas switches to the empty plan.
  function handleNewPlan() {
    const id = createPage(`Plan ${savedList.length + 2}`);
    switchToPage(id);
    pushToast('New plan started', 'success');
  }

  const storeysLabel =
    levels.length > 1
      ? `${activeLevel?.index === 0 ? 'Ground' : `Floor ${activeLevel?.index ?? 0}`} · ${levels.length}`
      : 'Storeys';
  const plotLabel = site ? `Plot ${site.widthM}×${site.depthM}` : 'Plot';
  const snapUnit = SNAP_UNIT_LABEL[precision];

  /** Label span: always shown when the group is stacked in a popover,
   *  otherwise only at the tier that has room for it. */
  const lbl = (stacked: boolean, tier: 'xl' | '1366' | '2xl' | '3xl') =>
    stacked
      ? 'inline'
      : tier === 'xl'
        ? 'hidden xl:inline'
        : tier === '1366'
          ? 'hidden min-[1366px]:inline'
          : tier === '2xl'
            ? 'hidden 2xl:inline'
            : 'hidden min-[1700px]:inline';

  // -------------------------------------------------------------------------
  // ROOM & PLAN group body — Finish · Storeys · Plot. Rendered ONCE: inline
  // at xl+, inside the "Room" popover below xl.
  // -------------------------------------------------------------------------
  const roomPlanGroup = (stacked: boolean) => {
    const btn = (on: boolean) =>
      stacked ? `${ROW} ${on ? ROW_ON : ''}` : `${BTN} ${on ? BTN_ON : BTN_REST}`;
    return (
      <>
        {/* The whole-room "Finish" picker that used to lead this group is
            retired (2026-08-30): the Floor tool's Room scope lays a whole
            room, so one tool covers what two controls used to. */}
        {/* Storeys — which storey of the building the canvas shows. */}
        <button
          ref={levelsRef}
          type="button"
          onClick={() => setLevelsOpen((v) => !v)}
          data-testid="levels-toggle"
          className={btn(levelsOpen)}
          title={`Storeys — now on ${activeLevel?.name ?? 'Ground floor'} (PageUp / PageDown to switch)`}
          aria-expanded={levelsOpen}
          aria-controls="ppw-pop-levels"
          aria-label="Storeys"
        >
          <Icon name="storeys" />
          <span className={`${lbl(stacked, '1366')} tabular-nums`}>{storeysLabel}</span>
          {!stacked && levels.length > 1 && (
            <span className="font-semibold tabular-nums min-[1366px]:hidden">{levels.length}</span>
          )}
        </button>
        <Popover anchor={levelsRef} open={levelsOpen} onClose={closeLevels} width={224} id="ppw-pop-levels" label="Storeys">
          <div data-testid="levels-picker" className="flex flex-col gap-0.5">
          {[...levels].sort((a, b) => b.index - a.index).map((l) => (
            <div key={l.id} className="flex items-center gap-1">
              {levelEditId === l.id ? (
                <input
                  autoFocus
                  value={levelDraft}
                  onChange={(e) => setLevelDraft(e.target.value)}
                  onBlur={commitLevelRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitLevelRename();
                    if (e.key === 'Escape') { setLevelEditId(null); setLevelDraft(''); }
                  }}
                  data-testid={`level-rename-${l.id}`}
                  className={`${INPUT} min-w-0 flex-1 text-left`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setActiveLevel(l.id); setLevelsOpen(false); }}
                  onDoubleClick={() => { setLevelEditId(l.id); setLevelDraft(l.name); }}
                  data-testid={`level-${l.id}`}
                  aria-pressed={l.id === activeLevelId}
                  className={`${ROW} min-w-0 flex-1 justify-between ${l.id === activeLevelId ? ROW_ON : ''}`}
                  title="Click to switch · double-click to rename"
                >
                  <span className="truncate">{l.name}</span>
                  <span className="ml-2 text-[11px] font-semibold tabular-nums opacity-80">
                    {isRoofLevel(l)
                      ? `${roofAreaM2(property).toFixed(0)} m²`
                      : `${roomsOnLevel(visibleRooms(property.rooms), l.id).filter((r) => isDrawnPolygon(r.polygon)).length} rm`}
                  </span>
                </button>
              )}
              {l.id !== 'ground' && (
                <button
                  type="button"
                  onClick={() => handleRemoveLevel(l.id)}
                  data-testid={`level-remove-${l.id}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-ppw-clay transition-colors duration-[120ms] ease-out motion-reduce:transition-none hover:border-ppw-clay hover:bg-ppw-clay hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]"
                  title="Remove this floor (must be empty)"
                  aria-label={`Remove ${l.name}`}
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => { handleAddLevel(); setLevelsOpen(false); }}
            data-testid="level-add"
            className={`${ROW} mt-1 justify-center border border-dashed border-ppw-rim font-semibold`}
          >
            + Add floor above
          </button>
        </div>
        </Popover>

        {/* Roof (eco / solar 2026-09-04) — the slab on top of the building:
            solar panels, air-con, planters, flooring. Toggles back to the
            top storey. */}
        <button
          type="button"
          onClick={handleToggleRoof}
          data-testid="roof-toggle"
          className={btn(onRoof)}
          title={onRoof ? 'Roof — back to the top storey' : 'Roof — lay solar panels, air-con and planters on the slab'}
          aria-pressed={onRoof}
          aria-label="Roof"
        >
          <Icon name="roof" />
          <span className={lbl(stacked, '1366')}>Roof</span>
        </button>

        {/* Energy (electrics fix 2026-09-20): sun vs use per day, reachable
            even when the canvas chip is hidden. Empty plan → the panel says
            "Nothing using power yet". */}
        <button
          type="button"
          onClick={handleToggleEnergy}
          data-testid="energy-toggle"
          className={btn(energyPanelOpen)}
          title="Energy — sun vs use per day"
          aria-pressed={energyPanelOpen}
          aria-label="Energy"
          aria-controls="ppw-energy-panel"
        >
          <Icon name="bolt" />
          <span className={lbl(stacked, '1366')}>Energy</span>
        </button>

        {/* 3D Mode (2026-09-17): the whole plan as a Sims-style room view;
            every tool keeps working inside it. Esc / Plan returns. */}
        <button
          type="button"
          onClick={() => setViewMode(viewMode === '3d' ? 'plan' : '3d')}
          data-testid="view-mode-3d"
          className={btn(viewMode === '3d')}
          title={viewMode === '3d' ? '3D Mode — back to the plan (Esc)' : '3D Mode — see the whole plan as a room'}
          aria-pressed={viewMode === '3d'}
          aria-label="3D Mode"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" d="M8 1.8 13.6 5v6L8 14.2 2.4 11V5zM8 8l5.6-3M8 8 2.4 5M8 8v6.2" />
          </svg>
          <span className={lbl(stacked, '1366')}>3D</span>
        </button>

        {/* Plot — lock the scale + capacity. */}
        <button
          ref={landRef}
          type="button"
          onClick={() => setLandOpen((v) => !v)}
          data-testid="land-toggle"
          className={btn(landOpen || !!site)}
          title={
            site
              ? `Plot locked at ${site.widthM} × ${site.depthM} m — click to change or clear`
              : 'Plot — set the width and depth of the site to lock the scale and the maximum you can build'
          }
          aria-expanded={landOpen}
          aria-controls="ppw-pop-land"
          aria-label="Plot"
        >
          <Icon name="plot" />
          <span className={`${lbl(stacked, '1366')} tabular-nums`}>{plotLabel}</span>
          {!stacked && site && (
            <span className="font-semibold tabular-nums min-[1366px]:hidden">{site.widthM}×{site.depthM}</span>
          )}
        </button>
        <Popover anchor={landRef} open={landOpen} onClose={closeLand} width={272} id="ppw-pop-land" label="Plot">
          <div data-testid="land-picker" className="flex flex-col gap-0.5">
          <p className="px-1 pb-2 text-[11px] leading-snug" style={{ color: CHROME_TEXT_2 }}>
            The plot is the outer boundary: rooms, walls and items stay inside it.
          </p>
          <div className="flex items-center gap-2 px-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>W</label>
            <input
              type="number"
              min={1}
              max={500}
              step={0.5}
              value={landW}
              onChange={(e) => setLandW(e.target.value)}
              data-testid="land-width"
              className={`${INPUT} w-16`}
            />
            <span className="text-[11px]" style={{ color: CHROME_TEXT_2 }}>m</span>
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>D</label>
            <input
              type="number"
              min={1}
              max={500}
              step={0.5}
              value={landD}
              onChange={(e) => setLandD(e.target.value)}
              data-testid="land-depth"
              className={`${INPUT} w-16`}
              onKeyDown={(e) => { if (e.key === 'Enter') applyLand(); }}
            />
            <span className="text-[11px]" style={{ color: CHROME_TEXT_2 }}>m</span>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 px-1">
            {site && (
              <button
                type="button"
                onClick={clearLand}
                data-testid="land-clear"
                className={`${BTN} h-9 border-ppw-clay bg-ppw-chrome text-ppw-clay hover:bg-ppw-clay hover:text-white`}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={applyLand}
              data-testid="land-apply"
              className={`${BTN} ${BTN_INK} h-9`}
            >
              Lock plot
            </button>
          </div>
        </div>
        </Popover>
      </>
    );
  };

  // -------------------------------------------------------------------------
  // VIEW group body — Snap · Grid · 3D · Undo/Redo. Rendered ONCE.
  // -------------------------------------------------------------------------
  const viewGroup = (stacked: boolean) => {
    const btn = (on: boolean) =>
      stacked ? `${ROW} ${on ? ROW_ON : ''}` : `${BTN} ${on ? BTN_ON : BTN_REST}`;
    return (
      <>
        {/* Snap unit (units brief 2026-08-28, D7). Digits 1-6 pick the same
            units from the keyboard; Ctrl+F swaps back to the last one. */}
        <button
          ref={snapRef}
          type="button"
          onClick={() => setUnitOpen((v) => !v)}
          data-testid="snap-unit-toggle"
          className={btn(unitOpen)}
          title={`Snap ${snapUnit} — choose the snap unit for drawing rooms and walls`}
          aria-expanded={unitOpen}
          aria-controls="ppw-pop-snap"
        >
          <Icon name="snap" />
          <span className={lbl(stacked, 'xl')}>{'Snap '}</span>
          <span className="font-semibold tabular-nums">{snapUnit}</span>
        </button>
        <Popover anchor={snapRef} open={unitOpen} onClose={closeUnit} width={200} id="ppw-pop-snap" label="Snap unit">
          <div data-testid="snap-unit-picker" className="flex flex-col gap-0.5">
          {SNAP_UNIT_ORDER.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                setPrecision(u);
                setUnitOpen(false);
              }}
              data-testid={`snap-unit-${u}`}
              aria-pressed={precision === u}
              className={`${ROW} justify-between ${precision === u ? ROW_ON : ''}`}
            >
              <span className="tabular-nums">{SNAP_UNIT_LABEL[u]}</span>
              <span className="text-[11px] font-semibold tabular-nums opacity-70">{i + 1}</span>
            </button>
          ))}
        </div>
        </Popover>

        <button
          type="button"
          onClick={toggleGrid}
          aria-pressed={showGrid}
          aria-label="Grid"
          className={`${btn(showGrid)} ${stacked ? '' : BTN_ICON}`}
          title={`Grid · ${snapUnit}`}
        >
          <Icon name="grid" />
          {stacked && <span>Grid · {snapUnit}</span>}
        </button>

        {/* Polish B / V4-AU-1: 3D preview toggle relocated from canvas
            top-right (cart pill now owns that slot) into TopBar. */}
        {setThreeDPreview && (
          <button
            type="button"
            onClick={() => setThreeDPreview(!threeDPreview)}
            aria-pressed={threeDPreview}
            aria-label="Toggle 3D preview"
            title="Toggle 3D preview"
            className={`${btn(threeDPreview)} ${stacked ? '' : BTN_ICON}`}
          >
            <Icon name="cube" />
            {stacked && <span>{threeDPreview ? '2D' : '3D'}</span>}
          </button>
        )}

        {/* Tweak 07 (Phase A.0) — UNDO / REDO. Desktop only: the canvas
            carries mobile-undo / mobile-redo. The undo button arms-then-fires
            on coarse-pointer devices per §7 (long-press confirm). */}
        <div
          className={stacked ? 'mt-1 flex gap-2 border-t border-ppw-rim pt-2' : `${SEG_GROUP} hidden md:inline-flex`}
          role="group"
          aria-label="History"
        >
          <button
            type="button"
            onClick={handleUndoClick}
            disabled={!drawInFlight && wallActive === false && pastLength === 0}
            aria-label={mobileUndoArmed ? 'Tap to confirm undo' : 'Undo (Ctrl+Z)'}
            title={mobileUndoArmed ? 'Tap again to confirm' : 'Undo (Ctrl+Z)'}
            className={
              stacked
                ? `${BTN} flex-1 ${mobileUndoArmed ? 'border-ppw-clay bg-ppw-clay text-white' : BTN_REST}`
                : `${SEG} w-10 px-0 ${mobileUndoArmed ? 'bg-ppw-clay text-white' : SEG_REST}`
            }
          >
            <Icon name="undo" />
            {stacked && <span>Undo</span>}
          </button>
          <button
            type="button"
            onClick={() => performRedo()}
            disabled={futureLength === 0}
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (Ctrl+Shift+Z)"
            className={stacked ? `${BTN} ${BTN_REST} flex-1` : `${SEG} ${SEG_REST} w-10 px-0`}
          >
            <Icon name="redo" />
            {stacked && <span>Redo</span>}
          </button>
        </div>
      </>
    );
  };

  const segOn = (on: boolean) => `${SEG} ${on ? SEG_ON : SEG_REST}`;

  return (
    <header
      ref={headerRef}
      {...(viewMode === '3d' ? { inert: '', 'aria-hidden': true as const } : {})}
      className="relative z-20 shrink-0 border-b"
      style={{ background: CHROME_BG, borderColor: CHROME_RIM }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* THE ROW: 56 px strip on the phone, 52 px bar from md up.            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-3 items-center gap-1 px-2 py-1 md:flex md:h-[52px] md:flex-nowrap md:gap-0 md:px-1 md:py-0 lg:px-2" data-testid="designer-main-strip">
        {/* 1 IDENTITY — the only group allowed to shrink. md (768–1023) runs
            4 px tighter everywhere it can: measured at 768 the Walls + Quote
            labels and the in-control cart count need those pixels. */}
        <div className="col-span-2 flex min-w-0 shrink items-center gap-2 max-md:order-1 md:flex-initial md:gap-1 lg:gap-2">
          {/* PPW brand mark — same tile as the shop header. Links back to the
              storefront. 44 on the phone, 40 on desktop (contract control sizes). */}
          <Link
            to="/products"
            title="Back to PPWellness Shop"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ppw-rim bg-ppw-chrome shadow-[3px_3px_7px_rgba(167,160,144,0.42),-3px_-3px_7px_rgba(255,255,255,0.95)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] md:h-10 md:w-10"
          >
            <img src="/brand/ppw-mark-512.png" alt="PPWellness" width={24} height={24} className="block" />
          </Link>

          {/* Rooms trigger — the ONLY way into the rooms list at every width
              (the permanent rail was deleted 2026-08-25). The property rename
              lives in that dropdown (RoomList.tsx). */}
          <button
            type="button"
            data-testid="rooms-trigger"
            onClick={() => setRoomsMenuOpen && setRoomsMenuOpen(!roomsMenuOpen)}
            className={`${BTN} ${roomsMenuOpen ? BTN_ON : BTN_REST} h-11 min-w-0 flex-1 justify-start md:h-10 md:min-w-[80px] md:max-w-[190px] md:flex-none lg:min-w-[104px] xl:min-w-[128px] xl:max-w-[190px] 2xl:max-w-[190px] min-[1700px]:max-w-[260px]`}
            style={{ justifyContent: 'flex-start' }}
            aria-label="Open rooms list"
            aria-expanded={roomsMenuOpen}
          >
            <Icon name="list" />
            {/* Polish (2026-08-29): the property name is visible at rest again
                (the rename block left with the rail). xl+: "property · room";
                below xl the shorter "room · n". The room end truncates. */}
            <span className="hidden min-w-0 items-baseline xl:flex">
              <span className="min-w-0 truncate font-semibold">{property.name}</span>
              {activeRoom && (
                <span className="ml-1 max-w-[55%] shrink-0 truncate opacity-80">· {activeRoom.name}</span>
              )}
              <span className="ml-1 hidden shrink-0 tabular-nums opacity-80 2xl:inline">· {drawnRoomCount}</span>
            </span>
            <span className="min-w-0 truncate xl:hidden">
              <span className="font-semibold">{activeRoom?.name ?? property.name}</span>
              <span className="ml-1 hidden tabular-nums opacity-80 lg:inline">· {drawnRoomCount}</span>
            </span>
          </button>

          {/* MERCHANT DEMO pill (Courts Mammouth push, 2026-09-05). Shown only
              while `/designer?demo=<slug>` is active in this tab: names whose
              range is in the catalog, and the × leaves demo mode (the show
              home page stays; only the catalog returns to the standard seed).
              md+ only — the phone strip has no spare pixels and the page name
              already carries the merchant. */}
          {demoPill && (
            <span
              data-testid="demo-pill"
              className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl border border-ppw-inkDeep bg-ppw-inkDeep pl-3 pr-1 text-[12px] font-semibold text-ppw-paper md:inline-flex"
              title={`${demoPill.merchant}: their catalog is loaded in this tab. Close the tab or press × for the standard catalog.`}
            >
              <span className="truncate max-w-[160px]">{demoPill.merchant}</span>
              <span className="opacity-70">· demo</span>
              <button
                type="button"
                data-testid="demo-pill-exit"
                onClick={() => {
                  setActiveDemo(null);
                  window.location.assign('/designer?demo=off');
                }}
                className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
                aria-label="Leave demo mode"
                title="Leave demo mode"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {/* ---- md+: rail A — BUILD. shrink-0; the Box|Custom segment follows
            OUTSIDE the rails because its Custom half is the phone strip's
            "Walls" button too (one node, one testid, every width). ---- */}
        <div className="hidden shrink-0 items-center md:flex">
          <span className={DIVIDER} aria-hidden="true" />

          {/* 2 BUILD — segmented: Walls · Door · Paint · Measure. Walls keeps
              its label at every width; Measure drops first, then Door. */}
          <div className={SEG_GROUP} role="group" aria-label="Build tools">
            {/* Select — the always-visible way back to move / rotate / delete
                an object (complaint B). Ink when no build tool is armed. */}
            <button
              type="button"
              onClick={handleSelect}
              data-testid="select-tool-toggle"
              className={segOn(selectActive)}
              title="Select — move, rotate or delete an object (Esc)"
              aria-pressed={selectActive}
              aria-label="Select"
            >
              <Icon name="cursor" />
              <span className="hidden min-[1366px]:inline">Select</span>
            </button>
            <button
              type="button"
              onClick={handleToggleWall}
              data-testid="wall-tool-toggle"
              className={segOn(drawMode || wallActive)}
              title="Walls — click to drop points. Close the shape for a room, or press Finish walls to leave them open. +/- change the unit mid-draw."
              aria-pressed={drawMode || wallActive}
              aria-label="Walls"
            >
              <Icon name="pen" />
              <span>Walls</span>
            </button>
            <button
              type="button"
              onClick={handleToggleDoor}
              data-testid="door-tool-toggle"
              className={segOn(doorActive)}
              title="Door — hover a wall to place a door, doorway or window; click an existing one to remove it. F flips which way it opens, H swaps the hinge."
              aria-pressed={doorActive}
              aria-label="Door"
            >
              <Icon name="door" />
              <span className="hidden min-[1700px]:inline">Door</span>
            </button>
            <button
              type="button"
              onClick={handleToggleFloorPaint}
              data-testid="floor-paint-toggle"
              className={segOn(floorPaintActive)}
              title="Floor — click a tile, drag an area, or Room to lay the whole room. Shift fills the room, Ctrl erases."
              aria-pressed={floorPaintActive}
              aria-controls="ppw-floor-panel"
              aria-label="Floor"
            >
              <Icon name="tiles" />
              {/* Vic could not find the floor — its label shows from 1366. */}
              <span className="hidden min-[1366px]:inline">Floor</span>
            </button>
            <button
              type="button"
              onClick={handleToggleWallPaint}
              data-testid="wallpaint-tool-toggle"
              className={segOn(wallPaintActive)}
              title="Wall paint — click a wall to paint it with a Sofap colour; the plan lifts to show the walls. Room paints every wall of the room."
              aria-pressed={wallPaintActive}
              aria-controls="ppw-wallpaint-panel"
              aria-label="Wall paint"
            >
              <Icon name="roller" />
              <span className="hidden min-[1700px]:inline">Paint</span>
            </button>
            <button
              type="button"
              onClick={handleToggleCladding}
              data-testid="cladding-tool-toggle"
              className={segOn(claddingActive)}
              title="Cladding — sample demo boards. Click a wall to clad it. Not a real Spa Concept product."
              aria-pressed={claddingActive}
              aria-controls="ppw-cladding-panel"
              aria-label="Cladding"
            >
              <Icon name="tiles" />
              <span className="hidden min-[1700px]:inline">Clad</span>
            </button>
            <button
              type="button"
              onClick={handleToggleMeasure}
              data-testid="measure-tool-toggle"
              className={segOn(measureActive)}
              title="Measure (M) — click any wall to retype its exact length"
              aria-pressed={measureActive}
              aria-label="Measure"
            >
              <Icon name="ruler" />
              <span className="hidden min-[1700px]:inline">Measure</span>
            </button>
            {/* Remove — the sledgehammer. Click a wall or object to delete it
                (complaint "I can't remove walls"). Terracotta-tinted when on. */}
            <button
              type="button"
              onClick={handleToggleRemove}
              data-testid="remove-tool-toggle"
              className={segOn(removeActive)}
              title="Remove — click a wall or an object to delete it (Esc to stop)"
              aria-pressed={removeActive}
              aria-label="Remove"
            >
              <Icon name="hammer" />
              <span className="hidden min-[1700px]:inline">Remove</span>
            </button>
          </div>

          <span className={`${DIVIDER} mr-0`} aria-hidden="true" />
        </div>

        {/* 3 ROOM & PLAN — Box | Custom. Always inline, every width. On the
            phone only the Custom half shows and reads "Walls" (the strip's
            wall pen); from md the Box half joins it as one segmented control.
            `room-draw-toggle` is THIS node and no other. */}
        {/* Polish (2026-08-29): a radiogroup, not two toggles. Neither half is
            ink at rest — Box goes ink only while its size popover is open,
            Custom only while the pen is open; Walls in BUILD is the pen-on
            indicator. The checked-at-rest half reads as a rail wash. */}
        <div
          className="inline-flex shrink-0 overflow-hidden rounded-lg border border-ppw-rim max-md:order-4 md:ml-1 lg:ml-2 2xl:ml-3"
          role="radiogroup"
          aria-label="Room shape"
        >
          <button
            ref={boxRef}
            type="button"
            role="radio"
            onClick={() => {
              setDrawMode(false);
              setSizeOpen((v) => !v);
            }}
            className={`${SEG} ${sizeOpen ? SEG_ON : !drawMode ? SEG_CHECKED : SEG_REST} hidden md:inline-flex`}
            title="Box — a rectangular room; set its size"
            aria-checked={!drawMode}
            aria-expanded={sizeOpen}
            aria-controls="ppw-pop-size"
            aria-label="Box"
          >
            <Icon name="box" />
            <span className="hidden xl:inline">Box</span>
          </button>
          <button
            type="button"
            role="radio"
            onClick={() => {
              if (drawMode) return;
              setViewMode('plan');
              setDrawMode(true);
            }}
            data-testid="room-draw-toggle"
            className={`${SEG} ${drawMode ? SEG_ON : SEG_REST} h-11 max-md:w-full md:h-10 md:border-l md:border-ppw-rim`}
            title="Custom — draw walls: close the shape for a room, or Finish walls to leave them open"
            aria-checked={drawMode}
          >
            <Icon name="pen" className="md:hidden" />
            <Icon name="polygon" className="hidden md:block" />
            <span className="md:hidden">Walls</span>
            <span className="hidden xl:inline">Custom</span>
          </button>
        </div>

        {/* Select on the PHONE STRIP (Vic 2026-09-05: "Select toolbar should
            still be available on main screen rather than only burger menu").
            Icon-only so the strip still fits at 390 px; the md+ bar has its
            own Select in the Build group. */}
        <button
          type="button"
          onClick={handleSelect}
          data-testid="select-tool-toggle-phone"
          className={`${BTN} ${selectActive ? BTN_ON : BTN_REST} order-3 h-11 w-full shrink-0 px-2 md:hidden`}
          aria-pressed={selectActive}
          aria-label="Select"
          title="Select — pick an object or a wall to move or delete it"
        >
          <Icon name="cursor" />
          <span>Select</span>
        </button>

        {/* 3D on the PHONE STRIP. The desktop rail's view-mode-3d is md+
            only, and the sheet row (view-mode-3d-mobile) stays as a second
            path — but the room view has to be a first-class control here.
            A burger row that only toggles a flag reads as "tapping 3D does
            nothing" when the sheet is what the customer is looking at. */}
        <button
          type="button"
          onClick={() => {
            if (drawMode) setDrawMode(false);
            setViewMode(viewMode === '3d' ? 'plan' : '3d');
          }}
          data-testid="view-mode-3d-phone"
          className={`${BTN} ${viewMode === '3d' ? BTN_ON : BTN_REST} order-5 h-11 w-full shrink-0 gap-1.5 px-2 md:hidden`}
          aria-pressed={viewMode === '3d'}
          aria-label={viewMode === '3d' ? 'Back to plan' : '3D'}
          title={viewMode === '3d' ? '3D Mode — back to the plan' : '3D Mode — see the room'}
        >
          <Icon name="cube" />
          <span>{viewMode === '3d' ? '2D Plan' : '3D View'}</span>
        </button>

        {/* Phone hamburger → full-height sheet. */}
        <button
          ref={menuBtnRef}
          type="button"
          onClick={() => setShowMobileMenu((v) => !v)}
          className={`${BTN} ${BTN_REST} order-2 h-11 justify-self-end px-3 md:hidden`}
          aria-label="Open menu"
          aria-expanded={showMobileMenu}
          aria-controls="ppw-sheet"
        >
          <Icon name="menu" />
          <span>Build</span>
        </button>

        {/* ---- md+: rail B — the rest of ROOM&PLAN + VIEW. `overflow-x:auto`
            is the last resort so nothing is ever clipped; every popover is
            portaled so the rail can never clip one. ---- */}
        <div className="hidden min-w-0 flex-1 items-center md:flex md:overflow-x-auto md:overflow-y-hidden md:[scrollbar-width:thin]">
          <Popover anchor={boxRef} open={sizeOpen} onClose={closeSize} width={232} mode="mounted" id="ppw-pop-size" label="Room size">
          <div data-testid="room-size-popover" className="flex flex-col gap-0.5">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>
              Room size
            </p>
            {activeRoomIsRect ? (
              <div className="flex items-center gap-2 px-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>L</label>
                <input
                  type="number"
                  min={Math.max(0.1, snapStepM)}
                  max={50}
                  step={snapStepM}
                  value={room.lengthM}
                  onChange={(e) =>
                    setRoom({ lengthM: Number(e.target.value) || room.lengthM, widthM: room.widthM })
                  }
                  aria-label="Room length (m)"
                  className={`${INPUT} w-16`}
                />
                <span className="text-[11px]" style={{ color: CHROME_TEXT_2 }}>m</span>
                <label className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>W</label>
                <input
                  type="number"
                  min={Math.max(0.1, snapStepM)}
                  max={50}
                  step={snapStepM}
                  value={room.widthM}
                  onChange={(e) =>
                    setRoom({ lengthM: room.lengthM, widthM: Number(e.target.value) || room.widthM })
                  }
                  aria-label="Room width (m)"
                  className={`${INPUT} w-16`}
                />
                <span className="text-[11px]" style={{ color: CHROME_TEXT_2 }}>m</span>
              </div>
            ) : activeRoom && isOutdoorRoom(activeRoom) ? (
              // Sims world (2026-08-29): focus follows a selected garden item
              // into the Outdoors container, which has no walls to measure.
              <p className="px-1 text-[12px]" style={{ color: CHROME_TEXT_2 }}>Outdoors · garden</p>
            ) : room.lengthM < 0.5 ? (
              // Blank-canvas-on-open (2026-06-09) — no room drawn yet.
              <p className="px-1 text-[12px]" style={{ color: CHROME_TEXT_2 }}>
                {drawnRoomCount === 0 ? 'Draw a room first — Walls or Custom.' : 'Pick a room from the rooms list.'}
              </p>
            ) : (
              <p className="px-1 text-[12px]" style={{ color: CHROME_TEXT_2 }}>
                This room is a custom shape — use Measure to retype a wall.
              </p>
            )}
          </div>
        </Popover>

          {isXl ? (
            <div className="ml-2 flex items-center gap-2">{roomPlanGroup(false)}</div>
          ) : (
            <>
              <button
                ref={roomGroupRef}
                type="button"
                onClick={() => setRoomGroupOpen((v) => !v)}
                className={`${BTN} ${roomGroupOpen ? BTN_ON : BTN_REST} ml-1 lg:ml-2`}
                title="Room — storeys, plot"
                aria-expanded={roomGroupOpen}
                aria-controls="ppw-pop-room"
                aria-label="Room"
              >
                <Icon name="room" />
                <span className="hidden lg:inline">Room</span>
              </button>
              <Popover anchor={roomGroupRef} open={roomGroupOpen} onClose={closeRoomGroup} width={232} id="ppw-pop-room" label="Room">
                <div className="flex flex-col gap-1">{roomPlanGroup(true)}</div>
              </Popover>
            </>
          )}

          <span className={DIVIDER} aria-hidden="true" />

          {/* 4 VIEW — Snap · Grid · 3D · Undo/Redo. */}
          {isXl ? (
            <div className="flex items-center gap-2">{viewGroup(false)}</div>
          ) : (
            <>
              <button
                ref={viewGroupRef}
                type="button"
                onClick={() => setViewGroupOpen((v) => !v)}
                className={`${BTN} ${viewGroupOpen ? BTN_ON : BTN_REST}`}
                title="View — snap unit, grid, undo / redo"
                aria-expanded={viewGroupOpen}
                aria-controls="ppw-pop-view"
                aria-label="View"
              >
                <Icon name="view" />
                <span className="hidden lg:inline">View</span>
              </button>
              <Popover anchor={viewGroupRef} open={viewGroupOpen} onClose={closeViewGroup} width={232} id="ppw-pop-view" label="View">
                <div className="flex flex-col gap-1">{viewGroup(true)}</div>
              </Popover>
            </>
          )}
        </div>

        {/* 5 COMMERCE — Currency · Cart · Request quote · More. Never shrinks. */}
        <div className="hidden shrink-0 items-center md:flex">
          <span className={DIVIDER} aria-hidden="true" />
          <div className="flex items-center gap-1 lg:gap-2">
            <CurrencySwitcher compact />

            {/* Polish (2026-08-29): the count sits INSIDE the control — "Cart · 3"
                where the label fits, icon + "3" at narrower tiers. No badge
                floating into the bar padding. */}
            <Link
              to="/cart"
              className={`${BTN} ${BTN_REST} min-[1700px]:px-3`}
              title={`Cart: ${cart.uniqueProductCount} unique products`}
              aria-label={`Cart, ${cart.uniqueProductCount} products`}
            >
              <Icon name="cart" />
              <span className="hidden min-[1700px]:inline">Cart ·</span>
              <span className="font-semibold tabular-nums">{cart.uniqueProductCount}</span>
            </Link>

            {/* M1.C.7 — Request Quote. THE call-to-action on the Designer —
                never icon-only: "Quote" from md, "Request quote" from 2xl. */}
            <button
              type="button"
              onClick={handleRequestQuote}
              disabled={submittingQuote}
              className={`${BTN} ${BTN_CTA} 2xl:px-3`}
              title="Send the current property + cart to the PPW team for a quote"
              aria-label={submittingQuote ? 'Sending…' : 'Request quote'}
            >
              <Icon name="send" className="hidden 2xl:block" />
              <span className="2xl:hidden">{submittingQuote ? 'Sending…' : 'Quote'}</span>
              <span className="hidden 2xl:inline">{submittingQuote ? 'Sending…' : 'Request quote'}</span>
            </button>

            {/* More — New · Save as… · Load (n) · Shop · Help. */}
            <button
              ref={moreRef}
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              data-testid="more-menu-toggle"
              className={`${BTN} ${moreOpen ? BTN_ON : BTN_REST} ${BTN_ICON}`}
              aria-label="More"
              title="More"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-controls="ppw-pop-more"
            >
              <Icon name="more" />
            </button>
            <Popover anchor={moreRef} open={moreOpen} onClose={closeMore} width={208} align="right" id="ppw-pop-more" role="menu" label="More">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMoreOpen(false); handleNew(); }}
                className={ROW}
                title="New property"
              >
                New
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMoreOpen(false); handleNewPlan(); }}
                data-testid="new-plan"
                className={ROW}
                title="Start a second plan (a different space or client) — the current one is kept as a tab"
              >
                New plan
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMoreOpen(false); handleSaveAs(); }}
                className={ROW}
                title="Save the current property under a name (syncs to cloud once you've entered an email)"
              >
                Save as…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMoreOpen(false); setShowLoad((v) => !v); }}
                className={`${ROW} justify-between`}
                title="Load a saved property"
                aria-expanded={showLoad}
                aria-controls="ppw-pop-load"
              >
                <span>Load</span>
                <span className="tabular-nums opacity-80">{savedList.length}</span>
              </button>
              <div className="my-1 h-px bg-ppw-rim" aria-hidden="true" />
              <Link
                to="/products"
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className={ROW}
                title="Browse the full product shop"
              >
                Shop
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMoreOpen(false); setShowHelp((v) => !v); }}
                className={ROW}
                title="Help"
                aria-label="Help"
                aria-expanded={showHelp}
                aria-controls="ppw-pop-help"
              >
                Help
              </button>
            </Popover>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tool options sub-bar — 52 px strip / 40 px controls, door tool only. */}
      {/* ------------------------------------------------------------------ */}
      {doorActive && (
        <div
          className="hidden h-[52px] items-center gap-3 border-t px-3 md:flex"
          style={{ background: CHROME_RAIL_BG, borderColor: CHROME_RIM }}
          data-testid="door-options"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>
            Door
          </span>
          <div className={SEG_GROUP} role="group" aria-label="Door kind">
            {(['door', 'doorway', 'window'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDoorDraft({ kind: k })}
                data-testid={`door-kind-${k}`}
                className={`${segOn(doorDraft.kind === k)} capitalize`}
                aria-pressed={doorDraft.kind === k}
              >
                {k}
              </button>
            ))}
          </div>
          {/* Live width readout (defect 8): the kind chips carry their default
              width with them (0.838 m door / 1.2 m window — designerUIStore),
              so show the number the next click will cut. */}
          <span
            className="text-[12px] font-medium tabular-nums"
            style={{ color: CHROME_TEXT_2 }}
            data-testid="door-width-readout"
          >
            {doorDraft.widthM} m
          </span>
          <span className="h-5 w-px bg-ppw-rim" aria-hidden="true" />
          <button
            type="button"
            onClick={toggleDoorFacing}
            data-testid="door-flip-facing"
            className={`${BTN} ${BTN_REST}`}
            title="Flip which side the door opens toward (F)"
          >
            Flip side
          </button>
          <button
            type="button"
            onClick={toggleDoorHand}
            data-testid="door-flip-hand"
            className={`${BTN} ${BTN_REST}`}
            title="Swap the hinge to the other end (H)"
          >
            Flip hinge
          </button>
        </div>
      )}

      {/* Floor panel (2026-08-30) — DOCKED to the right edge while the Floor
          tool is on, never a popover over the room. Fixed from the header's
          bottom edge down to the desktop dock, 272 px, chrome ground + left
          rim, scrolls internally. Tied to the tool (no outside-click close:
          the canvas clicks that lay tiles must not dismiss it). Carries
          `data-ppw-popover` so the other popovers' outside-click handlers
          treat it as chrome. */}
      {floorPanelOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <aside
            id="ppw-floor-panel"
            data-presentation={viewMode}
            role="complementary"
            aria-label="Floor"
            data-testid="floor-paint-palette"
            data-ppw-popover=""
            className="house-tool-panel hidden flex-col overflow-hidden border-l md:flex"
            style={{
              position: 'fixed',
              top: floorPanelTop,
              right: 0,
              bottom: 'var(--sims-dock-h, 0px)',
              width: FLOOR_PANEL_W,
              zIndex: 30,
              background: CHROME_BG,
              color: CHROME_TEXT,
              borderColor: CHROME_RIM,
              boxShadow: '-4px 0 16px rgba(42,41,38,0.08)',
            }}
          >
            <ToolPanelHeader title="Floor" onClose={() => setTool('hand')} testId="floor-paint-close"
              detail={<span data-testid="floor-paint-room">{floorRoom ? floorRoom.name : 'Draw a room first'}</span>} />
            <div className="house-tool-panel-body flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">

              {/* View — Plan or 3D. Same radios as Wall paint so Floor works
                  in 3D Mode the way paint already does (TintEX 2026-09-22). */}
              <div className={`${SEG_GROUP} mb-2 flex w-full`} role="radiogroup" aria-label="View" data-testid="floor-paint-view">
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode !== '3d'}
                  onClick={() => setViewMode('plan')}
                  data-testid="floor-paint-view-plan"
                  className={`${SEG} ${viewMode !== '3d' ? SEG_CHECKED : SEG_REST} h-9 flex-1`}
                  title="The plan — click the floor on the drawing to lay it"
                >
                  Plan
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === '3d'}
                  onClick={() => setViewMode('3d')}
                  data-testid="floor-paint-view-3d"
                  className={`${SEG} ${viewMode === '3d' ? SEG_CHECKED : SEG_REST} h-9 flex-1`}
                  title="The room in 3D — orbit, then click the floor to lay it"
                >
                  3D room
                </button>
              </div>
              {viewMode === '3d' && (
                <p className="mb-2 rounded-lg border border-ppw-rim bg-ppw-chrome px-3 py-2 text-[11px] font-medium text-ppw-charcoal" data-testid="floor-paint-3d-card-note">
                  The room is in the workspace — click the floor there to lay it.
                </p>
              )}

              {/* Materials — all six K1 SKUs, the roll included. */}
              {FLOOR_MATERIALS.map((m) => {
                const on = floorDraft.materialId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => chooseFloorMaterial(m)}
                    data-testid={`floor-paint-${m.id}`}
                    aria-pressed={on}
                    className={`${ROW} min-h-[44px] py-1 ${on ? ROW_ON : ''}`}
                    title={m.tile_w_m === null ? `${m.name} — sold by the roll, laid whole-room` : m.name}
                  >
                    <span
                      className="h-6 w-6 shrink-0 overflow-hidden rounded border border-ppw-rim"
                      style={{ background: m.hex }}
                    >
                      {productImageForSku(m.sku) && (
                        <img src={productImageForSku(m.sku) ?? undefined} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate">{m.name}</span>
                      <span
                        className="truncate text-[11px] font-medium tabular-nums"
                        style={{ color: on ? undefined : CHROME_TEXT_2, opacity: on ? 0.85 : 1 }}
                      >
                        {floorSizeText(m)} · {floorPriceText(m)}
                      </span>
                    </span>
                  </button>
                );
              })}

              {/* Scope — Tile or Room. Room IS the action (fills the active room). */}
              <div
                className="mt-2 flex gap-2 border-t border-ppw-rim pt-3"
                role="radiogroup"
                aria-label="Floor scope"
                data-testid="floor-paint-scope"
              >
                <button
                  type="button"
                  role="radio"
                  onClick={() => setFloorDraft({ scope: 'tile' })}
                  disabled={floorMaterialIsRoll}
                  data-testid="floor-paint-scope-tile"
                  aria-checked={floorScope === 'tile'}
                  className={`${CHIP} flex-1 ${floorScope === 'tile' ? CHIP_ON : CHIP_REST}`}
                  title={
                    floorMaterialIsRoll
                      ? 'Sold by the roll — whole room only'
                      : 'Tile — click a tile, drag an area'
                  }
                >
                  Tile
                </button>
                <button
                  type="button"
                  role="radio"
                  onClick={handleFloorRoom}
                  data-testid="floor-paint-scope-room"
                  aria-checked={floorScope === 'room'}
                  className={`${CHIP} flex-1 ${floorScope === 'room' ? CHIP_ON : CHIP_REST}`}
                  title={
                    floorDraft.erase
                      ? 'Room — clears the whole active room now'
                      : 'Room — lays the whole active room now (or Shift+click on the canvas)'
                  }
                >
                  Room
                </button>
              </div>

              {/* Erase toggle + Clear floor. */}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFloorDraft({ erase: !floorDraft.erase })}
                  data-testid="floor-paint-erase"
                  aria-pressed={floorDraft.erase}
                  className={`${CHIP} flex-1 ${floorDraft.erase ? CHIP_DANGER_ON : CHIP_REST}`}
                  title="Erase — clicks and drags remove tiles (or hold Ctrl)"
                >
                  Erase
                </button>
                <button
                  type="button"
                  onClick={handleFloorClear}
                  disabled={!floorRoomHasFloor}
                  data-testid="floor-paint-clear"
                  className={`${CHIP} flex-1 ${CHIP_DANGER}`}
                  title={
                    floorRoomHasFloor
                      ? `Remove every floor from ${floorRoom?.name ?? 'this room'}`
                      : 'This room has no floor yet'
                  }
                >
                  Clear floor
                </button>
              </div>

              {/* Live line — the cart's own number for this room. */}
              <p
                className="mt-3 px-1 text-[12px] font-semibold tabular-nums text-[#37362f]"
                data-testid="floor-paint-live"
                aria-live="polite"
              >
                {floorLiveText}
                {floorPreviewCount > 0 && (
                  <span className="ml-1 font-medium" style={{ color: CHROME_TEXT_2 }}>
                    +{floorPreviewCount} tiles
                  </span>
                )}
              </p>
              <p className="px-1 text-[11px] leading-snug" style={{ color: CHROME_TEXT_2 }}>
                {!floorRoom
                  ? 'Draw a room first — Walls'
                  : floorDraft.erase
                    ? floorScope === 'room'
                      ? 'Click inside a room to clear its floor'
                      : 'Click or drag to remove tiles'
                    : floorScope === 'room'
                      ? 'Click inside a room to fill it'
                      : 'Click a tile · drag an area · Shift fills the room · Ctrl erases'}
              </p>

              <button
                type="button"
                onClick={() => setTool('hand')}
                data-testid="floor-paint-done"
                className={`${CHIP} ${CHIP_ON} mt-3 w-full`}
                title="Done — put the Floor tool away (Esc)"
              >
                Done
              </button>
            </div>
          </aside>,
          document.body,
        )}

      {claddingPanelOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <aside
            id="ppw-cladding-panel"
            data-presentation={viewMode}
            role="complementary"
            aria-label="Cladding"
            data-testid="cladding-palette"
            data-ppw-popover=""
            className="house-tool-panel hidden flex-col overflow-hidden border-l md:flex"
            style={{
              position: 'fixed',
              top: floorPanelTop,
              right: 0,
              bottom: 'var(--sims-dock-h, 0px)',
              width: FLOOR_PANEL_W,
              zIndex: 30,
              background: CHROME_BG,
              color: CHROME_TEXT,
              borderColor: CHROME_RIM,
              boxShadow: '-4px 0 16px rgba(42,41,38,0.08)',
            }}
          >
            <ToolPanelHeader title="Cladding" onClose={() => setTool('hand')} testId="cladding-close"
              detail={<span data-testid="cladding-sample-badge">Sample</span>} />
            <div className="house-tool-panel-body flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              <p className="mb-2 px-1 text-[11px] leading-snug" style={{ color: CHROME_TEXT_2 }} data-testid="cladding-disclaimer">
                {CLADDING_DEMO_DISCLAIMER}
              </p>
              <div className={`${SEG_GROUP} mb-2 flex w-full`} role="radiogroup" aria-label="View" data-testid="cladding-view">
                <button type="button" role="radio" aria-checked={viewMode !== '3d'} onClick={() => setViewMode('plan')} data-testid="cladding-view-plan" className={`${SEG} ${viewMode !== '3d' ? SEG_CHECKED : SEG_REST} h-9 flex-1`}>
                  Plan
                </button>
                <button type="button" role="radio" aria-checked={viewMode === '3d'} onClick={() => setViewMode('3d')} data-testid="cladding-view-3d" className={`${SEG} ${viewMode === '3d' ? SEG_CHECKED : SEG_REST} h-9 flex-1`}>
                  3D room
                </button>
              </div>
              {viewMode === '3d' && (
                <p className="mb-2 rounded-lg border border-ppw-rim bg-ppw-chrome px-3 py-2 text-[11px] font-medium text-ppw-charcoal" data-testid="cladding-3d-note">
                  Click a wall in the room to clad it. Shift = whole room · Ctrl = erase.
                </p>
              )}
              {CLADDING_PRODUCTS.map((p) => {
                const on = claddingDraft.productId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCladdingDraft({ productId: p.id, erase: false })}
                    data-testid={`cladding-${p.id}`}
                    aria-pressed={on}
                    className={`${ROW} min-h-[44px] py-1 ${on ? ROW_ON : ''}`}
                  >
                    <span className="h-6 w-6 shrink-0 rounded border border-ppw-rim" style={{ background: p.hex }} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate">{p.name}</span>
                      <span className="truncate text-[11px] font-medium tabular-nums" style={{ color: on ? undefined : CHROME_TEXT_2 }}>
                        {(p.boardWidthM * 1000).toFixed(0)}×{(p.boardLengthM * 1000).toFixed(0)} mm · {p.boardsPerPack}/pack · sample
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="mt-2 flex gap-2 border-t border-ppw-rim pt-3" role="radiogroup" aria-label="Cladding scope" data-testid="cladding-scope">
                <button type="button" role="radio" onClick={() => setCladdingDraft({ scope: 'wall', erase: false })} data-testid="cladding-scope-wall" aria-checked={claddingDraft.scope === 'wall'} className={`${CHIP} flex-1 ${claddingDraft.scope === 'wall' && !claddingDraft.erase ? CHIP_ON : CHIP_REST}`}>
                  Wall
                </button>
                <button type="button" role="radio" onClick={() => setCladdingDraft({ scope: 'room', erase: false })} data-testid="cladding-scope-room" aria-checked={claddingDraft.scope === 'room'} className={`${CHIP} flex-1 ${claddingDraft.scope === 'room' && !claddingDraft.erase ? CHIP_ON : CHIP_REST}`}>
                  Room
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" aria-pressed={claddingDraft.erase} onClick={() => setCladdingDraft({ erase: !claddingDraft.erase })} data-testid="cladding-erase" className={`${CHIP} flex-1 ${claddingDraft.erase ? CHIP_DANGER_ON : CHIP_REST}`}>
                  Erase
                </button>
              </div>
              <p className="mt-2 px-1 text-[12px] font-semibold tabular-nums" data-testid="cladding-live">
                {claddingLiveText}
                {claddingCostText ? ` · ${claddingCostText}` : ''}
              </p>
              <p className="px-1 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                {claddingBrushLabel(claddingDraft)} · click a wall. Objects still place with Select.
              </p>
              <button type="button" onClick={() => setTool('hand')} data-testid="cladding-done" className={`${CHIP} ${CHIP_ON} mt-3 w-full`}>
                Done
              </button>
            </div>
          </aside>,
          document.body,
        )}

      {/* Wall paint panel (md+): the Sofap palette, docked like the Floor
          panel. Both tools share `tool`, so only one panel exists at a time;
          the shared effect above publishes the canvas inset var for both. */}
      {wallPaintPanelOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <aside
            id="ppw-wallpaint-panel"
            data-presentation={viewMode}
            role="complementary"
            aria-label="Wall paint"
            data-testid="wallpaint-palette"
            data-ppw-popover=""
            className="house-tool-panel hidden flex-col overflow-hidden border-l md:flex"
            style={{
              position: 'fixed',
              top: floorPanelTop,
              right: 0,
              bottom: 'var(--sims-dock-h, 0px)',
              width: FLOOR_PANEL_W,
              zIndex: 30,
              background: CHROME_BG,
              color: CHROME_TEXT,
              borderColor: CHROME_RIM,
              boxShadow: '-4px 0 16px rgba(42,41,38,0.08)',
            }}
          >
            <ToolPanelHeader title="Wall paint" onClose={() => setTool('hand')} testId="wallpaint-close"
              detail={<span data-testid="wallpaint-room">{floorRoom ? floorRoom.name : `${paintBrand?.name ?? 'Sofap'} · Mauritius`}</span>} />
            <div className="house-tool-panel-body flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">

              <WallSurfaceOptions />
              {/* View — Plan (the drawing) or 3D (the room). The 3D workspace
                  takes the plan's place; this panel stays. */}
              <div className={`${SEG_GROUP} mb-2 flex w-full`} role="radiogroup" aria-label="View" data-testid="wallpaint-view">
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode !== '3d'}
                  onClick={() => setViewMode('plan')}
                  data-testid="wallpaint-view-plan"
                  className={`${SEG} ${viewMode !== '3d' ? SEG_CHECKED : SEG_REST} h-9 flex-1`}
                  title="The plan — click a wall on the drawing to paint it"
                >
                  Plan
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === '3d'}
                  onClick={() => setViewMode('3d')}
                  data-testid="wallpaint-view-3d"
                  className={`${SEG} ${viewMode === '3d' ? SEG_CHECKED : SEG_REST} h-9 flex-1`}
                  title="The room in 3D — orbit, then click a wall to paint it"
                >
                  3D room
                </button>
              </div>

              {/* The Sims-style room view (2026-09-14): the storey in 3D,
                  every wall in its paint. Click a wall here to paint it;
                  ⤢ opens the big view. */}
              {viewMode === '3d' ? (
                // The workspace IS the room view while 3D Mode is open — one
                // GL stage at a time (a second context per paint click cost a
                // whole extra scene rebuild, and it can distort the first).
                <p className="mb-2 rounded-lg border border-ppw-rim bg-ppw-chrome px-3 py-2 text-[11px] font-medium text-ppw-charcoal" data-testid="wallpaint-3d-card-note">
                  The room is in the workspace — click a wall there to paint it.
                </p>
              ) : (
                <RoomView3D
                  variant="card"
                  onPaintWall={paintFromRoomView}
                  brushHex={wallPaintPreviewHex}
                  hoverTag={hoverWallTag}
                  onExpand={() => setViewMode('3d')}
                  className="mb-2 overflow-hidden rounded-lg border border-ppw-rim"
                />
              )}

              {/* Brand card — always: who the prices come from and when. */}
              {paintBrand && (
                <div className="mb-1 flex items-center gap-2 px-1" data-testid="wallpaint-brand-card">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-ppw-rim bg-white text-[11px] font-bold text-[#37362f]"
                  >
                    {paintBrand.name.slice(0, 1)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[12px] font-semibold text-[#37362f]">{paintBrand.name}</span>
                    <span className="truncate text-[10px]" style={{ color: CHROME_TEXT_2 }}>
                      {paintBrand.colourSystem ?? 'Tinted in store'}
                      {wallPaintSel.priced_at ? ` · prices ${wallPaintSel.priced_at}` : ''}
                    </span>
                  </span>
                </div>
              )}

              {/* Wall height — drives every litre and tin count. */}
              <label
                className="flex min-h-[44px] items-center justify-between gap-2 px-1"
                htmlFor="ppw-wall-height"
              >
                <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                  Wall height
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    id="ppw-wall-height"
                    type="number"
                    min={MIN_WALL_HEIGHT_M}
                    max={MAX_WALL_HEIGHT_M}
                    step={0.1}
                    value={wallHeightM}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) setWallHeight(v);
                    }}
                    data-testid="wallpaint-height"
                    className="h-9 w-20 rounded-md border border-ppw-rim bg-white px-2 text-right text-[13px] font-semibold tabular-nums text-ppw-ink focus:border-ppw-ink focus:outline-none"
                    aria-label="Wall height in metres"
                  />
                  <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                    m
                  </span>
                </span>
              </label>

              {/* Coats + touch-up contingency (audit 2026-09-14): the two
                  inputs that move the litres; both printed on the quote. */}
              <div className="flex items-center justify-between gap-2 px-1 pb-1" data-testid="wallpaint-estimate-settings">
                <label className="flex items-center gap-1.5" htmlFor="ppw-paint-coats">
                  <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                    Coats
                  </span>
                  <select
                    id="ppw-paint-coats"
                    data-testid="wallpaint-coats"
                    value={paintCoatsSetting ?? ''}
                    onChange={(e) => setWallPaintCoats(e.target.value === '' ? null : Number(e.target.value))}
                    className="h-9 rounded-md border border-ppw-rim bg-white px-1.5 text-[13px] font-semibold tabular-nums text-ppw-ink focus:border-ppw-ink focus:outline-none"
                    aria-label="Coats"
                    title={`Datasheet: ${wallPaintSel.recommended_coats} coats for ${wallPaintSel.name}`}
                  >
                    <option value="">Datasheet</option>
                    {Array.from({ length: MAX_PAINT_COATS - MIN_PAINT_COATS + 1 }, (_, i) => MIN_PAINT_COATS + i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5" htmlFor="ppw-paint-waste">
                  <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                    Extra
                  </span>
                  <input
                    id="ppw-paint-waste"
                    type="number"
                    min={0}
                    max={MAX_PAINT_WASTE_PCT}
                    step={1}
                    value={paintWasteSetting ?? (wallPaintTint ? TINTED_PAINT_WASTE_PCT : DEFAULT_PAINT_WASTE_PCT)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setWallPaintWastePct(Number.isFinite(v) ? v : null);
                    }}
                    data-testid="wallpaint-waste"
                    className="h-9 w-14 rounded-md border border-ppw-rim bg-white px-1.5 text-right text-[13px] font-semibold tabular-nums text-ppw-ink focus:border-ppw-ink focus:outline-none"
                    aria-label="Extra paint for touch-ups, percent"
                    title="Touch-up contingency — 10 % is the estimating norm, 15 % on a tinted colour"
                  />
                  <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                    %
                  </span>
                </label>
              </div>
              {/* Bare plaster → one coat of the brand's primer, its own line. */}
              <label className="flex min-h-[36px] items-center gap-2 px-1" htmlFor="ppw-paint-primer" title={paintBrandPrimer ? `${paintBrandPrimer.name} — 1 coat at ${paintBrandPrimer.coverage_m2_per_l} m²/L` : 'This brand has no priced primer loaded'}>
                <input
                  id="ppw-paint-primer"
                  type="checkbox"
                  data-testid="wallpaint-primer"
                  checked={paintPrimerOn}
                  disabled={!paintBrandPrimer && !paintPrimerOn}
                  onChange={(e) => setWallPaintPrimer(e.target.checked)}
                  className="h-4 w-4 accent-ppw-inkDeep"
                />
                <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                  Bare plaster · add primer{paintBrandPrimer ? ` (${paintBrandPrimer.name.replace(/^Permoglaze |^Polytol /, '')})` : ''}
                </span>
              </label>

              {/* Brands — only when more than one paint company is loaded. */}
              {paintBrands.length > 1 && (
                <div className="mb-1 flex flex-wrap gap-1.5 px-1" role="radiogroup" aria-label="Paint brand" data-testid="wallpaint-brands">
                  {paintBrands.map((b) => {
                    const on = b.id === (paintBrand?.id ?? paintBrandId);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-testid={`wallpaint-brand-${b.id}`}
                        onClick={() => {
                          setPaintBrandId(b.id);
                          const first = paintsForBrand(b.id)[0];
                          if (first && brandIdOfPaint(wallPaintSel) !== b.id) chooseWallPaint(first);
                        }}
                        className={`${CHIP} h-8 px-2.5 text-[11px] ${on ? CHIP_ON : CHIP_REST}`}
                        title={b.website ? `${b.name} — ${b.website.replace(/^https?:\/\//, '')}` : b.name}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* The products — sourced from the brand's own listings (see wallPaints.ts).
                  Featured lines first; the rest of the range one tap away. */}
              {wallPaintsShown
                .filter((p) => paintMoreLines || p.featured || !wallPaintsShown.some((q) => q.featured) || p.id === wallPaintSel.id)
                .map((p) => {
                const on = wallPaintSel.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => chooseWallPaint(p)}
                    data-testid={`wallpaint-${p.id}`}
                    aria-pressed={on}
                    className={`${ROW} min-h-[44px] py-1 ${on ? ROW_ON : ''}`}
                    title={`${p.name} — ${p.use === 'both' ? 'interior + exterior' : p.use}, ${p.recommended_coats} coats`}
                  >
                    <span
                      className="h-6 w-6 shrink-0 rounded border border-ppw-rim"
                      style={{ background: on ? wallPaintBrushHex : p.hex }}
                    />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate">{p.name}</span>
                      <span
                        className="truncate text-[11px] font-medium tabular-nums"
                        style={{ color: on ? undefined : CHROME_TEXT_2, opacity: on ? 0.85 : 1 }}
                      >
                        {wallPaintMetaText(p)}
                      </span>
                    </span>
                  </button>
                );
              })}
              {wallPaintsShown.some((q) => q.featured) && wallPaintsShown.some((q) => !q.featured) && (
                <button
                  type="button"
                  onClick={() => setPaintMoreLines((v) => !v)}
                  aria-expanded={paintMoreLines}
                  data-testid="wallpaint-more-lines"
                  className="flex min-h-[36px] w-full items-center justify-between px-2 text-[12px] font-medium"
                  style={{ color: CHROME_TEXT_2 }}
                >
                  <span>
                    {paintMoreLines
                      ? 'Fewer lines'
                      : `More ${paintBrand?.name ?? ''} lines (${wallPaintsShown.filter((q) => !q.featured).length})`}
                  </span>
                  <span aria-hidden="true">{paintMoreLines ? '▾' : '▸'}</span>
                </button>
              )}

              {/* Scope — Wall or Room — Erase and Clear sit right under the lines, in the first screen (the 2026-09-19 paint-UX audit found them 150 px below a 900 px fold). Room IS the action. */}
              <div
                className="mt-2 flex gap-2 border-t border-ppw-rim pt-3"
                role="radiogroup"
                aria-label="Wall paint scope"
                data-testid="wallpaint-scope"
              >
                <button
                  type="button"
                  role="radio"
                  onClick={() => setWallPaintDraft({ scope: 'wall' })}
                  data-testid="wallpaint-scope-wall"
                  aria-checked={wallPaintDraft.scope === 'wall'}
                  className={`${CHIP} flex-1 ${wallPaintDraft.scope === 'wall' ? CHIP_ON : CHIP_REST}`}
                  title="Wall — click one wall to paint it"
                >
                  Wall
                </button>
                <button
                  type="button"
                  role="radio"
                  onClick={handleWallPaintRoom}
                  data-testid="wallpaint-scope-room"
                  aria-checked={wallPaintDraft.scope === 'room'}
                  className={`${CHIP} flex-1 ${wallPaintDraft.scope === 'room' ? CHIP_ON : CHIP_REST}`}
                  title={
                    wallPaintDraft.erase
                      ? 'Room — strips every wall of the active room now'
                      : 'Room — paints every wall of the active room now'
                  }
                >
                  Room
                </button>
              </div>

              {/* Erase toggle + Clear paint. */}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setWallPaintDraft({ erase: !wallPaintDraft.erase })}
                  data-testid="wallpaint-erase"
                  aria-pressed={wallPaintDraft.erase}
                  className={`${CHIP} flex-1 ${wallPaintDraft.erase ? CHIP_DANGER_ON : CHIP_REST}`}
                  title="Erase — clicks remove paint from a wall"
                >
                  Erase
                </button>
                <button
                  type="button"
                  onClick={handleWallPaintClearAll}
                  disabled={!anyWallPainted}
                  data-testid="wallpaint-clear"
                  className={`${CHIP} flex-1 ${CHIP_DANGER}`}
                  title={anyWallPainted ? 'Remove wall paint from the whole plan' : 'No walls painted yet'}
                >
                  Clear paint
                </button>
              </div>

              {/* Colour (2026-09-14): the brand's tints for the chosen line,
                  plus any custom hex — "tint to match" at the counter. A
                  white-only line shows no colours. */}
              {isPaintTintable(wallPaintSel) ? (
                <div className="mt-2 border-t border-ppw-rim pt-2" data-testid="wallpaint-colours">
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                      Colour
                    </span>
                    <span className="min-w-0 truncate text-[12px] font-semibold text-[#37362f]" data-testid="wallpaint-colour-name">
                      {wallPaintTint ? wallPaintTint.name ?? wallPaintTint.hex : 'Base white'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 px-1" role="radiogroup" aria-label="Paint colour">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!wallPaintTint}
                      data-testid="wallpaint-colour-base"
                      onClick={() => chooseWallPaintColour(null)}
                      className={`h-7 w-7 rounded-md border ${!wallPaintTint ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                      style={{ background: wallPaintSel.hex }}
                      title="Base white — the tin as sold"
                      aria-label="Base white"
                    />
                    {wallPaintColours.map((c) => {
                      const hex = normalisePaintColourHex(c.hex) ?? c.hex;
                      const on = !!wallPaintTint && wallPaintTint.hex === hex;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-testid={`wallpaint-colour-${c.id}`}
                          onClick={() => chooseWallPaintColour(c)}
                          className={`h-7 w-7 rounded-md border ${on ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                          style={{ background: hex }}
                          title={`${c.name}${c.code ? ` · ${c.code}` : ''}${c.collection ? ` · ${c.collection}` : ''}`}
                          aria-label={c.name}
                        />
                      );
                    })}
                    <label
                      className={`relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-[13px] leading-none ${wallPaintTintIsCustom ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                      style={{
                        background: wallPaintTintIsCustom
                          ? wallPaintTint?.hex
                          : 'conic-gradient(#e8c9b8, #f3e3b0, #cfe0c2, #bfd6e6, #d9c6e6, #e8c9b8)',
                      }}
                      title="Any colour — the store tints to match"
                    >
                      <span className="sr-only">Custom colour</span>
                      <input
                        type="color"
                        data-testid="wallpaint-colour-custom"
                        aria-label="Custom colour"
                        value={wallPaintTint?.hex ?? '#DCCFB8'}
                        onChange={(e) => chooseCustomWallPaintColour(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      {!wallPaintTintIsCustom && <span aria-hidden="true">+</span>}
                    </label>
                  </div>
                  {brandHasColourChart(paintChartBrandId) && (
                    <div className="mt-1.5 px-1" data-testid="wallpaint-chart">
                      <button
                        type="button"
                        onClick={() => setPaintChartOpen((v) => !v)}
                        aria-expanded={paintChartOpen}
                        data-testid="wallpaint-chart-toggle"
                        className="flex w-full items-center justify-between py-1 text-[12px] font-medium"
                        style={{ color: CHROME_TEXT_2 }}
                      >
                        <span>{paintChartOpen ? `${paintChartName} chart` : `All ${paintChartName} shades`}</span>
                        <span aria-hidden="true">{paintChartOpen ? '▾' : '▸'}</span>
                      </button>
                      {paintChartOpen && (
                        <div className="mt-1">
                          <div className="flex gap-1.5">
                            <select
                              value={paintChartFamily}
                              onChange={(e) => setPaintChartFamily(e.target.value)}
                              data-testid="wallpaint-chart-family"
                              aria-label="Colour family"
                              className="h-8 min-w-0 flex-1 rounded-md border border-ppw-rim bg-white px-1.5 text-[12px] text-ppw-ink focus:outline-none"
                            >
                              <option value="">All families{paintChart ? ` (${paintChart.length})` : ''}</option>
                              {paintChartFamilies.map((f) => (
                                <option key={f} value={f}>
                                  {f.replace(/^Colour Match · /, '')}
                                </option>
                              ))}
                            </select>
                            <input
                              type="search"
                              value={paintChartQuery}
                              onChange={(e) => setPaintChartQuery(e.target.value)}
                              placeholder="Name or code"
                              data-testid="wallpaint-chart-search"
                              aria-label="Search colours"
                              className="h-8 w-24 rounded-md border border-ppw-rim bg-white px-1.5 text-[12px] text-ppw-ink focus:outline-none"
                            />
                          </div>
                          {!paintChart ? (
                            <p className="py-2 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                              Loading the chart…
                            </p>
                          ) : (
                            <div className="mt-1.5 grid max-h-[176px] grid-cols-8 gap-1 overflow-y-auto pr-0.5" role="radiogroup" aria-label={`${paintChartName} shades`} data-testid="wallpaint-chart-grid">
                              {paintChartRows.map((c) => {
                                const hex = normalisePaintColourHex(c.hex) ?? c.hex;
                                const on = !!wallPaintTint && wallPaintTint.hex === hex;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    data-testid={`wallpaint-colour-${c.id}`}
                                    onClick={() => chooseWallPaintColour(c)}
                                    className={`h-6 w-6 rounded border ${on ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                                    style={{ background: hex }}
                                    title={`${c.name}${c.code ? ` · ${c.code}` : ''}`}
                                    aria-label={`${c.name}${c.code ? ` ${c.code}` : ''}`}
                                  />
                                );
                              })}
                              {paintChartRows.length === 0 && (
                                <p className="col-span-8 py-2 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                                  No shade matches.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-1 px-1 text-[10px] leading-snug" style={{ color: CHROME_TEXT_2 }}>
                    {wallPaintColours.length > 0
                      ? `${paintBrand?.name ?? 'Brand'} shades${paintBrand?.colourSystem ? ` · ${paintBrand.colourSystem}` : ''}. A tinted tin is priced on its base (${(wallPaintSel.tintBases ?? []).map((b) => b.name).join(' / ') || 'Pastel / Medium / Basic'}).`
                      : 'Pick any colour — the store tints the base tin to match.'}
                    {paintChartBrandId === 'sofap' ? ` ${SOFAP_COLOUR_DISCLAIMER}` : ''}
                    {paintChartBrandId === 'tintex' ? ` ${TINTEX_COLOUR_DISCLAIMER}` : ''}
                  </p>
                </div>
              ) : (
                <p className="mt-2 border-t border-ppw-rim px-1 pt-2 text-[10px] leading-snug" style={{ color: CHROME_TEXT_2 }} data-testid="wallpaint-colours-none">
                  {wallPaintSel.name} is a white-only line — no tints.
                </p>
              )}

              {/* Scope, Erase / Clear and the live line stay PINNED to the
                  bottom of the panel while the shades and the chart scroll
                  above them — on a 900 px laptop they sat 150 px below the
                  fold (the 2026-09-19 paint-UX audit). */}
              <div className="sticky bottom-0 z-[1] -mx-3 mt-2 border-t border-ppw-rim px-3 pb-2" style={{ background: CHROME_BG }} data-testid="wallpaint-actions">
              {/* Live line — the cart's own number for the whole plan. */}
              <p
                className="mt-3 px-1 text-[12px] font-semibold tabular-nums text-[#37362f]"
                data-testid="wallpaint-live"
                aria-live="polite"
              >
                {wallPaintLiveText}
              </p>
              <p className="px-1 text-[11px] leading-snug" style={{ color: CHROME_TEXT_2 }}>
                {wallPaintDraft.erase
                  ? 'Click a wall to remove its paint'
                  : wallPaintDraft.scope === 'room'
                    ? 'Click any wall of a room to paint the whole room'
                    : `Click a wall to paint it · ${paintCoatsSetting ?? wallPaintSel.recommended_coats} coats at ${wallHeightM.toFixed(1)} m`}
              </p>
              </div>
              <p className="px-1 text-[10px] leading-snug" style={{ color: CHROME_TEXT_2 }} data-testid="wallpaint-assumptions">
                {vatText}
                {wallPaintSel.priced_at ? ` (${paintBrand?.name ?? 'store'}, ${wallPaintSel.priced_at})` : ''}
                {wallPaintSel.price_note ? ` · ${wallPaintSel.price_note}` : ''}
                {wallPaintSel.coverage_estimated ? ` · ${wallPaintSel.coverage_m2_per_l} m²/L is an estimate (no spread rate published)` : ''} · ceilings not included · skirting not deducted · openings under 1 m² not deducted
              </p>

              {/* How it's worked out (2026-09-14): every painted wall as a
                  row a paint company can check by hand, then the tins. */}
              {wallPaintRows.length > 0 && (
                <div className="mt-2 border-t border-ppw-rim pt-2" data-testid="wallpaint-breakdown">
                  <button
                    type="button"
                    onClick={() => setPaintBreakdownOpen((v) => !v)}
                    aria-expanded={paintBreakdownOpen}
                    data-testid="wallpaint-breakdown-toggle"
                    className="flex w-full items-center justify-between px-1 py-1 text-[12px] font-medium"
                    style={{ color: CHROME_TEXT_2 }}
                  >
                    <span>How it&apos;s worked out</span>
                    <span aria-hidden="true">{paintBreakdownOpen ? '▾' : '▸'}</span>
                  </button>
                  {paintBreakdownOpen && (
                    <div className="px-1 text-[11px] leading-snug" data-testid="wallpaint-breakdown-body">
                      <p className="mb-1" style={{ color: CHROME_TEXT_2 }}>
                        Wall length × height − doors and windows = m². Litres = m² × coats ÷ coverage, rounded up to 0.1 L, then the cheapest whole tins.
                      </p>
                      <ul className="space-y-0.5">
                        {wallPaintRows.map((r) => (
                          <li key={`${r.roomId}-${r.wallLabel}`} className="flex items-start gap-1.5 tabular-nums" data-testid="wallpaint-breakdown-row">
                            <span aria-hidden="true" className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border border-ppw-rim" style={{ background: r.renderHex }} />
                            <span className="min-w-0 flex-1 text-[#37362f]">
                              <span className="font-semibold">{r.roomName} · {r.wallLabel}</span>
                              {' '}
                              {r.lengthM.toFixed(2)} × {r.heightM.toFixed(1)} m
                              {r.faces === 2 ? ' × 2 faces' : ''}
                              {r.openingsM2 > 0 ? ` − ${r.openingsM2.toFixed(2)} m² (${r.openingCount} opening${r.openingCount === 1 ? '' : 's'})` : ''}
                              {' = '}
                              <span className="font-semibold">{r.areaM2.toFixed(2)} m²</span>
                              {r.kind === 'free' && r.wallId && (
                                <button
                                  type="button"
                                  onClick={() => setFreeWallPaintFaces(r.wallId as string, r.faces === 2 ? 1 : 2)}
                                  data-testid={`wallpaint-faces-${r.wallId}`}
                                  className="ml-1 rounded border border-ppw-rim bg-white px-1 text-[10px] font-semibold text-[#37362f] hover:bg-[#f3f1ec]"
                                  title="A free-standing wall has two faces — paint one or both"
                                >
                                  {r.faces === 2 ? 'both faces' : '1 face'}
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <ul className="mt-1.5 space-y-1 border-t border-ppw-rim pt-1.5">
                        {wallPaintOrders.map((o) => (
                          <li key={o.key} className="tabular-nums text-[#37362f]" data-testid="wallpaint-breakdown-order">
                            <span className="font-semibold">
                              {o.paint.name}
                              {o.isPrimer ? ' (primer, bare plaster)' : ''}
                              {o.colourHex ? ` · ${o.colourName ?? o.colourHex}` : ''}
                            </span>
                            {': '}
                            {o.areaM2.toFixed(2)} m² × {o.coats} coats ÷ {o.paint.coverage_m2_per_l} m²/L{o.paint.coverage_estimated ? ' (est.)' : ''} = {o.netLitres.toFixed(1)} L + {o.wastePct}% = {o.litres.toFixed(1)} L →{' '}
                            {o.fill.tins.map((t) => `${t.count}× ${t.sizeL} L`).join(' + ')} ={' '}
                            <span className="font-semibold">{formatCurrency(convert(o.fill.totalMur, 'MUR', displayCurrency, fx), displayCurrency)}</span>
                            {o.surplusLitres > 0 ? ` (${o.surplusLitres.toFixed(1)} L over)` : ''}
                            {o.baseName ? ` · ${o.baseName}${o.baseEstimated ? ' (estimated from the colour depth)' : ''}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setTool('hand')}
                data-testid="wallpaint-done"
                className={`${CHIP} ${CHIP_ON} mt-3 w-full`}
                title="Done — put the Wall paint tool away (Esc)"
              >
                Done
              </button>
            </div>
          </aside>,
          document.body,
        )}

      {/* The big 3D room view (2026-09-14). On md+ it covers the plan and
          leaves the docked panel usable, so the brush can change while the
          room is on screen; on the phone it is full-screen with Close. */}
      {viewMode === '3d' &&
        typeof document !== 'undefined' &&
        createPortal(
          <RoomView3D
            variant="overlay"
            title="3D Mode"
            onSave={handleSaveAs}
            onCart={() => navigate('/cart')}
            onPaintWall={claddingActive ? cladFromRoomView : wallPaintActive ? paintFromRoomView : undefined}
            onPaintFloor={floorPaintActive ? paintFloorFromRoomView : undefined}
            brushHex={claddingActive ? (claddingDraft.erase ? null : claddingProduct.hex) : wallPaintActive ? wallPaintPreviewHex : undefined}
            hoverTag={wallPaintActive ? hoverWallTag : undefined}
            onClose={() => setViewMode('plan')}
            footer={
              claddingActive
                ? `${claddingLiveText}${claddingCostText ? ` · ${claddingCostText}` : ''}`
                : wallPaintActive
                  ? wallPaintLiveText
                  : floorPaintActive
                    ? floorLiveText
                    : undefined
            }
            brushStrip={
              claddingActive && !isMd ? (
                <div className="flex items-center gap-1.5 overflow-x-auto border-t border-ppw-rim bg-ppw-chrome px-2 py-1.5" data-testid="cladding-3d-brush-strip">
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>Sample</span>
                  {CLADDING_PRODUCTS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={claddingDraft.productId === p.id}
                      onClick={() => setCladdingDraft({ productId: p.id, erase: false })}
                      className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${claddingDraft.productId === p.id && !claddingDraft.erase ? CHIP_ON : CHIP_REST}`}
                      data-testid={`cladding-3d-${p.id}`}
                    >
                      <span aria-hidden="true" className="mr-1 inline-block h-3.5 w-3.5 rounded-sm border border-ppw-rim" style={{ background: p.hex }} />
                      {p.boardWidthM * 1000} mm
                    </button>
                  ))}
                  <button type="button" aria-pressed={claddingDraft.erase} onClick={() => setCladdingDraft({ erase: !claddingDraft.erase })} className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${claddingDraft.erase ? CHIP_DANGER_ON : CHIP_REST}`} data-testid="cladding-3d-erase">
                    Erase
                  </button>
                </div>
              ) : wallPaintActive && !isMd ? (
                <div className="flex items-center gap-1.5 overflow-x-auto border-t border-ppw-rim bg-ppw-chrome px-2 py-1.5" data-testid="wallpaint-3d-brush-strip">
                  <WallSurfaceOptions compact />
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-menu', { detail: { section: 'wallpaint' } }))}
                    className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${CHIP_REST}`}
                    data-testid="wallpaint-3d-brush-change"
                    title="Change the paint"
                  >
                    <span aria-hidden="true" className="mr-1 inline-block h-3.5 w-3.5 rounded-sm border border-ppw-rim" style={{ background: wallPaintBrushHex }} />
                    {wallPaintSel.name.replace(/^Permoglaze |^Mauvilac |^Polytol /, '')}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!wallPaintTint}
                    onClick={() => chooseWallPaintColour(null)}
                    className={`h-10 w-10 shrink-0 rounded-md border ${!wallPaintTint ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                    style={{ background: wallPaintSel.hex }}
                    aria-label="Base white"
                    data-testid="wallpaint-3d-colour-base"
                  />
                  {wallPaintColours.slice(0, 24).map((c) => {
                    const hex = normalisePaintColourHex(c.hex) ?? c.hex;
                    const on = !!wallPaintTint && wallPaintTint.hex === hex;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => chooseWallPaintColour(c)}
                        className={`h-10 w-10 shrink-0 rounded-md border ${on ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                        style={{ background: hex }}
                        aria-label={c.name}
                        title={c.name}
                        data-testid={`wallpaint-3d-colour-${c.id}`}
                      />
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={wallPaintDraft.erase}
                    onClick={() => setWallPaintDraft({ erase: !wallPaintDraft.erase })}
                    className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${wallPaintDraft.erase ? CHIP_DANGER_ON : CHIP_REST}`}
                    data-testid="wallpaint-3d-erase"
                  >
                    Erase
                  </button>
                </div>
              ) : floorPaintActive && !isMd ? (
                <div className="flex items-center gap-1.5 overflow-x-auto border-t border-ppw-rim bg-ppw-chrome px-2 py-1.5" data-testid="floor-paint-3d-brush-strip">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-menu', { detail: { section: 'floor' } }))}
                    className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${CHIP_REST}`}
                    data-testid="floor-paint-3d-brush-change"
                    title="Change the floor"
                  >
                    <span
                      aria-hidden="true"
                      className="mr-1 inline-block h-3.5 w-3.5 rounded-sm border border-ppw-rim"
                      style={{ background: floorMaterial?.hex ?? '#8a8a84' }}
                    />
                    {floorMaterial?.name ?? 'Floor'}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={floorScope === 'tile'}
                    onClick={() => setFloorDraft({ scope: 'tile' })}
                    disabled={floorMaterialIsRoll}
                    className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${floorScope === 'tile' && !floorDraft.erase ? CHIP_ON : CHIP_REST}`}
                    data-testid="floor-paint-3d-scope-tile"
                  >
                    Tile
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={floorScope === 'room'}
                    onClick={handleFloorRoom}
                    className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${floorScope === 'room' && !floorDraft.erase ? CHIP_ON : CHIP_REST}`}
                    data-testid="floor-paint-3d-scope-room"
                  >
                    Room
                  </button>
                  <button
                    type="button"
                    aria-pressed={floorDraft.erase}
                    onClick={() => setFloorDraft({ erase: !floorDraft.erase })}
                    className={`${CHIP} h-10 shrink-0 px-2 text-[11px] ${floorDraft.erase ? CHIP_DANGER_ON : CHIP_REST}`}
                    data-testid="floor-paint-3d-erase"
                  >
                    Erase
                  </button>
                </div>
              ) : undefined
            }
          />,
          document.body,
        )}

      {/* Energy readout (2026-09-04) — same dock as Floor / Wall paint. */}
      {energyPanelOpenMd &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="house-tool-panel-host" data-presentation={viewMode}>
            <EnergyPanel top={floorPanelTop} width={FLOOR_PANEL_W} onClose={() => setEnergyPanelOpen(false)} />
          </div>,
          document.body,
        )}

      {/* ------------------------------------------------------------------ */}
      {/* Phone sheet — full-height, right, portaled; scrim closes.           */}
      {/* ------------------------------------------------------------------ */}
      {showMobileMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={viewMode === '3d' ? undefined : 'md:hidden'} data-testid="project-sheet-host">
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setShowMobileMenu(false)}
              aria-hidden="true"
            />
            <div
              id="ppw-sheet"
              data-ppw-sheet=""
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-y-0 right-0 z-50 flex w-[min(88vw,360px)] flex-col overflow-y-auto border-l"
              style={{
                background: CHROME_BG,
                color: CHROME_TEXT,
                borderColor: CHROME_RIM,
                paddingBottom: 'env(safe-area-inset-bottom)',
                boxShadow: '0 12px 32px rgba(42,41,38,0.18)',
                scrollPaddingTop: 56,
                scrollPaddingBottom: 80,
              }}
            >
              <div
                className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b px-3"
                style={{ background: CHROME_BG, borderColor: CHROME_RIM }}
              >
                <span className="text-[14px] font-semibold text-[#37362f]">Menu</span>
                <button
                  ref={sheetCloseRef}
                  type="button"
                  onClick={() => setShowMobileMenu(false)}
                  className={`${BTN} ${BTN_REST} h-11 w-11 px-0`}
                  aria-label="Close menu"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="flex flex-1 flex-col px-2 pb-4">
                {/* 1 BUILD */}
                <p className={CAPTION} style={{ color: CHROME_TEXT_2 }}>Build</p>
                {/* Select — the always-visible way back to grabbing an object
                    (complaint B). Same handler as the desktop toggle. */}
                <button
                  type="button"
                  data-testid="select-tool-toggle-mobile"
                  onClick={() => {
                    handleSelect();
                    setShowMobileMenu(false);
                  }}
                  aria-pressed={selectActive}
                  className={`${SHEET_ROW} justify-between ${selectActive ? SHEET_ROW_ON : ''}`}
                >
                  <span className="flex items-center gap-3"><Icon name="cursor" size={20} />Select</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{selectActive ? 'on' : 'off'}</span>
                </button>
                {/* Remove — sledgehammer; tap a wall or object to delete it. */}
                <button
                  type="button"
                  data-testid="remove-tool-toggle-mobile"
                  onClick={() => {
                    handleToggleRemove();
                    setShowMobileMenu(false);
                  }}
                  aria-pressed={removeActive}
                  className={`${SHEET_ROW} justify-between ${removeActive ? SHEET_ROW_ON : ''}`}
                >
                  <span className="flex items-center gap-3"><Icon name="hammer" size={20} />Remove</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{removeActive ? 'on · tap to delete' : 'off'}</span>
                </button>
                {/* Interior walls — the same pen as Custom; identical handler. */}
                <button
                  type="button"
                  data-testid="wall-tool-toggle-mobile"
                  onClick={() => {
                    handleToggleWall();
                    setShowMobileMenu(false);
                  }}
                  aria-pressed={drawMode || wallActive}
                  className={`${SHEET_ROW} justify-between ${drawMode || wallActive ? SHEET_ROW_ON : ''}`}
                >
                  <span className="flex items-center gap-3"><Icon name="pen" size={20} />Walls</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{drawMode || wallActive ? 'on' : 'off'}</span>
                </button>

                {/* Door on the phone (doors brief 2026-08-31, defect 2: below
                    md the toggle lived in a md:-only rail, so a phone had no
                    door tool at all). The row ARMS the tool via the same
                    exclusion handler as the desktop toggle and closes the
                    sheet; kind / flip / Done chips live on the canvas HUD
                    card (RoomCanvas), not here — the sheet is a menu. */}
                <button
                  ref={doorRowMobileRef}
                  type="button"
                  data-testid="door-toggle-mobile"
                  onClick={() => {
                    handleToggleDoor();
                    setShowMobileMenu(false);
                  }}
                  aria-pressed={doorActive}
                  className={`${SHEET_ROW} justify-between ${doorActive ? SHEET_ROW_ON : ''}`}
                  style={{ scrollMarginTop: 56 }}
                >
                  <span className="flex items-center gap-3"><Icon name="door" size={20} />Door</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{doorActive ? 'on' : 'off'}</span>
                </button>

                {/* Floor on the phone (2026-08-30). The Floor row toggles the
                    tool; tapping a material arms it with that material and
                    closes the sheet. Scope / Erase / Done live on the canvas
                    HUD card (RoomCanvas), not here — the sheet is a menu. */}
                <div data-testid="floor-paint-mobile" style={{ scrollMarginTop: 56 }}>
                  <button
                    ref={floorRowMobileRef}
                    type="button"
                    onClick={() => {
                      handleToggleFloorPaint();
                      setShowMobileMenu(false);
                    }}
                    data-testid="floor-paint-toggle-mobile"
                    aria-pressed={floorPaintActive}
                    className={`${SHEET_ROW} justify-between ${floorPaintActive ? SHEET_ROW_ON : ''}`}
                    style={{ scrollMarginTop: 56 }}
                  >
                    <span className="flex items-center gap-3"><Icon name="tiles" size={20} />Floor</span>
                    <span className="min-w-0 max-w-[55%] truncate text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">
                      {floorPaintActive ? `on · ${floorMaterial?.name ?? floorDraft.materialId}` : 'off'}
                    </span>
                  </button>
                  {FLOOR_MATERIALS.map((m) => {
                    const on = floorPaintActive && floorDraft.materialId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          chooseFloorMaterial(m);
                          if (!floorPaintActive) handleToggleFloorPaint();
                          setShowMobileMenu(false);
                        }}
                        data-testid={`floor-paint-mobile-${m.id}`}
                        aria-pressed={floorDraft.materialId === m.id}
                        className={`${SHEET_ROW} pl-6 ${on ? SHEET_ROW_ON : ''}`}
                      >
                        <span className="h-6 w-6 shrink-0 overflow-hidden rounded border border-ppw-rim" style={{ background: m.hex }}>
                          {productImageForSku(m.sku) && (
                            <img src={productImageForSku(m.sku) ?? undefined} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate">{m.name}</span>
                          <span
                            className="truncate text-[11px] font-medium tabular-nums"
                            style={{ color: on ? undefined : CHROME_TEXT_2, opacity: on ? 0.85 : 1 }}
                          >
                            {floorSizeText(m)} · {floorPriceText(m)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Wall paint on the phone (2026-09-02). Same shape as Floor:
                    the row arms the tool; a paint row arms it with that paint
                    and closes the sheet. Scope / Erase / Done live on the
                    canvas HUD card (RoomCanvas), not here. */}
                <div data-testid="cladding-mobile" style={{ scrollMarginTop: 56 }}>
                  <button
                    type="button"
                    data-testid="cladding-toggle-mobile"
                    onClick={() => {
                      handleToggleCladding();
                      setShowMobileMenu(false);
                    }}
                    aria-pressed={claddingActive}
                    className={`${SHEET_ROW} justify-between ${claddingActive ? SHEET_ROW_ON : ''}`}
                  >
                    <span className="flex items-center gap-3"><Icon name="tiles" size={20} />Cladding</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{claddingActive ? 'on · sample' : 'sample demo'}</span>
                  </button>
                  {CLADDING_PRODUCTS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`cladding-mobile-${p.id}`}
                      onClick={() => {
                        setCladdingDraft({ productId: p.id, erase: false });
                        if (!claddingActive) handleToggleCladding();
                        setShowMobileMenu(false);
                      }}
                      className={`${SHEET_ROW} ${claddingActive && claddingDraft.productId === p.id ? SHEET_ROW_ON : ''}`}
                    >
                      <span className="h-6 w-6 shrink-0 rounded border border-ppw-rim" style={{ background: p.hex }} />
                      <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
                    </button>
                  ))}
                </div>
                <div data-testid="wallpaint-mobile" style={{ scrollMarginTop: 56 }}>
                  <button
                    ref={wallPaintRowMobileRef}
                    type="button"
                    onClick={() => {
                      handleToggleWallPaint();
                      setShowMobileMenu(false);
                    }}
                    data-testid="wallpaint-toggle-mobile"
                    aria-pressed={wallPaintActive}
                    className={`${SHEET_ROW} justify-between ${wallPaintActive ? SHEET_ROW_ON : ''}`}
                    style={{ scrollMarginTop: 56 }}
                  >
                    <span className="flex items-center gap-3"><Icon name="roller" size={20} />Wall paint</span>
                    <span className="min-w-0 max-w-[55%] truncate text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">
                      {wallPaintActive ? `on · ${wallPaintSel.name}` : 'off'}
                    </span>
                  </button>
                  <div className="px-4"><WallSurfaceOptions /></div>
                  {/* Phone pass (2026-09-16): the brand's featured lines, the
                      rest behind "More lines" — the same short list the
                      panel shows. All 15 rows made the sheet 3,400 px tall
                      with the colours a screen and a half below the fold. */}
                  {wallPaintsShown
                    .filter((p) => paintMoreLines || p.featured || !wallPaintsShown.some((q) => q.featured) || p.id === wallPaintSel.id)
                    .map((p) => {
                    const on = wallPaintActive && wallPaintDraft.paintId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          chooseWallPaint(p);
                          if (!wallPaintActive) handleToggleWallPaint();
                          setShowMobileMenu(false);
                        }}
                        data-testid={`wallpaint-mobile-${p.id}`}
                        aria-pressed={wallPaintDraft.paintId === p.id}
                        className={`${SHEET_ROW} pl-6 ${on ? SHEET_ROW_ON : ''}`}
                      >
                        <span className="h-6 w-6 shrink-0 rounded border border-ppw-rim" style={{ background: on ? wallPaintBrushHex : p.hex }} />
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate">{p.name}</span>
                          <span
                            className="truncate text-[11px] font-medium tabular-nums"
                            style={{ color: on ? undefined : CHROME_TEXT_2, opacity: on ? 0.85 : 1 }}
                          >
                            {wallPaintMetaText(p)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {wallPaintsShown.some((q) => q.featured) && wallPaintsShown.some((q) => !q.featured) && (
                    <button
                      type="button"
                      onClick={() => setPaintMoreLines((v) => !v)}
                      aria-expanded={paintMoreLines}
                      data-testid="wallpaint-more-lines-mobile"
                      className={`${SHEET_ROW} justify-between pl-6`}
                    >
                      <span className="text-[13px]">
                        {paintMoreLines
                          ? 'Fewer lines'
                          : `More ${paintBrand?.name ?? ''} lines (${wallPaintsShown.filter((q) => !q.featured).length})`}
                      </span>
                      <span aria-hidden="true">{paintMoreLines ? '▾' : '▸'}</span>
                    </button>
                  )}
                  {/* Colour chips (2026-09-14) for the paint on the brush. */}
                  {isPaintTintable(wallPaintSel) && (
                    <div className="px-6 pb-2 pt-1" data-testid="wallpaint-colours-mobile">
                      <p className="mb-1 text-[11px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                        Colour · <span className="font-semibold text-[#37362f]">{wallPaintTint ? wallPaintTint.name ?? wallPaintTint.hex : 'Base white'}</span>
                      </p>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paint colour">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={!wallPaintTint}
                          data-testid="wallpaint-colour-base-mobile"
                          onClick={() => chooseWallPaintColour(null)}
                          className={`h-10 w-10 rounded-md border ${!wallPaintTint ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                          style={{ background: wallPaintSel.hex }}
                          aria-label="Base white"
                        />
                        {wallPaintColours.map((c) => {
                          const hex = normalisePaintColourHex(c.hex) ?? c.hex;
                          const onC = !!wallPaintTint && wallPaintTint.hex === hex;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={onC}
                              data-testid={`wallpaint-colour-mobile-${c.id}`}
                              onClick={() => chooseWallPaintColour(c)}
                              className={`h-10 w-10 rounded-md border ${onC ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                              style={{ background: hex }}
                              aria-label={c.name}
                              title={c.name}
                            />
                          );
                        })}
                        <label
                          className={`relative flex h-10 w-10 items-center justify-center rounded-md border text-[15px] ${wallPaintTintIsCustom ? 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25' : 'border-ppw-rim'}`}
                          style={{
                            background: wallPaintTintIsCustom
                              ? wallPaintTint?.hex
                              : 'conic-gradient(#e8c9b8, #f3e3b0, #cfe0c2, #bfd6e6, #d9c6e6, #e8c9b8)',
                          }}
                        >
                          <span className="sr-only">Custom colour</span>
                          <input
                            type="color"
                            data-testid="wallpaint-colour-custom-mobile"
                            aria-label="Custom colour"
                            value={wallPaintTint?.hex ?? '#DCCFB8'}
                            onChange={(e) => chooseCustomWallPaintColour(e.target.value)}
                            className="absolute inset-0 h-full w-full opacity-0"
                          />
                          {!wallPaintTintIsCustom && <span aria-hidden="true">+</span>}
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Energy (eco / solar 2026-09-04): the sun-vs-use balance,
                    same body as the desktop panel. */}
                <div ref={energyRowMobileRef} data-testid="energy-mobile" className="px-3" style={{ scrollMarginTop: 56 }}>
                  <p className={CAPTION} style={{ color: CHROME_TEXT_2 }}>Energy</p>
                  <EnergySummary compact onJumpToRoof={() => setShowMobileMenu(false)} />
                </div>

                {/* 2 ROOM & PLAN */}
                <p className={CAPTION} style={{ color: CHROME_TEXT_2 }}>Room &amp; plan</p>
                {/* Polish (2026-08-29): plain radios — the Walls row above is the
                    pen indicator, so neither half here goes ink. Below md the
                    pen half reads "Walls", same word as the strip. */}
                <div className={`${SEG_GROUP} mx-3 mb-1`} role="radiogroup" aria-label="Room shape">
                  <button
                    type="button"
                    role="radio"
                    onClick={() => { setDrawMode(false); setShowMobileMenu(false); }}
                    className={`${SEG} ${!drawMode ? SEG_CHECKED : SEG_REST} h-11 flex-1`}
                    aria-checked={!drawMode}
                  >
                    <Icon name="box" />
                    Box
                  </button>
                  <button
                    type="button"
                    role="radio"
                    onClick={() => { setDrawMode(true); setShowMobileMenu(false); }}
                    className={`${SEG} ${drawMode ? SEG_CHECKED : SEG_REST} h-11 flex-1`}
                    aria-checked={drawMode}
                  >
                    <Icon name="polygon" />
                    Custom
                  </button>
                </div>

                {/* Storeys on the phone: one row per floor + add. */}
                <div data-testid="levels-mobile">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>Storeys</p>
                  {[...levels].sort((a, b) => b.index - a.index).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => { setActiveLevel(l.id); setShowMobileMenu(false); }}
                      data-testid={`level-mobile-${l.id}`}
                      aria-pressed={l.id === activeLevelId}
                      className={`${SHEET_ROW} justify-between ${l.id === activeLevelId ? SHEET_ROW_ON : ''}`}
                    >
                      <span>{l.name}</span>
                      {l.id === activeLevelId && <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">here</span>}
                    </button>
                  ))}
                  {!roofLevelOf(property) && (
                    <button
                      type="button"
                      onClick={() => { handleToggleRoof(); setShowMobileMenu(false); }}
                      data-testid="roof-toggle-mobile"
                      aria-pressed={false}
                      className={`${SHEET_ROW} justify-between`}
                    >
                      <span>Roof</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">solar</span>
                    </button>
                  )}
                  <div className="px-3 pt-1">
                    <button
                      type="button"
                      onClick={() => { handleAddLevel(); setShowMobileMenu(false); }}
                      data-testid="level-add-mobile"
                      className={`${SHEET_ROW} justify-center border border-dashed border-ppw-rim`}
                    >
                      + Add floor above
                    </button>
                  </div>
                </div>

                {/* 3D Mode (2026-09-17) on the phone: the room, edge to edge
                    under the strip; the paint HUD's 3D chip is the same switch. */}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode(viewMode === '3d' ? 'plan' : '3d');
                    setShowMobileMenu(false);
                  }}
                  data-testid="view-mode-3d-mobile"
                  aria-pressed={viewMode === '3d'}
                  className={`${SHEET_ROW} justify-between ${viewMode === '3d' ? SHEET_ROW_ON : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" d="M8 1.8 13.6 5v6L8 14.2 2.4 11V5zM8 8l5.6-3M8 8 2.4 5M8 8v6.2" />
                    </svg>
                    3D Mode
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{viewMode === '3d' ? 'on' : 'off'}</span>
                </button>

                {/* Land plot on the phone. */}
                <div data-testid="land-mobile" className="px-3 pt-2">
                  <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: CHROME_TEXT_2 }}>
                    Plot {site ? `· ${site.widthM} × ${site.depthM} m` : '· unlimited'}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      step={0.5}
                      value={landW}
                      onChange={(e) => setLandW(e.target.value)}
                      aria-label="Plot width (m)"
                      className={`${INPUT} h-11 w-full min-w-0 flex-1 text-[14px]`}
                    />
                    <span className="text-[12px]" style={{ color: CHROME_TEXT_2 }}>×</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      step={0.5}
                      value={landD}
                      onChange={(e) => setLandD(e.target.value)}
                      aria-label="Plot depth (m)"
                      className={`${INPUT} h-11 w-full min-w-0 flex-1 text-[14px]`}
                    />
                    <button
                      type="button"
                      onClick={() => { applyLand(); setShowMobileMenu(false); }}
                      className={`${BTN} ${BTN_INK} h-11`}
                    >
                      Lock
                    </button>
                    {site && (
                      <button
                        type="button"
                        onClick={() => { clearLand(); setShowMobileMenu(false); }}
                        className={`${BTN} h-11 border-ppw-clay bg-ppw-chrome text-ppw-clay hover:bg-ppw-clay hover:text-white`}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 VIEW */}
                <p className={CAPTION} style={{ color: CHROME_TEXT_2 }}>View</p>
                <p className="px-3 pb-1 text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>Snap unit</p>
                {/* Units brief D7 - without these six chips a phone user has no
                    way to choose a unit at all (the desktop popover is md-only). */}
                <div className={`${SEG_GROUP} mx-3 mb-1 w-auto`}>
                  {SNAP_UNIT_ORDER.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        setPrecision(u);
                        setShowMobileMenu(false);
                      }}
                      data-testid={`snap-unit-mobile-${u}`}
                      aria-pressed={precision === u}
                      className={`${segOn(precision === u)} h-11 min-w-0 flex-1 px-1 text-[11px] tabular-nums`}
                      aria-label={`Snap ${SNAP_UNIT_LABEL[u]}`}
                    >
                      {SNAP_UNIT_LABEL[u]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toggleGrid();
                    setShowMobileMenu(false);
                  }}
                  aria-pressed={showGrid}
                  className={`${SHEET_ROW} justify-between ${showGrid ? SHEET_ROW_ON : ''}`}
                >
                  <span className="flex items-center gap-3"><Icon name="grid" size={20} />Grid · {snapUnit}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{showGrid ? 'on' : 'off'}</span>
                </button>
                {setThreeDPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setThreeDPreview(!threeDPreview);
                      setShowMobileMenu(false);
                    }}
                    aria-pressed={threeDPreview}
                    className={`${SHEET_ROW} justify-between ${threeDPreview ? SHEET_ROW_ON : ''}`}
                  >
                    <span className="flex items-center gap-3"><Icon name="cube" size={20} />3D preview</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">{threeDPreview ? 'on' : 'off'}</span>
                  </button>
                )}

                {/* 4 PLAN FILES */}
                <p className={CAPTION} style={{ color: CHROME_TEXT_2 }}>Plan files</p>
                <button
                  type="button"
                  onClick={() => {
                    handleNew();
                    setShowMobileMenu(false);
                  }}
                  className={SHEET_ROW}
                >
                  New property
                </button>
                {/* Clear moved to the canvas sticky ClearControls (2026-06-09). */}
                <button
                  type="button"
                  onClick={() => {
                    handleSaveAs();
                    setShowMobileMenu(false);
                  }}
                  className={SHEET_ROW}
                >
                  Save as…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowLoad((v) => !v);
                  }}
                  className={`${SHEET_ROW} justify-between`}
                >
                  <span>Load</span>
                  <span className="tabular-nums" style={{ color: CHROME_TEXT_2 }}>{savedList.length}</span>
                </button>
                <Link
                  to="/my-designs"
                  onClick={() => setShowMobileMenu(false)}
                  className={SHEET_ROW}
                >
                  My designs (cloud)
                </Link>

                {/* 5 SHOP */}
                <p className={CAPTION} style={{ color: CHROME_TEXT_2 }}>Shop</p>
                <div className="flex min-h-[48px] items-center justify-between px-3">
                  <span className="text-[14px] font-medium text-[#37362f]">Currency</span>
                  <CurrencySwitcher compact />
                </div>
                <Link
                  to="/cart"
                  onClick={() => setShowMobileMenu(false)}
                  className={`${SHEET_ROW} justify-between`}
                >
                  <span className="flex items-center gap-3"><Icon name="cart" size={20} />Cart</span>
                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-ppw-inkDeep px-1.5 text-[11px] font-semibold tabular-nums text-ppw-paper">
                    {cart.uniqueProductCount}
                  </span>
                </Link>
                {/* 3b (2026-07-26): mobile route back to the storefront. */}
                <Link
                  to="/products"
                  onClick={() => setShowMobileMenu(false)}
                  className={SHEET_ROW}
                >
                  ← Back to Shop
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowHelp((v) => !v);
                  }}
                  className={SHEET_ROW}
                >
                  Help
                </button>
              </div>

              {/* Sticky footer — THE call-to-action. */}
              <div
                className="sticky bottom-0 z-10 border-t p-3"
                style={{ background: CHROME_BG, borderColor: CHROME_RIM }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    void handleRequestQuote();
                  }}
                  disabled={submittingQuote}
                  className={`${BTN} ${BTN_CTA} h-12 w-full text-[14px]`}
                >
                  <Icon name="send" />
                  {submittingQuote ? 'Sending…' : 'Request quote'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Help + Load ride the same Popover as everything else (Esc + outside
          click close them). Anchored to More on desktop, the hamburger on the
          phone — the only two triggers that can open them at each width. */}
      <Popover
        anchor={helpAnchor}
        open={showHelp}
        onClose={closeHelp}
        width={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 16 : 320)}
        align="right"
        id="ppw-pop-help"
        label="Quick start"
        className="p-4 text-[12px] leading-snug"
      >
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Quick start</p>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className={`${BTN} ${BTN_REST} h-9 w-9 px-0`}
              aria-label="Close help"
            >
              <Icon name="close" />
            </button>
          </div>
          <ol className="ml-4 list-decimal space-y-1">
            <li><em>Walls</em> or <em>Custom</em>: click to drop wall points. Close the shape for a room, or <em>Finish walls</em> to leave them open.</li>
            <li>Change the unit mid-draw with the − / + chips (keys + and −, or 1–6).</li>
            <li>Drag a product from the dock onto the floor — inside a room or outside in the garden. Items sit flush to walls and tuck into corners.</li>
            <li><em>Floor</em>: pick a material, then click a tile, drag an area, or press <em>Room</em> to lay the whole room. Shift fills the room, Ctrl erases.</li>
            <li><em>Door</em>: pick Door, Doorway or Window, hover a wall and click. <em>Flip side</em> / <em>Flip hinge</em> set the swing; click a placed opening to remove it. On the phone: Menu → Door, then tap a wall.</li>
            <li><em>Plot</em> locks the plot size; <em>Storeys</em> adds storeys (PageUp / PageDown).</li>
            <li>Click a placed item to rotate, duplicate, delete, or switch a light on/off.</li>
            <li><em>Save as…</em> (under More) stores the whole property (all storeys, rooms, walls + items).</li>
          </ol>
          <p className="mt-2 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
            Keys: R rotate; D duplicate; Del delete; Esc deselect; Ctrl+Z undo; M measure;
            [ / ] unit; PageUp / PageDown storey; Shift+P clear products; Shift+X clear all.
          </p>
        </div>
      </Popover>

      <Popover
        anchor={helpAnchor}
        open={showLoad}
        onClose={closeLoad}
        width={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 16 : 320)}
        align="right"
        id="ppw-pop-load"
        label="Saved properties"
        className="p-3 text-[12px]"
      >
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-[#37362f]">Saved properties</p>
            <Link
              to="/my-designs"
              onClick={() => setShowLoad(false)}
              className="text-[11px] font-semibold text-[#37362f] underline underline-offset-2"
            >
              My designs (cloud)
            </Link>
          </div>
          {savedList.length === 0 ? (
            <p className="py-2" style={{ color: CHROME_TEXT_2 }}>No saved properties yet. Use <em>Save as…</em></p>
          ) : (
            <ul className="space-y-1.5">
              {savedList.map((d) => {
                const itemCount = (d.property?.rooms ?? []).reduce(
                  (acc, r) => acc + (r.placedItems?.length ?? 0),
                  0,
                );
                const roomCount = d.property?.rooms?.length ?? 0;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-ppw-rim p-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(d.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className={`truncate text-[14px] font-medium ${currentId === d.id ? 'text-ppw-inkDeep' : 'text-[#37362f]'}`}>
                        {d.name}{currentId === d.id ? ' (current)' : ''}
                      </p>
                      <p className="text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                        {roomCount} room{roomCount === 1 ? '' : 's'} - {itemCount} item{itemCount === 1 ? '' : 's'} - {new Date(d.savedAt).toLocaleString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete saved property "${d.name}"?`)) {
                          removeSavedDesign(d.id);
                          pushToast(`Deleted "${d.name}"`, 'info');
                        }
                      }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ppw-clay text-ppw-clay transition-colors duration-[120ms] ease-out motion-reduce:transition-none hover:bg-ppw-clay hover:text-white"
                      title="Delete saved property"
                      aria-label={`Delete ${d.name}`}
                    >
                      <Icon name="close" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Popover>

      {confirmingNew && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(event) => {
          if (event.target === event.currentTarget) setConfirmingNew(false);
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ppw-confirm-new-title"
            data-testid="new-property-dialog"
            className="w-80 rounded-xl border p-5"
            style={{ background: CHROME_BG, borderColor: CHROME_RIM, boxShadow: '0 12px 32px rgba(42,41,38,0.18)' }}
          >
            <p id="ppw-confirm-new-title" className="text-[14px] font-semibold text-[#37362f]">Start a new property?</p>
            <p className="mt-1 text-[12px]" style={{ color: CHROME_TEXT_2 }}>
              Current property has {property.rooms.length} room{property.rooms.length === 1 ? '' : 's'} and {cart.totalItemCount} placed item{cart.totalItemCount === 1 ? '' : 's'}. The auto-draft is kept, but un-named work will be lost. Save as… first if you want to keep it.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmNew}
                className={`${BTN} flex-1 border-ppw-clay bg-ppw-clay font-semibold text-white hover:brightness-95`}
              >
                Yes, start new
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingNew(false)}
                className={`${BTN} ${BTN_REST} flex-1`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
