/**
 * TopBar - Week 3 build (was Week 2.5).
 *
 * Additions vs Week 2.5:
 *   - CurrencySwitcher (MUR / USD / EUR / GBP) in the right cluster.
 *   - Cart badge is a Link to /cart.
 *
 * Carryover from W2.5:
 *   - Property name (inline rename) on the left.
 *   - Mode toggle (Rectangle / Draw) for the canvas.
 *   - L/W inputs only edit the active room AND only when polygon is rectangular.
 *   - Save/Load v2 - properties (multi-room) saved under `ppw_properties_v2`.
 *
 * fix/mobile-ux-v1 (May 2026):
 *   - Right-cluster Save/Load/Help/Cart/Grid hidden on mobile behind a
 *     hamburger overflow menu (the screenshot Vic sent showed all those
 *     buttons wrapping and overflowing on a ~390px viewport).
 *   - Rect/Draw mode toggle is now ALSO visible on mobile (was hidden
 *     md:flex — the reason Vic couldn't enter Draw mode on his phone).
 *   - The RoomList mobile trigger used to be an absolute-positioned
 *     button rendered by RoomList itself; it overlapped the currency
 *     picker. It now lives inline as the left-side button in this bar
 *     and toggles `roomsMenuOpen` (lifted to App.tsx).
 *   - All tap targets ≥40px on mobile.
 */

