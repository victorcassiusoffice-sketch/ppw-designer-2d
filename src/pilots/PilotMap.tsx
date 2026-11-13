import { useRef, useState } from 'react';
import { islands } from './mauritius';
import { project } from './projection';
import { kinds, type Site } from './contract';
const paths = Object.entries(islands).map(([name, points]) => ({
  name,
  d: 'M' + points.map(([lon, lat]) => project(lon, lat).join(',')).join(' L') + ' Z',
}));
const pinColors = ['#aa4c32', '#385640', '#56478b', '#386980'];
export default function PilotMap({
  sites,
  onPick,
}: {
  sites: Site[];
  onPick?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [center, setCenter] = useState([360, 170]);
  const contacts = useRef(new Map<number, [number, number]>()),
    previous = useRef(0),
    svg = useRef<SVGSVGElement>(null);
  function scale(value: number) {
    setZoom(Math.max(1, Math.min(4, value)));
    if (value <= 1) setCenter([360, 170]);
  }
  const width = 720 / zoom,
    height = 340 / zoom,
    left = Math.max(0, Math.min(720 - width, center[0] - width / 2)),
    top = Math.max(0, Math.min(340 - height, center[1] - height / 2));
  const release = (id: number) => {
    contacts.current.delete(id);
    previous.current = 0;
  };
  return (
    <div className="pilot-atlas">
      <svg
        ref={svg}
        role="group"
        aria-label="Mauritius and Rodrigues site map"
        viewBox={[left, top, width, height].join(' ')}
        style={{ touchAction: onPick ? 'none' : undefined }}
        onPointerDown={(e) => {
          if (!onPick) return;
          contacts.current.set(e.pointerId, [e.clientX, e.clientY]);
          if (e.target === svg.current) e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => release(e.pointerId)}
        onPointerCancel={(e) => release(e.pointerId)}
        onPointerLeave={(e) => release(e.pointerId)}
        onPointerMove={(e) => {
          const last = contacts.current.get(e.pointerId);
          if (!last) return;
          contacts.current.set(e.pointerId, [e.clientX, e.clientY]);
          const pts = [...contacts.current.values()];
          if (pts.length === 2) {
            const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
            if (previous.current) scale((zoom * d) / previous.current);
            previous.current = d;
          } else if (zoom > 1) {
            const k = width / e.currentTarget.clientWidth;
            setCenter([
              left + width / 2 - (e.clientX - last[0]) * k,
              top + height / 2 - (e.clientY - last[1]) * k,
            ]);
          }
        }}
      >
        <rect width="720" height="340" fill="#d6e8e8" />
        <rect x="500" y="50" width="200" height="220" rx="10" fill="#e1eeeb" stroke="#8eafac" />
        {paths.map((p) => (
          <path key={p.name} d={p.d} fill="#afc69c" stroke="#486958" strokeWidth="2" />
        ))}
        <g fill="#294c50" fontSize="16" fontWeight="600">
          <text x="22" y="28">
            N ↑
          </text>
          <text x="28" y="318">
            Mauritius
          </text>
          <text x="525" y="250">
            Rodrigues
          </text>
        </g>
        {sites.map((s, i) => {
          const [x, y] = project(s.lon, s.lat);
          return (
            <g
              key={s.id}
              transform={'translate(' + x + ' ' + y + ')'}
              role={onPick ? 'button' : 'img'}
              aria-label={s.name}
              tabIndex={onPick ? 0 : undefined}
              onClick={() => onPick?.(s.id)}
              onKeyDown={(e) => {
                if (onPick && ['Enter', ' '].includes(e.key)) {
                  e.preventDefault();
                  onPick(s.id);
                }
              }}
            >
              <circle
                r="17"
                fill={pinColors[kinds.indexOf(s.kind)]}
                stroke="#fff"
                strokeWidth="2"
              />
              <text y="6" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {onPick && (
        <div className="pilot-map-tools">
          <button aria-label="Zoom out" onClick={() => scale(zoom / 1.35)}>
            −
          </button>
          <button aria-label="Zoom in" onClick={() => scale(zoom * 1.35)}>
            +
          </button>
          <button onClick={() => scale(1)}>Reset map</button>
        </div>
      )}
      <div className="pilot-legend">
        {kinds
          .filter((k) => sites.some((s) => s.kind === k))
          .map((k) => (
            <span key={k}>
              <i style={{ background: pinColors[kinds.indexOf(k)] }} />
              {k}
            </span>
          ))}
      </div>
      {onPick && (
        <div className="pilot-map-index">
          {sites.map((s, i) => (
            <button key={s.id} onClick={() => onPick(s.id)}>
              {i + 1} · {s.place}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
