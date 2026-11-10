import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { usePropertyStore } from '../../store/propertyStore';
import { useLinkStore } from '../../store/linkStore';
import { JOB_STATUSES, TRADE_ROLES, workGeometry, workItems, type WorkItem } from '../../designer/link/tradeWork';
import { statusLabels } from './statusLabels';
import { useTradeFlow } from './tradeFlow';
import type { OverlayFrame } from './TradeOverlayHost';
import { overlayProjection, pickPixel } from './tradeOverlayGeometry';
import './tradeOverlay.css';

import { tradeAppearance } from './tradeAppearance';
const fileInks:Record<string,string>={sent:'#436885',quote:'#6f4382',booked:'#4d528c',working:'#325f62',done:'#325f62',invoiced:'#924972',paid:'#314b36',lost:'#665764'};
const human=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const trade=(i:WorkItem)=>TRADE_ROLES.find(t=>t.id===i.trade)?.label??i.trade;

/** Coordination ink is an overlay: it does not mutate the renderer, material,
 * room colour, estimate, floor selection or camera. Closed mode mounts none. */
export default function TradeProgressOverlay(frame:OverlayFrame) {
  const property=usePropertyStore(s=>s.property);
  const rows=useLinkStore(s=>s.packages),loadError=useLinkStore(s=>s.loadError);
  const flow=useTradeFlow(), [look,setLook]=useState(false),[showKey,setKey]=useState(false);
  const [selection,setSelection]=useState<{id:string;ref:string}|null>(null),[message,setMessage]=useState('');
  const [cameraTick,refresh]=useState(0);
  const pointer=useRef<{id:number;x:number;y:number}|null>(null),panel=useRef<HTMLDialogElement>(null);
  const lastFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{void useLinkStore.getState().hydrate()},[]);
  useEffect(()=>{if(flow.projectId!==property.id)useTradeFlow.getState().scope(property.id)},[property.id,flow.projectId]);
  // Three installs its current camera in its effects. Re-project once after
  // the commit, including damped orbit steps; never poll a stationary scene.
  const camera=frame.view==='house'?frame.camera:null, walls=frame.view==='house'?frame.wallView:null;
  const solids=frame.view==='house'?frame.solids:null;
  useEffect(()=>{if(!camera)return;const id=requestAnimationFrame(()=>refresh(n=>n+1));return()=>cancelAnimationFrame(id)},[camera,walls,solids,frame.size.width,frame.size.height]);
  const data=useMemo(()=>{try{return {g:workGeometry(property),items:workItems(property,rows),error:''};}
    catch(e){return {g:null,items:[],error:e instanceof Error?e.message:'Cannot map this plan.'}}},[property,rows]);
  const visibleLevels=useMemo(()=>new Set(solids?
    [frame.levelId,...solids.floors.map(f=>f.levelId??'ground'),...solids.walls.map(f=>f.levelId??'ground'),...solids.items.map(f=>f.levelId??'ground')]:[frame.levelId]),[frame.levelId,solids]);
  const items=useMemo(()=>data.items.filter(i=>flow.role==='owner'||flow.role===i.trade),[data.items,flow.role]);
  const drawing=useMemo(()=>{
    if(!data.g)return [];
    const project=overlayProjection(frame,data.g,property.foundation);
    return items.flatMap(item=>{
      const anchors=item.anchors.filter(pin=>visibleLevels.has(pin.levelId)).map(pin=>({pin,shape:project.ink(pin,item.kind==='package'),point:project.screen(pin)}));
      return anchors.length?[{item,anchors}]:[];
    });
    // The frame is intentionally sampled after the Three camera commit.
  },[frame,data.g,items,visibleLevels,property.foundation,cameraTick]);
  const selected=items.find(i=>i.id===selection?.id);
  const related=selection?items.filter(i=>i.id!==selection.id&&i.anchors.some(pin=>pin.planRef===selection.ref)):[];
  const modal=showKey||!!selected;
  useEffect(()=>{
    const d=panel.current;if(!modal||!d)return;
    lastFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    d.showModal();
    return()=>{d.close();if(lastFocus.current?.isConnected)lastFocus.current.focus({preventScroll:true})};
  },[modal]);
  function dismiss(){setKey(false);setSelection(null)}
  useEffect(()=>{
    const esc=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;e.preventDefault();e.stopImmediatePropagation();
      if(modal)dismiss();else useTradeFlow.getState().returnToDashboard()};
    window.addEventListener('keydown',esc,true);return()=>window.removeEventListener('keydown',esc,true);
  },[modal]);
  if(property.id!==flow.projectId||flow.mode==='off')return null;
  const picking=flow.mode==='pick';
  function pick(e:PointerEvent<SVGSVGElement>){
    const press=pointer.current;pointer.current=null;
    if(!press||press.id!==e.pointerId||Math.hypot(e.clientX-press.x,e.clientY-press.y)>9||!data.g)return;
    const bounds=e.currentTarget.getBoundingClientRect();
    const pin=pickPixel(frame,data.g,{x:(e.clientX-bounds.left)*frame.size.width/bounds.width,y:(e.clientY-bounds.top)*frame.size.height/bounds.height});
    if(!pin){setMessage(frame.view==='house'&&frame.backend==='painter'?'Switch to Plan to place a precise pin without WebGL.':'Choose a physical storey and tap a visible part of the build.');return}
    flow.finishPick(pin);
  }
  return <div className="trade-map-layer" data-testid="trade-progress-overlay" data-mode={flow.mode} data-view={frame.view} data-level={frame.levelId} aria-label={picking?'Pick a job location':'Trade progress on the model'}>
    <svg data-testid="trade-progress-shapes" width="100%" height="100%" viewBox={`0 0 ${frame.size.width} ${frame.size.height}`} aria-hidden="true" className="trade-map-ink">
      {[...drawing].reverse().flatMap(({item,anchors})=>anchors.flatMap(({pin,shape},a)=>shape.filter(s=>s.d).map((s,j)=><g key={`${item.id}:${a}:${j}`}>
        <path d={s.d} data-plan-ref={pin.planRef} data-work-id={item.id} data-status={item.status} data-exchange={item.exchange}
          fill={s.line?'none':tradeAppearance[item.status].ink} fillOpacity=".36" fillRule="evenodd"
          stroke={tradeAppearance[item.status].ink} strokeWidth={s.line?6:2.5} strokeLinejoin="round" strokeLinecap="round"
          style={{pointerEvents:!picking&&!look?'visiblePainted':'none',cursor:'pointer'}}
          onClick={()=>{setSelection({id:item.id,ref:pin.planRef});setKey(false)}}/>
        {fileInks[item.exchange]&&<path d={s.d} fill="none" stroke={fileInks[item.exchange]} strokeWidth={s.line?2.5:1.6} strokeDasharray="5 3" pointerEvents="none"/>}
      </g>)))}
    </svg>
    {!look&&!picking&&drawing.map(({item,anchors})=>{
      const a=anchors.find(({point})=>point&&point.x>=0&&point.y>=0&&point.x<=frame.size.width&&point.y<=frame.size.height);
      if(!a?.point)return null;
      return <button key={item.id} className="trade-map-pin" data-testid="trade-work-pin" data-work-id={item.id} data-plan-ref={a.pin.planRef} data-status={item.status}
        aria-label={`${item.title}, ${trade(item)}, ${item.status}`} title={item.title}
        style={{left:a.point.x,top:a.point.y,color:tradeAppearance[item.status].ink}} onClick={()=>{setSelection({id:item.id,ref:a.pin.planRef});setKey(false)}}>
          <span style={{borderColor:fileInks[item.exchange]??'white'}}>{tradeAppearance[item.status].symbol}</span></button>;
    })}
    {picking&&!look&&<svg data-testid="trade-pin-target" className="trade-pin-target" aria-label="Tap a spot on the model" width="100%" height="100%"
      onPointerDown={e=>{if(!e.isPrimary||e.button!==0){pointer.current=null;return}e.preventDefault();pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerUp={pick} onPointerCancel={()=>{pointer.current=null}}/>}
    <div className="trade-map-tools" aria-label="Progress map controls">
      <button type="button" onClick={flow.returnToDashboard}>Dashboard</button>
      <button type="button" onClick={()=>{setKey(true);setSelection(null)}}>Status key</button>
      <button type="button" aria-pressed={look} onClick={()=>{setLook(!look);setMessage('')}}>{look?(picking?'Place pin':'Inspect'):'Navigate'}</button>
    </div>
    {(data.error||loadError||message||(!look&&picking)||(!picking&&!drawing.length))&&<div className="trade-map-hint" role="status">
      {data.error||loadError||message||(picking?'Tap a wall, room or service to pin the job.':'No mapped work on this storey.')}
    </div>}
    {modal&&<dialog ref={panel} className="trade-map-sheet" data-build-surface="" data-testid={selected?'trade-part-detail':'trade-status-key'} aria-label={selected?selected.title:'Status key'}
      onCancel={e=>{e.preventDefault();dismiss()}} onClick={e=>{if(e.target===panel.current){const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dismiss()}}}>
      <header><h2>{selected?selected.title:'Status key'}</h2><button type="button" onClick={dismiss} aria-label="Close map details">Close</button></header>
      {selected?<><p>{trade(selected)} · {selected.kind==='job'?'Pinned job':'Work package'}</p>
        <p><i aria-hidden="true" style={{background:tradeAppearance[selected.status].ink}}/>{tradeAppearance[selected.status].symbol} {human(selected.status)}{selected.exchange!=='draft'&&' · '+statusLabels[selected.exchange]}</p>
        <p className="trade-map-small">{selected.kind==='package'&&selection?.ref.startsWith('olb:level:')?'Storey-wide scope: this estimate is not allocated to individual elements.':selection?.ref}</p>
        <h3>History</h3><ol className="trade-map-history">{selected.history.map(h=><li key={h.id}><strong>{h.label}</strong><span>{h.actor} · <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time></span></li>)}</ol>
        {related.length>0&&<><h3>Other work on this part</h3>{related.map(i=><button key={i.id} type="button" onClick={()=>setSelection({id:i.id,ref:selection!.ref})}>{i.title} · {human(i.status)}</button>)}</>}
      </>:<><p>Colour shows reported work. A dashed edge shows the work-file stage; a quote or invoice does not mean the work is done.</p>
        <ul className="trade-map-colours">{JOB_STATUSES.map(s=><li key={s}><i aria-hidden="true" style={{background:tradeAppearance[s].ink}}/>{tradeAppearance[s].symbol} {human(s)}</li>)}</ul>
        {Array.from(new Set(drawing.map(d=>d.item.exchange))).filter(s=>fileInks[s]).map(s=><p key={s}><b className="trade-file-line" style={{borderColor:fileInks[s]}}/>{statusLabels[s]}</p>)}
        <p className="trade-map-small">This is a coordination overlay, including concealed routes. Storey-wide estimates are marked across their floor. Navigate lets the usual camera controls take over.</p>
        {!picking&&<><h3>Work on the model</h3>{drawing.length?drawing.map(({item,anchors})=><button key={item.id} type="button" onClick={()=>{setKey(false);setSelection({id:item.id,ref:anchors[0].pin.planRef})}}>{item.title} · {human(item.status)}</button>):<p>No mapped work in this view.</p>}</>}
      </>}
    </dialog>}
  </div>;
}
