import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import './pilot.css';
import { request } from './remote';
import { visitGeometry } from './buildRecord';
import { normaliseLoadedProperty, type Property } from '../store/propertyStore';
import { prepareWalkVisit } from '../walk/visit';
import { sceneFromProperty } from '../components/RoomView3D';
import { ThreeStage } from '../components/three/ThreeStage';
import type { OrbitCamera } from '../designer/roomView3d';
import { levelsOf } from '../designer/levels';
const Walk = lazy(() => import('../walk/WalkMode'));
function cameraFor(p: Property): OrbitCamera {
  const pts = p.rooms.flatMap((r) => r.polygon);
  for (const w of p.walls ?? []) pts.push(w.a, w.b);
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  const range = (values: number[]) =>
    values.length ? [Math.min(...values), Math.max(...values)] : [-3, 3];
  const [x, X] = range(xs),
    [y, Y] = range(ys);
  return {
    target: { x: (x + X) / 2, y: (y + Y) / 2, z: 1.2 },
    distanceM: Math.max(8, Math.hypot(X - x, Y - y) * 1.5),
    azimuthRad: 0.7,
    elevationRad: 0.63,
    fovRad: Math.PI / 3,
  };
}
export default function PilotVisit({ site }: { site: string }) {
  const { slug = '' } = useParams(),
    [qs, setQuery] = useSearchParams(),
    walk = qs.get('view') === 'walk',
    [data, set] = useState<{ site: { id: string; name: string }; property: Property }>(),
    [error, say] = useState(''),
    [angle, turn] = useState(0),
    [zoom, scale] = useState(1),
    [size, resize] = useState({ width: 600, height: 440 }),
    box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let current = true;
    set(undefined);
    say('');
    request<{ site: { id: string; name: string }; property: unknown }>(
      '/' + slug + '/site-plan/' + site,
    )
      .then((r) => {
        const p = normaliseLoadedProperty(visitGeometry(r.property) as unknown as Property);
        if (current) set({ site: r.site, property: p });
      })
      .catch((e) => {
        if (current) say(e.message);
      });
    return () => {
      current = false;
    };
  }, [slug, site]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) =>
      resize({
        width: Math.max(1, Math.floor(e.contentRect.width)),
        height: Math.max(1, Math.floor(e.contentRect.height)),
      }),
    );
    o.observe(el);
    return () => o.disconnect();
  }, [data, walk]);
  const initial = useMemo(() => (data ? cameraFor(data.property) : undefined), [data]),
    visit = useMemo(
      () =>
        data && initial
          ? prepareWalkVisit(data.property, (p) => sceneFromProperty(p, null, initial))
          : undefined,
      [data, initial],
    );
  const mode = (view: string) => setQuery({ visit: site, view }, { replace: true }),
    wall = data ? { slug, site, plan: data.property.id } : undefined;
  return (
    <main
      className="pilot-visit"
      style={{ maxWidth: 1280, margin: 'auto', padding: 'clamp(8px,2vw,22px)' }}
    >
      <Link to={'/pilots/' + slug}>Back to pilot</Link>
      <h1>{data?.site.name ?? 'Shared plan'}</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data || !initial || !visit ? (
        <p role="status">Opening shared plan…</p>
      ) : (
        <>
          <nav aria-label="View shared plan">
            <button aria-pressed={!walk} onClick={() => mode('house')}>
              House
            </button>
            <button aria-pressed={walk} onClick={() => mode('walk')}>
              Walk
            </button>
          </nav>
          {walk ? (
            <Suspense fallback={<p>Opening Walk…</p>}>
              <Walk
                readOnlyProperty={data.property}
                pilotWall={wall}
                levels={levelsOf(data.property)}
                prepareVisit={() => visit}
                onClose={() => mode('house')}
              />
            </Suspense>
          ) : (
            <>
              <div
                ref={box}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'clamp(280px,64dvh,740px)',
                  overflow: 'hidden',
                  borderRadius: 12,
                }}
              >
                <ThreeStage
                  solids={visit.solids}
                  pilotWall={wall}
                  terrainCuts={data.property.terrainCuts}
                  boundaryComponents={data.property.boundaryComponents}
                  foundation={data.property.foundation}
                  shade={data.property.shade}
                  camera={{
                    ...initial,
                    azimuthRad: initial.azimuthRad + angle,
                    distanceM: initial.distanceM * zoom,
                  }}
                  width={size.width}
                  height={size.height}
                  hover={null}
                  wallView="up"
                  presentation="architectural"
                  onFailed={() => say('This browser could not display the 3D plan.')}
                />
              </div>
              <div>
                <button onClick={() => turn((a) => a - 0.35)}>Turn left</button>
                <button onClick={() => turn((a) => a + 0.35)}>Turn right</button>
                <button onClick={() => scale((z) => Math.max(0.3, z * 0.8))}>Zoom in</button>
                <button onClick={() => scale((z) => Math.min(3, z * 1.25))}>Zoom out</button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
