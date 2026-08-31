/**
 * ToastProvider — renders a stack of transient messages bottom-centre.
 * Reads from `toastStore`, schedules its own `setTimeout` per toast for
 * auto-dismiss. Zero external deps.
 *
 * PolB.3 (V4 Driver tick 35): toasts can carry an optional `action`
 * (e.g. Undo). When present, the CTA renders inline; clicking the
 * action fires `onClick` then dismisses the toast.
 *
 * Chrome register (toolbar contract 2026-08-29): every toast is an ink
 * pill with paper text (radius 8, 12/500); the action is a paper-outlined
 * chip. Error toasts are the one exception — chrome ground, terracotta rim
 * + terracotta icon, ink text — so the destructive colour stays an icon /
 * rim accent and never a fill (the old coral / amber / teal fills are gone).
 */
import { useEffect, useState } from 'react';
import { useToastStore } from '../store/toastStore';
import type { ToastKind } from '../store/toastStore';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { CHROME_DANGER } from '../designer/blueprintTheme';

/** Popover shadow from the contract (12 px blur, ink at 18 %). */
const SHADOW = 'shadow-[0_12px_32px_rgba(42,41,38,0.18)]';

const TOAST_BASE =
  `pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2 text-[12px] font-medium leading-snug ${SHADOW}`;
/** Ink pill: the ONE toast look. */
const TOAST_INK = `${TOAST_BASE} border-ppw-inkDeep bg-ppw-inkDeep text-ppw-paper`;
/** Error: chrome ground, terracotta rim, ink text (icon carries the colour). */
const TOAST_ERROR = `${TOAST_BASE} border-ppw-clay bg-ppw-chrome text-ppw-charcoal`;

const KIND_CLASSES: Record<ToastKind, string> = {
  info: TOAST_INK,
  warn: TOAST_INK,
  error: TOAST_ERROR,
  success: TOAST_INK,
};

/** Action chip: 11/600 caps, outlined in the toast's own text colour. */
const ACTION_BASE =
  'inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-[0.06em] leading-none ' +
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';
const ACTION_ON_INK = `${ACTION_BASE} border-ppw-paper/70 text-ppw-paper hover:bg-white/10`;
const ACTION_ON_CHROME = `${ACTION_BASE} border-ppw-inkDeep text-ppw-inkDeep hover:bg-[#f3f1ec]`;

/** Terracotta "!" badge for error toasts (decorative; the text carries meaning). */
function ErrorIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke={CHROME_DANGER}
      strokeWidth="1.75"
      strokeLinecap="round"
      className="shrink-0"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.75v3.9" />
      <circle cx="8" cy="11.4" r="0.6" fill={CHROME_DANGER} stroke="none" />
    </svg>
  );
}

/** True below Tailwind's md (768 px); SSR/jsdom-safe. */
function useBelowMd(): boolean {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false;
  const [below, setBelow] = useState<boolean>(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setBelow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return below;
}

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  // Sims world (2026-08-29): while the wall pen is live its HUD owns the
  // bottom-centre band. A toast there sat right on top of the HUD's buttons
  // and swallowed the click meant for "Finish walls" / "Close", so during a
  // draw the stack moves to the top-centre instead.
  const drawing = useDrawProgressStore((s) => s.enabled);
  const phone = useBelowMd();

  useEffect(() => {
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), t.ttlMs));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      // z-[35]: above the wall-pen HUD (z-30), BELOW sheets and popovers
      // (z-40+) so a toast never paints over an open cart sheet.
      className="pointer-events-none fixed left-1/2 z-[35] flex -translate-x-1/2 flex-col gap-2"
      // 2026-08-25: was a bare `bottom-6`, which stacked the toasts over the
      // Sims catalog dock. Both the desktop dock and the mobile toolbar
      // publish their live height; each resolves to 0 px when unmounted, so
      // every other page keeps the original 1.5rem offset.
      style={
        drawing
          ? { top: 'calc(4.75rem + env(safe-area-inset-top))' }
          : {
              // Phone: the Clear row + cart pill own the 52 px band above
              // the toolbar; stack the toasts above it. Desktop: the row is
              // bottom-left, toasts are centred — no extra offset needed.
              bottom: phone
                ? 'calc(1.5rem + 52px + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px) + var(--draw-hud-h, 0px))'
                : 'calc(1.5rem + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px) + var(--draw-hud-h, 0px))',
            }
      }
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.id} className={KIND_CLASSES[t.kind]} data-testid="toast">
          {t.kind === 'error' && <ErrorIcon />}
          <span className="flex-1 cursor-pointer" onClick={() => dismiss(t.id)}>
            {t.message}
          </span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
              className={t.kind === 'error' ? ACTION_ON_CHROME : ACTION_ON_INK}
              data-testid="toast-action"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
