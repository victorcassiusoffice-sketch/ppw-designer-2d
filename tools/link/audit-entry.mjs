// Compare actual delivered JS/CSS files (not source estimates). The baseline
// can be either the original Vite output or the final isolated plumbing build.
// Usage: node tools/link/audit-entry.mjs <baseline-dist> <candidate-dist> [evidence.json]
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { init, parse } from 'es-module-lexer'; // already installed by Vite

const json = file => readFileSync(file, 'utf8');
const bytes = data => ({ raw:data.length, gzip:gzipSync(data).length, sha256:createHash('sha256').update(data).digest('hex') });
const canon = pathname => pathname.replace(/^\/+/, '');
const group = rows => ({ files:rows.length, raw:rows.reduce((n,r)=>n+r.raw,0), gzip:rows.reduce((n,r)=>n+r.gzip,0) });

/** Exercise the actual emitted inline selector without executing downloaded
 * modules. A later browser smoke verifies real CSS/module network requests. */
export async function selectedAssets(html, route) {
  const scripts=[], preloads=[], styles=[], stylePreloads=[], navigations=[], listeners={};
  const url=new URL(route,'https://audit.invalid'), attrs=new Set(), links=[];
  const location={ href:url.href, pathname:url.pathname, origin:url.origin, hash:url.hash, search:url.search,
    assign:v=>navigations.push(['assign',v]), replace:v=>navigations.push(['replace',v]), reload:()=>navigations.push(['reload']) };
  const history={ pushState(){}, replaceState(){} };
  const append=l=>{
    links.push(l);
    if(l.rel==='stylesheet') {styles.push(canon(l.href));l.sheet=true;l.onload?.();}
    if(l.rel==='modulepreload') preloads.push(canon(l.href));
    if(l.rel==='preload' && l.as==='style') stylePreloads.push(canon(l.href));
  };
  const document={
    documentElement:{setAttribute:a=>attrs.add(a),hasAttribute:a=>attrs.has(a)},
    createElement:()=>{const a=new Set();return {setAttribute:k=>a.add(k),hasAttribute:k=>a.has(k)};},
    head:{append,appendChild:append}, querySelectorAll:()=>links.filter(l=>l.rel==='stylesheet'),
  };
  const ctx=vm.createContext({document,location,history,URL,URLSearchParams,addEventListener:(k,v)=>{listeners[k]=v;},
    __recordImport: src=>{scripts.push(canon(src));}},{codeGeneration:{strings:false,wasm:false}});
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>|<link\b([^>]*)>/gi)) {
    if(match[3]!=null) {
      const href=/\bhref="([^"]+)"/.exec(match[3])?.[1];
      if(href && /\brel="stylesheet"/.test(match[3])) styles.push(canon(href));
      if(href && /\brel="modulepreload"/.test(match[3])) preloads.push(canon(href));
      continue;
    }
    const src=/\bsrc="([^"]+)"/.exec(match[1])?.[1];
    if(src) {if(/\btype="module"/.test(match[1])) scripts.push(canon(src));continue;}
    const body=match[2].replace(/await import\(src\)/g,'await __recordImport(src)');
    if(body.trim()) await vm.runInContext(body,ctx,{timeout:1000});
  }
  if(!scripts.length || !styles.length) throw Error('Startup script/styles missing on '+route);
  return {scripts,preloads,styles,stylePreloads, location,history,navigations,listeners};
}

