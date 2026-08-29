/**
 * MeasurementChip — paper-theme token contract + screen-space geometry.
 *
 * react-konva is mocked with prop-recording stubs so the chip can be rendered
 * with `react-dom/server` in the plain node environment (no canvas, no
 * jsdom). The assertions are about WHAT the chip hands to Konva, which is
 * exactly the surface the reskin changed.
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MeasurementChip, type MeasurementChipProps } from '../MeasurementChip';
import {
  MEASURE_BG,
  MEASURE_BG_OPACITY,
  MEASURE_TEXT,
  ROOM_FILL,
  SELECT_STROKE,
  WALL_INK,
  isRoomBorderPixel,
  measureChipMetrics,
} from '../blueprintTheme';

type Recorded = { type: string; props: Record<string, unknown> };

const recorded = vi.hoisted(() => ({ nodes: [] as Array<{ type: string; props: Record<string, unknown> }> }));

vi.mock('react-konva', async () => {
  const React = await import('react');
  function stub(type: string) {
    return function KonvaStub(props: Record<string, unknown>): JSX.Element {
      const { children, ...rest } = props;
      recorded.nodes.push({ type, props: rest });
      return React.createElement('div', { 'data-konva': type }, children as React.ReactNode);
    };
  }
  return { Group: stub('Group'), Rect: stub('Rect'), Text: stub('Text') };
});

function render(props: MeasurementChipProps): { group: Recorded; rect: Recorded; text: Recorded } {
  recorded.nodes.length = 0;
  renderToStaticMarkup(createElement(MeasurementChip, props));
  const find = (type: string): Recorded => {
    const n = recorded.nodes.find((r) => r.type === type);
    if (!n) throw new Error(`${type} was not rendered`);
    return n;
  };
  return { group: find('Group'), rect: find('Rect'), text: find('Text') };
}

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const BASE: MeasurementChipProps = { x: 100, y: 200, text: '3.50 m', scale: 1 };

describe('MeasurementChip — paper register', () => {
  it('draws a charcoal plate with paper numerals', () => {
    const { rect, text } = render(BASE);
    expect(rect.props.fill).toBe(MEASURE_BG);
    expect(MEASURE_BG).toBe(WALL_INK);
    expect(rect.props.opacity).toBe(MEASURE_BG_OPACITY);
    expect(text.props.fill).toBe(MEASURE_TEXT);
    expect(text.props.text).toBe('3.50 m');
    expect(text.props.align).toBe('center');
    expect(text.props.fontStyle).toBe('bold');
  });

  it('never goes fully opaque, so the plate can never be read as a wall by the e2e scan', () => {
    for (const live of [false, true]) {
      const { rect } = render({ ...BASE, live });
      const opacity = rect.props.opacity as number;
      expect(opacity).toBeLessThan(1);
      expect(opacity).toBeLessThanOrEqual(MEASURE_BG_OPACITY);
      const [ir, ig, ib] = rgb(MEASURE_BG);
      const [pr, pg, pb] = rgb(ROOM_FILL);
      const composited: [number, number, number] = [
        Math.round(ir * opacity + pr * (1 - opacity)),
        Math.round(ig * opacity + pg * (1 - opacity)),
        Math.round(ib * opacity + pb * (1 - opacity)),
      ];
      expect(isRoomBorderPixel(...composited)).toBe(false);
    }
  });

  it('signals the live segment with a teal hairline, not a brighter plate', () => {
    const idle = render(BASE).rect.props;
    const live = render({ ...BASE, live: true }).rect.props;
    expect(idle.stroke).toBeUndefined();
    expect(idle.strokeWidth).toBe(0);
    expect(live.stroke).toBe(SELECT_STROKE);
    expect(live.strokeWidth).toBe(1);
    expect(live.opacity).toBe(idle.opacity);
    expect(live.fill).toBe(idle.fill);
  });

  it('is not interactive', () => {
    expect(render(BASE).group.props.listening).toBe(false);
  });
});

describe('MeasurementChip — screen-space geometry (unchanged by the reskin)', () => {
  it.each([0.3, 1, 3])('at %s× the plate matches measureChipMetrics and is centred on (x, y)', (scale) => {
    const m = measureChipMetrics(scale);
    const { group, rect, text } = render({ ...BASE, scale });
    expect(group.props.x).toBe(BASE.x);
    expect(group.props.y).toBe(BASE.y);
    expect(rect.props.x).toBeCloseTo(-m.halfWidth, 10);
    expect(rect.props.y).toBeCloseTo(-m.height / 2, 10);
    expect(rect.props.width).toBeCloseTo(m.halfWidth * 2, 10);
    expect(rect.props.height).toBeCloseTo(m.height, 10);
    expect(rect.props.cornerRadius).toBeCloseTo(m.cornerRadius, 10);
    expect(text.props.fontSize).toBeCloseTo(m.fontSize, 10);
    expect(text.props.width).toBeCloseTo(m.halfWidth * 2, 10);
  });

  it('renders the same on-screen size at every zoom', () => {
    const lo = render({ ...BASE, scale: 0.3 });
    const hi = render({ ...BASE, scale: 3 });
    expect((lo.rect.props.width as number) * 0.3).toBeCloseTo((hi.rect.props.width as number) * 3, 10);
    expect((lo.text.props.fontSize as number) * 0.3).toBeCloseTo((hi.text.props.fontSize as number) * 3, 10);
    // The live hairline is 1 screen px at every zoom.
    const liveLo = render({ ...BASE, scale: 0.3, live: true }).rect.props.strokeWidth as number;
    const liveHi = render({ ...BASE, scale: 3, live: true }).rect.props.strokeWidth as number;
    expect(liveLo * 0.3).toBeCloseTo(liveHi * 3, 10);
  });

  it('applies offsetYPx in screen px (divided by the scale)', () => {
    expect(render({ ...BASE, scale: 2, offsetYPx: -20 }).group.props.y).toBeCloseTo(BASE.y - 10, 10);
    expect(render({ ...BASE, scale: 0.5, offsetYPx: -20 }).group.props.y).toBeCloseTo(BASE.y - 40, 10);
  });

  it('survives a degenerate scale without collapsing', () => {
    for (const bad of [0, -1, Number.NaN]) {
      const { group, rect } = render({ ...BASE, scale: bad, offsetYPx: -20, live: true });
      expect(group.props.y).toBe(BASE.y - 20);
      expect(rect.props.strokeWidth).toBe(1);
      expect(rect.props.width).toBeGreaterThan(0);
    }
  });
});
