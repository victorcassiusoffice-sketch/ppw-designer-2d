/**
 * ToastProvider — renders a stack of transient messages bottom-centre.
 * Reads from `toastStore`, schedules its own `setTimeout` per toast for
 * auto-dismiss. Zero external deps.
 *
 * PolB.3 (V4 Driver tick 35): toasts can carry an optional `action`
 * (e.g. Undo). When present, the CTA renders inline; clicking the
 * action fires `onClick` then dismisses the toast.
 */
import { useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import type { ToastKind } from '../store/toastStore';
import { useDrawProgressStore } from '../store/drawProgressStore';

const KIND_CLASSES: Record<ToastKind, string> = {
  info: 'bg-ppw-ink text-white',
  warn: 'bg-amber-500 text-white',
  error: 'bg-ppw-coral text-white',
  success: 'bg-ppw-teal text-white',
};

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  // Sims world (2026-08-29): while the wall pen is live its HUD owns the
  // bottom-centre band. A toast there sat right on top of the HUD's buttons
  // and swallowed the click meant for "Finish walls" / "Close", so during a
  // draw the stack moves to the top-centre instead.
  const drawing = useDrawProgressStore((s) => s.enabled);

  useEffect(() => {
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), t.ttlMs));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
      // 2026-08-25: was a bare `bottom-6`, which stacked the toasts over the
      // Sims catalog dock. Both the desktop dock and the mobile toolbar
      // publish their live height; each resolves to 0 px when unmounted, so
      // every other page keeps the original 1.5rem offset.
      style={
        drawing
          ? { top: 'calc(4.75rem + env(safe-area-inset-top))' }
          : { bottom: 'calc(1.5rem + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px))' }
      }
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-black/10 ${KIND_CLASSES[t.kind]}`}
          data-testid="toast"
        >
          <span
            className="flex-1 cursor-pointer"
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
              className="rounded-sm bg-white/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/30 hover:bg-white/25"
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
