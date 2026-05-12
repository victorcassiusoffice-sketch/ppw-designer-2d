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
 */

import { useState } from 'react';
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

export default function App() {
  useKeyboardShortcuts();
  useAutoSave();

  const [drawMode, setDrawMode] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ppw-sand text-ppw-ink">
      <TopBar drawMode={drawMode} setDrawMode={setDrawMode} />
      <main className="flex flex-1 overflow-hidden">
        <RoomList onRequestAddRoom={() => setAddRoomOpen(true)} />
        <ProductPalette />
        <section className="relative flex-1 overflow-hidden">
          <CanvasErrorBoundary onReset={() => setDrawMode(false)}>
            <RoomCanvas
              drawMode={drawMode}
              onDrawComplete={() => setDrawMode(false)}
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
