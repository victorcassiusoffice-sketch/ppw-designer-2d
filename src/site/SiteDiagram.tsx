import { metrics } from './geometry';
import type { GeoSite, XY } from './types';
export function SiteDiagram({ site, envelope }: { site: GeoSite; envelope?: XY[] }) {
  const p = site.polygon,
    xmin = Math.min(...p.map((v) => v.x)),
    ymin = Math.min(...p.map((v) => v.y)),
    width = Math.max(...p.map((v) => v.x)) - xmin,
    height = Math.max(...p.map((v) => v.y)) - ymin,
    pad = Math.max(width, height) * 0.18,
    size = Math.max(width, height),
    m = metrics(p);
  return (
    <svg
      className="site-diagram"
      role="img"
      aria-label={`Plot of ${m.areaM2.toFixed(1)} square metres. North points up. All coordinates are plan metres.`}
      viewBox={`${xmin - pad} ${ymin - pad} ${width + pad * 2} ${height + pad * 2}`}
    >
      <polygon
        points={p.map((v) => `${v.x},${v.y}`).join(' ')}
        fill="#dbebe4"
        stroke="#176c5b"
        strokeWidth={size / 200}
      />
      {envelope && envelope.length > 2 && (
        <polygon
          points={envelope.map((v) => `${v.x},${v.y}`).join(' ')}
          fill="#edb75a55"
          stroke="#b07118"
          strokeWidth={size / 200}
          strokeDasharray={`${size / 60} ${size / 70}`}
        />
      )}
      {p.map((v, i) => {
        const next = p[(i + 1) % p.length];
        return (
          <g key={i}>
            <circle cx={v.x} cy={v.y} r={size / 90} fill="#176c5b" />
            <text x={v.x + size / 60} y={v.y - size / 50} fontSize={size / 24} fill="#143e34">
              {i + 1}
            </text>
            <text
              x={(v.x + next.x) / 2}
              y={(v.y + next.y) / 2 + size / 24}
              textAnchor="middle"
              fontSize={size / 30}
              fill="#284b43"
            >
              {m.sides[i].toFixed(2)} m
            </text>
          </g>
        );
      })}
      <path
        d={`M${xmin + width + pad * 0.5},${ymin + pad * 0.5} v${-pad * 0.65} m${-pad * 0.18},${pad * 0.2} l${pad * 0.18},${-pad * 0.2} l${pad * 0.18},${pad * 0.2}`}
        stroke="#143e34"
        strokeWidth={size / 150}
        fill="none"
      />
      <text
        x={xmin + width + pad * 0.5}
        y={ymin - pad * 0.28}
        fontSize={size / 22}
        textAnchor="middle"
      >
        N
      </text>
    </svg>
  );
}
