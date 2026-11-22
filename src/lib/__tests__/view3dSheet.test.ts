import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { drawSheet, viewAxes, type SheetImage, type SheetPart } from '../view3dSheet';
import {
  generatePlanPdf,
  generateViewsPdf,
  type OrderPdfInput,
  type PdfViewSheet,
} from '../planPdf';

/** A closed box with its faces counter-clockwise seen from outside, in metres: x east, y north, z up. */
function boxPart(colourHex: string, min: number[], max: number[]): SheetPart {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const quad = (a: number[], b: number[], c: number[], d: number[]) => [
    ...a,
    ...b,
    ...c,
    ...a,
    ...c,
    ...d,
  ];
  return {
    colourHex,
    positions: new Float32Array([
      ...quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]), // top
      ...quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]), // bottom
      ...quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]), // south
      ...quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]), // north
      ...quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]), // east
      ...quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]), // west
    ]),
  };
}
const RED = '#c82020';
const BLUE = '#2040c8';
const at = (image: SheetImage, x: number, y: number) => {
  const o = (Math.round(y) * image.width + Math.round(x)) * 4;
  return [image.data[o], image.data[o + 1], image.data[o + 2]];
};
const isRed = (c: number[]) => c[0] > c[2] + 40;
const isBlue = (c: number[]) => c[2] > c[0] + 40;
/** The middle of the points that show a colour, and how many they are. */
function where(image: SheetImage, is: (c: number[]) => boolean) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if (is(at(image, x, y))) {
        n++;
        sx += x;
        sy += y;
      }
  return { count: n, x: n ? sx / n : NaN, y: n ? sy / n : NaN };
}

describe('the axes of a view', () => {
  it('from the south at eye level: east is to the right, up is up, the eye is to the south', () => {
    const { right, up, eye } = viewAxes({ fromDeg: 180, aboveDeg: 0 });
    expect(right.map((n) => Math.round(n * 1e6) / 1e6 + 0)).toEqual([1, 0, 0]);
    expect(up.map((n) => Math.round(n * 1e6) / 1e6 + 0)).toEqual([0, 0, 1]);
    expect(eye.map((n) => Math.round(n * 1e6) / 1e6 + 0)).toEqual([0, -1, 0]);
  });

  it('from straight above: north is up on the sheet, east to the right', () => {
    const { right, up } = viewAxes({ fromDeg: 180, aboveDeg: 90 });
    expect(right.map((n) => Math.round(n * 1e6) / 1e6 + 0)).toEqual([1, 0, 0]);
    expect(up.map((n) => Math.round(n * 1e6) / 1e6 + 0)).toEqual([0, 1, 0]);
  });

  it('are three lines at right angles, each of length 1, whatever the view', () => {
    for (const view of [
      { fromDeg: 225, aboveDeg: 32 },
      { fromDeg: 45, aboveDeg: 58 },
      { fromDeg: 300, aboveDeg: 10 },
    ]) {
      const { right, up, eye } = viewAxes(view);
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      for (const axis of [right, up, eye]) expect(dot(axis, axis)).toBeCloseTo(1, 9);
      expect(dot(right, up)).toBeCloseTo(0, 9);
      expect(dot(right, eye)).toBeCloseTo(0, 9);
      expect(dot(up, eye)).toBeCloseTo(0, 9);
    }
  });
});

