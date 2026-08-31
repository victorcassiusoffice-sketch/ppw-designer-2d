/**
 * Toast queue — Zustand-backed, no external lib. Drives the
 * <ToastProvider> in App.tsx. Toasts auto-dismiss after `ttlMs`
 * (default 2.4 s); callers can pass a custom ttl or kind.
 *
 * PolB.3 (V4 Driver tick 35): an optional `action: { label, onClick }`
 * lets a toast render an inline CTA (e.g. "Undo" for auto-add) without
 * a new toast variant. The CTA fires onClick + dismisses the toast.
 */
import { create } from 'zustand';

export type ToastKind = 'info' | 'warn' | 'error' | 'success';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  /** How many identical pushes this toast represents (coalesced). */
  count?: number;
  id: string;
  message: string;
  kind: ToastKind;
  /** ms remaining until auto-dismiss; the provider decrements via setTimeout. */
  ttlMs: number;
  /** Optional inline CTA (e.g. "Undo"). */
  action?: ToastAction;
}

export interface ToastPushOptions {
  ttlMs?: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (
    message: string,
    kind?: ToastKind,
    ttlMsOrOptions?: number | ToastPushOptions,
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'info', ttlMsOrOptions) => {
    const id = makeId();
    const opts: ToastPushOptions =
      typeof ttlMsOrOptions === 'number'
        ? { ttlMs: ttlMsOrOptions }
        : ttlMsOrOptions ?? {};
    const ttlMs = opts.ttlMs ?? 2400;
    const toast: Toast = { id, message, kind, ttlMs };
    if (opts.action) toast.action = opts.action;
    set((s) => {
      // Coalesce a repeat of the newest toast ("Door added" x8 blanketed
      // the canvas): same message + kind and no action bumps a count on a
      // FRESH id (the ttl timer keys on id, so the clock restarts).
      const last = s.toasts[s.toasts.length - 1];
      if (last && !last.action && !toast.action && last.message === message && last.kind === kind) {
        const bumped: Toast = { ...last, id, count: (last.count ?? 1) + 1 };
        return { toasts: [...s.toasts.slice(0, -1), bumped] };
      }
      return { toasts: [...s.toasts, toast] };
    });
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
