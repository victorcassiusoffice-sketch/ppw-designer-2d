import { Circle, Ellipse, Group, Line, Rect } from 'react-konva';
import type { ServiceFixturePlacement } from '../designer/serviceFixtures';

/** Measured coordination symbols, not merchant product photos. Passive here;
 * the Plumbing & electric workspace owns fixture selection and editing. */
export function ServiceFixturesPlanLayer({ fixtures, pxPerMetre, onSelect }: {
  fixtures: ServiceFixturePlacement[];
  pxPerMetre: number;
  onSelect?: (id: string) => void;
}) {
  if (!fixtures.length) return null;
  return <Group name="service-fixtures" listening={Boolean(onSelect)}>
    {fixtures.map(fixture => {
      const w = fixture.widthM * pxPerMetre;
      const d = fixture.depthM * pxPerMetre;
      const stroke = Math.min(w, d) * .028;
      const edge = '#6c7973';
      const ceramic = '#f0f0e6';
      return <Group key={fixture.id} name={`service-fixture-${fixture.id}`} x={fixture.x * pxPerMetre} y={fixture.y * pxPerMetre} rotation={fixture.rotation}
        onClick={event => { event.cancelBubble = true; onSelect?.(fixture.id); }}
        onTap={event => { event.cancelBubble = true; onSelect?.(fixture.id); }}>
        {fixture.kind === 'toilet' && <>
          <Rect x={-w / 2} y={-d / 2} width={w} height={d * .26} cornerRadius={w * .09} fill={ceramic} stroke={edge} strokeWidth={stroke}
            shadowColor="#304238" shadowOpacity={.2} shadowBlur={w * .07} shadowOffsetY={d * .02} />
          <Ellipse x={0} y={d * .1} radiusX={w * .47} radiusY={d * .4} fill={ceramic} stroke={edge} strokeWidth={stroke} />
          <Ellipse x={0} y={d * .12} radiusX={w * .31} radiusY={d * .27} fill="#c6d2ca" stroke="#abb9b0" strokeWidth={stroke * .7} />
          <Circle x={w * .21} y={-d * .37} radius={w * .055} fill="#bbc5bd" />
        </>}
        {fixture.kind === 'sink' && <>
          <Rect x={-w / 2} y={-d / 2} width={w} height={d} cornerRadius={Math.min(w, d) * .17} fill={ceramic} stroke={edge} strokeWidth={stroke}
            shadowColor="#304238" shadowOpacity={.2} shadowBlur={w * .07} shadowOffsetY={d * .025} />
          <Rect x={-w * .4} y={-d * .28} width={w * .8} height={d * .64} cornerRadius={d * .24} fill="#d6dfd7" stroke="#aab9ad" strokeWidth={stroke} />
          <Circle x={0} y={d * .09} radius={Math.min(w, d) * .045} fill="#788f83" />
          <Line points={[0, -d * .42, 0, -d * .12]} stroke="#75867d" strokeWidth={w * .045} lineCap="round" />
        </>}
        {fixture.kind === 'mains-tap' && <>
          <Line points={[0, -d * .5, 0, d * .34, w * .4, d * .34]} stroke="#9d865c" strokeWidth={w * .24} lineCap="round" lineJoin="round" />
          <Circle x={0} y={-d * .17} radius={w * .38} fill="#447761" stroke="#294d3d" strokeWidth={stroke} />
          <Line points={[-w * .5, -d * .17, w * .5, -d * .17]} stroke="#345e49" strokeWidth={w * .12} />
        </>}
        {fixture.kind === 'electrical-board' && <>
          <Rect x={-w / 2} y={-d / 2} width={w} height={d} cornerRadius={Math.min(w, d) * .09} fill="#dadfd6" stroke={edge} strokeWidth={stroke} />
          <Line points={[-w * .18, -d * .34, w * .04, -d * .34, -w * .07, d * .08, w * .15, d * .08, -w * .12, d * .4]} stroke="#946d2f" strokeWidth={Math.min(w, d) * .1} lineCap="round" lineJoin="round" />
        </>}
      </Group>;
    })}
  </Group>;
}
