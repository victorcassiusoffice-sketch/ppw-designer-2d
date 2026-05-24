/**
 * App shell — Week 2.5 multi-room layout.
 *
 * Desktop: [RoomList] [Palette] [Canvas] [DetailsPanel]
 *          + CartStrip at bottom + Toasts overlay.
 * Mobile:  [Canvas only] with floating RoomList dropdown,
 *          Palette bottom-sheet, DetailsPanel slide-up,
 *          CartStrip chip.
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
import { CoachMark, useDarkMode } from './components/uxKit';
import { ProductPalette } from './components/ProductPalette';
import { RoomCanvas } from './components/RoomCanvas';
import { DetailsPanel } from './components/DetailsPanel';
import { ToastProvider } from './components/ToastProvider';
import { RoomList } from './components/RoomList';
import { CartStrip } from './components/CartStrip';
import { MiniCartPill } from './components/cart/MiniCartPill';
import { CartDrawer } from './components/cart/CartDrawer';
import { AddRoomChooser } from './components/AddRoomChooser';
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
// Mobile Sims rebuild (2026-05-23) — persistent sticky catalog toolbar
// for viewports < 1024 px. Replaces the old mobile bottom-sheet + the
// "Catalog" button. Desktop (≥ 1024 px) keeps the ProductPalette sidebar.
import { SimsBottomToolbar } from './components/mobile/SimsBottomToolbar';
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
// Sims-Parity Gaming Layer 1 (V4 default-ON 2026-05-18) — additive overlays
// mounted on top of the existing Konva render-core. Konva stable-lock 26c144c
// untouched; classic UI surfaces via `?ui=classic`.
import { GamingLayer1Surfaces } from './designer/GamingLayer1Surfaces';
// Sims-Parity DT-21 — Babylon Phase 2 (V7=YES 2026-05-19). Lazy-loaded
// so the marketing-route bundle stays under the 250 KB delta gate.
// Mounted only when `?engine=babylon` is on the URL.
import { lazy, Suspense } from 'react';
import { isBabylonActive } from './designer/babylon/engineFlag';
const BabylonRoomLazy = lazy(() => import('./designer/babylon/BabylonRoom'));

/**
 * OMS Wave 2.5 — desktop-first hero banner.
 *
 * Marketing line per `wrd_build_path.md`:
 * "Best experienced on a laptop. Mobile preview supported; for full
 * design work use desktop."
 *
 * Shows only on touch + narrow viewports. Dismissable via the close
 * button (persists to localStorage so we don't keep nagging).
 */
