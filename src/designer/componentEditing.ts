import { DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import { buildingLevels } from './building';
import {
  appendFace,
  appendWire,
  validComponents,
  detectFace,
  distance3,
  faceLoop,
  rayPlane,
  onFace,
  type BoundaryComponent,
  type Point3,
} from './boundaryModel';
import { indexGeometry, type SceneEdge } from './entitySnapping';
import { roomLevelId, GROUND_LEVEL_ID } from './levels';
import { usePropertyStore, type Property } from '../store/propertyStore';
import {
  beginDrawTransaction,
  endDrawTransaction,
  isDrawTransactionActive,
} from '../store/historyStore';

export function buildingSnapIndex(property: Property, draft: Point3[] = []) {
  const guides: SceneEdge[] = [];
  const levels = buildingLevels(property);
  const addWall = (a: { x: number; y: number }, b: { x: number; y: number }, levelId: string) => {
    const level = levels.find((l) => l.level.id === levelId);
    const z = level?.elevationM ?? 0,
      top = z + (level?.heightM ?? property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M);
    guides.push(
      { a: { ...a, z }, b: { ...b, z } },
      { a: { ...a, z: top }, b: { ...b, z: top } },
      { a: { ...a, z }, b: { ...a, z: top } },
      { a: { ...b, z }, b: { ...b, z: top } },
    );
  };
  for (const room of property.rooms)
    for (let i = 0; i < room.polygon.length; i++)
      addWall(room.polygon[i], room.polygon[(i + 1) % room.polygon.length], roomLevelId(room));
  for (const wall of property.walls ?? []) addWall(wall.a, wall.b, wall.levelId ?? GROUND_LEVEL_ID);
  for (let i = 1; i < draft.length; i++) guides.push({ a: draft[i - 1], b: draft[i] });
  const index = indexGeometry(property.boundaryComponents ?? [], guides);
  if (draft.length === 1) index.vertices.push(draft[0]);
  return index;
}
export function changeComponents(
  label: string,
  transform: (current: BoundaryComponent[]) => BoundaryComponent[],
): void {
  if (isDrawTransactionActive()) throw Error('Finish the active drawing first.');
  const store = usePropertyStore.getState(),
    before = store.property.boundaryComponents ?? [],
    next = transform(before);
  if (next === before) return;
  if (!validComponents(next)) throw Error('The edit would leave an invalid component.');
  beginDrawTransaction(label);
  try {
    store.setBoundaryComponents(next);
  } finally {
    endDrawTransaction();
  }
}
export function commitLoop(points: Point3[], id: string, name: string, closed = true) {
  const nextId = id || crypto.randomUUID();
  changeComponents(closed ? 'Draw measured face' : 'Draw measured edges', (current) => {
    const existing = current.find((c) => c.id === nextId);
    if (id && !existing) throw Error('The selected component was removed.');
    const next = (closed ? appendFace : appendWire)(
      existing ?? {
        id: nextId,
        name: name.trim() || 'Component',
        vertices: [],
        edges: [],
        faces: [],
      },
      points,
    );
    if (name.trim()) next.name = name.trim();
    return existing ? current.map((c) => (c.id === nextId ? next : c)) : [...current, next];
  });
  return nextId;
}
export function componentOnRay(components: BoundaryComponent[], origin: Point3, direction: Point3) {
  let result: BoundaryComponent | undefined,
    min = Infinity;
  for (const c of components)
    for (const refs of c.faces) {
      const face = detectFace(faceLoop(c, refs)),
        p = rayPlane(origin, direction, face.points[0], face.normal);
      if (p && onFace(face, p) && distance3(origin, p) < min) {
        min = distance3(origin, p);
        result = c;
      }
    }
  return result;
}
