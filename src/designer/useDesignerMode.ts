/**
 * Sims-Parity DT-15 — designer mode state.
 *
 * Modes: Move | Buy | Wall | Floor | Paint | Inspect.
 * 'floor' added per Tweak 02 (Phase C) — sits between Wall and Buy so
 * the strip reads left-to-right as build → finish → checkout.
 *
 * Pure-fn helpers for cursor styles + a small useState hook for
 * components that don't need a store.
 */

import { useState } from 'react';

export const DESIGNER_MODES = ['move', 'wall', 'floor', 'paint', 'inspect', 'buy'] as const;
export type DesignerMode = (typeof DESIGNER_MODES)[number];

export function cursorForMode(mode: DesignerMode): string {
  switch (mode) {
    case 'move':
      return 'move';
    case 'buy':
      return 'pointer';
    case 'wall':
      return 'crosshair';
    case 'floor':
      return 'crosshair';
    case 'paint':
      return 'crosshair';
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
    case 'floor':
      return 'Floor';
    case 'paint':
      return 'Paint';
    case 'inspect':
      return 'Inspect';
  }
}

export function useDesignerMode(initial: DesignerMode = 'move'): [DesignerMode, (m: DesignerMode) => void] {
  return useState<DesignerMode>(initial);
}
