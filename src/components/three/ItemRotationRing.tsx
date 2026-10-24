import { useRef, useState } from 'react';
import { gestureRotation, pointerAngle } from '../../designer/rotationGesture';
import { StudioIcon } from '../StudioIcon';

export interface ItemRotationRingProps {
  x: number; y: number; rotation: number; valid: boolean;
  onStart: () => boolean;
  onPreview: (angle: number) => void;
  onCommit: (angle: number) => void;
  onCancel: () => void;
  onStep: (delta: number) => void;
}

/** Screen-space handle anchored beside the selected body. Only the ring and
 * buttons accept events; the open centre never blocks the item beneath it. */
export function ItemRotationRing({ x, y, rotation, valid, onStart, onPreview, onCommit, onCancel, onStep }: ItemRotationRingProps) {
  const [fine, setFine] = useState(false);
  const gesture = useRef<{ id: number; centre: { x: number; y: number }; start: number; rotation: number; angle: number } | null>(null);
  const colour = valid ? '#4ab6a3' : '#de6868';
  const rad = (rotation - 90) * Math.PI / 180;
  return <div className="house-object-turn" role="group" aria-label="Rotate selected object" data-testid="view3d-object-turn"
    style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', display: 'block', width: 124, height: 160,
      padding: 0, border: 0, background: 'transparent', boxShadow: 'none', pointerEvents: 'none', zIndex: 4 }}>
    <svg width="124" height="124" viewBox="0 0 124 124" style={{ overflow: 'visible' }}>
      <circle cx="62" cy="62" r="47" fill="none" stroke="rgba(18,43,52,.78)" strokeWidth="10" />
      <circle cx="62" cy="62" r="47" fill="none" stroke={colour} strokeWidth="2" />
      {Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return <circle key={i} cx={62 + Math.sin(a) * 47} cy={62 - Math.cos(a) * 47} r="2.5" fill="#f3fff9" />; })}
      <circle cx={62 + Math.cos(rad) * 47} cy={62 + Math.sin(rad) * 47} r="8" fill={colour} stroke="#f3fff9" strokeWidth="2" />
      <circle data-testid="view3d-rotation-ring" role="slider" tabIndex={0} aria-label="Drag to rotate selected object"
        aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(rotation)} cx="62" cy="62" r="47"
        fill="none" stroke="transparent" strokeWidth="34" style={{ pointerEvents: 'stroke', touchAction: 'none', cursor: 'grab' }}
        onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); onStep((e.key === 'ArrowRight' ? 1 : -1) * (fine || e.altKey || e.shiftKey ? 1 : 45)); } }}
        onPointerDown={e => {
          if (e.button !== 0 || !onStart()) return;
          e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
          const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
          const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          gesture.current = { id: e.pointerId, centre, start: pointerAngle({ x: e.clientX, y: e.clientY }, centre), rotation, angle: rotation };
        }}
        onPointerMove={e => {
          const run = gesture.current;
          if (!run || run.id !== e.pointerId) return;
          e.preventDefault(); e.stopPropagation();
          run.angle = gestureRotation(run.rotation, run.start, pointerAngle({ x: e.clientX, y: e.clientY }, run.centre), fine || e.shiftKey || e.altKey);
          onPreview(run.angle);
        }}
        onPointerUp={e => {
          const run = gesture.current;
          if (!run || run.id !== e.pointerId) return;
          e.stopPropagation(); gesture.current = null; onCommit(run.angle);
        }}
        onPointerCancel={e => { if (gesture.current?.id === e.pointerId) { e.stopPropagation(); gesture.current = null; onCancel(); } }}
        onLostPointerCapture={() => { if (gesture.current) { gesture.current = null; onCancel(); } }} />
      <text x="62" y="67" textAnchor="middle" fill="#f3fff9" stroke="rgba(18,43,52,.8)" strokeWidth="3" paintOrder="stroke" fontSize="15" fontWeight="700">{Math.round(rotation)}°</text>
    </svg>
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', pointerEvents: 'auto', padding: 3, borderRadius: 22, background: 'rgba(18,43,52,.92)' }}>
      <button type="button" aria-label="Turn object counter-clockwise" title="Turn object 45° counter-clockwise" data-testid="view3d-rotate-ccw" onClick={() => onStep(fine ? -1 : -45)}><StudioIcon name="rotateLeft" size={18} /></button>
      <button type="button" aria-label="Fine rotation one degree" aria-pressed={fine} title="Switch between 45° snaps and 1° precision" onClick={() => setFine(!fine)} style={{ fontSize: 11, minWidth: 32 }}>{fine ? '1°' : '45°'}</button>
      <button type="button" aria-label="Turn object clockwise" title="Turn object 45° clockwise" data-testid="view3d-rotate" onClick={() => onStep(fine ? 1 : 45)}><StudioIcon name="rotateRight" size={18} /></button>
    </div>
  </div>;
}