import { useState } from 'react';
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
import { performUndo, performRedo } from '../lib/undoIntent';
import { FLOOR_MATERIALS } from '../data/floorMaterials';
import { useWallStore } from '../store/wallStore';
import { useCart } from '../store/cartStore';
import { CurrencySwitcher } from './CurrencySwitcher';
import {
  getCachedCustomerEmail,
  promptForCustomerEmail,
} from '../lib/customerIdentity';
import { saveDesignToApi, submitLead } from '../lib/designsApi';

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
  const renameProperty = usePropertyStore((s) => s.renameProperty);
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
  // reporting "1 room" over an empty plan is wrong.
  const drawnRoomCount = property.rooms.filter((r) => isDrawnPolygon(r.polygon)).length;
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

  // Floor finish (2026-08-28). Applies to the FOCUSED room — the one the
  // L/W boxes and the details panel already describe — so there is one
  // consistent answer to "which room am I editing".
  const [floorOpen, setFloorOpen] = useState(false);
  // Units brief (2026-08-28, D7). A popover, not a six-way segmented
  // control: this bar already overflowed at 1366 px, which is why the
  // title is hidden below xl. The floor picker below is the proven
  // width-safe dropdown pattern in this exact bar.
  const [unitOpen, setUnitOpen] = useState(false);
  const precision = useDesignerUIStore((s) => s.precision);
  const setPrecision = useDesignerUIStore((s) => s.setPrecision);
  const snapStepM = PRECISION_STEP_M[precision];
  const setRoomFloor = usePropertyStore((s) => s.setRoomFloor);

  function handleToggleDoor() {
    // Room-draw and wall-draw own the canvas pointer while they are live, so
    // stand them down rather than letting two tools fight over the same click.
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(doorActive ? 'hand' : 'door');
  }

  function handleToggleMeasure() {
    // Same three exclusions as the door tool. Wall mode lives on
    // wallStore.draw.phase, room-draw on App-level drawMode, and the door
    // tool on designerUIStore.tool - miss one and two tools fight the same
    // Stage click.
    if (drawMode) setDrawMode(false);
    if (wallActive) setWallDraw({ phase: 'idle' });
    setTool(measureActive ? 'hand' : 'measure');
  }

  function handleToggleWall() {
    if (wallActive) {
      setWallDraw({ phase: 'idle' });
      return;
    }
    // Entering wall mode — leave polygon-draw mode if it was on so the two
    // tools don't fight over the canvas (setDrawMode has history side
    // effects, so only call it when actually in draw mode).
    if (drawMode) setDrawMode(false);
    setWallDraw({ phase: 'armed' });
  }

  const [showHelp, setShowHelp] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState(property.name);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const activeRoom = property.rooms.find((r) => r.id === property.activeRoomId);
  const currentFloorId = activeRoom?.floorFinish?.materialId ?? null;

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

  function commitPropertyRename() {
    renameProperty(propertyDraft);
    setEditingProperty(false);
  }

  return (
    // Soft-skin frame (2026-07-26): warm surface + hairline rim, matching
    // the shop's neumorphic register instead of stark white.
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#dcd9d0] bg-[#faf9f5] px-2 md:px-4 gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
        {/* PPW brand mark — same tile as the shop header (was a placeholder
            teal triangle). Links back to the storefront. */}
        <Link
          to="/products"
          title="Back to PPWellness Shop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dcd9d0] bg-[#faf9f5] shadow-[3px_3px_7px_rgba(167,160,144,0.42),-3px_-3px_7px_rgba(255,255,255,0.95)]"
        >
          <img src="/brand/ppw-mark-512.png" alt="PPWellness" width={24} height={24} className="block" />
        </Link>

        {/* Title + property rename. `xl:` since 2026-08-25 — the Rooms
            trigger now lives in this cluster at every width, and at 1366 the
            two together overflowed the bar (buttons on the right clipped
            and wrapped). Below 1280 the Rooms trigger shows the active room
            + room count, and its dropdown still hosts the property rename,
            so nothing is lost. */}
        <div className="hidden xl:block leading-tight min-w-0">
          <p className="truncate text-sm font-semibold text-ppw-ink">Wellness Room Designer</p>
          {editingProperty ? (
            <input
              autoFocus
              type="text"
              value={propertyDraft}
              onChange={(e) => setPropertyDraft(e.target.value)}
              onBlur={commitPropertyRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPropertyRename();
                if (e.key === 'Escape') {
                  setPropertyDraft(property.name);
                  setEditingProperty(false);
                }
              }}
              className="block w-44 rounded-sm border-b border-ppw-teal bg-transparent text-[11px] text-ppw-slate focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setPropertyDraft(property.name);
                setEditingProperty(true);
              }}
              className="block truncate text-[11px] text-ppw-slate hover:text-ppw-teal"
              title="Rename property"
            >
              {property.name} - {drawnRoomCount} room{drawnRoomCount === 1 ? '' : 's'}
            </button>
          )}
        </div>

        {/* Rooms trigger. Was mobile-only; since 2026-08-25 (Vic complaint
            2) it is the ONLY way into the rooms list at every width — the
            permanent 224 px desktop rail was deleted and its dropdown hangs
            off this button. Capped width on desktop so it stays a control,
            not a rail. */}
        <button
          type="button"
          data-testid="rooms-trigger"
          onClick={() => setRoomsMenuOpen && setRoomsMenuOpen(!roomsMenuOpen)}
          className="flex min-h-[40px] min-w-[92px] flex-1 items-center gap-1 truncate rounded-md border border-ppw-stone bg-white px-2 text-left text-xs font-medium text-ppw-ink hover:border-ppw-teal md:max-w-[190px] md:flex-none md:px-2.5"
          aria-label="Open rooms list"
          aria-expanded={roomsMenuOpen}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-ppw-slate" aria-hidden="true">
            <path
              fill="currentColor"
              d="M2 3h12v3H2zM2 7h12v3H2zM2 11h12v2H2z"
            />
          </svg>
          <span className="truncate">
            <span className="font-semibold">{activeRoom?.name ?? property.name}</span>
            <span className="ml-1 text-ppw-slate">· {drawnRoomCount}</span>
          </span>
        </button>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 text-xs md:gap-2">
        <div className="hidden md:flex items-center gap-1.5 rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1">
          {activeRoomIsRect ? (
            <>
              <label className="text-[11px] uppercase tracking-wide text-ppw-slate">L</label>
              <input
                type="number"
                min={Math.max(0.1, snapStepM)}
                max={50}
                step={snapStepM}
                value={room.lengthM}
                onChange={(e) =>
                  setRoom({ lengthM: Number(e.target.value) || room.lengthM, widthM: room.widthM })
                }
                className="w-14 bg-transparent text-right text-sm font-medium text-ppw-ink focus:outline-none"
              />
              <span className="text-[11px] text-ppw-slate">m</span>
              <span className="px-1 text-ppw-stone">.</span>
              <label className="text-[11px] uppercase tracking-wide text-ppw-slate">W</label>
              <input
                type="number"
                min={Math.max(0.1, snapStepM)}
                max={50}
                step={snapStepM}
                value={room.widthM}
                onChange={(e) =>
                  setRoom({ lengthM: room.lengthM, widthM: Number(e.target.value) || room.widthM })
                }
                className="w-14 bg-transparent text-right text-sm font-medium text-ppw-ink focus:outline-none"
              />
              <span className="text-[11px] text-ppw-slate">m</span>
            </>
          ) : room.lengthM < 0.5 ? (
            // Blank-canvas-on-open (2026-06-09) — no room drawn yet.
            <span className="text-[11px] italic text-ppw-slate">Draw a room →</span>
          ) : (
            <span className="text-[11px] italic text-ppw-slate">(polygon)</span>
          )}
        </div>

        {/* 3c (2026-07-26): the old Rect|Draw|Wall triple read as three
            identical mystery tools. Regrouped with intent labels:
            ROOM SHAPE (rectangle via the L×W inputs vs custom polygon
            sketch) — then a separate WALLS tool for interior walls. Same
            handlers, clearer names. Visible on mobile + desktop. */}
        <div className="flex items-stretch overflow-hidden rounded-md border border-ppw-stone bg-white">
          <span className="hidden lg:flex items-center px-2 text-[9px] font-bold uppercase tracking-wider text-ppw-slate/70 border-r border-ppw-stone bg-[#efede8]">
            Room
          </span>
          <button
            type="button"
            onClick={() => setDrawMode(false)}
            className={`min-h-[40px] px-3 text-xs font-medium ${!drawMode ? 'bg-ppw-teal text-white' : 'text-ppw-slate hover:text-ppw-teal'}`}
            title="Rectangle room — set its size with the L × W boxes"
            aria-pressed={!drawMode}
          >
            Rectangle
          </button>
          <button
            type="button"
            onClick={() => setDrawMode(true)}
            data-testid="room-draw-toggle"
            className={`min-h-[40px] px-3 text-xs font-medium ${drawMode ? 'bg-ppw-teal text-white' : 'text-ppw-slate hover:text-ppw-teal'}`}
            title="Draw a room — attaches to existing rooms, walls snap together"
            aria-pressed={drawMode}
          >
            <span className="md:hidden">Custom</span>
            <span className="hidden md:inline">Custom shape</span>
          </button>
        </div>
        {/* Interior walls — its own control, not a third "room shape". */}
        <button
          type="button"
          onClick={handleToggleWall}
          data-testid="wall-tool-toggle"
          className={`hidden md:inline-block min-h-[40px] rounded-md border px-3 text-xs font-medium ${
            wallActive
              ? 'border-ppw-teal bg-ppw-teal text-white'
              : 'border-ppw-stone bg-white text-ppw-slate hover:text-ppw-teal'
          }`}
          title="Add interior walls inside the room — click to start a wall, click to drop each corner, Done to finish"
          aria-pressed={wallActive}
        >
          + Walls
        </button>

        {/* Openings — doors, doorways and windows. Cut into a wall rather than
            placed in space, so this is a wall tool, not a catalog product. */}
        {/* Measure (units brief D10) - click a wall, retype its length. */}
        <button
          type="button"
          onClick={handleToggleMeasure}
          data-testid="measure-tool-toggle"
          className={`hidden md:inline-block min-h-[40px] rounded-md border px-3 text-xs font-medium ${
            measureActive
              ? 'border-ppw-teal bg-ppw-teal text-white'
              : 'border-ppw-stone bg-white text-ppw-slate hover:text-ppw-teal'
          }`}
          title="Measure (M) — click any wall to retype its exact length"
          aria-pressed={measureActive}
        >
          Measure
        </button>

        <button
          type="button"
          onClick={handleToggleDoor}
          data-testid="door-tool-toggle"
          className={`hidden md:inline-block min-h-[40px] rounded-md border px-3 text-xs font-medium ${
            doorActive
              ? 'border-ppw-teal bg-ppw-teal text-white'
              : 'border-ppw-stone bg-white text-ppw-slate hover:text-ppw-teal'
          }`}
          title="Add a door, doorway or window — hover a wall to place it, click an existing one to remove it. F flips which way it opens, H swaps the hinge."
          aria-pressed={doorActive}
        >
          + Door
        </button>

        {/* Door options — only while the door tool is live, so the top bar
            stays quiet the rest of the time. */}
        {doorActive && (
          <div
            className="hidden md:flex items-center gap-1 rounded-md border border-ppw-stone bg-white px-2 py-1"
            data-testid="door-options"
          >
            {(['door', 'doorway', 'window'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDoorDraft({ kind: k })}
                data-testid={`door-kind-${k}`}
                className={`rounded px-2 py-1 text-[11px] font-medium capitalize ${
                  doorDraft.kind === k ? 'bg-ppw-teal text-white' : 'text-ppw-slate hover:text-ppw-teal'
                }`}
                aria-pressed={doorDraft.kind === k}
              >
                {k}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-ppw-stone" aria-hidden />
            <button
              type="button"
              onClick={toggleDoorFacing}
              data-testid="door-flip-facing"
              className="rounded px-2 py-1 text-[11px] font-medium text-ppw-slate hover:text-ppw-teal"
              title="Flip which side the door opens toward (F)"
            >
              Flip side
            </button>
            <button
              type="button"
              onClick={toggleDoorHand}
              data-testid="door-flip-hand"
              className="rounded px-2 py-1 text-[11px] font-medium text-ppw-slate hover:text-ppw-teal"
              title="Swap the hinge to the other end (H)"
            >
              Flip hinge
            </button>
          </div>
        )}

        {/* Floor finish — the material the customer buys for this room. */}
        <div className="relative hidden md:inline-block">
          <button
            type="button"
            onClick={() => setFloorOpen((v) => !v)}
            data-testid="floor-tool-toggle"
            className={`min-h-[40px] rounded-md border px-3 text-xs font-medium ${
              currentFloorId
                ? 'border-ppw-teal bg-ppw-teal text-white'
                : 'border-ppw-stone bg-white text-ppw-slate hover:text-ppw-teal'
            }`}
            title="Choose the floor material for this room"
            aria-expanded={floorOpen}
          >
            Floor
          </button>
          {floorOpen && (
            <div
              className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border border-ppw-stone bg-white p-2 shadow-lg"
              data-testid="floor-picker"
            >
              <button
                type="button"
                onClick={() => {
                  if (activeRoom) setRoomFloor(activeRoom.id, null);
                  setFloorOpen(false);
                }}
                data-testid="floor-none"
                className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] ${
                  currentFloorId ? 'text-ppw-slate hover:bg-ppw-mist' : 'bg-ppw-mist font-semibold'
                }`}
              >
                <span className="h-4 w-4 rounded-sm border border-ppw-stone bg-white" />
                No floor finish
              </button>
              {FLOOR_MATERIALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (activeRoom) setRoomFloor(activeRoom.id, m.id);
                    setFloorOpen(false);
                  }}
                  data-testid={`floor-material-${m.id}`}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] ${
                    currentFloorId === m.id
                      ? 'bg-ppw-mist font-semibold'
                      : 'text-ppw-slate hover:bg-ppw-mist'
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-sm border border-ppw-stone"
                    style={{ background: m.hex }}
                  />
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tweak 07 (Phase A.0) — UNDO / REDO buttons. Visible on both
            mobile and desktop. The undo button arms-then-fires on
            coarse-pointer devices per §7 (long-press confirm). */}
        <div className="flex overflow-hidden rounded-md border border-ppw-stone bg-white">
          <button
            type="button"
            onClick={handleUndoClick}
            disabled={!drawInFlight && wallActive === false && pastLength === 0}
            aria-label={mobileUndoArmed ? 'Tap to confirm undo' : 'Undo (Ctrl+Z)'}
            title={mobileUndoArmed ? 'Tap again to confirm' : 'Undo (Ctrl+Z)'}
            className={`min-h-[40px] px-2.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
              mobileUndoArmed ? 'bg-ppw-coral text-white' : 'text-ppw-slate hover:text-ppw-teal'
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7h7a3 3 0 010 6H7M3 7l3-3M3 7l3 3"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => performRedo()}
            disabled={futureLength === 0}
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (Ctrl+Shift+Z)"
            className="min-h-[40px] border-l border-ppw-stone px-2.5 text-xs font-medium text-ppw-slate hover:text-ppw-teal disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7H6a3 3 0 000 6h3M13 7l-3-3M13 7l-3 3"
              />
            </svg>
          </button>
        </div>

        {/* Snap unit (units brief 2026-08-28, D7). Digits 1-6 pick the same
            units from the keyboard; Ctrl+F swaps back to the last one. */}
        <div className="relative hidden md:inline-block">
          <button
            type="button"
            onClick={() => setUnitOpen((v) => !v)}
            data-testid="snap-unit-toggle"
            className="min-h-[40px] rounded-md border border-ppw-stone bg-white px-3 text-xs font-medium text-ppw-slate hover:text-ppw-teal"
            title="Choose the snap unit for drawing rooms and walls"
            aria-expanded={unitOpen}
          >
            Snap {SNAP_UNIT_LABEL[precision]}
          </button>
          {unitOpen && (
            <div
              className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border border-ppw-stone bg-white p-2 shadow-lg"
              data-testid="snap-unit-picker"
            >
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
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] ${
                    precision === u ? 'bg-ppw-mist font-semibold' : 'text-ppw-slate hover:bg-ppw-mist'
                  }`}
                >
                  <span>{SNAP_UNIT_LABEL[u]}</span>
                  <span className="text-[10px] opacity-60">{i + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleGrid}
          className={`hidden md:inline-block rounded-md border px-2.5 py-1 text-xs font-medium transition ${showGrid ? 'border-ppw-teal bg-ppw-teal text-white' : 'border-ppw-stone bg-white text-ppw-slate hover:border-ppw-teal'}`}
          title="Toggle grid overlay"
        >
          Grid {SNAP_UNIT_LABEL[precision]}
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
            className={`hidden md:inline-block rounded-md border px-2.5 py-1 text-xs font-medium transition ${threeDPreview ? 'border-ppw-teal bg-ppw-teal text-white' : 'border-ppw-stone bg-white text-ppw-slate hover:border-ppw-teal'}`}
          >
            {threeDPreview ? '2D' : '3D preview'}
          </button>
        )}

        <div className="hidden sm:block">
          <CurrencySwitcher compact />
        </div>

        {/* Shop entry — surfaces the Amazon-style storefront (/products) so
            customers can browse + buy without designing a room (WD rework). */}
        <Link
          to="/products"
          className="hidden md:flex items-center gap-1.5 rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs text-ppw-slate hover:border-ppw-teal"
          title="Browse the full product shop"
        >
          Shop
        </Link>

        <Link
          to="/cart"
          className="hidden md:flex items-center gap-1.5 rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs hover:border-ppw-teal"
          title={`Cart: ${cart.uniqueProductCount} unique products`}
        >
          <span className="text-ppw-slate">Cart</span>
          <span className="rounded-full bg-ppw-teal px-1.5 py-[1px] text-[10px] font-bold text-white">
            {cart.uniqueProductCount}
          </span>
        </Link>

        <button
          type="button"
          onClick={handleNew}
          className="hidden md:inline-block rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          title="New property"
        >
          New
        </button>

        {/* Clear moved to the canvas as two always-visible sticky buttons
            (ClearControls — 2026-06-09): "Clear products" / "Clear all". */}

        <button
          type="button"
          onClick={handleSaveAs}
          className="hidden md:inline-block rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          title="Save the current property under a name (syncs to cloud once you've entered an email)"
        >
          Save as...
        </button>

        <button
          type="button"
          onClick={() => setShowLoad((v) => !v)}
          className="hidden md:inline-block rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          title="Load a saved property"
        >
          Load ({savedList.length})
        </button>

        {/* M1.C.7 — Request Quote. Primary lead CTA on the Designer. */}
        <button
          type="button"
          onClick={handleRequestQuote}
          disabled={submittingQuote}
          className="hidden md:inline-block rounded-full border border-[#79c7ad] bg-[#a9e2cf] px-3 py-1 text-xs font-semibold text-[#1e3a30] shadow-sm hover:brightness-105 disabled:opacity-60"
          title="Send the current property + cart to the PPW team for a quote"
        >
          {submittingQuote ? 'Sending…' : 'Request quote'}
        </button>

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-ppw-stone bg-white text-sm font-bold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
          title="Help"
          aria-label="Help"
        >
          ?
        </button>

        {/* Mobile hamburger — overflow menu for buttons that don't fit on a ~390px viewport. */}
        <button
          type="button"
          onClick={() => setShowMobileMenu((v) => !v)}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-md border border-ppw-stone bg-white text-ppw-slate hover:border-ppw-teal"
          aria-label="Open menu"
          aria-expanded={showMobileMenu}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path fill="currentColor" d="M2 4h12v1.5H2zM2 7.25h12v1.5H2zM2 10.5h12v1.5H2z" />
          </svg>
        </button>
      </div>

      {/* Mobile overflow menu (drawer below the TopBar). */}
      {showMobileMenu && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/30"
            onClick={() => setShowMobileMenu(false)}
            aria-hidden="true"
          />
          <div className="md:hidden absolute right-2 top-full z-40 mt-1 w-64 rounded-lg border border-ppw-stone bg-white p-2 shadow-2xl">
            <div className="flex flex-col gap-1.5">
              {/* 3b (2026-07-26): mobile route back to the storefront — the
                  desktop Shop pill was md:-only, stranding phone users. */}
              <Link
                to="/products"
                onClick={() => setShowMobileMenu(false)}
                className="flex min-h-[44px] items-center rounded-md border border-ppw-stone bg-white px-3 text-sm font-medium text-ppw-ink hover:border-ppw-teal"
              >
                ← Back to Shop
              </Link>
              <Link
                to="/cart"
                onClick={() => setShowMobileMenu(false)}
                className="flex min-h-[44px] items-center justify-between rounded-md border border-ppw-stone bg-white px-3 text-sm font-medium text-ppw-ink hover:border-ppw-teal"
              >
                <span>Cart</span>
                <span className="rounded-full bg-ppw-teal px-2 py-[1px] text-[10px] font-bold text-white">
                  {cart.uniqueProductCount}
                </span>
              </Link>
              {/* Interior walls — moved off the phone TopBar (2026-08-25) so
                  the Rooms trigger fits; identical handler. */}
              <button
                type="button"
                data-testid="wall-tool-toggle-mobile"
                onClick={() => {
                  handleToggleWall();
                  setShowMobileMenu(false);
                }}
                aria-pressed={wallActive}
                className={`flex min-h-[44px] items-center justify-between rounded-md border px-3 text-sm font-medium ${
                  wallActive
                    ? 'border-ppw-teal bg-ppw-teal text-white'
                    : 'border-ppw-stone bg-white text-ppw-ink hover:border-ppw-teal'
                }`}
              >
                <span>Interior walls</span>
                <span className="text-[10px] opacity-80">{wallActive ? 'on' : 'off'}</span>
              </button>

              {/* Units brief D7 - without these six rows a phone user has no
                  way to choose a unit at all (the desktop popover is md-only). */}
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
                  className={`flex min-h-[44px] items-center justify-between rounded-md border px-3 text-sm font-medium hover:border-ppw-teal ${
                    precision === u
                      ? 'border-ppw-teal bg-ppw-teal text-white'
                      : 'border-ppw-stone bg-white text-ppw-ink'
                  }`}
                >
                  <span>Snap {SNAP_UNIT_LABEL[u]}</span>
                  {precision === u && <span className="text-[10px] opacity-80">on</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  toggleGrid();
                  setShowMobileMenu(false);
                }}
                className={`flex min-h-[44px] items-center justify-between rounded-md border px-3 text-sm font-medium hover:border-ppw-teal ${
                  showGrid
                    ? 'border-ppw-teal bg-ppw-teal text-white'
                    : 'border-ppw-stone bg-white text-ppw-ink'
                }`}
              >
                <span>Grid {SNAP_UNIT_LABEL[precision]}</span>
                <span className="text-[10px] opacity-80">{showGrid ? 'on' : 'off'}</span>
              </button>
              {setThreeDPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setThreeDPreview(!threeDPreview);
                    setShowMobileMenu(false);
                  }}
                  aria-pressed={threeDPreview}
                  className={`flex min-h-[44px] items-center justify-between rounded-md border px-3 text-sm font-medium hover:border-ppw-teal ${
                    threeDPreview
                      ? 'border-ppw-teal bg-ppw-teal text-white'
                      : 'border-ppw-stone bg-white text-ppw-ink'
                  }`}
                >
                  <span>3D preview</span>
                  <span className="text-[10px] opacity-80">{threeDPreview ? 'on' : 'off'}</span>
                </button>
              )}
              <div className="flex items-center justify-between rounded-md border border-ppw-stone bg-white px-3 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-ppw-slate">Currency</span>
                <CurrencySwitcher compact />
              </div>
              <button
                type="button"
                onClick={() => {
                  handleNew();
                  setShowMobileMenu(false);
                }}
                className="min-h-[44px] rounded-md border border-ppw-stone bg-white px-3 text-left text-sm font-medium text-ppw-ink hover:border-ppw-teal"
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
                className="min-h-[44px] rounded-md border border-ppw-stone bg-white px-3 text-left text-sm font-medium text-ppw-ink hover:border-ppw-teal"
              >
                Save as...
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowLoad((v) => !v);
                }}
                className="min-h-[44px] rounded-md border border-ppw-stone bg-white px-3 text-left text-sm font-medium text-ppw-ink hover:border-ppw-teal"
              >
                Load ({savedList.length})
              </button>
              <Link
                to="/my-designs"
                onClick={() => setShowMobileMenu(false)}
                className="flex min-h-[44px] items-center rounded-md border border-ppw-stone bg-white px-3 text-sm font-medium text-ppw-ink hover:border-ppw-teal"
              >
                My designs (cloud)
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  void handleRequestQuote();
                }}
                disabled={submittingQuote}
                className="min-h-[44px] rounded-md bg-ppw-coral px-3 text-left text-sm font-semibold text-white shadow-sm hover:bg-ppw-coral/90 disabled:opacity-60"
              >
                {submittingQuote ? 'Sending…' : 'Request quote'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowHelp((v) => !v);
                }}
                className="min-h-[44px] rounded-md border border-ppw-stone bg-white px-3 text-left text-sm font-medium text-ppw-ink hover:border-ppw-teal"
              >
                Help
              </button>
            </div>
          </div>
        </>
      )}

      {showHelp && (
        <div className="absolute right-2 top-full z-40 mt-1 w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-ppw-stone bg-white p-4 text-xs leading-snug text-ppw-slate shadow-lg">
          <p className="mb-1 font-semibold text-ppw-ink">Quick start</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Set room L x W (top bar), or switch to <em>Draw</em> mode to sketch a polygon.</li>
            <li>Drag a product from the left palette onto the canvas (or tap "Place on floor" on mobile).</li>
            <li>Scroll-wheel zoom or pinch-zoom; drag empty floor to pan.</li>
            <li>Click a placed item to edit on the right.</li>
            <li>Use the room list to switch rooms within this property.</li>
            <li><em>Save as...</em> stores the whole property (all rooms + items).</li>
          </ol>
          <p className="mt-2 text-[10px] text-ppw-slate">
            Keys: R rotate; D duplicate; Del delete; Esc deselect; Ctrl+Z undo;
            Shift+P clear products; Shift+X clear all.
          </p>
        </div>
      )}

      {showLoad && (
        <div className="absolute right-2 top-full z-40 mt-1 w-[min(20rem,calc(100vw-1rem))] max-h-[70vh] overflow-y-auto rounded-lg border border-ppw-stone bg-white p-3 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-ppw-ink">Saved properties</p>
            <Link
              to="/my-designs"
              onClick={() => setShowLoad(false)}
              className="text-[11px] font-medium text-ppw-teal hover:underline"
            >
              My designs (cloud)
            </Link>
          </div>
          {savedList.length === 0 ? (
            <p className="text-ppw-slate py-2">No saved properties yet. Use <em>Save as...</em></p>
          ) : (
            <ul className="space-y-1.5">
              {savedList.map((d) => {
                const itemCount = (d.property?.rooms ?? []).reduce(
                  (acc, r) => acc + (r.placedItems?.length ?? 0),
                  0,
                );
                const roomCount = d.property?.rooms?.length ?? 0;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-ppw-stone bg-white p-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(d.id)}
                      className="flex-1 text-left"
                    >
                      <p className={`text-sm font-medium ${currentId === d.id ? 'text-ppw-teal' : 'text-ppw-ink'}`}>
                        {d.name}{currentId === d.id ? ' (current)' : ''}
                      </p>
                      <p className="text-[10px] text-ppw-slate">
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
                      className="rounded-md border border-ppw-stone bg-white px-1.5 py-0.5 text-[10px] text-ppw-slate hover:border-ppw-coral hover:text-ppw-coral"
                      title="Delete saved property"
                    >
                      x
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {confirmingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-lg bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-ppw-ink">Start a new property?</p>
            <p className="mt-1 text-xs text-ppw-slate">
              Current property has {property.rooms.length} room{property.rooms.length === 1 ? '' : 's'} and {cart.totalItemCount} placed item{cart.totalItemCount === 1 ? '' : 's'}. The auto-draft is kept, but un-named work will be lost. Save as... first if you want to keep it.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmNew}
                className="flex-1 rounded-md bg-ppw-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-ppw-coral/90"
              >
                Yes, start new
              </button>
              <button
                type="button"
                onClick={() => setConfirmingNew(false)}
                className="flex-1 rounded-md border border-ppw-stone bg-white px-3 py-1.5 text-sm font-semibold text-ppw-slate hover:border-ppw-ink"
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
