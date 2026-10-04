/** Label typography is screen-aware presentation, never a room measurement.
 * Small fitted rooms should read as rooms, not giant screen-constant text. */
export function planRoomLabelLayout(widthPx: number, heightPx: number, text: string, active: boolean): { widthPx: number; heightPx: number; fontPx: number } | null {
  if (![widthPx, heightPx].every(value => Number.isFinite(value) && value > 0) || !text.trim()) return null;
  if (widthPx < (active ? 64 : 110) || heightPx < (active ? 44 : 64) || (!active && widthPx * heightPx < 10000)) return null;
  const available = widthPx - 16;
  const fontPx = Math.min(10, Math.max(8, Math.min(widthPx / 15, heightPx / 9)));
  return { widthPx: Math.min(available, text.length * fontPx * 0.6 + 6), heightPx: fontPx * 1.35, fontPx };
}
