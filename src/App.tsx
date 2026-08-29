/**
 * App shell — Sims build-mode layout (Vic 2026-08-25, complaint 2).
 *
 * Desktop AND mobile now share one shape:
 *
 *   [ TopBar (rooms dropdown lives here) ]
 *   [ ============ CANVAS ============= ]   <- full width, ~88% height
 *   [ Sims catalog dock                 ]
 *
 * The old desktop row — [RoomList 224px][Palette 288px][Canvas][Details
 * 320px] + a 209px CartStrip — left the drawing surface at 56.7% of the
 * viewport width and 75.5% of its height once the cart appeared. All four
 * chrome blocks are gone from the flow:
 *
 *   RoomList     -> compact dropdown hung off the TopBar trigger
 *   Palette      -> SimsDock, a one-row build toolbar at the bottom
 *   DetailsPanel -> right-side overlay, only while an item is selected
 *   CartStrip    -> floating pill above the dock, expands on click
 *
 * Everything is the SAME component with the SAME store calls; only where
 * it is mounted changed.
 *
 * Draw mode is a top-level UI state that the TopBar toggles; the
 * canvas reads it and routes through RoomDrawMode.
 *
 * Hotfix 5 (Week 4b): wrap the canvas region in a CanvasErrorBoundary
 * so a render-time crash inside the Konva tree does not unmount the
 * whole app. The boundary's Reset callback also clears draw mode so
 * Vic can recover with one click.
 *
 * fix/mobile-ux-v1 (May 2026): lifted roomsMenuOpen / catalogOpen /
 * pendingProductId here so TopBar can host the Rooms trigger inline
 * (kills the absolute-positioned overlap with the currency picker) and
 * Catalog can be opened from the TopBar overflow menu. The pending
 * product id powers the tap-to-place fallback (HTML5 DnD doesn't work
 * from a bottom-sheet to the canvas on touch devices).
 */

import { useState, useEffect, useCallback } from 'react';
import { PageTabs } from './components/PageTabs';
import { TopBar } from './components/TopBar';
import { CoachMark } from './components/uxKit';
import { RoomCanvas } from './components/RoomCanvas';
import { DetailsPanel } from './components/DetailsPanel';
import { ToastProvider } from './components/ToastProvider';
import { RoomList } from './components/RoomList';
import { CartStrip } from './components/CartStrip';
import { CartDrawer } from './components/cart/CartDrawer';
import { AddRoomChooser } from './components/AddRoomChooser';
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
// Mobile Sims rebuild (2026-05-23) — persistent sticky catalog toolbar
// for viewports < 1024 px. Replaces the old mobile bottom-sheet + the
// "Catalog" button. Desktop (>= 1024 px) uses SimsDock (below).
import { SimsBottomToolbar } from './components/mobile/SimsBottomToolbar';
// Desktop Sims rebuild (2026-08-25) — the >= 1024 px counterpart of
// SimsBottomToolbar. Replaces the ProductPalette sidebar; arms the SAME
// `pendingProductId` the palette did, so the placement FSM is unchanged.
import { SimsDock } from './components/desktop/SimsDock';
import { useKeyboardShortcuts } from './lib/useKeyboardShortcuts';
import { useAutoSave } from './lib/useAutoSave';
import {
  abortDrawTransaction,
  beginDrawTransaction,
  endDrawTransaction,
  installHistorySubscriptions,
  isDrawTransactionActive,
} from './store/historyStore';
import { keepOpenRunAsWalls } from './lib/wallPen';
import { usePropertyStore } from './store/propertyStore';
import { useDesignsStore, DRAFT_ID } from './store/designsStore';
import { useWallStore } from './store/wallStore';
import { useFloorZoneStore } from './store/floorZoneStore';
// (wallTreatmentStore's import went with the draw-mode entry-clear — draw
// mode no longer destroys anything, so there is nothing here to clear.)
import { useDrawProgressStore } from './store/drawProgressStore';
import { useToastStore } from './store/toastStore';
import { unstackLegacyRooms } from './designer/roomLayout';
// Sims-Parity Gaming Layer 1 (V4 default-ON 2026-05-18) — additive overlays
// mounted on top of the existing Konva render-core. Konva stable-lock 26c144c
// untouched; classic UI surfaces via `?ui=classic`.
import { GamingLayer1Surfaces } from './designer/GamingLayer1Surfaces';
import { RoomEstimatePanel } from './components/RoomEstimatePanel';
import { ClearControls } from './components/ClearControls';
import { isPaintEstimateActive } from './designer/paintEstimateFlag';
// Babylon 3D viewer removed 2026-06-04 (P1-1): the lazy 3D path (6.46 MB raw /
// 1.43 MB gzip) was never flipped past its soak (DEFAULT_ENGINE='konva'),
// carried untested-in-prod surface, and is the single biggest simplification.
// Konva 2D is now the only canvas engine. Capture-side WebXR is a SEPARATE
// feature and is untouched.

