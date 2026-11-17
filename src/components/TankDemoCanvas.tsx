import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Line, Rect, Text, Image as KonvaImage } from 'react-konva';
import type { WallView } from '../store/designerUIStore';
import type { Property } from '../store/propertyStore';
import { getProductById } from '../data/products';
import type { Product } from '../data/products.schema';
import { buildingSolids } from '../designer/buildingScene';
import { sceneFromProperty } from '../designer/propertyScene';
import { fitArchitecturalCamera } from '../designer/architecturalCamera';
import { type OrbitCamera } from '../designer/roomView3d';
import { polygonBounds } from '../lib/geometry';
import { buildingLevels } from '../designer/building';
import { placedTanks } from '../designer/tankNetwork';
import { visibleServiceRuns } from '../designer/serviceScene';
import { ALL_DISCIPLINES } from '../designer/disciplineVisibility';
import type { ItemSolid } from '../designer/roomSolids';
import { usePlanModelImage } from '../hooks/usePlanModelImage';
import { BuildingPlanLayer } from './BuildingPlanLayer';
import { loadThreeStage } from './threeStageLoader';
import type { ThreeStageHandle } from './three/ThreeStage';

const ThreeStage = lazy(loadThreeStage);
const geometryCamera: OrbitCamera = {
  target: { x: 0, y: 0, z: 0 },
  azimuthRad: 0,
  elevationRad: 0.7,
  distanceM: 20,
  fovRad: 0.9,
};

