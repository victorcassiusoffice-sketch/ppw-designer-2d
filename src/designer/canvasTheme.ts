import type { UiTheme } from '../i18n/AppPreferences';

type CanvasPalette = { background: string; grid: string; majorGrid: string; ink: string; site: string; boundary: string };

/** Workspace surround and drafting lines. Model material colours belong to the drawing. */
export const CANVAS_THEMES = {
  ivory: { background: '#94aab5', grid: '#859eab', majorGrid: '#718d9c', ink: '#142d40', site: '#b6cad0', boundary: '#38566a' },
  ocean: { background: '#253b4c', grid: '#30495a', majorGrid: '#446173', ink: '#e9f3f7', site: '#324e5d', boundary: '#94b9c5' },
  slate: { background: '#343c50', grid: '#424b60', majorGrid: '#566078', ink: '#f0f1fa', site: '#454e61', boundary: '#a8b6cb' },
} satisfies Record<UiTheme, CanvasPalette>;

export function canvasThemeFor(theme: string): CanvasPalette {
  return theme === 'ocean' || theme === 'slate' ? CANVAS_THEMES[theme] : CANVAS_THEMES.ivory;
}
