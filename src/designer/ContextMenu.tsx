/**
 * Sims-Parity DT-18 — right-click / long-press context menu (GL1.14).
 *
 * Anchored at the pointer event. Items: Rotate ▸ (sub-actions
 * 90°/180°/270°), Duplicate, Send to back, Bring to front, Delete.
 *
 * Long-press on touch (≥500 ms) triggers the same menu; click
 * outside dismisses.
 */

import { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  destructive?: boolean;
  onClick: () => void;
  children?: ContextMenuItem[];
}

export interface ContextMenuProps {
  /** Anchor (page-coords px). */
  xPx: number;
  yPx: number;
  items: ContextMenuItem[];
  onDismiss: () => void;
}

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

export function ContextMenu(props: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent): void {
      if (!menuRef.current?.contains(e.target as Node)) props.onDismiss();
    }
    function onEsc(e: KeyboardEvent): void {
      if (e.key === 'Escape') props.onDismiss();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [props]);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        left: props.xPx,
        top: props.yPx,
        minWidth: 180,
        background: PALETTE.cream,
        border: `1px solid ${PALETTE.gold}`,
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(14,14,16,0.2)',
        zIndex: 950,
        padding: 4,
      }}
    >
      {props.items.map((it) => (
        <div
          key={it.id}
          role="menuitem"
          tabIndex={0}
          onClick={() => {
            if (it.children) {
              setOpenSub(openSub === it.id ? null : it.id);
              return;
            }
            it.onClick();
            props.onDismiss();
          }}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            color: it.destructive ? '#c64545' : PALETTE.ink,
            cursor: 'pointer',
            borderRadius: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(192,166,126,0.2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <span>{it.label}</span>
          {it.children && <span style={{ opacity: 0.5 }}>▸</span>}
          {openSub === it.id && it.children && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                left: '100%',
                top: 0,
                marginLeft: 4,
                minWidth: 140,
                background: PALETTE.cream,
                border: `1px solid ${PALETTE.gold}`,
                borderRadius: 6,
                padding: 4,
              }}
            >
              {it.children.map((sub) => (
                <div
                  key={sub.id}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    sub.onClick();
                    props.onDismiss();
                  }}
                  style={{
                    padding: '4px 8px', fontSize: 12,
                    color: PALETTE.ink, cursor: 'pointer', borderRadius: 4,
                  }}
                >
                  {sub.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Helper: long-press detector (≥500 ms) for touch trigger.
 * Returns a pair of pointer event handlers + a manual cancel fn.
 */
export function useLongPress(onLongPress: (e: PointerEvent) => void, msHold = 500): {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return {
    onPointerDown: (e) => {
      const native = e.nativeEvent;
      cancel();
      timerRef.current = setTimeout(() => onLongPress(native), msHold);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
  };
}
