// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSolids } from '../../../designer/roomSolids';
import { sampleMeasuredPath } from '../../../designer/measuredPath';
import { cornerShades } from '../dressing';

describe('measured curved wall shading', () => {
  it('preserves floor/base shading but draws vertical occlusion only at real endpoints', () => {
    const sample=sampleMeasuredPath({start:{x:0,y:0},segments:[{kind:'quadratic',control:{x:2,y:2},to:{x:4,y:0}}]})!;
    const walls=sample.vertices.slice(1).map((b,i)=>({id:`arc-${i}`,a:sample.vertices[i],b}));
    const solids=buildSolids({rooms:[],walls,wallHeightM:2.7,cameraPos:{x:8,y:8,z:8},cameraTarget:{x:2,y:0,z:0}});
    expect(solids.walls.length).toBeGreaterThan(10);
    for(const[w,i]of solids.walls.map((w,i)=>[w,i] as const)) {
      expect(Boolean(w.smoothStart)).toBe(i>0);
      expect(Boolean(w.smoothEnd)).toBe(i<solids.walls.length-1);
      const dressing=cornerShades(w,2.7,[]);
      expect(dressing.children.length).toBe(i===0||i===solids.walls.length-1?3:2);
    }
  });
  it('keeps occlusion at right-angle corners and does not merge T junctions', () => {
    const walls=[{id:'a',a:{x:0,y:0},b:{x:2,y:0}},{id:'b',a:{x:2,y:0},b:{x:2,y:2}}];
    const input={rooms:[],walls,wallHeightM:2.7,cameraPos:{x:8,y:8,z:8},cameraTarget:{x:2,y:0,z:0}};
    expect(buildSolids(input).walls.every(w=>!w.smoothStart&&!w.smoothEnd)).toBe(true);
    walls.push({id:'c',a:{x:2,y:0},b:{x:4,y:0}});
    expect(buildSolids(input).walls.every(w=>!w.smoothStart&&!w.smoothEnd)).toBe(true);
  });
});
