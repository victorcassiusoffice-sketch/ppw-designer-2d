/**
 * Sims-Parity DT-15 — designer mode state.
 *
 * Five modes: Move | Buy | Wall (M2 — per protocol-03-walls.md) | Paint (V-GAME-2 stub) | Inspect.
 * Pure-fn helpers for cursor styles + a small useState hook for
 * components that don't need a store.
 */

import { useState } from 'react';

export const DESIGNER_MODES = ['move', 'buy', 'wall', 'paint', 'inspect'] as const;
export type DesignerMode = (typeof DESIGNER_MODES)[number];

export function cursorForMode(mode: DesignerMode): string {
  switch (mode) {
    case 'move':
      return 'move';
    case 'buy':
      return 'pointer';
    case 'wall':
      return 'crosshair';
    case 'paint':
      return 'not-allowed'; // stub — no-op
    case 'inspect':
      return 'help';
  }
}

export function labelForMode(mode: DesignerMode): string {
  switch (mode) {
    case 'move':
      return 'Move';
    case 'buy':
      return 'Buy';
    case 'wall':
      return 'Wall';
    case 'paint':
      return 'Paint';
    case 'inspect':
      return 'Inspect';
  }
}

export function useDesignerMode(initial: DesignerMode = 'move'): [DesignerMode, (m: DesignerMode) => void] {
  return useState<DesignerMode>(initial);
}
