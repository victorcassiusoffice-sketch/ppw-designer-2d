import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { applyWallHoverVisibility,removalHighlight,clipRemovalHighlightToPlanBounds,disposeRemovalHighlight } from '../viewOnlyFeedback';
describe('reversible view-only wall and erase feedback',()=>{
  it('lowers only full walls and restores the exact current camera cutaway state',()=>{
    const full=new THREE.Group(),stub=new THREE.Group();
    for(const show of ['full','stub','hidden'] as const){
      const entry={show,full,stub};applyWallHoverVisibility(entry,true);
      expect(full.visible).toBe(false);expect(stub.visible).toBe(show!=='hidden');
      applyWallHoverVisibility(entry,false);expect(full.visible).toBe(show==='full');expect(stub.visible).toBe(show==='stub');
      expect(entry.show).toBe(show);
    }
  });
  it('makes private highlight geometry without recolouring or moving the original product',()=>{
    const geometry=new THREE.BoxGeometry(2,1,.5),material=new THREE.MeshStandardMaterial({color:'#abc123'});
    const product=new THREE.Mesh(geometry,material);product.position.set(3,2,1);product.updateMatrixWorld(true);
    const highlight=removalHighlight([product]),copy=highlight.children[0] as THREE.Mesh;
    expect(copy.geometry).not.toBe(geometry);expect(copy.material).not.toBe(material);
    expect(material.color.getHexString()).toBe('abc123');expect(product.position.toArray()).toEqual([3,2,1]);
    expect(new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3()).toArray()).toEqual([2,1,.5]);
    disposeRemovalHighlight(highlight);expect(product.geometry).toBe(geometry);expect(product.material).toBe(material);
  });
  it('clips a floor highlight to the clicked tile without changing the measured floor',()=>{
    const geometry=new THREE.BoxGeometry(6,.18,4),floor=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());floor.position.set(3,0,2);
    const highlight=removalHighlight([floor]);
    clipRemovalHighlightToPlanBounds(highlight,[{x:1,y:2},{x:2,y:2},{x:2,y:3},{x:1,y:3}]);
    const bounds=new THREE.Box3().setFromObject(highlight);
    expect(bounds.min.x).toBeCloseTo(1);expect(bounds.max.x).toBeCloseTo(2);expect(bounds.min.z).toBeCloseTo(2);expect(bounds.max.z).toBeCloseTo(3);
    expect(new THREE.Box3().setFromObject(floor).getSize(new THREE.Vector3()).toArray()).toEqual([6,expect.closeTo(.18),4]);
    expect(floor.geometry).toBe(geometry);disposeRemovalHighlight(highlight);geometry.dispose();(floor.material as THREE.Material).dispose();
  });
});