async function audit(baseDir, nextDir, out) {
  await init;
  const failures=[];
  const check=(ok,msg)=>{if(!ok)failures.push(msg);};
  const cache=new Map();
  const read=(dir,file)=>{
    const key=dir+'|'+file;
    if(cache.has(key)) return cache.get(key);
    if(!/^assets\/[\w./-]+$/.test(file)||file.includes('..')) throw Error('Unexpected asset path '+file);
    const data=readFileSync(path.join(dir,file)), source=data.toString('utf8');
    const imports=file.endsWith('.js')?parse(source,file)[0]:[];
    const local=i=>i.n&&(i.n.startsWith('./')||i.n.startsWith('../')||i.n.startsWith('/assets/'))
      ? i.n.startsWith('/')?canon(i.n):path.posix.normalize(path.posix.join(path.posix.dirname(file),i.n)):null;
    const deps=imports.map(i=>({file:local(i),dynamic:i.d>=0})).filter(i=>i.file&&/\.(js|css)$/.test(i.file));
    const result={file,...bytes(data),source,deps};cache.set(key,result);return result;
  };
  const walk=(dir,entries,dynamic=false)=>{
    const files=new Set(), visit=f=>{if(files.has(f))return;files.add(f);for(const d of read(dir,f).deps)if(dynamic||!d.dynamic)visit(d.file);};
    entries.forEach(visit);return [...files].sort();
  };
  const manifest=(dir,files)=>files.map(f=>{const {file,raw,gzip,sha256}=read(dir,f);return {file,raw,gzip,sha256};});
  const analyze=async(dir)=>{
    const html=json(path.join(dir,'index.html')),boot=await selectedAssets(html,'/demo?view=3d&pitch=1');
    const reachable=walk(dir,boot.scripts,true);
    const roots=Object.fromEntries(['main','App','ThreeStage','DemoDesignerPage'].map(name=>{
      const matches=reachable.filter(f=>new RegExp('^assets/'+name+'-[^/]+\\.js$').test(f));
      if(matches.length!==1) throw Error('Expected exactly one public '+name+' chunk: '+matches.join(', '));return [name,matches[0]];
    }));
    const perEntry=Object.fromEntries(Object.entries(roots).map(([name,file])=>[name,group(manifest(dir,walk(dir,[file])))]));
    const early=manifest(dir,walk(dir,[...Object.values(roots),...boot.scripts,...boot.preloads,...boot.styles,...boot.stylePreloads]));
    const leaks=reachable.filter(f=>f.startsWith('assets/studio/') || /^BuildDashboard-/.test(path.basename(f)) || read(dir,f).source.includes('olb_link_packages_v1'));
    return { roots,perEntry,early,total:group(early),leaks };
  };
  const baseline=await analyze(baseDir),candidate=await analyze(nextDir);
  check(JSON.stringify(baseline.early)===JSON.stringify(candidate.early),'Public early JS/CSS bytes or names differ');
  check(!candidate.leaks.length,'The public application graph reaches studio code');
  const routeRows=[], htmlBytes={};
  for(const shell of ['index.html','olb.html']){
    const before=json(path.join(baseDir,shell)),after=json(path.join(nextDir,shell));
    htmlBytes[shell]={before:bytes(Buffer.from(before)),after:bytes(Buffer.from(after))};
    // If the base was captured straight from Vite, reconstruct its ORIGINAL
    // plumbing selector using the clean base's helper (no new build or write).
    // Hash-named plumbing assets are read from the final candidate selector.
    const baseHelper=path.resolve(baseDir,'../tools/build-plumbing-entry.mjs');
    const baseHero=path.resolve(baseDir,'../src/pages/sales/plumbingHero.json');
    if(!before.includes('data-app-entry-style') && existsSync(baseHelper) && existsSync(baseHero)){
      const {rewriteEntryHtml}=await import(pathToFileURL(baseHelper).href);
      const pitch=await selectedAssets(after,'/pitch/plumbing');
      const assets=Object.fromEntries(['scripts','preloads','styles'].map(k=>[k,pitch[k].map(f=>'/'+f)]));
      const equivalent=bytes(Buffer.from(rewriteEntryHtml(before,assets,JSON.parse(json(baseHero))).html));
      htmlBytes[shell].beforeWithBasePlumbingSelector=equivalent;
      htmlBytes[shell].deltaVsBasePlumbingSelector={raw:htmlBytes[shell].after.raw-equivalent.raw,gzip:htmlBytes[shell].after.gzip-equivalent.gzip};
    }
    for(const route of ['/demo','/demo?view=2d&pitch=1','/demo?view=3d&pitch=1','/embed/designer','/pitch/plumbing','/pitch/eco-city','/home','/designer-preview','/designer','/designer/?panel=build#w=x']){
      const pathname=new URL(route,'https://audit.invalid').pathname;
      const boot=await selectedAssets(after,route), mode=/^\/designer\/?$/.test(pathname)?'studio':pathname==='/pitch/plumbing'?'plumbing':'primary';
      const startup=[...boot.scripts,...boot.preloads,...boot.styles,...boot.stylePreloads];
      if(mode==='studio'||mode==='plumbing')check(startup.every(f=>f.startsWith('assets/'+mode+'/')),shell+' wrong isolated startup on '+route);
      else {
        const prior=await selectedAssets(before,route);
        check(JSON.stringify(prior.scripts)===JSON.stringify(boot.scripts),shell+' different public startup JS on '+route);
        check(JSON.stringify(prior.styles)===JSON.stringify(boot.styles),shell+' different public CSS on '+route);
        check(startup.every(f=>!f.startsWith('assets/studio/')&&!f.startsWith('assets/plumbing/')),shell+' wrong public graph on '+route);
      }
      routeRows.push({shell,route,mode,scripts:boot.scripts,...group(manifest(nextDir,[...new Set(startup)]))});
    }
  }
  const boot=await selectedAssets(json(path.join(nextDir,'index.html')),'/designer?panel=build'),priv=walk(nextDir,boot.scripts,true);
  const privateApp=priv.find(f=>/^App-.*\.js$/.test(path.basename(f)));
  const privateStatic=walk(nextDir,[...boot.scripts,...(privateApp?[privateApp]:[])]);
  const pilot=priv.filter(f=>/^BuildDashboard-.*\.js$/.test(path.basename(f))||read(nextDir,f).source.includes('olb_link_packages_v1'));
  check(pilot.length>0&&pilot.every(f=>!privateStatic.includes(f)),'Build dashboard absent or not lazy on /designer');
  const lazyOnly=new Set(walk(nextDir,pilot).filter(f=>!privateStatic.includes(f)));
  const pilotStyles=readdirSync(path.join(nextDir,'assets/studio')).filter(f=>/^BuildDashboard-.*\.css$/.test(f)).map(f=>'assets/studio/'+f);
  check(pilotStyles.length===1 && !boot.styles.some(f=>pilotStyles.includes(f)), 'Pilot CSS absent or activated at studio startup');
  const evidence={method:'Local compiled static closures; byte-for-byte SHA-256 plus raw and per-file gzip. Public App, ThreeStage, DemoDesignerPage and main and their transitive static imports; includes House startup preload JS/CSS. Dynamic graph checked separately for private leakage. HTML selector overhead listed separately (baseline can be Vite-only, before its existing pitch finalizer); not a timing benchmark.',baseline,candidate,htmlBytes,routeRows,
    private:{pilotChunks:manifest(nextDir,pilot),pilotStyles:manifest(nextDir,pilotStyles),lazyOnly:group(manifest(nextDir,[...lazyOnly,...pilotStyles]))},failures};
  mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({baseline:baseline.total,candidate:candidate.total,pilot:evidence.private,failures},null,2));
  if(failures.length)process.exitCode=1;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [base,next='dist',out='docs/link/evidence/entry.json']=process.argv.slice(2);
  if(!base)throw new Error('Pass the clean comparison build directory explicitly (use the same commit stamp and build settings).');
  await audit(path.resolve(base),path.resolve(next),out);
}
