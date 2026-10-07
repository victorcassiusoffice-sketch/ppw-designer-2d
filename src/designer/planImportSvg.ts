import type { Vertex } from '../lib/geometry';
import type { PlanImportShape, PlanImportSource } from './planImport';

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
function numbers(value: string): number[] {
  // SVG permits adjacent signed coordinates, e.g. "10-20".
  const tokens = value.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  if (value.replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g, '').replace(/[\s,]/g, ''))
    throw new Error('Unsupported SVG coordinate or transform.');
  return tokens.map(Number);
}
function product(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function transform(value: string): Matrix {
  let matrix: Matrix = IDENTITY;
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  if (value.replace(pattern, '').trim()) throw new Error('Unsupported SVG transform.');
  for (const match of value.matchAll(pattern)) {
    const v = numbers(match[2]);
    let m: Matrix;
    if (match[1] === 'matrix' && v.length === 6) m = v as Matrix;
    else if (match[1] === 'translate' && (v.length === 1 || v.length === 2))
      m = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (match[1] === 'scale' && (v.length === 1 || v.length === 2))
      m = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (match[1] === 'rotate' && (v.length === 1 || v.length === 3)) {
      const angle = (v[0] * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle),
        x = v[1] ?? 0,
        y = v[2] ?? 0;
      m = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
    } else if ((match[1] === 'skewX' || match[1] === 'skewY') && v.length === 1) {
      const tan = Math.tan((v[0] * Math.PI) / 180);
      m = match[1] === 'skewX' ? [1, 0, tan, 1, 0, 0] : [1, tan, 0, 1, 0, 0];
    } else throw new Error('Flatten unsupported SVG transforms before exporting.');
    matrix = product(matrix, m);
  }
  if (
    matrix.some((v) => !Number.isFinite(v)) ||
    Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) < 1e-12
  )
    throw new Error('The SVG contains a collapsed or invalid transform.');
  return matrix;
}
function point(p: Vertex, m: Matrix): Vertex {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
function attribute(node: Element, name: string, fallback = 0): number {
  const value = node.getAttribute(name);
  if (value === null) return fallback;
  if (!numeric.test(value.trim()))
    throw new Error(
      `Use plain drawing units for SVG ${name}; flatten percentage or CSS coordinates before export.`,
    );
  return Number(value);
}
/** Linear path subsets only. Curves and arcs are reported, never changed into chords. */
function paths(d: string): { points: Vertex[]; closed: boolean }[] {
  if (/[a-cf-gi-kn-uw-y]/i.test(d.replace(/[eE][+-]?\d+/g, ''))) throw new Error('curved paths');
  const tokens = d.match(/[MLHVZmlhvz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  if (
    d.replace(/[MLHVZmlhvz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g, '').replace(/[\s,]/g, '')
  )
    throw new Error('unsupported paths');
  let i = 0,
    command = '',
    position: Vertex = { x: 0, y: 0 },
    current: Vertex[] = [];
  const out: { points: Vertex[]; closed: boolean }[] = [];
  const read = () => {
    if (i >= tokens.length || !numeric.test(tokens[i])) throw new Error('incomplete paths');
    return Number(tokens[i++]);
  };
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    if (!command) throw new Error('incomplete paths');
    const upper = command.toUpperCase(),
      relative = command !== upper;
    if (upper === 'Z') {
      if (current.length) {
        out.push({ points: current, closed: true });
        position = current[0];
        current = [];
      }
      command = '';
      continue;
    }
    if (upper === 'M' || upper === 'L') {
      const x = read(),
        y = read();
      position = { x: x + (relative ? position.x : 0), y: y + (relative ? position.y : 0) };
      if (upper === 'M') {
        if (current.length) out.push({ points: current, closed: false });
        current = [];
        command = relative ? 'l' : 'L';
      }
    } else if (upper === 'H') position = { x: read() + (relative ? position.x : 0), y: position.y };
    else if (upper === 'V') position = { x: position.x, y: read() + (relative ? position.y : 0) };
    else throw new Error('unsupported paths');
    current.push({ ...position });
    if (current.length > 2000) throw new Error('The SVG path has too many vertices.');
  }
  if (current.length) out.push({ points: current, closed: false });
  return out;
}
function physicalMetres(value: string | null): number | undefined {
  const match = value?.match(/^\s*([\d.+eE-]+)\s*(mm|cm|in|pt|pc|px)\s*$/);
  if (!match) return undefined;
  const factors: Record<string, number> = {
    mm: 0.001,
    cm: 0.01,
    in: 0.0254,
    pt: 0.0254 / 72,
    pc: 0.0254 / 6,
    px: 0.0254 / 96,
  };
  const result = Number(match[1]) * factors[match[2]];
  return Number.isFinite(result) && result > 0 ? result : undefined;
}

/** Inert XML → numeric geometry. Never insert source markup into the DOM, execute or fetch it. */
export function parsePlanSvg(text: string): PlanImportSource {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('SVG document types and entities are not accepted. Export a plain SVG.');
  const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = xml.documentElement;
  if (root.localName !== 'svg' || xml.querySelector('parsererror'))
    throw new Error('This is not a valid SVG document.');
  const all = [root, ...root.querySelectorAll('*')];
  if (all.length > 15000)
    throw new Error('The SVG is too detailed. Export only plan boundary layers.');
  for (const node of all) {
    if (
      [
        'script',
        'foreignObject',
        'iframe',
        'object',
        'embed',
        'image',
        'style',
        'animate',
        'animateTransform',
        'set',
      ].includes(node.localName)
    )
      throw new Error(
        'Use a static geometry-only SVG without scripts, images, stylesheets or embedded content.',
      );
    for (const attr of [...node.attributes])
      if (
        /^on/i.test(attr.name) ||
        /href$/i.test(attr.name) ||
        /url\s*\(|@import|javascript:/i.test(attr.value)
      )
        throw new Error('External references and active content are not accepted in plan SVGs.');
    if (/(?:^|;)\s*(?:transform|d|x|y|width|height)\s*:/i.test(node.getAttribute('style') ?? ''))
      throw new Error('Flatten CSS positioning and transforms before exporting the SVG.');
  }
  const shapes: PlanImportShape[] = [],
    skipped = new Map<string, number>();
  const skip = (type: string) => skipped.set(type, (skipped.get(type) ?? 0) + 1);
  function visit(node: Element, parent: Matrix, layer: string, depth: number) {
    if (depth > 50) throw new Error('SVG groups are nested too deeply. Flatten the export.');
    if (
      node.getAttribute('display') === 'none' ||
      node.getAttribute('visibility') === 'hidden' ||
      /display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.getAttribute('style') ?? '')
    )
      return;
    if (
      ['defs', 'metadata', 'title', 'desc', 'clipPath', 'mask', 'symbol'].includes(node.localName)
    )
      return;
    if (node !== root && node.localName === 'svg') {
      skip('nested SVG viewports');
      return;
    }
    const matrix = product(parent, transform(node.getAttribute('transform') ?? ''));
    const nextLayer =
      node.localName === 'g'
        ? (
            node.getAttribute('inkscape:label') ||
            node.getAttribute('data-layer') ||
            node.id ||
            layer
          ).slice(0, 120)
        : layer;
    if (node.localName === 'g' || node === root) {
      for (const child of [...node.children]) visit(child, matrix, nextLayer, depth + 1);
      return;
    }
    let runs: { points: Vertex[]; closed: boolean }[] = [];
    if (node.localName === 'line')
      runs = [
        {
          points: [
            { x: attribute(node, 'x1'), y: attribute(node, 'y1') },
            { x: attribute(node, 'x2'), y: attribute(node, 'y2') },
          ],
          closed: false,
        },
      ];
    else if (node.localName === 'polygon' || node.localName === 'polyline') {
      const coords = numbers(node.getAttribute('points') ?? '');
      if (coords.length % 2) throw new Error('SVG points must be x,y coordinate pairs.');
      runs = [
        {
          points: Array.from({ length: coords.length / 2 }, (_, i) => ({
            x: coords[2 * i],
            y: coords[2 * i + 1],
          })),
          closed: node.localName === 'polygon',
        },
      ];
    } else if (node.localName === 'rect') {
      if (attribute(node, 'rx') || attribute(node, 'ry')) {
        skip('rounded rectangles');
        return;
      }
      const x = attribute(node, 'x'),
        y = attribute(node, 'y'),
        w = attribute(node, 'width'),
        h = attribute(node, 'height');
      if (w <= 0 || h <= 0) return;
      runs = [
        {
          points: [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ],
          closed: true,
        },
      ];
    } else if (node.localName === 'path') {
      try {
        runs = paths(node.getAttribute('d') ?? '');
      } catch (error) {
        skip(error instanceof Error ? error.message : 'unsupported paths');
        return;
      }
    } else {
      skip(node.localName);
      return;
    }
    for (const run of runs)
      if (run.points.length >= 2) {
        if (shapes.length >= 2500 || run.points.length > 2000)
          throw new Error('The SVG has too much geometry. Export plan boundary layers only.');
        const transformed = run.points.map((p) => point(p, matrix));
        const coincident =
          Math.hypot(
            transformed[0].x - transformed[transformed.length - 1].x,
            transformed[0].y - transformed[transformed.length - 1].y,
          ) < 1e-8;
        shapes.push({
          id: `svg-${shapes.length}`,
          layer: nextLayer,
          points: transformed,
          closed: run.closed || coincident,
        });
      }
  }
  visit(root, IDENTITY, 'Plan', 0);
  let metresPerUnit: number | undefined;
  const vb = root.getAttribute('viewBox');
  const width = physicalMetres(root.getAttribute('width')),
    height = physicalMetres(root.getAttribute('height'));
  if (vb) {
    const v = numbers(vb);
    if (v.length !== 4 || v[2] <= 0 || v[3] <= 0) throw new Error('Invalid SVG viewBox.');
    if (width && height && Math.abs(width / v[2] - height / v[3]) < 1e-8)
      metresPerUnit = width / v[2];
  }
  return {
    format: 'svg',
    name: 'SVG plan',
    shapes,
    metresPerUnit,
    warnings: [...skipped]
      .map(([type, count]) => `${count} ${type} skipped. Only straight plan geometry is imported.`)
      .concat(
        'SVG page units may describe paper size. Confirm real-world scale or calibrate a known dimension before adding the plan.',
      ),
  };
}