function MobilePreviewBanner(): JSX.Element | null {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('ppw_mobile_banner_dismissed_v1') === '1';
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const forced = window.localStorage.getItem('ppw_force_desktop_view_v1') === '1';
      if (forced) {
        setIsMobile(false);
        return;
      }
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const narrow = window.matchMedia('(max-width: 768px)').matches;
      setIsMobile(touch && narrow);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (dismissed || !isMobile) return null;
  return (
    <div
      role="status"
      style={{
        background: '#0E0E10',
        color: '#F5EFE6',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottom: '3px solid #C0A67E',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 20, lineHeight: 1.25, color: '#C0A67E' }}>
          Best experienced on a laptop
        </strong>
        <span style={{ fontSize: 15, lineHeight: 1.4, color: '#F5EFE6', opacity: 0.92 }}>
          The Wellness Designer was built desktop-first. Mobile works, but products,
          drag-drop, and the cart drawer feel far better on a bigger screen.
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          aria-label="Switch to desktop view on this device"
          onClick={() => {
            window.localStorage.setItem('ppw_force_desktop_view_v1', '1');
            // Force a viewport reflow to desktop width so the layout renders wide
            const vp = document.querySelector('meta[name="viewport"]');
            if (vp) vp.setAttribute('content', 'width=1280, initial-scale=0.3, user-scalable=yes');
            window.location.reload();
          }}
          style={{
            background: '#C0A67E',
            color: '#0E0E10',
            border: 'none',
            borderRadius: 6,
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            flex: '1 1 auto',
            minWidth: 140,
          }}
        >
          Switch to desktop view
        </button>
        <button
          type="button"
          aria-label="Continue on mobile and dismiss this banner"
          onClick={() => {
            window.localStorage.setItem('ppw_mobile_banner_dismissed_v1', '1');
            setDismissed(true);
          }}
          style={{
            background: 'transparent',
            color: '#F5EFE6',
            border: '1px solid rgba(245,239,230,0.4)',
            borderRadius: 6,
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            flex: '0 1 auto',
          }}
        >
          Continue on mobile
        </button>
      </div>
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  useAutoSave();
  // Tweak 07 / Phase A.0 — install undo subscriptions once. The hook
  // returns its own teardown, but App is mounted once at the root so we
  // don't bother re-running the effect (idempotent inside the store).
  useEffect(() => {
    return installHistorySubscriptions();
  }, []);
  // OMS Wave 3.7 — dark mode opt-in. localStorage flag flips
  // `<html class="dark">` so Tailwind dark: variants apply globally.
  const [darkMode, toggleDark] = useDarkMode();

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
  // perspective transform. ProductPalette's Sims-style hover DetailCard
  // (P0-ζ) replaces the "show what you're placing" need. Babylon 3D is
  // a separate path via ?engine=babylon and stays untouched.
  // DT-21 — Babylon engine flag captured at mount; URL change requires
  // a hard refresh to switch (matches the ?ui=classic semantics).
  const babylonActive = isBabylonActive();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ppw-sand text-ppw-ink">
      {/* OMS Wave 2.5 — desktop-first hero banner. Visible on touch
          devices only; localStorage flag dismissal so it doesn't nag. */}
      <MobilePreviewBanner />
      <TopBar
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        roomsMenuOpen={roomsMenuOpen}
        setRoomsMenuOpen={setRoomsMenuOpen}
      />
      <main className="flex flex-1 overflow-hidden">
        <RoomList
          onRequestAddRoom={() => setAddRoomOpen(true)}
          mobileOpen={roomsMenuOpen}
          setMobileOpen={setRoomsMenuOpen}
        />
        <ProductPalette
          pendingProductId={pendingProductId}
          setPendingProductId={setPendingProductId}
        />
        <section className="relative flex-1 overflow-hidden">
          {/* Polish B (V4 Driver tick 35): MiniCartPill owns the canvas
              top-right slot. The 3D toggle migrated to TopBar overflow
              per V4-AU-1 conflict resolution. */}
          <MiniCartPill />
          <CanvasErrorBoundary onReset={() => setDrawMode(false)}>
            <div style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '100%', height: '100%' }}>
                {babylonActive ? (
                  <Suspense
                    fallback={
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#0E0E10', color: '#F5EFE6', fontSize: 13,
                      }}>
                        Loading Babylon 3D engine…
                      </div>
                    }
                  >
                    <BabylonRoomLazy
                      pendingProductId={pendingProductId}
                      setPendingProductId={setPendingProductId}
                    />
                  </Suspense>
                ) : (
                  <RoomCanvas
                    drawMode={drawMode}
                    onDrawComplete={() => setDrawMode(false)}
                    pendingProductId={pendingProductId}
                    setPendingProductId={setPendingProductId}
                  />
                )}
              </div>
            </div>
          </CanvasErrorBoundary>
        </section>
        <DetailsPanel />
      </main>
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
      {/* OMS Wave 3.7 — small dark mode toggle pinned bottom-left. */}
      <button
        type="button"
        onClick={toggleDark}
        aria-label="Toggle dark mode"
        aria-pressed={darkMode}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed',
          // Clear the mobile Sims toolbar (var 0 on desktop → stays at 12).
          bottom: 'calc(12px + var(--sims-toolbar-h, 0px))',
          right: 12,
          padding: '6px 10px',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: 999,
          fontSize: 11,
          cursor: 'pointer',
          opacity: 0.8,
          zIndex: 50,
        }}
      >
        {darkMode ? '☀️ light' : '🌙 dark'}
      </button>
    </div>
  );
}
