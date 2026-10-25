import { describe,expect,it } from 'vitest';
import { createAutoAoState,sampleAutoAo } from '../adaptiveAmbientOcclusion';
import { naturalRenderResolution } from '../naturalSceneRenderer';

function run(fps:number,frames=300) {
  let state=createAutoAoState();
  for(let i=0;i<frames;i++) state=sampleAutoAo(state,i*1000/fps);
  return state;
}
describe('measured desktop Auto corner shading',()=>{
  it('keeps Auto AO buffers lighter without changing the viewport aspect or High profile',()=>{
    const balanced=naturalRenderResolution(1280,800,2,true),high=naturalRenderResolution(1280,800,2);
    expect(balanced.beautyWidth/balanced.beautyHeight).toBeCloseTo(1.6);
    expect(balanced.beautyWidth*balanced.beautyHeight).toBeLessThan(high.beautyWidth*high.beautyHeight);
    expect(balanced.aoWidth*balanced.aoHeight).toBeLessThanOrEqual(500000);
  });
  it('retains AO only after a real 45fps-or-faster window',()=>{
    expect(run(60).mode).toBe('enabled');
    expect(run(45).mode).toBe('enabled');
    expect(run(44).mode).toBe('disabled');
    expect(run(20).mode).toBe('disabled');
  });
  it('excludes a bounded shader warm-up before measuring sustained rendered frames',()=>{
    let state=createAutoAoState();
    for(let now=0;now<1500;now+=150)state=sampleAutoAo(state,now);
    expect(state.mode).toBe('probing');expect(state.fps).toBeNull();
    for(let now=1500;now<=3200;now+=1000/60)state=sampleAutoAo(state,now);
    expect(state.mode).toBe('enabled');expect(state.fps).toBeGreaterThan(59);
  });
  it('downgrades a previously fast scene when sustained orbit becomes slow',()=>{
    let state=run(60);let now=state.last!;
    for(let i=0;i<70;i++) {now+=1000/30;state=sampleAutoAo(state,now);}
    expect(state.mode).toBe('disabled');
    expect(state.fps).toBeLessThan(45);
  });
  it('does not count an idle user pause as poor performance or repeatedly retry a failure',()=>{
    const enabled=run(60),paused=sampleAutoAo(enabled,enabled.last!+10000);
    expect(paused.mode).toBe('enabled');expect(paused.intervals).toBe(0);
    const slow=run(20);expect(sampleAutoAo(slow,slow.last!+16)).toBe(slow);
    expect(sampleAutoAo(enabled,NaN)).toBe(enabled);
  });
});
