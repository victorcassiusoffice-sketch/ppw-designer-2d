import type { Property } from '../store/propertyStore';
import type { OrbitCamera } from '../designer/roomView3d';
import { cleanBulge } from '../designer/arcSegment';
import { designFileName } from '../designer/designFile';
import { isRoofLevel, levelsOf } from '../designer/levels';

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

/** The words of the sheets, in the language of the person who saves them. `{name}` is the name of a storey. */
export interface ViewSheetWords {
  fromSouthWest: string;
  fromNorthEast: string;
  storey: string;
  note: string;
}

export interface HouseViewsFile {
  blob: Blob;
  fileName: string;
  sheets: number;
}

const SHEET_WIDTH = 1500;
const SHEET_HEIGHT = 1000;

/**
 * The house as 3D view sheets in a PDF: the whole house from two sides, then each storey by itself from above,
 * without what is over it. No order, no customer and no price is on these sheets.
 */
export async function houseViewsPdf(
  property: Property,
  words: ViewSheetWords,
): Promise<HouseViewsFile> {
  const [view, visit, model, sheet, pdf] = await Promise.all([
    import('../components/RoomView3D'),
    import('../walk/visit'),
    import('../components/three/exportModel'),
    import('./view3dSheet'),
    import('./planPdf'),
  ]);
  const { solids } = visit.prepareWalkVisit(property, (p) =>
    view.sceneFromProperty(p, null, STILL_CAMERA),
  );
  const { parts } = model.exportParts(solids, wallCurvesOf(property));
  // A PNG where there is a canvas to make one (a browser): a far smaller file than the plain points.
  const picture = (image: { data: Uint8ClampedArray; width: number; height: number }) => {
    if (typeof document === 'undefined') return image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) return image;
    const pixels = context.createImageData(image.width, image.height);
    pixels.data.set(image.data);
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  };
  const page = (title: string, shown: typeof parts, fromDeg: number, aboveDeg: number) => {
    const image = sheet.drawSheet(shown, { fromDeg, aboveDeg }, SHEET_WIDTH, SHEET_HEIGHT);
    return {
      title,
      note: words.note,
      image: picture(image),
      widthPx: image.width,
      heightPx: image.height,
    };
  };
  const sheets = [
    page(words.fromSouthWest, parts, 225, 32),
    page(words.fromNorthEast, parts, 45, 32),
  ];
  for (const level of levelsOf(property)) {
    if (isRoofLevel(level)) continue;
    const shown = parts.filter((part) => part.levelId === level.id && part.kind !== 'roof');
    if (shown.length === 0) continue;
    sheets.push(page(words.storey.replace('{name}', level.name), shown, 225, 58));
  }
  const base = designFileName(property.name).replace(/\.json$/, '');
  return {
    blob: pdf.generateViewsPdf(sheets),
    fileName: `${base}-3d-views.pdf`,
    sheets: sheets.length,
  };
}
