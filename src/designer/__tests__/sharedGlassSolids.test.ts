import { describe, expect, it } from 'vitest';
import { buildSolids, cutawayState } from '../roomSolids';
import { buildScene, type SceneInput, type SceneRoomInput } from '../roomView3d';

function rooms(): SceneRoomInput[] {
  return [
    { id: 'a', name: 'a', polygon: [{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}], wallConstructionByEdge: new Map([[1, 'glass']]), wallThicknessByEdge: new Map([[1, .012]]) },
    { id: 'b', name: 'b', polygon: [{x:4,y:0},{x:8,y:0},{x:8,y:3},{x:4,y:3}], wallConstructionByEdge: new Map([[3, 'glass']]), wallThicknessByEdge: new Map([[3, .012]]) },
  ];
}
const scene = (r = rooms()): SceneInput => ({ rooms: r, wallHeightM: 2.7, cameraPos: {x:12,y:5,z:6}, cameraTarget: {x:4,y:1.5,z:0} });

describe('one physical shared glass partition', () => {
  it('keeps both room addresses but renders one 12 mm centred pane, independent of room order', () => {
    for (const r of [rooms(), rooms().reverse()]) {
      const walls = buildSolids(scene(r)).walls.filter(w => w.construction === 'glass');
      expect(walls).toHaveLength(2);
      expect(walls.map(w => w.key).sort()).toEqual(['wall-a-1', 'wall-b-3']);
      expect(walls.every(w => w.centred && w.thicknessM === .012)).toBe(true);
      expect(walls.find(w => w.key === 'wall-b-3')!.renderDuplicateOf).toBe('wall-a-1');
      const physical = walls.filter(w => !w.renderDuplicateOf);
      expect(physical).toHaveLength(1);
      const w = physical[0];
      const sides = [-1, 1].map(sign => w.a.x + sign * w.inward.x * w.thicknessM / 2);
      expect(Math.max(...sides) - Math.min(...sides)).toBeCloseTo(.012, 10);
    }
  });
  it('stays visible from either room in cutaway without reviving its duplicate', () => {
    const s = buildSolids(scene());
    for (const x of [-10, 12]) {
      const state = cutawayState(s, {x,y:5,z:6}, {x:4,y:1.5,z:0});
      expect(state.get('wall-a-1')).toBe('full');
      expect(state.get('wall-b-3')).toBe('hidden');
      const faces = buildScene({...scene(), cameraPos:{x,y:5,z:6}});
      expect(faces.filter(f => f.key === 'wall-a-1')).toHaveLength(1);
      expect(faces.some(f => /^(wall|stub|stub-in|cap)-b-3$/.test(f.key))).toBe(false);
      const cap = faces.find(f => f.key === 'cap-a-1')!;
      expect(Math.min(...cap.pts.map(p=>p.x))).toBeCloseTo(4-.006,10);
      expect(Math.max(...cap.pts.map(p=>p.x))).toBeCloseTo(4+.006,10);
    }
  });
  it('keeps one-sided imported circular cutouts and deduplicates mirrored copies with different IDs', () => {
    const r=rooms();
    r[1].openings=[{id:'peer-hole',edgeIndex:3,offsetM:.8,widthM:.5,heightM:.5,sillM:1,kind:'hole',shape:'circle'}];
    let s=buildSolids(scene(r));
    const hole=s.walls.find(w=>w.key==='wall-a-1')!.openings[0];
    expect(hole).toMatchObject({id:'peer-hole',bottomM:1,topM:1.5,shape:'circle'});
    expect(hole.t0M).toBeCloseTo(1.95,10);
    expect(hole.t1M).toBeCloseTo(2.45,10);
    expect(hole.profile!.length).toBeGreaterThanOrEqual(64);
    expect(buildScene(scene(r)).find(f=>f.key==='wall-a-1')!.holes).toHaveLength(1);
    r[0].openings=[{...r[1].openings[0],id:'original',edgeIndex:1,offsetM:2.2}];
    s=buildSolids(scene(r));
    expect(s.walls.find(w=>w.key==='wall-a-1')!.openings).toHaveLength(1);
  });
  it('does not suppress mismatched, partial, or masonry walls', () => {
    const mismatch=rooms(); mismatch[1].wallThicknessByEdge!.set(3,.01);
    expect(buildSolids(scene(mismatch)).walls.every(w=>!w.renderDuplicateOf)).toBe(true);
    const partial=rooms(); partial[1].polygon[2].y=2; partial[1].polygon[3].y=2;
    expect(buildSolids(scene(partial)).walls.every(w=>!w.renderDuplicateOf)).toBe(true);
    const masonry=rooms(); masonry.forEach(r=>r.wallConstructionByEdge=undefined);
    expect(buildSolids(scene(masonry)).walls.every(w=>!w.renderDuplicateOf && !w.centred)).toBe(true);
  });
  it('keeps free-standing glass transparent in the fallback renderer, including its cap', () => {
    const input=scene([]);
    input.walls=[{id:'pane',a:{x:0,y:0},b:{x:4,y:0},construction:'glass',thicknessM:.012}];
    const faces=buildScene(input).filter(f=>f.key.startsWith('fw-pane-'));
    expect(faces.length).toBeGreaterThan(1);
    expect(faces.every(f=>f.alpha===.25 && f.flat)).toBe(true);
    const cap=faces.find(f=>f.key==='fw-pane-cap')!;
    expect(Math.max(...cap.pts.map(p=>p.y))-Math.min(...cap.pts.map(p=>p.y))).toBeCloseTo(.012,10);
  });
});
