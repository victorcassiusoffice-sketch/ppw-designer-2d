import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const out='docs/qa-2026-10-09';const report=[];
const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const width of [1280,390]){
 const name=width===1280?'desktop':'phone';const context=await b.newContext({viewport:{width,height:width===1280?900:844},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:1});
 await context.addInitScript(()=>{if(sessionStorage.getItem('qa-products'))return;localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{showGrid:true,pxPerMetre:70,property:{id:'qa-products-oct9',name:'Supplier product study',activeRoomId:'room',rooms:[{id:'room',name:'Bathroom',polygon:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],placedItems:[{instanceId:'bidet',productId:'espace-duravit-dcode-bidet-224110',x:4.7,y:3.8,rotation:0},{instanceId:'sofa',productId:'espace-seville-garden-sofa',x:1,y:1,rotation:0}]}]}}}));sessionStorage.setItem('qa-products','1');});
 const p=await context.newPage();p.setDefaultTimeout(12000);const record={name,consoleErrors:[],pageErrors:[],checks:[],screens:[],failure:null};report.push(record);
 p.on('console',m=>{if(m.type()==='error')record.consoleErrors.push(m.text())});p.on('pageerror',e=>record.pageErrors.push(e.message));
 const shot=async label=>{await p.waitForTimeout(250);await p.screenshot({timeout:60000,path:`${out}/${name}-${label}.png`});record.screens.push(`${name}-${label}.png`);expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);};
 try{
  await p.goto('http://127.0.0.1:5173/designer');await p.locator('.konvajs-content canvas').first().waitFor();
  await p.getByRole('button',{name:'Open Materials',exact:true}).click();await p.getByRole('navigation',{name:'Materials sections'}).getByRole('button',{name:'Costs',exact:true}).click();await shot('materials-costs');await p.getByRole('button',{name:'Open Materials',exact:true}).click();
  await p.getByRole('button',{name:'Site & tools',exact:true}).click();
  const projectBar=await p.locator('.plan-project-bar').boundingBox();const settings=await p.locator('.studio-plan-settings').boundingBox();
  expect(settings.y).toBeGreaterThanOrEqual(projectBar.y+projectBar.height-1);record.checks.push('Expanded site tools sit below persistent Floors / Materials / Undo without overlap');
  await shot('plan-site-tools');await p.getByRole('button',{name:'Site & tools',exact:true}).click();
  await p.getByRole('button',{name:'3D House',exact:true}).click();await p.getByTestId('loading-3d').waitFor({state:'hidden'});await p.getByTestId('wallpaint-3d-gl').waitFor();await p.waitForTimeout(1200);
  await p.getByTestId('house-view-settings').click();await p.getByLabel('Camera view',{exact:true}).selectOption('above');await p.getByRole('button',{name:'Close view settings'}).click();await p.waitForTimeout(500);
  const box=await p.getByTestId('wallpaint-3d-canvas').boundingBox();await p.mouse.click(box.x+box.width*.5,box.y+box.height*(width===390?.515:.5));
  await expect(p.getByTestId('view3d-object-turn')).toBeVisible();record.checks.push('Selected product has object-adjacent rotate controls');await shot('product-3d-selected');
  await p.getByRole('button',{name:'Products and cost',exact:true}).click();await shot('product-details-cost');
  await p.getByRole('button',{name:'Close house details',exact:true}).click();
  await p.getByRole('button',{name:'2D Plan',exact:true}).click();await p.getByTestId('cart-pill').click();await shot('cart-quote-required');
 }catch(e){record.failure=e.message;await fs.writeFile(`${out}/${name}-product-failure-dom.txt`,await p.locator('body').innerText());await shot('product-check-failure');}
 await context.close();
}
await b.close();await fs.writeFile(`${out}/products-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