// M8 (Customer-UI fix 2026-05-31) — the desktop-first "Best experienced on a
// laptop" MobilePreviewBanner interstitial was removed now that mobile parity
// is being delivered. It told customers the product was second-class on the
// device most of them use. (Previous implementation in git history.)

export default function App() {
  useKeyboardShortcuts();
  useAutoSave();
  // Tweak 07 / Phase A.0 — install undo subscriptions once. The hook
  // returns its own teardown, but App is mounted once at the root so we
  // don't bother re-running the effect (idempotent inside the store).
  useEffect(() => {
    return installHistorySubscriptions();
  }, []);
  // D8 (attached multi-room 2026-08-26) — one-shot legacy un-stack.
  // Pre-2026-08-26 every rectangle room was pinned at the origin by
  // `rectToPolygon`, so a legacy multi-room save has all its rooms STACKED.
  // Single-room rendering hid it; the attached canvas would draw them on
  // top of each other. This can NOT live in `normaliseLoadedProperty` —
  // that does not run on a normal reload (persist `migrate()` early-returns
  // for version >= 2), so it hangs off app mount.
  //
  // Walls / zones are keyed in the SAME world frame but are NOT per-room,
  // so moving rooms out from under them would strand them. When any exist,
  // the overlap is left in place and only warned about.
  // Sims world (2026-08-29): the old interior-wall tool kept its walls in a
  // separate mm store that never reached the server. Fold any it left behind
  // into the property ONCE, then empty the legacy store so nothing renders
  // twice. Runs before the un-stack check below, which used to skip whenever
  // legacy walls existed.
  useEffect(() => {
    const legacy = useWallStore.getState().walls;
    if (legacy.length === 0) return;
    if (usePropertyStore.getState().importLegacyWalls(legacy)) {
      useWallStore.getState().replace([]);
      console.log('[walls]', `migrated ${legacy.length} legacy wall(s) onto the property`);
    }
  }, []);
  useEffect(() => {
    const property = usePropertyStore.getState().property;
    // Reference-identity check: the pure helper returns its input unchanged
    // when nothing overlaps, so this is a cheap "is there anything to do?".
    if (unstackLegacyRooms(property) === property) return;
    // Free walls now live ON the property (Sims world 2026-08-29), so a plan
    // with walls keeps its geometry together and must not be re-laid.
    const hasWorldGeometry =
      useWallStore.getState().walls.length > 0
      || (usePropertyStore.getState().property.walls?.length ?? 0) > 0
      || useFloorZoneStore.getState().zones.length > 0;
    if (hasWorldGeometry) {
      console.warn('[multi-room] legacy overlap left in place (walls/zones present)');
      return;
    }
    if (usePropertyStore.getState().unstackIfLegacy()) {
      useToastStore
        .getState()
        .push('Your rooms were un-stacked into an attached layout', 'info');
    }
  }, []);
  const [drawMode, setDrawModeRaw] = useState(false);
  // Attached multi-room (Vic 2026-08-26) — draw mode NO LONGER destroys the
  // canvas on entry. The old wrapper mass-cleared items / walls / zones /
  // treatments so the user drew onto an empty stage; the whole point now is
  // that a new room is drawn ATTACHED to the rooms already there, which you
  // cannot do if they have just been wiped.
  //
  // The one clear that stays is the SELECTION, which the entry-wipe used to
  // do as a side effect. Selection is not part of the history snapshot, so a
  // selection surviving into draw mode would (a) leave DetailsPanel /
  // FloatingCluster mounted over the canvas eating vertex clicks and (b) let
  // the item shortcut keys mutate the property inside the suppressed
  // transaction — permanently, and un-undoably, under the new abort
  // semantics.
  //
  // On exit we ABORT rather than end: a draw that changed nothing must leave
  // history exactly as it found it. A committed draw has already called
  // `endDrawTransaction`, so the abort here no-ops — one convention covers
  // commit, Esc-cancel, and the TopBar "Rectangle" mid-draw exit (which used
  // to strand a phantom undo frame).
  const setDrawMode = useCallback((next: boolean) => {
    if (next) {
      beginDrawTransaction('draw new room');
      usePropertyStore.getState().selectItem(null);
      const dp = useDrawProgressStore.getState();
      dp.setEnabled(true);
      dp.setVertices([]);
    } else {
      const dp = useDrawProgressStore.getState();
      // Sims world (Vic 2026-08-29): leaving the pen KEEPS the walls that
      // were drawn. Any exit path that reaches here with points still in
      // flight — Rectangle, another tool, the + Walls toggle — turns the run
      // into free walls and ends the transaction as ONE undo frame. A commit
      // (room or walls) has already ended the transaction and emptied the
      // run, so this cannot double-commit; an explicit Discard empties the
      // run first, so this keeps nothing.
      if (isDrawTransactionActive() && dp.vertices.length >= 2) {
        keepOpenRunAsWalls(dp.vertices);
        dp.setEnabled(false);
        dp.setVertices([]);
        endDrawTransaction();
      } else {
        dp.setEnabled(false);
        dp.setVertices([]);
        abortDrawTransaction();
      }
    }
    setDrawModeRaw(next);
  }, []);
  /**
   * "Keep drawing" (units brief D12). Deliberately its OWN effect rather
   * than a branch inside setDrawMode or handleDrawCommit: two source-pin
   * tests extract those by regex and require setDrawMode's deps to stay
   * literally `[]` and the commit body's to begin with `[addRoom`. Adding a
   * store dep to either produces a confusing null-match failure rather
   * than an honest behaviour one.
   */
  const continueAfterCommit = useDrawProgressStore((s) => s.continueAfterCommit);
  useEffect(() => {
    if (!continueAfterCommit || drawMode) return;
    useDrawProgressStore.getState().setContinueAfterCommit(false);
    setDrawMode(true);
  }, [continueAfterCommit, drawMode, setDrawMode]);

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [roomsMenuOpen, setRoomsMenuOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  // Tweak 06 (Phase A) — the OMS Wave 2.4 top-of-screen CSS-perspective
  // 3D preview was removed per Vic's 2026-05-21 designer test (Note 6:
  // "3D Preview at the top is pointless. 2D can work but better to show
  // images of the products."). The TopBar prop is left undefined so its
  // toggle is hidden; the canvas wrapper below no longer applies the
  // perspective transform. The Sims-style hover DetailCard (P0-ζ, now on
  // SimsDock) replaces the "show what you're placing" need.

  // P3-2 — paint/flooring estimate beta panel; OFF unless ?paint=1.
  const paintEstimateActive = isPaintEstimateActive();

  // Toolbar pass (2026-08-29): PageTabs honours its own "hidden until there
  // is something to switch between" contract. The strip used to appear the
  // moment a room was drawn — with ONE plan, a tab bar is pure chrome (and a
  // second header line on a 390 px phone). Plans = the named pages plus the
  // unsaved draft when that is what is on the canvas.
  const namedPageCount = useDesignsStore(
    (st) => Object.keys(st.designs).filter((id) => id !== DRAFT_ID).length,
  );
  const onDraftPage = useDesignsStore((st) => (st.currentId ?? DRAFT_ID) === DRAFT_ID);
  const planCount = namedPageCount + (onDraftPage ? 1 : 0);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#efede8] text-ppw-ink">
      <TopBar
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        roomsMenuOpen={roomsMenuOpen}
        setRoomsMenuOpen={setRoomsMenuOpen}
      />
      {/* Separate PLANS (Vic 2026-08-28). Rooms are areas on one canvas; a
          page is a different space or client. Hidden until there is something
          to switch between — i.e. at least two plans. */}
      {planCount >= 2 && <PageTabs />}
      {/* RoomList now renders ONLY its dropdown overlay — the permanent
          224 px rail is gone. The TopBar hosts its trigger at every
          viewport width. Same store calls (setActiveRoom / renameRoom /
          removeRoom / renameProperty), same rows, no rail. */}
      <RoomList
        onRequestAddRoom={() => setAddRoomOpen(true)}
        mobileOpen={roomsMenuOpen}
        setMobileOpen={setRoomsMenuOpen}
      />
      {/* Toolbar pass (2026-08-29): below lg the Sims catalog toolbar is
          `fixed` over the bottom of the viewport, so the canvas section pads
          by its live height (`--sims-toolbar-h`, published by the toolbar,
          0 px when it is not mounted). The section — and therefore the
          Konva stage the ResizeObserver measures — is then exactly the
          VISIBLE area; nothing sits under the toolbar any more. */}
      <main className="flex flex-1 overflow-hidden pb-[var(--sims-toolbar-h,0px)] lg:pb-0">
        <section className="relative flex-1 overflow-hidden">
          {/* 2026-08-25: MiniCartPill un-mounted. It sat at `right-3 top-3`
              and OVERLAPPED RoomCanvas's own top-right Reset/Share/Capture
              row (visible in docs/ui-modernize-2026-08-25/before/), and now
              that CartStrip is itself a pill it was a second cart readout on
              the same screen. The cart lives at bottom-right. The component
              and its unit test are untouched on disk. */}
          <CanvasErrorBoundary onReset={() => setDrawMode(false)}>
            <div style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '100%', height: '100%' }}>
                <RoomCanvas
                  drawMode={drawMode}
                  onDrawComplete={() => setDrawMode(false)}
                  pendingProductId={pendingProductId}
                  setPendingProductId={setPendingProductId}
                  onRequestDraw={() => setDrawMode(true)}
                />
              </div>
            </div>
          </CanvasErrorBoundary>
          {/* P3-2 — room estimate: paint + flooring (beta, OFF by default; ?paint=1). */}
          {paintEstimateActive && <RoomEstimatePanel />}
          {/* Blank-canvas + clear (2026-06-09) — two sticky, always-visible
              clear buttons pinned to the canvas (Clear products / Clear all).
              Toolbar pass (2026-08-29): hidden while the wall pen is open so
              the HUD owns the bottom band (Discard is the pen's own clear). */}
          {!drawMode && <ClearControls />}
        </section>
        {/* Overlay, not a rail — slides in from the right only while an
            item is selected (see DetailsPanel). */}
        <DetailsPanel armedProductId={pendingProductId} />
      </main>
      {/* Desktop Sims catalog dock (>= 1024 px). Mounted BEFORE
          SimsBottomToolbar so a `[data-product-id=...]` .first() in the e2e
          suite resolves to the VISIBLE desktop tile, not the hidden mobile
          thumbnail. */}
      <SimsDock
        pendingProductId={pendingProductId}
        setPendingProductId={setPendingProductId}
      />
      {/* Toolbar pass (2026-08-29): the cart pill leaves the bottom band
          while the wall pen is open — the HUD owns it. Conditional at the
          render site; CartStrip itself is untouched. */}
      {!drawMode && <CartStrip />}
      <CartDrawer />
      {/* Mobile/tablet Sims catalog — sticky bottom toolbar (< 1024 px). */}
      <SimsBottomToolbar />
      <AddRoomChooser
        open={addRoomOpen}
        onClose={() => setAddRoomOpen(false)}
        onRequestDrawMode={() => setDrawMode(true)}
      />
      <ToastProvider />
      {/* Sims-Parity Gaming Layer 1 (V4 default-ON) — additive DT-11..DT-18
          polish surfaces (StatusCard / ModeStrip / Help). Renders null when
          ?ui=classic is set. */}
      <GamingLayer1Surfaces />
      {/* OMS Wave 3.5 — 3-step coach mark, localStorage dismissal. */}
      <CoachMark
        flagKey="ppw_designer_coach_v1"
        steps={[
          { title: 'Draw your walls', body: 'Tap Walls (or Box | Custom for a shape), then tap to drop wall points. Close the shape for a room, or Done to leave the walls open. Change the unit mid-draw with − / +. Add a Door, Paint the floor, or Measure a wall from the same bar.' },
          { title: 'Furnish inside and out', body: 'Drag products from the dock onto any floor — inside a room or out in the garden. Items sit flush to walls and tuck into corners. Finish picks the room\'s floor finish.' },
          { title: 'Storeys, plot, quote', body: 'Add levels with Storeys, lock the plot with Plot, then Request quote to send the layout to the PPW team. New, Save as… and Load live under More.' },
        ]}
      />
      {/* V-RENDER-3 (2026-05-27) — unobtrusive build-stamp pinned
          bottom-left so Vic can confirm a fresh bundle landed on his
          iPhone after the index.html no-cache header change. Short commit
          SHA on Vercel; dev-timestamp locally (see vite.config define).
          Polish (2026-08-29): DEV-only (`import.meta.env.DEV` is a build-
          time literal, so the span is dead code in a production bundle),
          hidden below md (it sat under the Clear pills on the phone), and
          z 20 — below the cart pill (30), the launcher (35) and every
          sheet / popover (40+), so it never paints over an open sheet. */}
      {import.meta.env.DEV && (
        <span
          data-testid="build-stamp"
          title="Build identifier"
          className="hidden md:block"
          style={{
            position: 'fixed',
            // Clears the Sims dock (desktop) / toolbar (mobile); both publish
            // their live height and resolve to 0 px when not mounted.
            bottom:
              'calc(max(6px, env(safe-area-inset-bottom)) + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px))',
            left: 'max(6px, env(safe-area-inset-left))',
            // 11 px: the contract floor (was 9). Charcoal on the paper ground
            // at low opacity — legible when looked for, invisible otherwise.
            fontSize: 11,
            lineHeight: 1,
            color: '#3D4655',
            opacity: 0.55,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            pointerEvents: 'none',
            zIndex: 20,
            userSelect: 'all',
          }}
        >
          build {__APP_BUILD__}
        </span>
      )}
      {/* 3e (2026-07-26): the dark-mode toggle was removed — it flipped a
          Tailwind `dark` class that almost nothing consumed (2 dark:
          variants app-wide), so it visibly did nothing. A real dark
          designer theme is a separate design decision. */}
    </div>
  );
}
