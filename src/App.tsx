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

import { useState, useEffect } from 'react';
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
import { useKeyboardShortcuts } from './lib/useKeyboardShortcuts';
import { useAutoSave } from './lib/useAutoSave';

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
        background: '#1f4a4a',
        color: 'white',
        padding: '6px 12px',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span>
        <strong>Mobile preview mode</strong> — best experienced on a laptop. For full design
        work, use desktop.
      </span>
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={() => {
          window.localStorage.setItem('ppw_mobile_banner_dismissed_v1', '1');
          setDismissed(true);
        }}
        style={{
          background: 'transparent',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  useAutoSave();
  // OMS Wave 3.7 — dark mode opt-in. localStorage flag flips
  // `<html class="dark">` so Tailwind dark: variants apply globally.
  const [darkMode, toggleDark] = useDarkMode();

  const [drawMode, setDrawMode] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [roomsMenuOpen, setRoomsMenuOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  // OMS Wave 2.4 — 3D preview toggle. CSS perspective on the Konva
  // Stage container; hit-tests stay accurate because we keep the
  // transform CSS-only (the Konva Stage thinks it's still flat).
  // Touch devices get the toggle disabled because tilting + pinch-zoom
  // simultaneously is unreliable. Locked: no Babylon migration here.
  const [threeDPreview, setThreeDPreview] = useState(false);

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
        onOpenCatalog={() => setCatalogOpen(true)}
        threeDPreview={threeDPreview}
        setThreeDPreview={setThreeDPreview}
      />
      <main className="flex flex-1 overflow-hidden">
        <RoomList
          onRequestAddRoom={() => setAddRoomOpen(true)}
          mobileOpen={roomsMenuOpen}
          setMobileOpen={setRoomsMenuOpen}
        />
        <ProductPalette
          mobileOpen={catalogOpen}
          setMobileOpen={setCatalogOpen}
          pendingProductId={pendingProductId}
          setPendingProductId={setPendingProductId}
        />
        <section className="relative flex-1 overflow-hidden">
          {/* Polish B (V4 Driver tick 35): MiniCartPill owns the canvas
              top-right slot. The 3D toggle migrated to TopBar overflow
              per V4-AU-1 conflict resolution. */}
          <MiniCartPill />
          <CanvasErrorBoundary onReset={() => setDrawMode(false)}>
            <div
              style={{
                width: '100%',
                height: '100%',
                perspective: threeDPreview ? '1200px' : 'none',
                perspectiveOrigin: '50% 30%',
                transition: 'perspective 200ms ease',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transform: threeDPreview
                    ? 'rotateX(45deg) translateZ(0)'
                    : 'rotateX(0deg)',
                  transformOrigin: '50% 50%',
                  transition: 'transform 250ms ease',
                  // When tilted, hit tests are intentionally degraded
                  // (Konva still thinks the stage is flat). Document
                  // this caveat: 3D is preview-only — toggle off to
                  // edit.
                  pointerEvents: threeDPreview ? 'none' : 'auto',
                }}
              >
                <RoomCanvas
                  drawMode={drawMode}
                  onDrawComplete={() => setDrawMode(false)}
                  pendingProductId={pendingProductId}
                  setPendingProductId={setPendingProductId}
                />
              </div>
            </div>
          </CanvasErrorBoundary>
        </section>
        <DetailsPanel />
      </main>
      <CartStrip />
      <CartDrawer />
      <AddRoomChooser
        open={addRoomOpen}
        onClose={() => setAddRoomOpen(false)}
        onRequestDrawMode={() => setDrawMode(true)}
      />
      <ToastProvider />
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
          bottom: 12,
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
