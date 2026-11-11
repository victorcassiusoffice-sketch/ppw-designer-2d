import * as THREE from 'three';
import {
  detectFace,
  faceLoop,
  flatten,
  type BoundaryComponent,
} from '../../designer/boundaryModel';

/** Triangles are a display cache. The saved model retains vertices, shared edges and face loops. */
export function addBoundaryMeshes(scene: THREE.Scene, components: BoundaryComponent[]) {
  const group = new THREE.Group();
  const fill = new THREE.MeshStandardMaterial({
    color: 0x92b6ac,
    side: THREE.DoubleSide,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const stroke = new THREE.LineBasicMaterial({ color: 0x25483e });
  const buffers: THREE.BufferGeometry[] = [];
  for (const component of components) {
    const points = component.vertices.map((p) => new THREE.Vector3(p.x, p.z, p.y));
    const indices: number[] = [];
    for (const refs of component.faces) {
      const loop = faceLoop(component, refs),
        plane = detectFace(loop).plane;
      const contour = loop.map((p) => {
        const q = flatten(p, plane);
        return new THREE.Vector2(q.x, q.y);
      });
      const positions = refs.map((ref) => component.edges[Math.abs(ref) - 1][ref > 0 ? 0 : 1]);
      for (const triangle of THREE.ShapeUtils.triangulateShape(contour, []))
        indices.push(...triangle.map((i) => positions[i]));
    }
    if (indices.length) {
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      geom.setIndex(indices);
      geom.computeVertexNormals();
      const mesh = new THREE.Mesh(geom, fill);
      mesh.userData.boundaryComponentId = component.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      buffers.push(geom);
    }
    const lines = new THREE.BufferGeometry().setFromPoints(
      component.edges.flatMap(([a, b]) => [points[a], points[b]]),
    );
    group.add(new THREE.LineSegments(lines, stroke));
    buffers.push(lines);
  }
  scene.add(group);
  return () => {
    group.removeFromParent();
    buffers.forEach((buffer) => buffer.dispose());
    fill.dispose();
    stroke.dispose();
  };
}
