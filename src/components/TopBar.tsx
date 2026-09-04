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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
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
import { performUndo, performRedo } from '../lib/undoIntent';
// Polish (2026-08-29): "New plan" under More — PageTabs is hidden while there
// is a single plan, so this is how a second plan gets started.
import { createPage, switchToPage } from '../lib/pages';
import {
  DEFAULT_WALL_HEIGHT_M,
  MAX_WALL_HEIGHT_M,
  MIN_WALL_HEIGHT_M,
  WALL_PAINTS,
  findWallPaintById,
  type WallPaint,
} from '../data/wallPaints';
import { deriveWallPaintOrders } from '../designer/wallPaintCalc';
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
    !measureActive;
  const floorDraft = useDesignerUIStore((st) => st.floorDraft);
  const setFloorDraft = useDesignerUIStore((st) => st.setFloorDraft);
  const wallPaintDraft = useDesignerUIStore((st) => st.wallPaintDraft);
  const setWallPaintDraft = useDesignerUIStore((st) => st.setWallPaintDraft);
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
  const floorRoom =
    activeRoom && isDrawnPolygon(activeRoom.polygon) && !isOutdoorRoom(activeRoom) ? activeRoom : null;
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
  const wallPaintSel: WallPaint = findWallPaintById(wallPaintDraft.paintId) ?? WALL_PAINTS[0];
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
  /** "matt · 9 m²/L · from Rs 201.25" — one line under the name. */
  const wallPaintMetaText = (p: WallPaint) =>
    `${p.finish} · ${p.coverage_m2_per_l} m²/L · from ${formatCurrency(
      convert(Math.min(...p.tins.map((t) => t.priceMur)), 'MUR', displayCurrency, fx),
      displayCurrency,
    )}`;

  /** Choose a paint: erase off, like choosing a floor material. */
  function chooseWallPaint(p: WallPaint) {
    setWallPaintDraft({ paintId: p.id, erase: false });
  }

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
    if (wallPaintDraft.erase) {
      paintRoomWalls(floorRoom.id, null);
      pushToast(`${floorRoom.name} — wall paint removed`, 'info');
      return;
    }
    paintRoomWalls(floorRoom.id, wallPaintSel.id);
    pushToast(`${floorRoom.name} — every wall painted`, 'success');
  }

  const anyWallPainted =
    property.rooms.some((r) => (r.wallPaint?.length ?? 0) > 0) ||
    (property.walls ?? []).some((w) => !!w.paintId);

  function handleWallPaintClearAll() {
    for (const r of property.rooms) {
      if ((r.wallPaint?.length ?? 0) > 0) paintRoomWalls(r.id, null);
    }
    for (const w of property.walls ?? []) {
      if (w.paintId) paintFreeWall(w.id, null);
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
    const opener = menuBtnRef.current;
    sheetCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [showMobileMenu]);

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
  // Energy readout (2026-09-04): a third docked panel on the same edge. The
  // store guarantees it never coexists with a build tool.
  const energyPanelOpen = useDesignerUIStore((s) => s.energyPanelOpen);
  const setEnergyPanelOpen = useDesignerUIStore((s) => s.setEnergyPanelOpen);
  const energyPanelOpenMd = isMd && energyPanelOpen;
  const sidePanelOpen = floorPanelOpen || wallPaintPanelOpen || energyPanelOpenMd;
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
    const measure = () => setFloorPanelTop(Math.round(el.getBoundingClientRect().bottom));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sidePanelOpen]);

  // Esc = tool off while the Floor tool is on (Done does the same). Inputs
  // keep their own Esc (a level rename in progress must not lose the tool).
  useEffect(() => {
    if (!floorPaintActive && !wallPaintActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      setTool('hand');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [floorPaintActive, wallPaintActive, setTool]);

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
      className="relative z-20 shrink-0 border-b"
      style={{ background: CHROME_BG, borderColor: CHROME_RIM }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* THE ROW: 56 px strip on the phone, 52 px bar from md up.            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex h-14 flex-nowrap items-center gap-2 px-2 md:h-[52px] md:gap-0 md:px-1 lg:px-2">
        {/* 1 IDENTITY — the only group allowed to shrink. md (768–1023) runs
            4 px tighter everywhere it can: measured at 768 the Walls + Quote
            labels and the in-control cart count need those pixels. */}
        <div className="flex min-w-0 flex-1 shrink items-center gap-2 md:flex-initial md:gap-1 lg:gap-2">
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
            className={`${BTN} ${roomsMenuOpen ? BTN_ON : BTN_REST} h-11 min-w-[128px] flex-1 justify-start md:h-10 md:min-w-[80px] md:max-w-[190px] md:flex-none lg:min-w-[104px] xl:min-w-[128px] xl:max-w-[190px] 2xl:max-w-[190px] min-[1700px]:max-w-[260px]`}
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
              <span className="ml-1 tabular-nums opacity-80 max-md:inline md:hidden lg:inline">· {drawnRoomCount}</span>
            </span>
          </button>
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
          className="inline-flex shrink-0 overflow-hidden rounded-lg border border-ppw-rim md:ml-1 lg:ml-2 2xl:ml-3"
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
            onClick={() => setDrawMode(true)}
            data-testid="room-draw-toggle"
            className={`${SEG} ${drawMode ? SEG_CHECKED : SEG_REST} h-11 md:h-10 md:border-l md:border-ppw-rim`}
            title="Custom — draw walls: close the shape for a room, or Finish walls to leave them open"
            aria-checked={drawMode}
          >
            <Icon name="pen" className="md:hidden" />
            <Icon name="polygon" className="hidden md:block" />
            <span className="md:hidden">Walls</span>
            <span className="hidden xl:inline">Custom</span>
          </button>
        </div>

        {/* Phone hamburger → full-height sheet. */}
        <button
          ref={menuBtnRef}
          type="button"
          onClick={() => setShowMobileMenu((v) => !v)}
          className={`${BTN} ${BTN_REST} h-11 w-11 px-0 md:hidden`}
          aria-label="Open menu"
          aria-expanded={showMobileMenu}
          aria-controls="ppw-sheet"
        >
          <Icon name="menu" />
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
            role="complementary"
            aria-label="Floor"
            data-testid="floor-paint-palette"
            data-ppw-popover=""
            className="hidden flex-col overflow-y-auto border-l md:flex"
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
            <div className="flex flex-col gap-0.5 p-3">
              {/* Title + the room the tool works on. */}
              <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
                <span className="text-[14px] font-semibold text-[#37362f]">Floor</span>
                <span
                  className="min-w-0 truncate text-[12px] font-medium"
                  style={{ color: CHROME_TEXT_2 }}
                  data-testid="floor-paint-room"
                >
                  {floorRoom ? floorRoom.name : 'Draw a room first'}
                </span>
              </div>

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

      {/* Wall paint panel (md+): the Sofap palette, docked like the Floor
          panel. Both tools share `tool`, so only one panel exists at a time;
          the shared effect above publishes the canvas inset var for both. */}
      {wallPaintPanelOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <aside
            id="ppw-wallpaint-panel"
            role="complementary"
            aria-label="Wall paint"
            data-testid="wallpaint-palette"
            data-ppw-popover=""
            className="hidden flex-col overflow-y-auto border-l md:flex"
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
            <div className="flex flex-col gap-0.5 p-3">
              {/* Title + the room the Room scope works on. */}
              <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
                <span className="text-[14px] font-semibold text-[#37362f]">Wall paint</span>
                <span
                  className="min-w-0 truncate text-[12px] font-medium"
                  style={{ color: CHROME_TEXT_2 }}
                  data-testid="wallpaint-room"
                >
                  {floorRoom ? floorRoom.name : 'Sofap · Mauritius'}
                </span>
              </div>

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

              {/* The five Sofap (Permoglaze) products — sourced 2026-09-02. */}
              {WALL_PAINTS.map((p) => {
                const on = wallPaintDraft.paintId === p.id;
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
                      style={{ background: p.hex }}
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

              {/* Scope — Wall or Room. Room IS the action. */}
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
                    : `Click a wall to paint it · ${wallPaintSel.recommended_coats} coats at ${wallHeightM.toFixed(1)} m`}
              </p>

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

      {/* Energy readout (2026-09-04) — same dock as Floor / Wall paint. */}
      {energyPanelOpenMd &&
        typeof document !== 'undefined' &&
        createPortal(
          <EnergyPanel top={floorPanelTop} width={FLOOR_PANEL_W} onClose={() => setEnergyPanelOpen(false)} />,
          document.body,
        )}

      {/* ------------------------------------------------------------------ */}
      {/* Phone sheet — full-height, right, portaled; scrim closes.           */}
      {/* ------------------------------------------------------------------ */}
      {showMobileMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="md:hidden">
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
                  {WALL_PAINTS.map((p) => {
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
                        <span className="h-6 w-6 shrink-0 rounded border border-ppw-rim" style={{ background: p.hex }} />
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

      {confirmingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ppw-confirm-new-title"
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
        </div>
      )}
    </header>
  );
}
