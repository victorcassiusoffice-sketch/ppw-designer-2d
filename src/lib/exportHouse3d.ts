import type { Property } from '../store/propertyStore';
import type { OrbitCamera } from '../designer/roomView3d';
import { cleanBulge } from '../designer/arcSegment';
import { designFileName } from '../designer/designFile';

/**
 * The house of a design as a 3D file: glTF for another program, STL for a 3D printer.
 *
 * It is made from what the 3D view draws from, the whole house as the walk through it has it: every storey, the
 * roof, the stairs, the garden, the things in their true size. The heavy parts (the 3D view's own mapper, the
 * geometry maths) are loaded only when a file is asked for.
 */

/** The 3D view's mapper wants a camera; nothing of the solids depends on where it stands. */
const STILL_CAMERA: OrbitCamera = {
  target: { x: 0, y: 0, z: 0 },
  azimuthRad: 0,
  elevationRad: 0.6,
  distanceM: 10,
  fovRad: 0.9,
};

/** The curved walls of a design (format version 2), by the key the 3D solids give a wall. */
export function wallCurvesOf(property: Property): Map<string, number> {
  const curves = new Map<string, number>();
  for (const room of property.rooms ?? [])
    for (const arc of room.wallArcs ?? []) {
      const bulge = cleanBulge(arc.bulge);
      if (bulge !== undefined) curves.set(`wall-${room.id}-${arc.edgeIndex}`, bulge);
    }
  for (const wall of property.walls ?? []) {
    const bulge = cleanBulge(wall.bulge);
    if (bulge !== undefined) curves.set(`fw-${wall.id}`, bulge);
  }
  return curves;
}

export interface HouseModelFile {
  bytes: Uint8Array;
  fileName: string;
  mime: string;
  parts: number;
  triangles: number;
  /** The size of the box round the house in metres: east to west, north to south, bottom to top. */
  sizeM: { x: number; y: number; z: number };
  /** What was left simpler than the design, in words. */
  notes: string[];
}

export async function houseModelFile(
  property: Property,
  format: 'glb' | 'stl',
): Promise<HouseModelFile> {
  const [view, visit, model] = await Promise.all([
    import('../components/RoomView3D'),
    import('../walk/visit'),
    import('../components/three/exportModel'),
  ]);
  const { solids } = visit.prepareWalkVisit(property, (p) =>
    view.sceneFromProperty(p, null, STILL_CAMERA),
  );
  const { parts, notes } = model.exportParts(solids, wallCurvesOf(property));
  const numbers = model.modelNumbers(parts);
  const title = typeof property.name === 'string' && property.name ? property.name : 'House';
  const base = designFileName(property.name).replace(/\.json$/, '');
  return {
    bytes: format === 'glb' ? model.glbBytes(parts, title) : model.stlBytes(parts, title),
    fileName: `${base}.${format}`,
    mime: format === 'glb' ? 'model/gltf-binary' : 'model/stl',
    parts: numbers.parts,
    triangles: numbers.triangles,
    sizeM: numbers.sizeM,
    notes,
  };
}
