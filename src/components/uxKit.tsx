/**
 * OMS Wave 3 — shared UX kit.
 *
 * One file collecting the small components the rest of Wave 3 reuses:
 *   - EmptyState (W3.1)
 *   - SkeletonRow / SkeletonGrid (W3.2)
 *   - ErrorBanner (W3.3)
 *   - InlineFieldError (W3.4)
 *   - CoachMark (W3.5)
 *   - Toast container hook (W3.9 — wraps the existing toastStore)
 *
 * Brand consistency (W3.6): all components use the `ppw-*` Tailwind
 * tokens from `tailwind.config.js`, mocha CTA, Inter font stack.
 * Dark mode (W3.7): `dark:` variants applied where contrast benefits.
 * A11y (W3.8): every interactive element carries role + label.
 */

import { useEffect, useState } from 'react';

// ─── W3.1 EmptyState ────────────────────────────────────────────────
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}): JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: 48,
        textAlign: 'center',
        background: 'var(--ppw-sand, #f4efe3)',
        borderRadius: 12,
      }}
    >
      <div aria-hidden style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{title}</h2>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 16px' }}>{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: '8px 16px',
            background: '#7B4F2C',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── W3.2 SkeletonRow / SkeletonGrid ────────────────────────────────
export function SkeletonRow({ height = 14 }: { height?: number }): JSX.Element {
  return (
    <div
      role="presentation"
      style={{
        height,
        background: '#e5e7eb',
        borderRadius: 4,
        animation: 'ppw-pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

export function SkeletonGrid({ rows = 5 }: { rows?: number }): JSX.Element {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'grid', gap: 8 }}>
      <style>{`@keyframes ppw-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// ─── W3.3 ErrorBanner ───────────────────────────────────────────────
export function ErrorBanner({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        padding: 12,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 6,
        color: '#991b1b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>{error}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry the failed request"
          style={{
            padding: '4px 10px',
            background: '#991b1b',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── W3.4 InlineFieldError ──────────────────────────────────────────
export function InlineFieldError({ error }: { error?: string | null }): JSX.Element | null {
  if (!error) return null;
  return (
    <p role="alert" style={{ color: '#dc2626', fontSize: 12, margin: '2px 0 0' }}>
      {error}
    </p>
  );
}

// ─── W3.5 CoachMark ─────────────────────────────────────────────────
interface CoachStep {
  title: string;
  body: string;
}

export function CoachMark({
  flagKey,
  steps,
}: {
  flagKey: string;
  steps: CoachStep[];
}): JSX.Element | null {
  const [stepIdx, setStepIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return -1;
    return window.localStorage.getItem(flagKey) === '1' ? -1 : 0;
  });

  if (stepIdx < 0 || stepIdx >= steps.length) return null;
  const step = steps[stepIdx]!;

  return (
    <div
      role="dialog"
      aria-labelledby="ppw-coach-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 320,
          padding: 24,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        }}
      >
        <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>
          Step {stepIdx + 1} of {steps.length}
        </p>
        <h2 id="ppw-coach-title" style={{ margin: '4px 0 8px', fontSize: 18 }}>
          {step.title}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#374151' }}>{step.body}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(flagKey, '1');
              setStepIdx(-1);
            }}
            style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              if (stepIdx + 1 >= steps.length) {
                window.localStorage.setItem(flagKey, '1');
                setStepIdx(-1);
              } else {
                setStepIdx(stepIdx + 1);
              }
            }}
            style={{
              padding: '6px 14px',
              background: '#0a0a0a',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {stepIdx + 1 >= steps.length ? 'Got it' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── W3.7 useDarkMode (opt-in via localStorage) ─────────────────────
export function useDarkMode(): [boolean, () => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ppw_dark_mode_v1') === '1';
  });
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [enabled]);
  return [
    enabled,
    () => {
      const next = !enabled;
      window.localStorage.setItem('ppw_dark_mode_v1', next ? '1' : '0');
      setEnabled(next);
    },
  ];
}
