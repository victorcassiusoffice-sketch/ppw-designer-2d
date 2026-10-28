import {launch,newCtx,watch,save,TARGETS,OUT,wait3d} from './lib.mjs';
const report={at:new Date().toISOString(),url:TARGETS.localwalk,method:'Local DEV rendering of the actual furnished demo. Same character, room and accepted capsule pose; before uses exact52dfa87 camera formula behind DEV-only fixture flag; after uses new followCamera. This is camera-algorithm evidence, not preview timing.',room:{id:'office',name:'Home office',size:'3×4m',bounds:{x:[4.5,7.5],z:[4.5,8.5]}},rows:[]};
for(const device of ['desktop','phone']){
 const browser=await launch(),{context}=await newCtx(browser,device),page=await context.newPage();page.setDefaultTimeout(90000);
 const row={device};report.rows.push(row);watch(page,row);
 try{
  await page.goto(TARGETS.localwalk+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);
  await page.getByRole('button',{name:'Open Walk mode',exact:true}).click();await page.getByRole('button',{name:'Lea',exact:true}).click();await page.getByRole('button',{name:'Start walk',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-world-walk]')?.getAttribute('data-status'));
  for(const baselineCamera of [true,false]){
   const name=baselineCamera?'before':'after';
   await page.locator('[data-world-walk] canvas').evaluate((canvas,baselineCamera)=>{
    window.__poseResult=null;canvas.addEventListener('world-walk-test-pose-ready',e=>{window.__poseResult=e.detail;},{once:true});
    canvas.dispatchEvent(new CustomEvent('world-walk-test-pose',{detail:{position:[5.8,.001,6.2],yaw:-Math.PI/2,baselineCamera}}));
   },baselineCamera);
   await page.waitForFunction(()=>window.__poseResult);row[name]=await page.evaluate(()=>window.__poseResult);
   if(!row[name].accepted)throw new Error('Camera fixture rejected: '+JSON.stringify(row[name]));
   await page.screenshot({path:OUT+`camera-${device}-${name}.jpg`,type:'jpeg',quality:85});
  }
 }catch(e){row.fatal=String(e).slice(0,800);}
 await context.close();await browser.close();save('camera-pair.json',report);console.log(JSON.stringify(row));
}

