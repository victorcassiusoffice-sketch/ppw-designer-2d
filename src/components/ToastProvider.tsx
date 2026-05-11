/**
 * ToastProvider — renders a stack of transient messages bottom-centre.
 * Reads from `toastStore`, schedules its own `setTimeout` per toast for
 * auto-dismiss. Zero external deps.
 */
import { useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import type { ToastKind } from '../store/toastStore';

const KIND_CLASSES: Record<ToastKind, string> = {
  info: 'bg-ppw-ink text-white',
  warn: 'bg-amber-500 text-white',
  error: 'bg-ppw-coral text-white',
  success: 'bg-ppw-teal text-white',
};

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  // For every toast in the queue, schedule a one-shot dismiss timer.
  useEffect(() => {
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), t.ttlMs));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-md px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-black/10 ${KIND_CLASSES[t.kind]}`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
