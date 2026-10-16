// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Property, Room } from '../../store/propertyStore';
import { useProjectHubStore, emptyRegister } from '../../store/projectHubStore';
import { DepartmentTaskSchema, ProjectRegisterSchema, projectMetrics, projectRevisionSource, parseProjectHandover, importHandoverTasks } from '../projectHub';

const rectangle = (id: string, x: number, width = 4, levelId?: string): Room => ({ id, name: id, polygon: [{x,y:0},{x:x+width,y:0},{x:x+width,y:3},{x,y:3}], placedItems: [], ...(levelId ? {levelId} : {}) });
const property = (rooms: Room[]): Property => ({ id:'project-a', name:'Measured test project', activeRoomId:rooms[0]?.id ?? '', rooms, wallHeightM:3 });
const task = (id='task-1') => ({ id, title:'Check foundation evidence', department:'engineering' as const, note:'Review documents', status:'open' as const });
const fingerprint = 'a'.repeat(64);
const bundle = () => ({format:'one-live-build/project-handover',version:1,units:'metres',projectId:'project-a',fingerprint,register:{...emptyRegister('project-a'),tasks:[task()]},snapshot:{},engineVersions:[],review:{}});

describe('one measured project across department views', () => {
  it('unions overlaps on each floor, adds storeys and excludes roof/outdoor floor area', () => {
    const p = property([rectangle('ground-a',0),rectangle('ground-b',2),rectangle('upper',0,4,'first'),{...rectangle('roof',0),kind:'roof'},{...rectangle('garden',20),kind:'outdoor'}]);
    p.levels=[{id:'ground',name:'Ground',index:0},{id:'first',name:'First',index:1},{id:'roof',name:'Roof',index:2,kind:'roof'}];
    const result = projectMetrics(p);
    expect(result.floorAreaM2).toBeCloseTo(18+12,8);
    expect(result.footprintM2).toBeCloseTo(18,8);
    expect(result.floors).toBe(2);
  });
  it('counts a shared wall once and does not depend on the selected room or level', () => {
    const p = property([rectangle('left',0),rectangle('right',4)]);
    expect(projectMetrics(p).wallNetAreaM2).toBeCloseTo(25*3,8);
    expect(projectMetrics({...p,activeRoomId:'right',activeLevelId:'first'})).toEqual(projectMetrics(p));
  });
  it('canonical revisions ignore selected floor/room and object-key order, but retain actual dimensions', () => {
    const p = property([rectangle('room',0)]);
    const reordered = {rooms:p.rooms,activeRoomId:'other',activeLevelId:'roof',wallHeightM:3,name:p.name,id:p.id};
    expect(projectRevisionSource(reordered)).toBe(projectRevisionSource(p));
    expect(projectRevisionSource({...p,wallHeightM:3.1})).not.toBe(projectRevisionSource(p));
  });
  it('preserves an oversized model and explicitly withholds its quantities', () => {
    const p=property(Array.from({length:301},(_,i)=>rectangle(`room-${i}`,i*5)));
    const before=JSON.stringify(p), result=projectMetrics(p);
    expect(result.available).toBe(false);
    expect(result.floorAreaM2).toBeNull(); expect(result.concreteNetM3).toBeNull();
    expect(result.unavailableReason).toBeTruthy(); expect(JSON.stringify(p)).toBe(before);
  });
});

describe('bounded handovers without destructive geometry imports', () => {
  it('rejects malformed dates, reserved IDs, unsupported fields and duplicate task IDs', () => {
    expect(DepartmentTaskSchema.safeParse({...task(),due:'2026-02-30'}).success).toBe(false);
    expect(DepartmentTaskSchema.safeParse({...task(),due:'2028-02-29'}).success).toBe(true);
    expect(DepartmentTaskSchema.safeParse({...task(),id:'__proto__'}).success).toBe(false);
    expect(DepartmentTaskSchema.safeParse({...task(),recipientEmail:'not-a-task-field'}).success).toBe(false);
    expect(ProjectRegisterSchema.safeParse({...emptyRegister('a'),tasks:[task(),task()]}).success).toBe(false);
    expect(ProjectRegisterSchema.safeParse({...emptyRegister('a'),revision:1e30}).success).toBe(false);
  });
  it('imports only new task IDs against the exact build and leaves existing tasks intact', () => {
    const current = {...emptyRegister('project-a'),tasks:[{...task(),status:'done' as const}]};
    const incoming = parseProjectHandover(JSON.stringify({...bundle(),register:{...bundle().register,tasks:[task(),task('new')]},snapshot:{maliciousReplacement:true}}));
    const result=importHandoverTasks(current,incoming,fingerprint);
    expect(result.tasks).toEqual([current.tasks[0],task('new')]);
    expect(result.revision).toBe(1);
    expect(current.tasks).toHaveLength(1);
    expect(() => importHandoverTasks(current,incoming,'b'.repeat(64))).toThrow('differentBuild');
    expect(() => importHandoverTasks(emptyRegister('other'),incoming,fingerprint)).toThrow('differentBuild');
  });
  it('rejects cross-project registers and files beyond the import cap', () => {
    expect(() => parseProjectHandover(JSON.stringify({...bundle(),register:emptyRegister('other')}))).toThrow();
    expect(() => parseProjectHandover(' '.repeat(5_000_001))).toThrow('handoverTooLarge');
  });
});

describe('department register revision control', () => {
  beforeEach(() => useProjectHubStore.setState({registers:{}}));
  it('rejects stale changes and isolates projects', () => {
    expect(useProjectHubStore.getState().upsert('project-a',task(),0)).toBe(true);
    expect(useProjectHubStore.getState().upsert('project-a',task('stale'),0)).toBe(false);
    expect(useProjectHubStore.getState().upsert('project-b',task('second'),0)).toBe(true);
    expect(useProjectHubStore.getState().registers['project-a'].tasks).toEqual([task()]);
    expect(useProjectHubStore.getState().registers['project-b'].tasks).toEqual([task('second')]);
  });
  it('retains every valid project after reload instead of dropping projects after the first hundred', async () => {
    for(let i=0;i<101;i++) expect(useProjectHubStore.getState().upsert(`p-${i}`,task(),0)).toBe(true);
    await useProjectHubStore.persist.rehydrate();
    expect(Object.keys(useProjectHubStore.getState().registers)).toHaveLength(101);
    expect(useProjectHubStore.getState().registers['p-100'].tasks).toEqual([task()]);
  });
});
