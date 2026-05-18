/**
 * Sims-Parity DT-14 — GL1.08 floating detail card.
 *
 * Anchored above-right of the selected item, with a gold #C0A67E SVG
 * leader-line from the card's lower-left corner to the item's centre.
 * Flips below-right when the item sits in the upper third of the
 * canvas (so the card doesn't render off-screen).
 *
 * Mobile (≤768 px viewport): renders as a fixed bottom-sheet instead
 * of a floating card. Engine-agnostic DOM (Konva-agnostic per
 * data-flow §6 P6).
 *
 * Slots:
 *   • thumb (64²) + name + price + description
 *   • variant swatch row (DT-09 product.variants)
 *   • action row (Rotate, Duplicate, Delete)
 */

import { useEffect, useState } from 'react';

export interface DetailCardVariant {
  color: string;
  color_label: string;
  photo_url?: string;
}

export interface DetailCardAction {
  id: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export interface DetailCardProps {
  /** Selected item screen-space anchor (centre of the item, px). */
  anchorXPx: number;
  anchorYPx: number;
  /** Canvas dimensions in px (used to decide above vs below flip). */
  canvasWidthPx: number;
  canvasHeightPx: number;

  thumbUrl: string;
  name: string;
  priceMur: number;
  description: string;
  variants?: DetailCardVariant[];
  activeVariant?: string;
  onVariantPick?: (color: string) => void;
  actions: DetailCardAction[];

  onDismiss: () => void;
}

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

function useIsMobile(): boolean {
  const [m, setM] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 768,
  );
  useEffect(() => {
    function r(): void { setM(window.innerWidth <= 768); }
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  return m;
}

export function DetailCard(props: DetailCardProps): JSX.Element {
  const mobile = useIsMobile();
  if (mobile) return <MobileSheet {...props} />;
  return <FloatingCard {...props} />;
}

function FloatingCard(props: DetailCardProps): JSX.Element {
  // Decide flip: card sits below-right when the item is in the upper third.
  const isUpperThird = props.anchorYPx < props.canvasHeightPx / 3;
  const cardWidth = 280;
  const cardHeight = 240;

  // Card top-left position.
  const offsetX = 32;
  const offsetY = isUpperThird ? 32 : -(cardHeight + 32);
  const cardX = Math.max(8, Math.min(props.anchorXPx + offsetX, props.canvasWidthPx - cardWidth - 8));
  const cardY = Math.max(8, Math.min(props.anchorYPx + offsetY, props.canvasHeightPx - cardHeight - 8));

  // Leader-line: from the anchor centre to the card's nearest corner.
  const lineFromX = props.anchorXPx;
  const lineFromY = props.anchorYPx;
  const lineToX = cardX;
  const lineToY = isUpperThird ? cardY : cardY + cardHeight;

  return (
    <>
      <svg
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 800,
        }}
      >
        <line
          x1={lineFromX}
          y1={lineFromY}
          x2={lineToX}
          y2={lineToY}
          stroke={PALETTE.gold}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <circle cx={lineFromX} cy={lineFromY} r={3} fill={PALETTE.gold} />
      </svg>
      <article
        role="dialog"
        aria-label={`${props.name} details`}
        style={{
          position: 'fixed',
          left: cardX,
          top: cardY,
          width: cardWidth,
          maxHeight: cardHeight,
          background: PALETTE.cream,
          border: `1px solid ${PALETTE.gold}`,
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(14,14,16,0.2)',
          padding: 12,
          zIndex: 810,
          overflowY: 'auto',
          color: PALETTE.ink,
        }}
      >
        <CardBody {...props} />
      </article>
    </>
  );
}

function MobileSheet(props: DetailCardProps): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: PALETTE.cream,
        borderTopLeftRadius: 12, borderTopRightRadius: 12,
        boxShadow: '0 -4px 16px rgba(14,14,16,0.2)',
        padding: 16, zIndex: 900,
        maxHeight: '70vh', overflowY: 'auto',
      }}
    >
      <CardBody {...props} />
    </div>
  );
}

function CardBody(props: DetailCardProps): JSX.Element {
  return (
    <>
      <header style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
        <img
          src={props.thumbUrl}
          alt=""
          width={64}
          height={64}
          style={{ objectFit: 'cover', borderRadius: 6, background: '#ddd' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{props.name}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: PALETTE.gold, fontWeight: 600 }}>
            Rs {props.priceMur}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onDismiss}
          aria-label="Close detail card"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: PALETTE.ink, fontSize: 18, padding: 0,
          }}
        >
          ×
        </button>
      </header>

      <p style={{ fontSize: 12, color: 'rgba(14,14,16,0.7)', margin: '0 0 12px' }}>
        {props.description}
      </p>

      {props.variants && props.variants.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }} role="radiogroup" aria-label="Colour variants">
          {props.variants.map((v) => (
            <button
              key={v.color}
              role="radio"
              aria-checked={props.activeVariant === v.color}
              aria-label={v.color_label}
              type="button"
              onClick={() => props.onVariantPick?.(v.color)}
              style={{
                width: 24, height: 24,
                borderRadius: '50%',
                background: v.color,
                border: `2px solid ${props.activeVariant === v.color ? PALETTE.ink : 'rgba(14,14,16,0.2)'}`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {props.actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={a.onClick}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: `1px solid ${a.destructive ? '#c64545' : PALETTE.ink}`,
              background: 'transparent',
              color: a.destructive ? '#c64545' : PALETTE.ink,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
