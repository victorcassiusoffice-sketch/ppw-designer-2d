/**
 * MacroIcon — small monochrome glyph per macro category for the mobile
 * Sims toolbar category bar (uses currentColor → gold when active, cream
 * idle). Kept in its own file so catalogMacros.ts exports only constants.
 */
import type { MacroCategory } from './catalogMacros';

export function MacroIcon({ macro }: { macro: MacroCategory }): JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
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
  }
}