describe('a 3D view drawn as a picture', () => {
  it('nothing to draw is a white sheet', () => {
    const image = drawSheet([], { fromDeg: 225, aboveDeg: 32 }, 60, 40);
    expect([image.width, image.height, image.faces, image.covered]).toEqual([60, 40, 0, 0]);
    expect(image.data.every((v) => v === 255)).toBe(true);
  });

  it('a box seen from the south shows its south face and its top, fitted into the sheet', () => {
    const image = drawSheet(
      [boxPart(RED, [0, 0, 0], [4, 2, 3])],
      { fromDeg: 180, aboveDeg: 30 },
      300,
      200,
    );
    // Two faces look toward the eye: two triangles each.
    expect(image.faces).toBe(4);
    expect(image.covered).toBeGreaterThan(0.3);
    expect(image.covered).toBeLessThan(0.9);
    expect(isRed(at(image, 150, 100))).toBe(true);
    // The corners of the sheet are paper.
    expect(at(image, 2, 2)).toEqual([255, 255, 255]);
    expect(at(image, 297, 197)).toEqual([255, 255, 255]);
    // The top is lit more than the face: lighter above the middle than below it.
    const top = at(image, 150, 40);
    const face = at(image, 150, 160);
    expect(isRed(top) && isRed(face)).toBe(true);
    expect(top[0]).toBeGreaterThan(face[0]);
  });

  it('east is to the right from the south, and to the left from the north', () => {
    const west = boxPart(RED, [0, 0, 0], [2, 2, 2]);
    const east = boxPart(BLUE, [6, 0, 0], [8, 2, 2]);
    const fromSouth = drawSheet([west, east], { fromDeg: 180, aboveDeg: 25 }, 300, 160);
    expect(where(fromSouth, isRed).x).toBeLessThan(where(fromSouth, isBlue).x - 50);
    const fromNorth = drawSheet([west, east], { fromDeg: 0, aboveDeg: 25 }, 300, 160);
    expect(where(fromNorth, isRed).x).toBeGreaterThan(where(fromNorth, isBlue).x + 50);
  });

  it('what is nearer hides what is behind it, in whatever order the parts are given', () => {
    const front = boxPart(RED, [0, 0, 0], [6, 1, 4]);
    const behind = boxPart(BLUE, [1, 5, 0], [5, 6, 2]);
    for (const parts of [
      [front, behind],
      [behind, front],
    ]) {
      const image = drawSheet(parts, { fromDeg: 180, aboveDeg: 5 }, 300, 200);
      // The lower box behind the higher one is hidden but for nothing: no blue is seen.
      expect(where(image, isBlue).count).toBe(0);
      expect(where(image, isRed).count).toBeGreaterThan(1000);
    }
    // From the north the blue box is in front and is seen.
    const other = drawSheet([front, behind], { fromDeg: 0, aboveDeg: 5 }, 300, 200);
    expect(where(other, isBlue).count).toBeGreaterThan(500);
  });

  it('is at one scale over the whole sheet: a box of 10 m is as many points as its length asks', () => {
    const image = drawSheet(
      [boxPart(RED, [0, 0, 0], [10, 1, 1])],
      { fromDeg: 180, aboveDeg: 0 },
      400,
      200,
    );
    let left = Infinity;
    let right = -Infinity;
    for (let x = 0; x < image.width; x++)
      if (isRed(at(image, x, 100))) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    expect((right - left + 1) * image.metresPerPoint).toBeCloseTo(10, 0);
  });

  it('draws the edges where two faces meet darker than the faces', () => {
    const image = drawSheet(
      [boxPart('#d0d0d0', [0, 0, 0], [4, 4, 3])],
      { fromDeg: 225, aboveDeg: 32 },
      300,
      220,
    );
    let darkest = 255;
    let lightest = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i] === 255 && image.data[i + 1] === 255) continue;
      darkest = Math.min(darkest, image.data[i]);
      lightest = Math.max(lightest, image.data[i]);
    }
    expect(lightest - darkest).toBeGreaterThan(60);
  });
});

describe('3D view sheets in the PDF', () => {
  const picture = drawSheet(
    [boxPart(RED, [0, 0, 0], [4, 2, 3])],
    { fromDeg: 225, aboveDeg: 32 },
    120,
    80,
  );
  const sheet = (title: string): PdfViewSheet => ({
    title,
    note: 'A parallel view of the solids of the design.',
    image: { data: picture.data, width: picture.width, height: picture.height },
    widthPx: picture.width,
    heightPx: picture.height,
  });
  /** The file as text, with every packed part of it unpacked: what a reader of the PDF gets to see. */
  const text = async (blob: Blob) => {
    const bytes = Buffer.from(await blob.arrayBuffer());
    let all = bytes.toString('latin1');
    let from = 0;
    for (;;) {
      const start = bytes.indexOf('stream', from, 'latin1');
      if (start < 0) break;
      const dataAt = bytes[start + 6] === 0x0d ? start + 8 : start + 7;
      const end = bytes.indexOf('endstream', dataAt, 'latin1');
      if (end < 0) break;
      try {
        all += inflateSync(bytes.subarray(dataAt, end)).toString('latin1');
      } catch {
        // Not packed, or a picture: nothing to read as words.
      }
      from = end + 9;
    }
    return all;
  };
  const pages = (pdf: string) => (pdf.match(/\/Type \/Page[^s]/g) ?? []).length;

  it('a PDF of sheets alone: one page for each, with its title and its note, and no price', async () => {
    const blob = generateViewsPdf([
      sheet('The whole house, seen from the south-west'),
      sheet('Ground floor, seen from above'),
    ]);
    const pdf = await text(blob);
    expect(pdf.startsWith('%PDF')).toBe(true);
    expect(pages(pdf)).toBe(2);
    expect(pdf).toContain('The whole house, seen from the south-west');
    expect(pdf).toContain('Ground floor, seen from above');
    expect(pdf).toContain('A parallel view of the solids of the design.');
    expect(pdf).not.toMatch(/Total|Subtotal|Shipping/);
  });

  it('the plan PDF takes the sheets after the pages of its rooms', async () => {
    const input: OrderPdfInput = {
      orderId: 'T-1',
      date: 0,
      customerName: 'Test Person',
      customerEmail: 'test@example.org',
      currency: 'USD' as OrderPdfInput['currency'],
      total: 0,
      property: {
        name: 'House',
        rooms: [
          {
            id: 'r1',
            name: 'Room',
            polygon: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 3 },
              { x: 0, y: 3 },
            ],
            placedItems: [],
            products: [],
          },
        ],
      },
    };
    const without = await text(generatePlanPdf(input));
    const withSheets = await text(
      generatePlanPdf({
        ...input,
        viewSheets: [sheet('The whole house, seen from the south-west')],
      }),
    );
    expect(pages(withSheets)).toBe(pages(without) + 1);
    expect(withSheets).toContain('The whole house, seen from the south-west');
    expect(without).not.toContain('seen from the south-west');
  });
});
