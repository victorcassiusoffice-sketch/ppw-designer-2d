/**
 * Customer-UI fixes (2026-05-31) — regression guards.
 *
 * The live customer renderer is Konva (a single <canvas>, no per-shape DOM),
 * so several of these fixes can't be asserted by rendering in the node test
 * env. Following the established repo convention (roomCanvasRenderBind.test.ts)
 * we assert against the component SOURCE so a future edit that reverts a fix
 * fails loudly. Behavioural coverage that CAN run in-env lives alongside:
 *   • M5 wheel zoom            → src/lib/__tests__/zoom.test.ts
 *   • M9 off-lot drag rejection→ src/lib/__tests__/offlot-drag.test.ts
 *   • B2 cluster dup/delete/rotate (jsdom) → src/designer/__tests__/FloatingCluster.test.tsx
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), 'utf8');
const roomCanvas = read('../RoomCanvas.tsx');
const app = read('../../App.tsx');
const productPalette = read('../ProductPalette.tsx');
const thumbStrip = read('../../designer/CatalogThumbStrip.tsx');
const floatingCluster = read('../../designer/FloatingCluster.tsx');

describe('B1 — placed items carry an always-listening hit target', () => {
  it('renders a transparent, default-listening hit Rect on the placed-item group', () => {
    expect(roomCanvas).toMatch(
      /<Rect\s+width=\{wPx\}\s+height=\{hPx\}\s+fill="transparent"\s+perfectDrawEnabled=\{false\}\s+data-testid="placed-hit"\s*\/>/,
    );
  });
});

describe('M3 — no HTML5 draggable on catalog cards', () => {
  it('ProductPalette card dropped draggable / handleDragStart / DRAG_MIME', () => {
    // Forbid the HTML5 drag-ENABLING `draggable` attr, but allow the
    // explicit `draggable={false}` that DISABLES native image drag on the
    // real-photo thumbnail (2026-06-09) — disabling is not the regression.
    expect(productPalette).not.toMatch(/\n\s*draggable(?!=\{false\})\b/);
    // assert on the real code forms (an explanatory comment may name them)
    expect(productPalette).not.toContain('function handleDragStart');
    expect(productPalette).not.toContain('const DRAG_MIME');
  });
  it('CatalogThumbStrip card dropped the DOM draggable + dataTransfer path', () => {
    expect(thumbStrip).not.toMatch(/\n\s*draggable\b/);
    expect(thumbStrip).not.toContain('dataTransfer');
  });
});

describe('M4 — no on-canvas debug text / no persistent tip banner', () => {
  it('the bbox debug Konva Text was removed', () => {
    expect(roomCanvas).not.toContain('text={`0,0 -');
  });
  it('the persistent non-draw "Tip:" banner was removed (draw-mode help only)', () => {
    expect(roomCanvas).not.toContain('<span className="font-semibold text-ppw-ink">Tip:</span>');
  });
});

describe('M5 — wheel zoom uses a functional updater + the tested helper', () => {
  it('handleWheel reads scale via setViewport((v) => ...) and computeZoomScale', () => {
    expect(roomCanvas).toMatch(/setViewport\(\(v\) =>/);
    expect(roomCanvas).toContain('computeZoomScale(oldScale, e.evt.deltaY');
  });
});

describe('M6 — safe-area-inset on the floating clusters', () => {
  it('top-right button column references env(safe-area-inset-right)', () => {
    expect(roomCanvas).toContain('env(safe-area-inset-right)');
  });
  it('FloatingCluster position folds in env(safe-area-inset-*)', () => {
    expect(floatingCluster).toContain('env(safe-area-inset-left)');
    expect(floatingCluster).toContain('env(safe-area-inset-top)');
  });
});

describe('M7 — selection cluster avoids the top-right button column', () => {
  it('FloatingCluster nudges left out of the top-right zone', () => {
    expect(floatingCluster).toContain('TOPRIGHT_W');
  });
});

describe('M8 — desktop-first interstitial removed', () => {
  it('MobilePreviewBanner component + mount are gone from App', () => {
    // The component definition and its JSX mount must be gone (an
    // explanatory code comment may still name it — assert on real code).
    expect(app).not.toContain('function MobilePreviewBanner');
    expect(app).not.toContain('<MobilePreviewBanner');
    // The interstitial body copy must not ship.
    expect(app).not.toContain('built desktop-first. Mobile works');
  });
});

describe('Minor 11 — placed-item labels render upright (outside the rotating group)', () => {
  it('labels use the AABB width (wPx) in the non-rotating outer group', () => {
    // The upright label is anchored to the AABB (wPx) rather than the
    // unrotated footprint inside the rotating art group.
    expect(roomCanvas).toContain('width={Math.max(wPx - 8, 20)}');
  });
});
