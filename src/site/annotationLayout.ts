import type { CanvasSiteProjection } from '../components/canvasSiteBridge';

const fontSize = 11;
const lineHeight = 1.3;
let measuringContext: CanvasRenderingContext2D | null | undefined;

export function measureAnnotationText(text: string): number {
  if (measuringContext === undefined) {
    measuringContext = typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined'
      ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!measuringContext) return Array.from(text).length * fontSize;
  measuringContext.font = `bold ${fontSize}px Inter, sans-serif`;
  return measuringContext.measureText(text).width;
}

export type AnnotationView = Parameters<CanvasSiteProjection['annotation']>[0];

/** Screen-space layout stays deferred. The supplied size excludes the tools row. */
export function layoutSiteAnnotation(
  label: string,
  anchor: { x: number; y: number },
  { pxPerMetre, viewport, size }: Pick<AnnotationView, 'pxPerMetre' | 'viewport' | 'size'>,
  measure = measureAnnotationText,
  topInset = 8,
) {
  const margin = 8, arrowColumn = 20;
  const blockWidth = Math.min(384, size.width - margin * 2);
  const width = blockWidth - arrowColumn;
  if (width <= 0 || size.height <= 0 || viewport.scale <= 0) return null;
  const lines: string[] = [];
  let line = '';
  // Preserve every word, including names with a single long token. No ellipsis.
  for (const word of label.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const character of Array.from(word)) {
      if (measure(character) > width) return null;
      if (line && measure(line + character) > width) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  const height = Math.max(30, lines.length * fontSize * lineHeight);
  // A collapsed canvas cannot display full provenance. Wait for its measured
  // usable size instead of shrinking text, clipping it, or deleting words.
  if (height > size.height - topInset - margin) return null;
  const left = Math.max(margin, Math.min(
    anchor.x * pxPerMetre * viewport.scale + viewport.x + 10,
    size.width - margin - blockWidth,
  ));
  const top = Math.max(topInset, Math.min(
    anchor.y * pxPerMetre * viewport.scale + viewport.y + 8,
    size.height - margin - height,
  ));
  const x = (left - viewport.x) / viewport.scale;
  const y = (top - viewport.y) / viewport.scale;
  const unit = 1 / viewport.scale;
  return {
    text: lines.join('\n'), x: x + arrowColumn * unit, y,
    width: width * unit, height: height * unit,
    backing: { x: x - 4 * unit, y: y - 4 * unit,
      width: (blockWidth + 8) * unit, height: (height + 8) * unit },
    fontSize: fontSize * unit, lineHeight,
    points: [x + 5 * unit, y + 28 * unit, x + 5 * unit, y + 2 * unit,
      x, y + 8 * unit, x + 5 * unit, y + 2 * unit, x + 10 * unit, y + 8 * unit],
    strokeWidth: 1.5 * unit,
  };
}
