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

export function GamingLayer1Surfaces(): JSX.Element | null {
  // Always call hooks unconditionally; gate the render at the bottom.
  const active = isGamingV1Active();
  const placedItems = useDesignStore((s) => s.placedItems);
  const roomDimensions = useDesignStore((s) => s.roomDimensions);
  const [mode, setMode] = useDesignerMode('move');
  const setWallDraw = useWallStore((s) => s.setDraw);
  const wallDrawPhase = useWallStore((s) => s.draw.phase);
  const [helpOpen, setHelpOpen] = useState(false);

  // M2: bridge ModeStrip selection ↔ wallStore FSM. Selecting Wall on
  // the strip arms the next-click anchor drop; selecting any other mode
  // returns the FSM to idle so the layer unwires its Stage listeners.
  function handleModeChange(next: DesignerMode): void {
    setMode(next);
    if (next === 'wall') {
      setWallDraw({ phase: 'armed' });
    } else if (wallDrawPhase !== 'idle') {
      setWallDraw({ phase: 'idle' });
    }
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
    </>
  );
}
