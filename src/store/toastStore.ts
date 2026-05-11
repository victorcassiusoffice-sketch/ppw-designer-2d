/**
 * Toast queue — Zustand-backed, no external lib. Drives the
 * <ToastProvider> in App.tsx. Toasts auto-dismiss after `ttlMs`
 * (default 2.4 s); callers can pass a custom ttl or kind.
 */
import { create } from 'zustand';

export type ToastKind = 'info' | 'warn' | 'error' | 'success';

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  /** ms remaining until auto-dismiss; the provider decrements via setTimeout. */
  ttlMs: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind, ttlMs?: number) => string;
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
  push: (message, kind = 'info', ttlMs = 2400) => {
    const id = makeId();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind, ttlMs }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
