import {launch,newCtx,watch,save,TARGETS,wait3d,OUT} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const branch=process.argv[2]||'walk';
const report={at:new Date().toISOString(),branch,method:'Diagnostic Chrome trace; fresh browsers, native GPU, no throttle. Trace overhead makes these diagnostic samples separate from formal timing pairs.',rows:[]};
for(const device of ['desktop','phone'])for(const target of ['base',branch]){
 const browser=await launch(),{context}=await newCtx(browser,device),page=await context.newPage(),cdp=await context.newCDPSession(page);
 const row={device,target};report.rows.push(row);watch(page,row);
 await cdp.send('Tracing.start',{categories:'devtools.timeline,v8.execute,blink.user_timing,loading',transferMode:'ReturnAsStream'});
 try{
  await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);
  Object.assign(row,await page.evaluate(()=>({firstPictureMs:Number(document.querySelector('[data-first-picture-ms]').getAttribute('data-first-picture-ms')),nav:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,responseStart:r.responseStart,end:r.responseEnd,duration:r.duration,bytes:r.transferSize}))})));
  await page.evaluate(()=>performance.mark('world-fix1-first-picture',{startTime:Number(document.querySelector('[data-first-picture-ms]').getAttribute('data-first-picture-ms'))}));
 }catch(e){row.fatal=String(e);}
 const ended=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await ended;let raw='';
 while(true){const part=await cdp.send('IO.read',{handle:stream});raw+=part.base64Encoded?Buffer.from(part.data,'base64').toString():part.data;if(part.eof)break;}
 await cdp.send('IO.close',{handle:stream});writeFileSync(OUT+`trace-${branch}-${target}-${device}.json`,raw);
 const events=JSON.parse(raw).traceEvents;const mark=events.find(e=>e.name==='world-fix1-first-picture');
 const start=mark?mark.ts-row.firstPictureMs*1000:0;
 const mainThread=mark?.tid,pid=mark?.pid;
 const work=events.filter(e=>e.ph==='X'&&e.tid===mainThread&&e.pid===pid&&e.ts>=start&&e.ts<=mark?.ts);
 row.mainThread={pid,tid:mainThread,byEvent:Object.entries(Object.groupBy(work,e=>e.name)).map(([name,es])=>({name,count:es.length,totalMs:es.reduce((s,e)=>s+e.dur/1000,0),longestMs:Math.max(...es.map(e=>e.dur/1000))})).sort((a,b)=>b.totalMs-a.totalMs),scripts:work.filter(e=>['EvaluateScript','FunctionCall'].includes(e.name)).map(e=>({name:e.name,startMs:(e.ts-start)/1000,durationMs:e.dur/1000,url:e.args?.data?.url||e.args?.data?.scriptName,functionName:e.args?.data?.functionName})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,30)};
 await context.close();await browser.close();save(`profile-${branch}.json`,report);console.log(JSON.stringify({target,device,firstPictureMs:row.firstPictureMs,mainThread:row.mainThread.byEvent.slice(0,8),fatal:row.fatal}));
}
