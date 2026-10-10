import { Circle, Ellipse, Group, Line, Rect } from 'react-konva';
import type { ServiceFixturePlacement } from '../designer/serviceFixtures';

/** Measured coordination symbols, not merchant product photos. Passive here;
 * the Plumbing & electric workspace owns fixture selection and editing. */
export function ServiceFixturesPlanLayer({
  fixtures,
  pxPerMetre,
  onSelect,
}: {
  fixtures: ServiceFixturePlacement[];
  pxPerMetre: number;
  onSelect?: (id: string) => void;
}) {
  if (!fixtures.length) return null;
  return (
    <Group name="service-fixtures" listening={Boolean(onSelect)}>
      {fixtures.map((fixture) => {
        const w = fixture.widthM * pxPerMetre;
        const d = fixture.depthM * pxPerMetre;
        const stroke = Math.min(w, d) * 0.028;
        const edge = '#6c7973';
        const ceramic = '#f0f0e6';
        return (
          <Group
            key={fixture.id}
            name={`service-fixture-${fixture.id}`}
            x={fixture.x * pxPerMetre}
            y={fixture.y * pxPerMetre}
            rotation={fixture.rotation}
            onClick={(event) => {
              event.cancelBubble = true;
              onSelect?.(fixture.id);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onSelect?.(fixture.id);
            }}
          >
            {fixture.kind === 'toilet' && (
              <>
                <Rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d * 0.26}
                  cornerRadius={w * 0.09}
                  fill={ceramic}
                  stroke={edge}
                  strokeWidth={stroke}
                  shadowColor="#304238"
                  shadowOpacity={0.2}
                  shadowBlur={w * 0.07}
                  shadowOffsetY={d * 0.02}
                />
                <Ellipse
                  x={0}
                  y={d * 0.1}
                  radiusX={w * 0.47}
                  radiusY={d * 0.4}
                  fill={ceramic}
                  stroke={edge}
                  strokeWidth={stroke}
                />
                <Ellipse
                  x={0}
                  y={d * 0.12}
                  radiusX={w * 0.31}
                  radiusY={d * 0.27}
                  fill="#c6d2ca"
                  stroke="#abb9b0"
                  strokeWidth={stroke * 0.7}
                />
                <Circle x={w * 0.21} y={-d * 0.37} radius={w * 0.055} fill="#bbc5bd" />
              </>
            )}
            {fixture.kind === 'sink' && (
              <>
                <Rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  cornerRadius={Math.min(w, d) * 0.17}
                  fill={ceramic}
                  stroke={edge}
                  strokeWidth={stroke}
                  shadowColor="#304238"
                  shadowOpacity={0.2}
                  shadowBlur={w * 0.07}
                  shadowOffsetY={d * 0.025}
                />
                <Rect
                  x={-w * 0.4}
                  y={-d * 0.28}
                  width={w * 0.8}
                  height={d * 0.64}
                  cornerRadius={d * 0.24}
                  fill="#d6dfd7"
                  stroke="#aab9ad"
                  strokeWidth={stroke}
                />
                <Circle x={0} y={d * 0.09} radius={Math.min(w, d) * 0.045} fill="#788f83" />
                <Line
                  points={[0, -d * 0.42, 0, -d * 0.12]}
                  stroke="#75867d"
                  strokeWidth={w * 0.045}
                  lineCap="round"
                />
              </>
            )}
            {fixture.kind === 'mains-tap' && (
              <>
                <Line
                  points={[0, -d * 0.5, 0, d * 0.34, w * 0.4, d * 0.34]}
                  stroke="#9d865c"
                  strokeWidth={w * 0.24}
                  lineCap="round"
                  lineJoin="round"
                />
                <Circle
                  x={0}
                  y={-d * 0.17}
                  radius={w * 0.38}
                  fill="#447761"
                  stroke="#294d3d"
                  strokeWidth={stroke}
                />
                <Line
                  points={[-w * 0.5, -d * 0.17, w * 0.5, -d * 0.17]}
                  stroke="#345e49"
                  strokeWidth={w * 0.12}
                />
              </>
            )}
            {fixture.kind === 'electrical-board' && (
              <>
                <Rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  cornerRadius={Math.min(w, d) * 0.09}
                  fill="#dadfd6"
                  stroke={edge}
                  strokeWidth={stroke}
                />
                <Line
                  points={[
                    -w * 0.18,
                    -d * 0.34,
                    w * 0.04,
                    -d * 0.34,
                    -w * 0.07,
                    d * 0.08,
                    w * 0.15,
                    d * 0.08,
                    -w * 0.12,
                    d * 0.4,
                  ]}
                  stroke="#946d2f"
                  strokeWidth={Math.min(w, d) * 0.1}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            )}
            {fixture.kind === 'sewer-connection' && (
              <>
                <Rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  cornerRadius={Math.min(w, d) * 0.05}
                  fill="#7c897d"
                  stroke={edge}
                  strokeWidth={stroke}
                />
                {[-0.28, 0, 0.28].map((x) => (
                  <Line
                    key={x}
                    points={[x * w, -d * 0.4, x * w, d * 0.4]}
                    stroke="#c3cbc0"
                    strokeWidth={w * 0.05}
                  />
                ))}
              </>
            )}
          </Group>
        );
      })}
    </Group>
  );
}
