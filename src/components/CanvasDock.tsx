import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './canvasDock.css';

type Edge = 'top' | 'bottom';
type Workspace = 'plan' | 'house' | 'walk';

/** A drawing dock takes one row in the layout. Moving it changes CSS order rather
 * than remounting a tool or changing the canvas's pointer coordinate system. */
export function CanvasDock({ workspace, children, focusTarget }: { workspace: Workspace; children: ReactNode; focusTarget?: string }) {
  const key = 'olb:toolbar-edge:' + workspace;
  const [edge, setEdge] = useState<Edge>(() => {
    try { return localStorage.getItem(key) === 'bottom' ? 'bottom' : 'top'; } catch { return 'top'; }
  });
  const [guide, setGuide] = useState<Edge | null>(null);
  const [overflow, setOverflow] = useState<'more' | 'start' | null>(null);
  const scroller = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; y: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  function dock(at: Edge) {
    setEdge(at);
    try { localStorage.setItem(key, at); } catch { /* Optional preference. */ }
  }
  function nearest(y: number) {
    const box = scroller.current!.parentElement!.parentElement!.getBoundingClientRect();
    return y < box.top + box.height / 2 ? 'top' : 'bottom';
  }
  useLayoutEffect(() => {
    const el = scroller.current!;
    const update = () => setOverflow(el.scrollWidth <= el.clientWidth + 1 ? null :
      el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 ? 'start' : 'more');
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el); observer?.observe(content.current!);
    return () => { observer?.disconnect(); el.removeEventListener('scroll', update); };
  }, []);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = focusTarget ? el.querySelector<HTMLElement>(focusTarget) : null;
    if (target) el.scrollLeft += target.getBoundingClientRect().left - el.getBoundingClientRect().left;
    else el.scrollLeft = 0;
  }, [focusTarget]);
  const next = edge === 'top' ? 'bottom' : 'top';
  return <div className="canvas-edge-dock" data-workspace={workspace} data-edge={edge}
    role="group" aria-label={workspace + ' canvas toolbar'}>
    <button type="button" className="edge-dock-grip" aria-label={'Dock toolbar at ' + next}
      title={'Drag to an edge, or click to dock at ' + next}
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return;
        ignoreClick.current = false;
        gesture.current = { id: e.pointerId, y: e.clientY, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const p = gesture.current;
        if (!p || p.id !== e.pointerId) return;
        p.moved ||= Math.abs(e.clientY - p.y) > 5;
        if (p.moved) setGuide(nearest(e.clientY));
      }}
      onPointerUp={e => {
        const p = gesture.current;
        if (!p || p.id !== e.pointerId) return;
        if (p.moved) { ignoreClick.current = true; dock(nearest(e.clientY)); }
        gesture.current = null; setGuide(null);
      }}
      onLostPointerCapture={() => { gesture.current = null; setGuide(null); }}
      onClick={e => { if (!ignoreClick.current || e.detail === 0) dock(next); ignoreClick.current = false; }}>
      <svg width="12" height="17" viewBox="0 0 12 17" fill="currentColor" aria-hidden="true">
        {[3,8,13].map(y => <g key={y}><circle cx="3" cy={y} r="1.4"/><circle cx="8" cy={y} r="1.4"/></g>)}
      </svg>
    </button>
    <div ref={scroller} className="edge-dock-scroll"><div ref={content} className="edge-dock-content">{children}</div></div>
    {overflow && <button type="button" className="edge-dock-more" aria-label={overflow === 'more' ? 'Show more toolbar actions' : 'Back to first toolbar actions'}
      onClick={() => { const el = scroller.current!; el.scrollLeft = overflow === 'start' ? 0 : el.scrollLeft + Math.max(80, el.clientWidth - 32); }}>
      <span aria-hidden="true">{overflow === 'more' ? '›' : '‹'}</span>
    </button>}
    {guide && <div className="edge-dock-guide" data-at={guide} aria-hidden="true">Dock at {guide}</div>}
  </div>;
}
