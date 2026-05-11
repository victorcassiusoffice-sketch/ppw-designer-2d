/**
 * Lightweight page header used by /cart, /checkout, /orders, /order/*.
 *
 * Brand mark on the left, currency switcher + "← Back to designer" on
 * the right. No L/W inputs, no draw mode — those are designer-only.
 */

import { Link } from 'react-router-dom';
import { CurrencySwitcher } from './CurrencySwitcher';

export interface CartPageHeaderProps {
  /** Optional extra label slot on the right (e.g. "Order #123"). */
  rightLabel?: React.ReactNode;
}

export function CartPageHeader({ rightLabel }: CartPageHeaderProps) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-ppw-stone bg-white px-3 md:px-6">
      <Link to="/" className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ppw-teal">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" aria-hidden="true">
            <path d="M5 18 L12 5 L19 18 Z" fill="currentColor" />
            <circle cx="12" cy="14" r="1.6" fill="#0F766E" />
          </svg>
        </div>
        <div className="leading-tight min-w-0">
          <p className="truncate text-sm font-semibold text-ppw-ink">
            Peak Performance Wellness
          </p>
          <p className="hidden md:block text-[11px] text-ppw-slate">
            Wellness Room Designer
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-2 text-xs">
        {rightLabel}
        <CurrencySwitcher compact />
        <Link
          to="/"
          className="rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
        >
          ← Designer
        </Link>
      </div>
    </header>
  );
}
