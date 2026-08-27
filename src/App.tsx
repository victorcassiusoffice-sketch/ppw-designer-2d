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
  beginDrawTransaction,
  endDrawTransaction,
  installHistorySubscriptions,
} from './store/historyStore';
// Batch 3 Fix 3.1 — DRAW button click destroys the canvas atomically so
// the user gets a fresh slate to draw into; Ctrl+Z restores everything.
import { usePropertyStore } from './store/propertyStore';
import { useWallStore } from './store/wallStore';
import { useFloorZoneStore } from './store/floorZoneStore';
import { useWallTreatmentStore } from './store/wallTreatmentStore';
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
  useEffect(() => {
    const property = usePropertyStore.getState().property;
    // Reference-identity check: the pure helper returns its input unchanged
    // when nothing overlaps, so this is a cheap "is there anything to do?".
    if (unstackLegacyRooms(property) === property) return;
    const hasWorldGeometry =
      useWallStore.getState().walls.length > 0
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
  // Batch 3 Fix 3.1 — wrapped setDrawMode that, on entry, snapshots the
  // canvas into a single undo frame then wipes items / walls / zones /
  // wall treatments so the user draws onto an empty stage. On exit it
  // closes the history transaction. The downstream RoomDrawLayer +
  // RoomList consume `drawMode` exactly as before.
  const setDrawMode = useCallback((next: boolean) => {
    if (next) {
      beginDrawTransaction('draw new room');
      // Mass-clear all stores that contribute visible canvas state.
      usePropertyStore.getState().clearActiveRoomItems();
      useWallStore.getState().clearWalls();
      useFloorZoneStore.getState().clearZones();
      useWallTreatmentStore.getState().clearTreatments();
      const dp = useDrawProgressStore.getState();
      dp.setEnabled(true);
      dp.setVertices([]);
    } else {
      const dp = useDrawProgressStore.getState();
      dp.setEnabled(false);
      dp.setVertices([]);
      endDrawTransaction();
    }
    setDrawModeRaw(next);
  }, []);
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#efede8] text-ppw-ink">
      <TopBar
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        roomsMenuOpen={roomsMenuOpen}
        setRoomsMenuOpen={setRoomsMenuOpen}
      />
      {/* RoomList now renders ONLY its dropdown overlay — the permanent
          224 px rail is gone. The TopBar hosts its trigger at every
          viewport width. Same store calls (setActiveRoom / renameRoom /
          removeRoom / renameProperty), same rows, no rail. */}
      <RoomList
        onRequestAddRoom={() => setAddRoomOpen(true)}
        mobileOpen={roomsMenuOpen}
        setMobileOpen={setRoomsMenuOpen}
      />
      <main className="flex flex-1 overflow-hidden">
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
              clear buttons pinned to the canvas (Clear products / Clear all). */}
          <ClearControls />
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
      <CartStrip />
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
          { title: 'Set your room dims', body: 'Use the toolbar above to set length/width, or click Draw room to sketch a custom polygon.' },
          { title: 'Drag products in', body: 'Open the catalog from the top bar, then drag (or tap then tap) items into your room.' },
          { title: 'Save & request a quote', body: 'Click Save to keep your design. Use Request quote to send the layout to the PPW team.' },
        ]}
      />
      {/* V-RENDER-3 (2026-05-27) — unobtrusive build-stamp pinned
          bottom-left so Vic can confirm a fresh bundle landed on his
          iPhone after the index.html no-cache header change. Short commit
          SHA on Vercel; dev-timestamp locally (see vite.config define). */}
      <span
        data-testid="build-stamp"
        title="Build identifier"
        style={{
          position: 'fixed',
          // Clears the Sims dock (desktop) / toolbar (mobile); both publish
          // their live height and resolve to 0 px when not mounted.
          bottom:
            'calc(max(6px, env(safe-area-inset-bottom)) + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px))',
          left: 'max(6px, env(safe-area-inset-left))',
          fontSize: 9,
          lineHeight: 1,
          // Light on the blueprint ground (was slate #3B4A52, which is
          // near-invisible against CANVAS_GROUND).
          color: '#E9EDEF',
          opacity: 0.45,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          pointerEvents: 'none',
          zIndex: 40,
          userSelect: 'all',
        }}
      >
        build {__APP_BUILD__}
      </span>
      {/* 3e (2026-07-26): the dark-mode toggle was removed — it flipped a
          Tailwind `dark` class that almost nothing consumed (2 dark:
          variants app-wide), so it visibly did nothing. A real dark
          designer theme is a separate design decision. */}
    </div>
  );
}
