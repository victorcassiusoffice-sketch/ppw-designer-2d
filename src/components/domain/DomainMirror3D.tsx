/**
 * DomainMirror3D — procedural 3D mirror surface (DESIGNER-EXPANSION P5).
 *
 * Renders the `buildDomainScene(domain)` procedural scene-graph for a domain's
 * `render.mirror3d` (car turntable / airplane cabin). Because the Designer's
 * Babylon engine was removed (`be15d21`) and reinstating a WebGL engine is a
 * separate Vic-gated call, this paints the scene-graph as a deterministic SVG
 * projection — the GUARDED FALLBACK the P5 gate calls for. `hasWebGL()` flags
 * whether a live GL renderer COULD mount (a future enhancement consuming the
 * same node tree); today the SVG path always renders, so the mirror is
 * machine-verifiable headless.
 *
 * Wellness-room has no `mirror3d` → this renders nothing (2D-only, unchanged).
 */
import { useMemo } from 'react';
import type { DomainId } from '../../lib/domain';
import { buildDomainScene } from '../../lib/domain/scene3d';
import type { SceneNode } from '../../lib/domain/scene3d';
import { hasWebGL } from '../../lib/domain/renderCaps';

export interface DomainMirror3DProps {
  domain: DomainId;
}

const VIEW = 320; // square SVG viewport in px
const PAD = 24;

/** Flatten the leaf meshes (skip pure groups) for projection. */
function leaves(node: SceneNode): SceneNode[] {
  if (node.children.length === 0) return node.kind === 'group' ? [] : [node];
  return node.children.flatMap(leaves);
}

export function DomainMirror3D({ domain }: DomainMirror3DProps): JSX.Element | null {
  const scene = useMemo(() => buildDomainScene(domain), [domain]);
  const glAvailable = useMemo(() => hasWebGL(), []);

  if (!scene) return null;

  const meshes = leaves(scene.root);

  // Project model (x, z) → SVG (x, y) top-down, auto-fitting the extent.
  const xs = meshes.map((m) => m.position.x);
  const zs = meshes.map((m) => m.position.z);
  const minX = Math.min(...xs, -scene.root.size.x / 2);
  const maxX = Math.max(...xs, scene.root.size.x / 2);
  const minZ = Math.min(...zs, -scene.root.size.z / 2);
  const maxZ = Math.max(...zs, scene.root.size.z / 2);
  const spanX = Math.max(0.001, maxX - minX);
  const spanZ = Math.max(0.001, maxZ - minZ);
  const scale = (VIEW - PAD * 2) / Math.max(spanX, spanZ);
  const toX = (x: number): number => PAD + (x - minX) * scale;
  const toY = (z: number): number => PAD + (z - minZ) * scale;

  return (
    <section
      data-testid="domain-mirror-3d"
      data-domain={domain}
      data-mirror={scene.mirror}
      data-gl={glAvailable ? 'webgl' : 'fallback-svg'}
      className="domain-mirror-3d"
      aria-label={`${domain} 3D mirror (procedural)`}
    >
      <header className="domain-mirror-head">
        <span className="domain-mirror-title">
          3D mirror · {scene.mirror === 'turntable-3d' ? 'turntable' : 'cabin'}
        </span>
        <span data-testid="domain-mirror-nodecount" className="domain-mirror-meta">
          {scene.nodeCount} nodes · {scene.camera.type} camera
        </span>
      </header>

      <svg
        data-testid={glAvailable ? 'domain-mirror-gl' : 'domain-mirror-fallback'}
        role="img"
        aria-label={`${domain} procedural scene projection`}
        width={VIEW}
        height={VIEW}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="domain-mirror-svg"
      >
        {meshes.map((m) => {
          const w = Math.max(4, m.size.x * scale);
          const h = Math.max(4, (m.size.z || m.size.x) * scale);
          const cx = toX(m.position.x);
          const cy = toY(m.position.z);
          if (m.kind === 'cylinder') {
            return (
              <circle
                key={m.id}
                data-testid={`mirror-node-${m.id}`}
                cx={cx}
                cy={cy}
                r={Math.max(3, (m.size.x * scale) / 2)}
                fill="#232c3b"
              />
            );
          }
          return (
            <rect
              key={m.id}
              data-testid={`mirror-node-${m.id}`}
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={3}
              fill={m.kind === 'tube' ? 'rgba(35,44,59,0.12)' : '#c9a227'}
              stroke="#232c3b"
              strokeWidth={1}
            />
          );
        })}
      </svg>
    </section>
  );
}
