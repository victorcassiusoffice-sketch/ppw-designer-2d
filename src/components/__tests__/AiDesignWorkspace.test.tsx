/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiDesignWorkspace } from '../AiDesignWorkspace';
import { normaliseLoadedProperty, usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useHistoryStore, installHistorySubscriptions, __test } from '../../store/historyStore';
import { createGuidedDesign } from '../../designer/aiDesignContract';
import { switchToPage } from '../../lib/pages';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let host: HTMLDivElement;
const beforeOpen = vi.fn();
const click = (name: string) => { const b=[...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(x=>x.textContent?.trim()===name); expect(b, name).toBeDefined(); act(()=>b!.click()); };
function open() { act(()=>window.dispatchEvent(new Event('ppw:open-ai-design'))); }
function input(el: HTMLInputElement | HTMLTextAreaElement, value: string) { act(()=>{const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}); }
beforeEach(()=>{
  localStorage.clear(); usePropertyStore.getState().resetToDefault(); useDesignerUIStore.getState().setViewMode('plan');
  usePropertyStore.getState().renameProperty('Victors existing project');
  usePropertyStore.getState().setRoomPolygon(usePropertyStore.getState().property.activeRoomId,[{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}]);
  useDesignsStore.setState({designs:{},currentId:null}); useHistoryStore.getState().reset();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(<AiDesignWorkspace onBeforeOpen={beforeOpen}/>));
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllMocks();});
describe('Design assistant draft review',()=>{
  it('does not overwrite typed JSON with an older asynchronous file read',async()=>{
    open();click('Import a draft');
    let resolve!:(text:string)=>void;
    const file={size:20,text:()=>new Promise<string>(done=>{resolve=done;})};
    const fileInput=document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(fileInput,'files',{value:[file],configurable:true});
    act(()=>fileInput.dispatchEvent(new Event('change',{bubbles:true})));
    input(document.querySelector('textarea')!,'{"title":"New typed input"}');
    await act(async()=>resolve('{"title":"Old file"}'));
    expect(document.querySelector('textarea')!.value).toBe('{"title":"New typed input"}');
  });
  it('invalidates an acknowledged review when another file is rejected or unreadable',async()=>{
    open();click('Import a draft');input(document.querySelector('textarea')!,JSON.stringify(createGuidedDesign({})));click('Validate draft');
    act(()=>document.querySelector<HTMLInputElement>('.design-ack input')!.click());
    const fileInput=document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(fileInput,'files',{value:[{size:500001,text:vi.fn()}],configurable:true});
    act(()=>fileInput.dispatchEvent(new Event('change',{bubbles:true})));
    expect(document.querySelector('.design-ack')).toBeNull();expect(document.querySelector('[role=alert]')?.textContent).toContain('500 KB');
    Object.defineProperty(fileInput,'files',{value:[{size:20,text:async()=>{throw new Error('read failed');}}],configurable:true});
    await act(async()=>fileInput.dispatchEvent(new Event('change',{bubbles:true})));
    expect(document.querySelector('[role=alert]')?.textContent).toContain('could not be read');
    expect(usePropertyStore.getState().property.name).toBe('Victors existing project');
  });
  it('does not send editing shortcuts to the canvas behind its modal',()=>{
    open();const behind=vi.fn();window.addEventListener('keydown',behind);
    try {act(()=>document.querySelector<HTMLButtonElement>('[aria-label="Close design assistant"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true})));expect(behind).not.toHaveBeenCalled();}
    finally {window.removeEventListener('keydown',behind);}
  });
  it('starts the new concept with fresh history, so Undo cannot replace it with its temporary blank page',()=>{
    __test.resetSubscriptions();const stop=installHistorySubscriptions({coalesceMs:0});
    try {open();click('Create measured draft');act(()=>document.querySelector<HTMLInputElement>('.design-ack input')!.click());click('Add as a new plan');
      const house=usePropertyStore.getState().property;expect(useHistoryStore.getState().past).toEqual([]);act(()=>useHistoryStore.getState().undo());expect(usePropertyStore.getState().property).toBe(house);
    } finally {stop();}
  });
  it('opens and closes without changing or erasing a current plan',()=>{
    const current=usePropertyStore.getState().property;open();expect(beforeOpen).toHaveBeenCalled();click('Create measured draft');
    expect(document.querySelector('[aria-label="Measured draft floor plan"]')).not.toBeNull();expect(usePropertyStore.getState().property).toBe(current);
    const apply=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Add as a new plan');expect(apply?.disabled).toBe(true);
    act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role=dialog]')).toBeNull();expect(usePropertyStore.getState().property).toBe(current);
  });
  it('adds the reviewed house as a separate page and preserves the previous drawing',()=>{
    const original=structuredClone(usePropertyStore.getState().property);open();click('Create measured draft');
    act(()=>document.querySelector<HTMLInputElement>('.design-ack input')!.click());click('Add as a new plan');
    expect(usePropertyStore.getState().property.name).toBe('My home concept');expect(usePropertyStore.getState().property.rooms.length).toBeGreaterThan(5);expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    const previous=useDesignsStore.getState().list().find(page=>page.property.id===original.id);expect(previous).toBeDefined();
    act(()=>{switchToPage(previous!.id);});expect(usePropertyStore.getState().property.rooms).toEqual(normaliseLoadedProperty(original)!.rooms);expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('rejects malformed or disconnected imported proposals without offering Apply',()=>{
    open();click('Import a draft');const invalid=createGuidedDesign({});invalid.rooms[1].openings=[];
    input(document.querySelector('textarea')!,JSON.stringify(invalid));click('Validate draft');
    expect(document.querySelector('[role=alert]')?.textContent).toContain('no connected');expect(document.querySelector('.design-ack')).toBeNull();expect(usePropertyStore.getState().property.name).toBe('Victors existing project');
  });
  it('accepts an MCP result envelope and keeps all 16 supplied warnings importable',()=>{
    open();click('Import a draft');const valid=createGuidedDesign({bedrooms:2});valid.warnings=Array.from({length:16},(_,i)=>`Note ${i}`);
    input(document.querySelector('textarea')!,JSON.stringify({draft:valid}));click('Validate draft');expect(document.querySelector('[role=alert]')).toBeNull();
    act(()=>document.querySelector<HTMLInputElement>('.design-ack input')!.click());click('Add as a new plan');expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
