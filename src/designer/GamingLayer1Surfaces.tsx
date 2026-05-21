/**
 * Sims-Parity Gaming Layer 1 — additive surfaces wrapper.
 *
 * Mounts the DOM-overlay polish surfaces (StatusCard top-left,
 * ModeStrip bottom-left, HelpLauncherIcon top-right, HelpOverlay
 * modal) on top of the existing designer canvas WITHOUT touching
 * the Konva render-core (stable-lock 26c144c).
 *
 * Returns null when the flag is off so the classic UI renders alone.
 *
 * Reads stats from designStore + propertyStore via cheap selectors.
 * Catalog prices stay zero pre-M9.B.1 per Vic's V4 protection rule,
 * so totalValueMur = 0 is correct here.
 */

import { useEffect, useMemo, useState } from 'react';
import { HelpLauncherIcon, HelpOverlay } from './HelpOverlay';
import { StatusCard } from './StatusCard';
import { ModeStrip } from './ModeStrip';
import { EngineToggle } from './babylon/EngineToggle';
import { isGamingV1Active } from './gamingV1Flag';
import { useDesignStore } from '../store/designStore';
import { computeRoomStats } from './useRoomStats';
import { useDesignerMode, type DesignerMode } from './useDesignerMode';
import { useWallStore } from '../store/wallStore';
import { useToastStore } from '../store/toastStore';

export function GamingLayer1Surfaces(): JSX.Element | null {
  // Always call hooks unconditionally; gate the render at the bottom.
  const active = isGamingV1Active();
  const placedItems = useDesignStore((s) => s.placedItems);
  const roomDimensions = useDesignStore((s) => s.roomDimensions);
  const [mode, setMode] = useDesignerMode('move');
  const setWallDraw = useWallStore((s) => s.setDraw);
  const wallDrawPhase = useWallStore((s) => s.draw.phase);
  const clearWalls = useWallStore((s) => s.clearWalls);
  const clearActiveRoomItems = useDesignStore((s) => s.clearDesign);
  const pushToast = useToastStore((s) => s.push);
  const [helpOpen, setHelpOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // M2: bridge ModeStrip selection ↔ wallStore FSM. Selecting Wall on
  // the strip arms the next-click anchor drop; selecting any other mode
  // returns the FSM to idle so the layer unwires its Stage listeners.
  //
  // Tweak 04 (Phase A): the strip now also fires onChange when the
  // active mode is re-clicked — so a re-tap on WALL while already in
  // wall mode resets the in-flight polyline (`phase: drawing` → `armed`).
  function handleModeChange(next: DesignerMode): void {
    setMode(next);
    if (next === 'wall') {
      setWallDraw({ phase: 'armed' });
    } else if (wallDrawPhase !== 'idle') {
      setWallDraw({ phase: 'idle' });
    }
  }

  // Tweak 04 (Phase A): CLEAR with confirm modal. The 30-second Ctrl+Z
  // restore IS the unified history stack from Tweak 07 — Vic's original
  // brief language "Ctrl+Z within 30s" maps to "as long as the wipe
  // sits within the 50-frame in-memory ring AND the user hasn't
  // performed 50 other actions since". One-step Ctrl+Z fulfils the
  // demand.
  function handleClearActiveLayer(): void {
    setClearConfirmOpen(false);
    if (mode === 'wall' || wallDrawPhase !== 'idle') {
      clearWalls();
      pushToast('Walls cleared — press Ctrl+Z to restore.', 'info', 4000);
      return;
    }
    // Default: clear placed items in the active room.
    clearActiveRoomItems();
    pushToast('Placed items cleared — press Ctrl+Z to restore.', 'info', 4000);
  }

  // Reverse-bridge: if the WallDrawLayer / HUD takes the FSM to 'idle'
  // (right-click, Done button, Esc twice), reflect that in the strip
  // so the active-button outline matches the live phase.
  useEffect(() => {
    if (wallDrawPhase === 'idle' && mode === 'wall') {
      setMode('move');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallDrawPhase]);

  // M1.4: clear any stale `gaming_v1='0'` localStorage left over from
  // pre-flip dev sessions. V4 is permanently default-on per Vic 2026-05-19,
  // so this is the only piece of the (now-removed) V4Banner worth keeping.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (localStorage.getItem('gaming_v1') === '0') {
        localStorage.removeItem('gaming_v1');
      }
    } catch {
      // ignore
    }
  }, []);

  const stats = useMemo(() => {
    return computeRoomStats({
      items: placedItems.map((p) => ({ productId: p.productId, priceMur: 0 })),
      roomWidthMm: Math.round(roomDimensions.lengthM * 1000),
      roomDepthMm: Math.round(roomDimensions.widthM * 1000),
    });
  }, [placedItems, roomDimensions.lengthM, roomDimensions.widthM]);

  if (!active) return null;

  return (
    <>
      <StatusCard stats={stats} />
      <ModeStrip
        active={mode}
        onChange={handleModeChange}
        onClearClick={() => setClearConfirmOpen(true)}
        onPaintStubToast={() => {
          // Coach-mark friendly toast — keep silent for now; future
          // wire into ToastProvider when Paint mode lands.
          console.info('[gaming] Paint mode — coming soon.');
        }}
      />
      <HelpLauncherIcon onOpen={() => setHelpOpen(true)} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      {/* DT-27 — engine side-by-side toggle. Hard-refreshes on flip. */}
      <EngineToggle />
      {/* Tweak 04 (Phase A) — CLEAR confirm modal. */}
      {clearConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
          data-testid="clear-confirm-modal"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 800,
            background: 'rgba(14,14,16,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setClearConfirmOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setClearConfirmOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 22,
              width: 'min(92vw, 360px)',
              boxShadow: '0 12px 32px rgba(14,14,16,0.32)',
            }}
          >
            <h2 id="clear-confirm-title" style={{ margin: 0, fontSize: 16, color: '#0E0E10' }}>
              Clear active layer?
            </h2>
            <p style={{ marginTop: 8, marginBottom: 18, fontSize: 13, color: '#475569' }}>
              This wipes {mode === 'wall' || wallDrawPhase !== 'idle' ? 'all walls' : 'all placed items in this room'}.
              You can press Ctrl+Z within the next ~30 seconds to restore.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                autoFocus
                onClick={() => setClearConfirmOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearActiveLayer}
                data-testid="clear-confirm-yes"
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#C73030',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Yes, clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
