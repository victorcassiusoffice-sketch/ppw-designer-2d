import {readFileSync,writeFileSync} from 'node:fs';
import {OUT} from './lib.mjs';
for(const target of ['walk','site']){
 const raw=JSON.parse(readFileSync(OUT+'/t14-load-timed-prod_'+target+'-desktop_phone.json','utf8'));
 const pairs=[];
 for(const device of raw.devices)for(let run=1;run<=5;run++){
  const prod=raw.rows.find(r=>r.target==='prod'&&r.device===device&&r.run===run);
  const preview=raw.rows.find(r=>r.target===target&&r.device===device&&r.run===run);
  if(!prod||!preview||!preview.first3dMs)throw Error('Incomplete '+target);
  pairs.push({device,run,productionMs:prod.first3dMs,previewMs:preview.first3dMs,deltaMs:preview.first3dMs-prod.first3dMs,productionCanvasMarkMs:Number(prod.gl['data-first-picture-ms']),previewCanvasMarkMs:Number(preview.gl['data-first-picture-ms']),startSeparationSeconds:(preview.timeOrigin-prod.timeOrigin)/1000,productionTimeOrigin:prod.timeOrigin,previewTimeOrigin:preview.timeOrigin});
 }
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const summary={target,startedAt:raw.startedAt,endedAt:raw.endedAt,method:'Unmodified t14 measurement loop from PR51 harness, fresh Chromium/context per load; production then preview interleaved. Only target/output adaptation. Native D3D11 with preview hosts pinned to216.198.79.3, no CPU/network throttling. Primary first3dMs uses original loading-hidden wait; independent canvas marks retained. Local heavy builds/tests and other task browsers idle. Different host/CDN paths are inherent in requested comparison; a slower result is not by itself proof of code-only cause.',pairs,slowerPairs:pairs.filter(p=>p.deltaMs>0).length,slowerCanvasMarkPairs:pairs.filter(p=>p.previewCanvasMarkMs>p.productionCanvasMarkMs).length,allPairsWithin60Seconds:pairs.every(p=>p.startSeparationSeconds<60),devices:raw.devices.map(device=>({device,productionMedianMs:median(pairs.filter(p=>p.device===device).map(p=>p.productionMs)),previewMedianMs:median(pairs.filter(p=>p.device===device).map(p=>p.previewMs)),slowerPairs:pairs.filter(p=>p.device===device&&p.deltaMs>0).length})),errors:raw.rows.reduce((s,r)=>s+(r.pageErrors?.length||0)+(r.httpErrors?.length||0)+(r.fatal?1:0),0)};
 writeFileSync(OUT+'/'+target+'-paired-summary.json',JSON.stringify(summary,null,2));
 let md='| Viewport | Pair | Production s | Preview s | Delta ms | Start gap s |\n|---|---:|---:|---:|---:|---:|\n';
 for(const p of pairs)md+='| '+p.device+' | '+p.run+' | '+(p.productionMs/1000).toFixed(3)+' | '+(p.previewMs/1000).toFixed(3)+' | '+(p.deltaMs>0?'+':'')+p.deltaMs+' | '+p.startSeparationSeconds.toFixed(1)+' |\n';
 writeFileSync(OUT+'/'+target+'-paired-table.md',md);console.log(JSON.stringify(summary.devices),summary.slowerPairs,summary.slowerCanvasMarkPairs);
}

