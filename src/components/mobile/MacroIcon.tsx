/**
 * MacroIcon — small monochrome glyph per macro category for the mobile
 * Sims toolbar category bar (uses currentColor → gold when active, cream
 * idle). Kept in its own file so catalogMacros.ts exports only constants.
 */
import type { MacroCategory } from './catalogMacros';

export interface MacroIconProps {
  macro: MacroCategory;
  /**
   * Rendered size in CSS px. Defaults to the mobile toolbar's 22; the desktop
   * dock tabs pass 20 (toolbar contract 2026-08-29: 16 px icons in bars,
   * 20 px in dock tabs).
   */
  size?: number;
}

export function MacroIcon({ macro, size = 22 }: MacroIconProps): JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (macro) {
    case 'all':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'furniture':
      return (
        <svg {...common}>
          <path d="M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" />
          <path d="M4 11h16v5H4z" />
          <path d="M6 16v3M18 16v3" />
        </svg>
      );
    case 'cardio':
      return (
        <svg {...common}>
          <path d="M3 12h4l2 5 4-12 2 7h6" />
        </svg>
      );
    case 'recovery':
      return (
        <svg {...common}>
          <path d="M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z" />
        </svg>
      );
    case 'sauna':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case 'flooring':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      );
    case 'walls':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 9h18M3 14.5h18M9 4v5M15 9v5.5M9 14.5V20" />
        </svg>
      );
    case 'decor':
      return (
        <svg {...common}>
          <path d="M12 20V9" />
          <path d="M12 9c-3 0-5-2-5-4 3 0 5 2 5 4z" />
          <path d="M12 11c3 0 5-2 5-4-3 0-5 2-5 4z" />
          <path d="M8 20h8" />
        </svg>
      );
    case 'lighting':
      // Bulb: dome + neck + base line.
      return (
        <svg {...common}>
          <path d="M9 14.5a5 5 0 1 1 6 0c-.8.6-1 1.5-1 2.5h-4c0-1-.2-1.9-1-2.5z" />
          <path d="M10 20h4" />
          <path d="M12 2v1.5M5 6l1 1M19 6l-1 1" />
        </svg>
      );
    case 'outdoor':
      // Tree: round canopy on a trunk, ground line.
      return (
        <svg {...common}>
          <path d="M12 3a5.5 5.5 0 0 1 4.2 9c1.5.4 2.3 1.5 2.3 2.5 0 1.7-2 2.5-6.5 2.5S5.5 16.2 5.5 14.5c0-1 .8-2.1 2.3-2.5A5.5 5.5 0 0 1 12 3z" />
          <path d="M12 17v4" />
          <path d="M7 21h10" />
        </svg>
      );
  }
}
