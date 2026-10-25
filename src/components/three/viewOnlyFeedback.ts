import * as THREE from 'three';

/** Only visibility changes: saved wall height, openings and materials stay intact. */
export function applyWallHoverVisibility(entry:{show:'full'|'stub'|'hidden';full:THREE.Object3D;stub:THREE.Object3D}, lower:boolean) {
  entry.full.visible=entry.show==='full'&&!lower;
  entry.stub.visible=entry.show==='stub'||(entry.show==='full'&&lower);
}

/** Private cloned geometry/material, never a tint on a shared supplier asset. */
export function removalHighlight(objects:readonly THREE.Object3D[]):THREE.Group {
  const root=new THREE.Group();
  root.name='remove-target-preview';
  const material=new THREE.MeshBasicMaterial({color:'#e14e46',transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
  for(const object of objects){
    object.updateWorldMatrix(true,true);
    object.traverseVisible(node=>{
      const mesh=node as THREE.Mesh;
      if(!mesh.isMesh||mesh.userData.hull)return;
      const copy=new THREE.Mesh(mesh.geometry.clone(),material);
      copy.matrixAutoUpdate=false;copy.matrix.copy(mesh.matrixWorld);
      // A tiny world-space lift makes the floor overlay legible without changing it.
      copy.matrix.elements[13]+=.006;
      copy.renderOrder=5;root.add(copy);
    });
  }
  root.userData.material=material;
  return root;
}
/** Clip the private floor overlay, not the floor, to a selected tile rectangle.
 * Clipping its existing triangles retains concave room edges and stair holes. */
export function clipRemovalHighlightToPlanBounds(root:THREE.Group, outline:readonly {x:number;y:number}[]) {
  if(outline.length<3)return;
  const bounds=[Math.min(...outline.map(p=>p.x)),Math.max(...outline.map(p=>p.x)),Math.min(...outline.map(p=>p.y)),Math.max(...outline.map(p=>p.y))];
  if(!bounds.every(Number.isFinite))return;
  for(const child of root.children){
    const mesh=child as THREE.Mesh;if(!mesh.isMesh)continue;
    const source=mesh.geometry,positions=source.getAttribute('position'),index=source.getIndex(),output:number[]=[];
    const length=index?.count??positions.count;
    for(let i=0;i<length;i+=3){
      let polygon=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix));
      for(const [axis,bound,sign] of [['x',bounds[0],1],['x',bounds[1],-1],['z',bounds[2],1],['z',bounds[3],-1]] as const){
        const clipped:THREE.Vector3[]=[];
        for(let j=0;j<polygon.length;j++){
          const a=polygon[j],b=polygon[(j+1)%polygon.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;
          if(da>=0)clipped.push(a);
          if((da>=0)!==(db>=0))clipped.push(a.clone().lerp(b,da/(da-db)));
        }
        polygon=clipped;if(polygon.length<3)break;
      }
      for(let j=1;j<polygon.length-1;j++)for(const point of [polygon[0],polygon[j],polygon[j+1]])output.push(point.x,point.y,point.z);
    }
    mesh.geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(output,3));
    mesh.matrix.identity();source.dispose();
  }
}
export function disposeRemovalHighlight(root:THREE.Group) {
  root.parent?.remove(root);
  root.traverse(node=>{const mesh=node as THREE.Mesh;if(mesh.isMesh)mesh.geometry.dispose();});
  (root.userData.material as THREE.Material|undefined)?.dispose();
}
