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
import { V4Banner } from './V4Banner';
import { EngineToggle } from './babylon/EngineToggle';
import { isGamingV1Active } from './gamingV1Flag';
import { useDesignStore } from '../store/designStore';
import { computeRoomStats } from './useRoomStats';
import { useDesignerMode } from './useDesignerMode';
import { fetchApiProducts } from '../data/apiCatalogAdapter';

export function GamingLayer1Surfaces(): JSX.Element | null {
  // Always call hooks unconditionally; gate the render at the bottom.
  const active = isGamingV1Active();
  const placedItems = useDesignStore((s) => s.placedItems);
  const roomDimensions = useDesignStore((s) => s.roomDimensions);
  const [mode, setMode] = useDesignerMode('move');
  const [helpOpen, setHelpOpen] = useState(false);

  // PCF-2 — surface merchant SKU count in the V4 banner so Vic can
  // verify the K1 catalog wiring at a glance.
  const [merchantSkuCount, setMerchantSkuCount] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    fetchApiProducts().then((rows) => {
      if (!cancelled) setMerchantSkuCount(rows.length);
    });
    return () => {
      cancelled = true;
    };
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
      <V4Banner merchantProductCount={merchantSkuCount} />
      <StatusCard stats={stats} />
      <ModeStrip
        active={mode}
        onChange={setMode}
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
