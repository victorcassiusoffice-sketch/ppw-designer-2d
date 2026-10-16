import { Circle, Group, Line, Text } from 'react-konva';
import { ECO_LIMITS, treeProtectionRadiusM, type EcoTree } from '../designer/eco';

/** Crown and protection envelopes share the same world-metre data as 3D. */
export function EcoTreesLayer({ trees, pxPerMetre, scale }: { trees?: readonly EcoTree[]; pxPerMetre: number; scale: number }) {
  return <Group name="eco-trees" listening={false}>
    {(trees ?? []).slice(0, ECO_LIMITS.trees).map(tree => {
      const r = tree.canopyRadiusM * pxPerMetre;
      const protection = treeProtectionRadiusM(tree);
      return <Group key={tree.id} name={`eco-tree-${tree.id}`} x={tree.x * pxPerMetre} y={tree.y * pxPerMetre}>
        {protection != null && <Circle radius={protection * pxPerMetre} stroke="#a06c37" strokeWidth={1 / scale} dash={[5 / scale, 4 / scale]} />}
        <Circle radius={r} fill={tree.status === 'existing' ? '#597c50' : '#93ae7c'} opacity={0.65} stroke="#375640" strokeWidth={1.2 / scale} />
        <Circle radius={r * 0.72} x={-r * 0.13} y={-r * 0.13} fill="#b2c69a" opacity={0.3} />
        <Line points={[-3 / scale, 0, 3 / scale, 0]} stroke="#263c2e" strokeWidth={1 / scale} />
        <Line points={[0, -3 / scale, 0, 3 / scale]} stroke="#263c2e" strokeWidth={1 / scale} />
        {r * scale > 25 && <Text x={-r} y={r + 4 / scale} width={r * 2} align="center" text={`${tree.name} · ${tree.heightM} m`} fontFamily="Inter, sans-serif" fontSize={10 / scale} fill="#304136" />}
      </Group>;
    })}
  </Group>;
}
