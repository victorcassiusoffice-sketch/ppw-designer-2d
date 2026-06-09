/**
 * V-RENDER-1 (2026-05-27) — source-level regression guard.
 *
 * Konva renders every placed item into a single <canvas> (no per-shape
 * DOM), so the in-room image bind can't be asserted by rendering in the
 * node test env. Instead we statically assert the RoomCanvas image bind
 * uses the canonical `productTopDownUrl(product)` resolver (top-down-first,
 * so the floor-plan footprint reads correctly — 2026-06-09) and has NOT
 * regressed to the raw `product.image_url` field that skipped the baked
 * top-down PNGs (the original bug).
 *
 * If a future edit re-introduces `useImageCache(product.image_url`, this
 * test fails loudly — the cheapest possible guard against the exact
 * regression this /goal fixed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const roomCanvasPath = path.resolve(here, '../RoomCanvas.tsx');
const source = readFileSync(roomCanvasPath, 'utf8');

describe('RoomCanvas in-room image bind', () => {
  it('binds the canonical top-down resolver into useImageCache', () => {
    expect(source).toContain('useImageCache(productTopDownUrl(product))');
  });

  it('imports productTopDownUrl from the products module', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bproductTopDownUrl\b[^}]*\}\s*from\s*'\.\.\/data\/products'/);
  });

  it('has NOT regressed to binding the raw image_url field', () => {
    expect(source).not.toContain('useImageCache(product.image_url');
  });
});
