/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiProviderDraft from '../AiProviderDraft';
import { DesignBriefSchema } from '../../designer/aiDesignContract';
const mocks=vi.hoisted(()=>({signedIn:true,getToken:vi.fn(),provider:vi.fn()}));
vi.mock('@clerk/clerk-react',()=>({ClerkProvider:({children}:{children:ReactNode})=>{mocks.provider();return children;},SignIn:()=>null,useAuth:()=>({isLoaded:true,isSignedIn:mocks.signedIn,getToken:mocks.getToken})}));
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
const onDraft=vi.fn(),onError=vi.fn(),onStart=vi.fn();
const brief=DesignBriefSchema.parse({brief:'A house with garden access.'});
function deferred<T>() { let resolve!:(value:T)=>void; const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve}; }
async function render(next=brief) { await act(async()=>root.render(<AiProviderDraft brief={next} onDraft={onDraft} onError={onError} onStart={onStart}/>)); }
async function generate(){await act(async()=>{host.querySelector<HTMLButtonElement>('button')!.click();});}
function readyResponse() { return {ok:true,json:async()=>({aiConfigured:true})} as Response; }
function server(post: ReturnType<typeof vi.fn>) { vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>init?.method==='POST'?post():Promise.resolve(readyResponse()))); }
beforeEach(()=>{vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY','test');mocks.signedIn=true;mocks.getToken.mockResolvedValue('token');mocks.provider.mockClear();onDraft.mockReset();onError.mockReset();onStart.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
describe('connected AI readiness',()=>{
  it('does not load authentication or offer sign-in when server AI is unconfigured',async()=>{
    mocks.signedIn=false;vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({aiConfigured:false})})));await render();
    expect(host.textContent).toContain('not configured on this server');expect(host.textContent).toContain('Guided layout');expect(host.textContent).not.toContain('Sign in for AI');expect(mocks.provider).not.toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();
  });
  it('offers Retry on a failed readiness check and only then mounts sign-in when the server is ready',async()=>{
    mocks.signedIn=false;const fetch=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce(readyResponse());vi.stubGlobal('fetch',fetch);await render();
    expect(host.textContent).toContain('could not be verified');expect(mocks.provider).not.toHaveBeenCalled();await generate();await act(async()=>{await import('../AuthenticatedAiDraft');});expect(host.textContent).toContain('Sign in for AI drafting');expect(mocks.provider).toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('treats malformed readiness as unavailable instead of inferring a configured provider',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({ok:true})})));await render();expect(host.textContent).toContain('could not be verified');expect(mocks.provider).not.toHaveBeenCalled();
  });
  it('bounds the readiness wait and ignores a late success after timeout',async()=>{
    vi.useFakeTimers();const response=deferred<Response>();vi.stubGlobal('fetch',vi.fn(()=>response.promise));await render();expect(host.textContent).toContain('Checking connected AI');act(()=>vi.advanceTimersByTime(8000));
    expect(host.textContent).toContain('could not be verified');await act(async()=>response.resolve(readyResponse()));expect(mocks.provider).not.toHaveBeenCalled();
  });
  it('keeps the client configuration fallback without loading Clerk or sending a request',async()=>{
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await render();expect(host.textContent).toContain('not configured on this build');expect(fetch).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled();
  });
});
describe('connected AI request ownership',()=>{
  it('ignores an old successful response after the brief is edited, even if abort is ignored',async()=>{
    const response=deferred<Response>();server(vi.fn(()=>response.promise));await render();await generate();expect(onStart).toHaveBeenCalledOnce();await render({...brief,brief:'A revised brief.'});
    await act(async()=>response.resolve({ok:true,json:async()=>({draft:{title:'Old result'}})} as Response));expect(onDraft).not.toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();
  });
  it('does not send a request after a pending auth token belongs to an abandoned brief',async()=>{
    const token=deferred<string>();mocks.getToken.mockReturnValueOnce(token.promise);const post=vi.fn();server(post);await render();await generate();await render({...brief,title:'A different plan'});
    await act(async()=>token.resolve('late-token'));expect(post).not.toHaveBeenCalled();expect(onDraft).not.toHaveBeenCalled();
  });
  it('ignores response parsing that finishes after sign-out',async()=>{
    const body=deferred<unknown>();server(vi.fn(async()=>({ok:true,json:()=>body.promise})));await render();await generate();mocks.signedIn=false;await render();
    await act(async()=>body.resolve({draft:{title:'Should be ignored'}}));expect(onDraft).not.toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();
  });
  it('times out pending authentication without sending a late request or leaving the UI busy',async()=>{
    vi.useFakeTimers();const token=deferred<string>();mocks.getToken.mockReturnValueOnce(token.promise);const post=vi.fn();server(post);await render();await generate();act(()=>vi.advanceTimersByTime(28000));
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('timed out'));expect(host.textContent).toContain('Generate AI proposal');await act(async()=>token.resolve('late-token'));expect(post).not.toHaveBeenCalled();expect(onDraft).not.toHaveBeenCalled();
  });
  it('passes only a live successful proposal for review',async()=>{
    server(vi.fn(async()=>({ok:true,json:async()=>({draft:{title:'Current'}})})));await render();await generate();expect(onDraft).toHaveBeenCalledTimes(1);expect(onDraft).toHaveBeenCalledWith({title:'Current'});expect(onError).not.toHaveBeenCalled();
  });
});