function PlanProduct({
  product,
  item,
  px,
  selected,
  editable,
  onSelect,
  onMove,
}: {
  product: Product;
  item: ItemSolid;
  px: number;
  selected: boolean;
  editable: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => boolean;
}) {
  const art = usePlanModelImage(product);
  const w = item.x1 - item.x0,
    h = item.y1 - item.y0;
  return (
    <Group
      x={item.x0 * px}
      y={item.y0 * px}
      draggable={editable}
      name={editable ? 'demo-tank-' + item.instanceId : undefined}
      onClick={() => editable && onSelect(item.instanceId)}
      onTap={() => editable && onSelect(item.instanceId)}
      onDragStart={() => onSelect(item.instanceId)}
      onDragEnd={(e) => {
        if (!onMove(item.instanceId, e.target.x() / px, e.target.y() / px))
          e.target.position({ x: item.x0 * px, y: item.y0 * px });
      }}
    >
      <Rect
        width={w * px}
        height={h * px}
        fill={art ? 'transparent' : item.hex}
        cornerRadius={editable ? (Math.min(w, h) * px) / 2 : 2}
        stroke={selected ? '#006e78' : editable ? '#66877c' : '#8a8e86'}
        strokeWidth={selected ? 3 : 1}
      />
      <Group x={(w * px) / 2} y={(h * px) / 2} rotation={item.rotationDeg} listening={false}>
        {art && (
          <KonvaImage
            image={art}
            x={(-item.lengthM * px) / 2}
            y={(-item.widthM * px) / 2}
            width={item.lengthM * px}
            height={item.widthM * px}
          />
        )}
      </Group>
      {editable && (
        <Text
          text={product.name.match(/[\d,]+\s*L/)?.[0] ?? 'Tank'}
          y={h * px + 5}
          width={w * px}
          fontSize={11}
          fontStyle="bold"
          fill="#12474b"
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
}

export default function TankDemoCanvas({
  property,
  view,
  floor,
  selected,
  placing,
  onSelect,
  onMove,
  onPlace,
}: {
  property: Property;
  view: 'plan' | '3d';
  floor: string;
  selected: string;
  placing: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => boolean;
  onPlace: (x: number, y: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<ThreeStageHandle>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [camera, setCamera] = useState<OrbitCamera | null>(null),
    [wallView, setWallView] = useState<WallView>('up');
  const [roof, setRoof] = useState(true),
    [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const pointer = useRef<{ x: number; y: number; camera: OrbitCamera; moved: boolean } | null>(
    null,
  );
  const activeFloor = floor === 'all' ? 'ground' : floor;
  const model = useMemo(
    () => ({ ...property, activeLevelId: activeFloor }),
    [property, activeFloor],
  );
  const bounds = useMemo(
    () => polygonBounds(property.rooms.flatMap((r) => r.polygon)),
    [property.rooms],
  );
  const solids = useMemo(
    () =>
      buildingSolids(
        model,
        (p) => sceneFromProperty(p, null, geometryCamera),
        floor === 'all' && view === '3d' ? 'building' : 'floor',
        roof,
      ),
    [model, floor, view, roof],
  );
  const runs = useMemo(
    () =>
      visibleServiceRuns(
        model,
        activeFloor,
        floor === 'all' && view === '3d' ? 'building' : 'floor',
        ALL_DISCIPLINES,
      ),
    [model, activeFloor, floor, view],
  );
  const tanks = placedTanks(property),
    tankIds = new Set(tanks.map((t) => t.instanceId));
  const height = Math.max(
    3,
    ...buildingLevels(property).map(
      (l) => l.elevationM + (l.level.kind === 'roof' ? 1.7 : l.heightM),
    ),
  );
  const fit = () =>
    setCamera(
      fitArchitecturalCamera(bounds, height, size.width / size.height, {
        azimuthRad: Math.PI / 5,
        elevationRad: (24 * Math.PI) / 180,
      }),
    );
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(100, rect.width), height: Math.max(100, rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setCamera(
      fitArchitecturalCamera(bounds, height, size.width / size.height, {
        azimuthRad: Math.PI / 5,
        elevationRad: (24 * Math.PI) / 180,
      }),
    );
  }, [size.width, size.height, height, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]);
  const scale = Math.min(
    (size.width - 70) / (bounds.maxX - bounds.minX),
    (size.height - 80) / (bounds.maxY - bounds.minY),
  );
  const origin = {
    x: (size.width - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale,
    y: (size.height - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale,
  };
  return (
    <section className="tank-demo-viewport">
      <div className="tank-demo-canvas-controls">
        {view === '3d' ? (
          <>
            <select
              aria-label="Wall display"
              value={wallView}
              onChange={(e) => setWallView(e.target.value as WallView)}
            >
              <option value="cutaway">Cutaway walls</option>
              <option value="up">Full walls</option>
              <option value="down">Walls down</option>
            </select>
            <label>
              <input type="checkbox" checked={roof} onChange={(e) => setRoof(e.target.checked)} />{' '}
              Show roof
            </label>
            <button onClick={fit}>Fit house</button>
            <button
              aria-label="Zoom in"
              onClick={() =>
                setCamera((c) => c && { ...c, distanceM: Math.max(3, c.distanceM * 0.85) })
              }
            >
              ＋
            </button>
            <button
              aria-label="Zoom out"
              onClick={() =>
                setCamera((c) => c && { ...c, distanceM: Math.min(80, c.distanceM / 0.85) })
              }
            >
              −
            </button>
          </>
        ) : (
          <span>
            {placing
              ? 'Tap inside the service terrace to place the tank.'
              : 'Select or drag a tank. Positions snap to 5 cm.'}
          </span>
        )}
      </div>
      <div
        ref={host}
        className={'tank-demo-canvas ' + (view === '3d' ? 'is-3d' : '')}
        aria-label={
          view === '3d' ? 'Interactive three-dimensional house' : 'Interactive house floor plan'
        }
        data-view={view}
        data-ready={view === 'plan' || ready}
        onPointerDown={(e) => {
          if (view !== '3d' || !camera) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer.current = { x: e.clientX, y: e.clientY, camera, moved: false };
        }}
        onPointerMove={(e) => {
          const p = pointer.current;
          if (view !== '3d' || !p) return;
          const dx = e.clientX - p.x,
            dy = e.clientY - p.y;
          p.moved ||= Math.hypot(dx, dy) > 4;
          setCamera({
            ...p.camera,
            azimuthRad: p.camera.azimuthRad - dx * 0.006,
            elevationRad: Math.max(0.08, Math.min(1.48, p.camera.elevationRad + dy * 0.006)),
          });
        }}
        onPointerUp={(e) => {
          const p = pointer.current;
          pointer.current = null;
          if (view !== '3d' || !p || p.moved) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = stage.current?.hitItem(e.clientX - rect.left, e.clientY - rect.top);
          if (hit && tankIds.has(hit.instanceId)) onSelect(hit.instanceId);
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onWheel={(e) => {
          if (view !== '3d') return;
          setCamera(
            (c) =>
              c && {
                ...c,
                distanceM: Math.min(80, Math.max(3, c.distanceM * Math.exp(e.deltaY * 0.001))),
              },
          );
        }}
      >
        {view === '3d' && !failed && camera ? (
          <Suspense fallback={<p className="tank-demo-loading">Opening house…</p>}>
            <ThreeStage
              ref={stage}
              solids={solids}
              serviceRuns={runs}
              camera={camera}
              width={size.width}
              height={size.height}
              hover={null}
              selectedInstanceId={selected}
              presentation="architectural"
              wallView={wallView}
              groundVisible={true}
              canvasBackground="#e4ece7"
              onReady={() => setReady(true)}
              onFailed={() => setFailed(true)}
            />
          </Suspense>
        ) : view === '3d' ? (
          <p className="tank-demo-loading">
            3D is unavailable on this device. Use 2D Plan to edit the installation.
          </p>
        ) : (
          <Stage
            width={size.width}
            height={size.height}
            onClick={(e) => {
              if (!placing) return;
              const point = e.target.getStage()?.getPointerPosition();
              if (point) onPlace((point.x - origin.x) / scale, (point.y - origin.y) / scale);
            }}
            onTap={(e) => {
              if (!placing) return;
              const point = e.target.getStage()?.getPointerPosition();
              if (point) onPlace((point.x - origin.x) / scale, (point.y - origin.y) / scale);
            }}
          >
            <Layer>
              <Group x={origin.x} y={origin.y}>
                {solids.floors.map((f) => (
                  <Group key={f.key} listening={false}>
                    <Line
                      points={f.polygon.flatMap((p) => [p.x * scale, p.y * scale])}
                      closed
                      fill={f.hex || '#f1ecdf'}
                      stroke="#c2c4b8"
                      strokeWidth={1}
                    />
                    <Text
                      x={polygonBounds(f.polygon).minX * scale + 8}
                      y={polygonBounds(f.polygon).minY * scale + 9}
                      text={
                        activeFloor === 'roof'
                          ? ''
                          : (property.rooms.find((r) => r.id === f.roomId)?.name ?? '')
                      }
                      fontSize={11}
                      fill="#667368"
                    />
                  </Group>
                ))}
                {solids.walls
                  .filter((w) => !w.renderDuplicateOf)
                  .map((w) => {
                    const ux = (w.b.x - w.a.x) / w.lengthM,
                      uy = (w.b.y - w.a.y) / w.lengthM;
                    const gaps = [...w.openings].sort((a, b) => a.t0M - b.t0M);
                    const segments: [number, number][] = [];
                    let end = 0;
                    for (const o of gaps) {
                      if (o.t0M > end) segments.push([end, o.t0M]);
                      end = Math.max(end, o.t1M);
                    }
                    if (end < w.lengthM) segments.push([end, w.lengthM]);
                    return (
                      <Group key={w.key} listening={false}>
                        {segments.map(([a, b], i) => (
                          <Line
                            key={i}
                            points={[
                              (w.a.x + ux * a) * scale,
                              (w.a.y + uy * a) * scale,
                              (w.a.x + ux * b) * scale,
                              (w.a.y + uy * b) * scale,
                            ]}
                            stroke="#677567"
                            strokeWidth={Math.max(3, w.thicknessM * scale)}
                          />
                        ))}
                        {gaps.map((o, i) => (
                          <Line
                            key={i}
                            points={[
                              (w.a.x + ux * o.t0M) * scale,
                              (w.a.y + uy * o.t0M) * scale,
                              (w.a.x + ux * o.t1M) * scale,
                              (w.a.y + uy * o.t1M) * scale,
                            ]}
                            stroke={o.kind === 'window' ? '#6da1af' : '#b59c72'}
                            strokeWidth={o.kind === 'window' ? 3 : 1}
                            dash={o.kind === 'window' ? undefined : [4, 3]}
                          />
                        ))}
                      </Group>
                    );
                  })}
                <BuildingPlanLayer
                  property={property}
                  activeLevelId={activeFloor}
                  pxPerMetre={scale}
                  scale={1}
                />
                {runs.map((run) => (
                  <Line
                    key={run.id}
                    points={run.points.flatMap((p) => [p.x * scale, p.y * scale])}
                    stroke="#0085a0"
                    strokeWidth={Math.max(2, (run.diameterMm / 1000) * scale)}
                    lineJoin="round"
                    listening={false}
                  />
                ))}
                {solids.items.map((item) => {
                  const product = item.productId && getProductById(item.productId);
                  return (
                    product && (
                      <PlanProduct
                        key={item.instanceId}
                        item={item}
                        product={product}
                        px={scale}
                        selected={item.instanceId === selected}
                        editable={!placing && tankIds.has(item.instanceId)}
                        onSelect={onSelect}
                        onMove={onMove}
                      />
                    )
                  );
                })}
                <Text
                  x={bounds.minX * scale}
                  y={bounds.maxY * scale + 20}
                  width={(bounds.maxX - bounds.minX) * scale}
                  align="center"
                  text={(bounds.maxX - bounds.minX).toFixed(2) + ' m'}
                  fill="#53665c"
                  fontSize={12}
                />
              </Group>
            </Layer>
          </Stage>
        )}
      </div>
      <p className="tank-demo-gesture">
        {view === '3d'
          ? 'Drag to orbit · scroll or use ＋ / − to zoom · tap a tank to select'
          : 'The house, tanks and pipes use the same dimensions in plan and 3D.'}
      </p>
    </section>
  );
}
