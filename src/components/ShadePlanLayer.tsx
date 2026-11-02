import { Circle, Group, Line, Text } from 'react-konva';
import { usePropertyStore } from '../store/propertyStore';
import { useShadeEditorStore } from '../store/shadeEditorStore';
import { estimateShadeSail, shadeSailSurface, type ShadeModel, type ShadeSail } from '../designer/shade';

const INK = '#2f4a44';
const SELECTED = '#1f7a68';

/** One sail: the scalloped finished outline, the straight fixing chords, the
 * fixing points (draggable in select mode) with their heights, and the edge
 * spans. The same surface sampler draws the 3D membrane, so plan and picture
 * agree. Dragging a point moves the fixing point; the engine recomputes. */
function SailShape({ sail, pxPerMetre, scale, interactive, selected }: { sail: ShadeSail; pxPerMetre: number; scale: number; interactive: boolean; selected: boolean }) {
  const surface = shadeSailSurface(sail, { edgeSegments: 10, rings: 1 });
  const report = estimateShadeSail(sail);
  const select = (anchorId: string | null) => {
    useShadeEditorStore.getState().select(sail.id, anchorId);
    usePropertyStore.getState().selectItemAcrossRooms(null);
  };
  const edit = (anchorId: string | null) => { select(anchorId); window.dispatchEvent(new CustomEvent('ppw:edit-shade', { detail: { id: sail.id, anchorId } })); };
  const stroke = selected ? SELECTED : INK;
  const unit = 1 / scale;
  return <Group name={`shade-sail-${sail.id}`}>
    <Line name={`shade-outline-${sail.id}`} points={surface.outline.flatMap(p => [p.x * pxPerMetre, p.y * pxPerMetre])} closed
      fill={sail.colour} opacity={0.55} stroke={stroke} strokeWidth={(selected ? 2 : 1.2) * unit} listening={interactive}
      onClick={e => { e.cancelBubble = true; edit(null); }} onTap={e => { e.cancelBubble = true; edit(null); }} />
    <Line listening={false} points={sail.anchors.flatMap(a => [a.x * pxPerMetre, a.y * pxPerMetre])} closed stroke={stroke} strokeWidth={0.8 * unit} dash={[6 * unit, 4 * unit]} opacity={0.7} />
    {report.edges.map(edge => {
      const a = sail.anchors[edge.index], b = sail.anchors[(edge.index + 1) % sail.anchors.length];
      const mx = (a.x + b.x) / 2 * pxPerMetre, my = (a.y + b.y) / 2 * pxPerMetre;
      return edge.spanM * pxPerMetre * scale > 60 ? <Text key={`edge-${edge.index}`} name={`shade-edge-label-${sail.id}-${edge.index}`} listening={false} x={mx + 4 * unit} y={my - 14 * unit}
        text={`${edge.spanM.toFixed(2)} m${edge.fit === 'over-stretch' ? ' · too far' : edge.fit === 'slack' ? ' · slack' : ''}`} fontFamily="Inter, sans-serif" fontSize={10 * unit} fill={edge.fit === 'over-stretch' ? '#a63a2c' : INK} /> : null;
    })}
    {sail.anchors.map(anchor => {
      const r = Math.max(0.16 * pxPerMetre, 8 * unit);
      const anchorSelected = selected && useShadeEditorStore.getState().anchorId === anchor.id;
      return <Group key={anchor.id} name={`shade-anchor-${anchor.id}`} x={anchor.x * pxPerMetre} y={anchor.y * pxPerMetre}
        draggable={interactive} listening={interactive}
        onDragStart={e => { e.cancelBubble = true; select(anchor.id); }} onDragMove={e => { e.cancelBubble = true; }}
        onDragEnd={e => {
          e.cancelBubble = true;
          const snap = (n: number) => Math.round(n / pxPerMetre * 20) / 20;
          const moved = usePropertyStore.getState().updateShadeAnchor(sail.id, anchor.id, { x: snap(e.target.x()), y: snap(e.target.y()) });
          if (!moved) e.target.position({ x: anchor.x * pxPerMetre, y: anchor.y * pxPerMetre });
        }}
        onClick={e => { e.cancelBubble = true; edit(anchor.id); }} onTap={e => { e.cancelBubble = true; edit(anchor.id); }}>
        <Circle radius={r} fill={anchor.support === 'post' ? '#f4f1e8' : '#d9e3df'} stroke={anchorSelected ? SELECTED : stroke} strokeWidth={(anchorSelected ? 2.5 : 1.2) * unit} />
        {anchor.support === 'post' && <Circle radius={r * 0.35} fill={stroke} listening={false} />}
        <Text listening={false} x={r + 3 * unit} y={-6 * unit} text={`${anchor.heightM.toFixed(2)} m`} fontFamily="Inter, sans-serif" fontSize={10 * unit} fill={INK} />
      </Group>;
    })}
  </Group>;
}

/** Ground-level overlay drawn above the garden; select mode edits it like garden surfaces. */
export function ShadePlanLayer({ model, pxPerMetre, scale, interactive = false }: { model?: ShadeModel; pxPerMetre: number; scale: number; interactive?: boolean }) {
  const selectedSailId = useShadeEditorStore(s => s.sailId);
  if (!model?.enabled || model.sails.length === 0) return null;
  return <Group name="shade-sails" listening={interactive}>
    {model.sails.map(sail => <SailShape key={sail.id} sail={sail} pxPerMetre={pxPerMetre} scale={scale} interactive={interactive} selected={sail.id === selectedSailId} />)}
  </Group>;
}
