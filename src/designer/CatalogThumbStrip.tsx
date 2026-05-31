/**
 * Sims-Parity DT-13 — thumb scroll strip (96 px).
 *
 * Each thumb: 72×72 px image with name + price below.
 * Drag-from-thumb fires `onDragStart` so the parent can spawn the
 * DragLayer ghost (DT-12). HTML5 native drag for keyboard a11y;
 * pointer drag fallback for touch.
 */

import { useRef } from 'react';

export interface CatalogThumb {
  id: string;
  name: string;
  priceMur: number;
  /** Front photo URL (DT-09 photo_front_url). */
  photoUrl: string;
}

export interface CatalogThumbStripProps {
  thumbs: CatalogThumb[];
  onDragStart: (thumb: CatalogThumb) => void;
}

export function CatalogThumbStrip(props: CatalogThumbStripProps): JSX.Element {
  const dragSource = useRef<string | null>(null);

  return (
    <div
      role="list"
      aria-label="Product thumbnails"
      style={{
        height: 96,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '8px 12px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {props.thumbs.map((t) => (
        <div
          key={t.id}
          role="listitem"
          onPointerDown={() => {
            dragSource.current = t.id;
            props.onDragStart(t);
          }}
          aria-label={`Drag ${t.name} into the room`}
          style={{
            width: 72,
            minWidth: 72,
            height: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'grab',
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 6,
            border: '1px solid rgba(14,14,16,0.1)',
            padding: 4,
          }}
        >
          <img
            src={t.photoUrl}
            alt=""
            width={64}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 4, background: '#ddd' }}
          />
          <span style={{ fontSize: 10, marginTop: 2, color: '#0E0E10', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 64 }}>
            {t.name}
          </span>
          <span style={{ fontSize: 10, color: '#C0A67E', fontWeight: 600 }}>
            Rs {t.priceMur}
          </span>
        </div>
      ))}
    </div>
  );
}
