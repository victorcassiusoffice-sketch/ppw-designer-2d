import type { PlanImportShape, PlanImportSource, PlanUnit } from './planImport';

type Pair = { code: number; value: string };
const number = (pairs: Pair[], code: number, fallback = 0): number => {
  const value = pairs.find((p) => p.code === code)?.value;
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid DXF coordinate (group ${code}).`);
  return parsed;
};
const UNITS: Record<number, PlanUnit> = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };

/** ASCII DXF model-space XY entities only. Bulges/blocks/3D curves are never flattened silently. */
export function parsePlanDxf(text: string): PlanImportSource {
  if (text.includes('\0') || text.startsWith('AutoCAD Binary DXF'))
    throw new Error('Use ASCII DXF, not binary DXF.');
  const lines = text
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split(/\r?\n/);
  if (lines.length % 2)
    throw new Error('Incomplete DXF group-code pairs. Export the file again as ASCII DXF.');
  const pairs: Pair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isInteger(code) || code < 0 || code > 1071 || !lines[i].trim())
      throw new Error('Invalid DXF group code.');
    pairs.push({ code, value: lines[i + 1].trim() });
  }
  if (!pairs.some((p) => p.code === 0 && p.value === 'EOF'))
    throw new Error('Incomplete DXF file: EOF marker missing.');
  const shapes: PlanImportShape[] = [],
    skipped = new Map<string, number>();
  const skip = (type: string) => skipped.set(type, (skipped.get(type) ?? 0) + 1);
  let suggestedUnit: PlanUnit | undefined,
    section = '',
    polyline: { pairs: Pair[]; vertices: Pair[][] } | null = null;
  const push = (entity: Pair[], points: { x: number; y: number }[], closed: boolean) => {
    if (number(entity, 67) !== 0 || entity.some((p) => p.code === 410 && p.value !== 'Model')) {
      skip('paper-space entities');
      return;
    }
    if (points.length > 2000 || shapes.length >= 2500)
      throw new Error('This DXF is too detailed. Export only room outlines and wall centre lines.');
    shapes.push({
      id: `dxf-${shapes.length}`,
      layer: entity.find((p) => p.code === 8)?.value.slice(0, 120) || '0',
      points,
      closed,
    });
  };
  const supportedPlane = (entity: Pair[]) =>
    number(entity, 210) === 0 && number(entity, 220) === 0 && number(entity, 230, 1) === 1;
  const finishPolyline = () => {
    if (!polyline) return;
    const flags = number(polyline.pairs, 70);
    if (
      flags & (2 | 4 | 8 | 16 | 64) ||
      !supportedPlane(polyline.pairs) ||
      polyline.vertices.some((v) => number(v, 42) !== 0 || number(v, 30) !== 0) ||
      number(polyline.pairs, 30) !== 0
    )
      skip('curved or 3D polylines');
    else
      push(
        polyline.pairs,
        polyline.vertices.map((v) => ({ x: number(v, 10, NaN), y: -number(v, 20, NaN) })),
        (flags & 1) !== 0,
      );
    polyline = null;
  };
  for (let i = 0; i < pairs.length; ) {
    const pair = pairs[i];
    if (pair.code === 9 && pair.value === '$INSUNITS' && section === 'HEADER')
      suggestedUnit = UNITS[Number(pairs[i + 1]?.value)];
    if (pair.code !== 0) {
      i++;
      continue;
    }
    const type = pair.value;
    let end = i + 1;
    while (end < pairs.length && pairs[end].code !== 0) end++;
    const entity = pairs.slice(i + 1, end);
    i = end;
    if (type === 'SECTION') {
      section = entity.find((p) => p.code === 2)?.value ?? '';
      if (section === 'HEADER') {
        const unitIndex = entity.findIndex((p) => p.code === 9 && p.value === '$INSUNITS');
        if (unitIndex >= 0) suggestedUnit = UNITS[Number(entity[unitIndex + 1]?.value)];
      }
      continue;
    }
    if (type === 'ENDSEC') {
      finishPolyline();
      section = '';
      continue;
    }
    if (section === 'HEADER') {
      const index = entity.findIndex((p) => p.code === 9 && p.value === '$INSUNITS');
      if (index >= 0) suggestedUnit = UNITS[Number(entity[index + 1]?.value)];
    }
    if (section !== 'ENTITIES') continue;
    if (type === 'VERTEX' && polyline) {
      polyline.vertices.push(entity);
      continue;
    }
    if (type === 'SEQEND') {
      finishPolyline();
      continue;
    }
    finishPolyline();
    if (type === 'POLYLINE') {
      polyline = { pairs: entity, vertices: [] };
      continue;
    }
    if (type === 'LINE') {
      if (!supportedPlane(entity) || number(entity, 30) !== 0 || number(entity, 31) !== 0) {
        skip('3D lines');
        continue;
      }
      push(
        entity,
        [
          { x: number(entity, 10, NaN), y: -number(entity, 20, NaN) },
          { x: number(entity, 11, NaN), y: -number(entity, 21, NaN) },
        ],
        false,
      );
    } else if (type === 'LWPOLYLINE') {
      if (
        !supportedPlane(entity) ||
        number(entity, 38) !== 0 ||
        entity.some((p) => p.code === 42 && Number(p.value) !== 0)
      ) {
        skip('curved or elevated polylines');
        continue;
      }
      const points: { x: number; y: number }[] = [];
      for (let j = 0; j < entity.length; j++)
        if (entity[j].code === 10) {
          const x = Number(entity[j].value);
          let y = NaN;
          for (let k = j + 1; k < entity.length && entity[k].code !== 10; k++)
            if (entity[k].code === 20) {
              y = -Number(entity[k].value);
              break;
            }
          points.push({ x, y });
        }
      if (number(entity, 90, points.length) !== points.length)
        throw new Error('DXF polyline vertex count does not match its data.');
      push(entity, points, (number(entity, 70) & 1) !== 0);
    } else skip(type);
  }
  finishPolyline();
  return {
    format: 'dxf',
    name: 'DXF plan',
    shapes,
    suggestedUnit,
    warnings: [...skipped].map(
      ([type, count]) =>
        `${count} ${type} skipped. Export straight XY room outlines or wall centre lines; explode blocks before export.`,
    ),
  };
}
