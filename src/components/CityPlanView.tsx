import { useEffect, useRef, useState } from 'react';
import {
  cityAssetPolygon,
  cityBounds,
  cityRoadPolygons,
  CITY_ASSET_KINDS,
  CITY_NETWORK_SYSTEMS,
  type CityModel,
  type CityPoint,
} from '../designer/city';

type View = { x: number; y: number; w: number; h: number };
export function CityPlanView({
  model,
  tool,
  selectedId,
  draft,
  onPoint,
  onSelect,
  fitNonce,
  showUtilities,
}: {
  model: CityModel;
  tool: string;
  selectedId: string | null;
  draft: CityPoint[];
  onPoint: (p: CityPoint) => void;
  onSelect: (id: string | null) => void;
  fitNonce: number;
  showUtilities: boolean;
}) {
  const fit = (): View => {
    const b = cityBounds(model);
    return { x: b.minX - 10, y: b.minY - 10, w: b.maxX - b.minX + 20, h: b.maxY - b.minY + 20 };
  };
  const [view, setView] = useState<View>(fit);
  const svg = useRef<SVGSVGElement>(null),
    current = useRef(view),
    currentFit = useRef(fit);
  current.current = view;
  currentFit.current = fit;
  const pointers = useRef(new Map<number, CityPoint>());
  const drag = useRef<{ x: number; y: number; view: View; scale: number; moved: boolean } | null>(
    null,
  );
  const pinch = useRef<{
    distance: number;
    view: View;
    anchor: CityPoint;
    sx: number;
    sy: number;
  } | null>(null);
  const point = (x: number, y: number): CityPoint => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };
  useEffect(() => {
    setView(currentFit.current());
  }, [fitNonce]);
  useEffect(() => {
    const host = svg.current;
    if (!host) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = current.current,
        anchor = point(e.clientX, e.clientY);
      const factor = Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * 0.002);
      const w = Math.min(22000, Math.max(5, v.w * factor)),
        h = (v.h * w) / v.w;
      setView({
        x: anchor.x - ((anchor.x - v.x) * w) / v.w,
        y: anchor.y - ((anchor.y - v.y) * h) / v.h,
        w,
        h,
      });
    };
    host.addEventListener('wheel', wheel, { passive: false });
    return () => host.removeEventListener('wheel', wheel);
  }, []);
  const points = (p: CityPoint[]) => p.map((v) => `${v.x},${v.y}`).join(' ');
  const scale = view.w / 900;
  return (
    <svg
      ref={svg}
      className={`city-map ${tool === 'select' ? '' : 'city-map--draw'}`}
      data-testid="city-plan"
      role="img"
      aria-label="Measured city site plan"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      onPointerDown={(e) => {
        svg.current?.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()],
            mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          pinch.current = {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            view: current.current,
            anchor: point(mx, my),
            sx: mx,
            sy: my,
          };
          drag.current = null;
        } else
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            view: current.current,
            scale: svg.current?.getScreenCTM()?.a ?? 1,
            moved: false,
          };
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinch.current) {
          const [a, b] = [...pointers.current.values()],
            seed = pinch.current;
          const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
          const w = Math.max(5, Math.min(22000, (seed.view.w * seed.distance) / distance)),
            ratio = w / seed.view.w;
          const ct = svg.current?.getBoundingClientRect();
          const pixelScale = ct ? Math.min(ct.width / w, ct.height / (seed.view.h * ratio)) : 1;
          setView({
            x:
              seed.anchor.x -
              (seed.anchor.x - seed.view.x) * ratio -
              ((a.x + b.x) / 2 - seed.sx) / pixelScale,
            y:
              seed.anchor.y -
              (seed.anchor.y - seed.view.y) * ratio -
              ((a.y + b.y) / 2 - seed.sy) / pixelScale,
            w,
            h: seed.view.h * ratio,
          });
        } else if (drag.current && tool === 'select') {
          const d = drag.current,
            dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (Math.hypot(dx, dy) > 5) d.moved = true;
          if (d.moved)
            setView({ ...d.view, x: d.view.x - dx / d.scale, y: d.view.y - dy / d.scale });
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current,
          wasPinch = !!pinch.current;
        pointers.current.delete(e.pointerId);
        if (!pointers.current.size) pinch.current = null;
        if (!wasPinch && d && !d.moved) {
          if (tool !== 'select') {
            const p = point(e.clientX, e.clientY);
            onPoint({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 });
          } else {
            const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-city-id]');
            onSelect(hit?.getAttribute('data-city-id') ?? null);
          }
        }
        drag.current = null;
      }}
      onPointerCancel={() => {
        pointers.current.clear();
        pinch.current = null;
        drag.current = null;
      }}
    >
      <defs>
        <pattern id="city-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M10 0H0V10"
            fill="none"
            stroke="#638274"
            strokeWidth={0.25 * scale}
            opacity=".22"
          />
        </pattern>
      </defs>
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#d4ded0" />
      <rect
        x={model.site.originM.x}
        y={model.site.originM.y}
        width={model.site.widthM}
        height={model.site.lengthM}
        rx="1"
        fill="#bdcfb2"
        stroke="#77917a"
        strokeWidth={scale}
      />
      <rect
        x={model.site.originM.x}
        y={model.site.originM.y}
        width={model.site.widthM}
        height={model.site.lengthM}
        fill="url(#city-grid)"
      />
      {model.enabled &&
        model.roads.map((road) => (
          <g key={road.id} data-city-id={road.id}>
            {cityRoadPolygons(road).map((p, i) => (
              <polygon
                key={i}
                points={points(p)}
                fill={road.presetId === 'cycle-path' ? '#bfb39a' : '#7a8683'}
                stroke={selectedId === road.id ? '#effcf0' : '#abb7af'}
                strokeWidth={scale}
              />
            ))}
            <polyline
              points={points(road.points)}
              fill="none"
              stroke="#e1dfca"
              strokeWidth={0.4}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          </g>
        ))}
      {model.enabled &&
        model.assets.map((a) => (
          <g key={a.id} data-city-id={a.id}>
            <polygon
              points={points(cityAssetPolygon(a))}
              fill={CITY_ASSET_KINDS.find((k) => k.id === a.kind)?.colour ?? '#c3c8bb'}
              stroke={selectedId === a.id ? '#fcfff0' : '#567567'}
              strokeWidth={scale * (selectedId === a.id ? 3 : 1)}
            />
            {a.kind === 'solar-light' && (
              <circle
                cx={a.x}
                cy={a.y}
                r={Math.max(0.8, scale * 5)}
                fill="#f1d297"
                stroke="#736b47"
                strokeWidth={scale}
              />
            )}
            {a.kind === 'pv-array' && (
              <path
                transform={`rotate(${a.rotation} ${a.x} ${a.y})`}
                d={`M${a.x - a.widthM / 2} ${a.y}h${a.widthM}M${a.x} ${a.y - a.lengthM / 2}v${a.lengthM}`}
                stroke="#c1d7df"
                strokeWidth={0.2}
                pointerEvents="none"
              />
            )}
            {(a.widthM > 10 || a.id === selectedId) && (
              <text
                x={a.x}
                y={a.y + Math.max(a.lengthM / 2 + 2, 3 * scale)}
                textAnchor="middle"
                fill="#304a40"
                fontSize={Math.max(2, 10 * scale)}
                pointerEvents="none"
              >
                {a.name}
              </text>
            )}
          </g>
        ))}
      {model.enabled &&
        showUtilities &&
        model.networks.map((n) => (
          <g key={n.id} data-city-id={n.id}>
            <polyline
              points={points(n.points)}
              fill="none"
              stroke={CITY_NETWORK_SYSTEMS.find((s) => s.id === n.system)?.colour}
              strokeWidth={Math.max(n.diameterMm / 1000, scale * (selectedId === n.id ? 5 : 3))}
              strokeDasharray={n.system === 'fibre' ? `${scale * 5} ${scale * 3}` : undefined}
            />
            {n.points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={scale * 3}
                fill="#eff3e9"
                stroke={CITY_NETWORK_SYSTEMS.find((s) => s.id === n.system)?.colour}
                strokeWidth={scale}
              />
            ))}
          </g>
        ))}
      {draft.length > 0 && (
        <g pointerEvents="none">
          <polyline
            points={points(draft)}
            fill="none"
            stroke="#efad41"
            strokeWidth={scale * 3}
            strokeDasharray={`${scale * 5} ${scale * 2}`}
          />
          {draft.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={scale * 4}
              fill="#fff0c5"
              stroke="#b77b2b"
              strokeWidth={scale}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
