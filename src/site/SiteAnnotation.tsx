import { useEffect, useLayoutEffect, useReducer, useState } from 'react';
import { layoutSiteAnnotation, measureAnnotationText, type AnnotationView } from './annotationLayout';

export function SiteAnnotation({ label, anchor, view }: {
  label: string; anchor: { x: number; y: number }; view: AnnotationView;
}) {
  const [topInset, setTopInset] = useState(8);
  const [, remeasure] = useReducer(value => value + 1, 0);
  useLayoutEffect(() => {
    // The normal-flow tools row is already outside size. Its separate mobile
    // Undo/Redo strip is inside the drawing area and must also remain clear.
    const strip = view.container?.querySelector('[data-testid="mobile-undo"]')?.parentElement;
    const bottom = strip?.getClientRects().length && view.container
      ? strip.getBoundingClientRect().bottom - view.container.getBoundingClientRect().top : 0;
    setTopInset(Math.max(8, bottom + 8));
  }, [view]);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let active = true;
    const ready = () => { if (active) remeasure(); };
    void fonts.ready.then(ready, () => {});
    fonts.addEventListener('loadingdone', ready);
    return () => { active = false; fonts.removeEventListener('loadingdone', ready); };
  }, []);
  const layout = layoutSiteAnnotation(label, anchor, view, measureAnnotationText, topInset);
  if (!layout) return null;
  const { Rect, Text, Line, ink, paper } = view;
  return <>
    <Rect name="site-provenance-backing" {...layout.backing} fill={paper} />
    <Text name="site-provenance" x={layout.x} y={layout.y} width={layout.width}
      text={layout.text} fontSize={layout.fontSize} lineHeight={layout.lineHeight}
      fontStyle="bold" fontFamily="Inter, sans-serif" wrap="none" fill={ink} />
    <Line name="site-north-arrow" points={layout.points} stroke={ink} strokeWidth={layout.strokeWidth} />
  </>;
}
