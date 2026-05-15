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
import { ProductPalette } from './components/ProductPalette';
import { RoomCanvas } from './components/RoomCanvas';
import { DetailsPanel } from './components/DetailsPanel';
import { ToastProvider } from './components/ToastProvider';
import { RoomList } from './components/RoomList';
import { CartStrip } from './components/CartStrip';
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

  const [drawMode, setDrawMode] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [roomsMenuOpen, setRoomsMenuOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

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
          <CanvasErrorBoundary onReset={() => setDrawMode(false)}>
            <RoomCanvas
              drawMode={drawMode}
              onDrawComplete={() => setDrawMode(false)}
              pendingProductId={pendingProductId}
              setPendingProductId={setPendingProductId}
            />
          </CanvasErrorBoundary>
        </section>
        <DetailsPanel />
      </main>
      <CartStrip />
      <AddRoomChooser
        open={addRoomOpen}
        onClose={() => setAddRoomOpen(false)}
        onRequestDrawMode={() => setDrawMode(true)}
      />
      <ToastProvider />
    </div>
  );
}
