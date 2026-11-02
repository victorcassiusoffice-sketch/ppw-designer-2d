import {launch,newCtx,watch,save,TARGETS,OUT,wait3d,health} from './lib.mjs';
const expected={walk:process.argv[2],site:process.argv[3]};
if(!Object.values(expected).every(value=>/^[a-f0-9]{40}$/.test(value??'')))throw Error('Supply exact Walk and Site heads');
const allowedMeeting='https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour';
const report={startedAt:new Date().toISOString(),harnessVersion:3,allowedMeeting,method:'Read-only visible-UI audit on exact current previews, desktop and phone. Initial route is /demo?view=3d&pitch=1. Walk chooser is opened without starting; Site requires the established 2D plan route with site=1 and is opened offline (no live=1). Both previews are checked; Site uses its established 2D launcher. Earlier failed route experiments remain in Round1 evidence. Visible fields/links/text and all meeting-like hrefs retained. Instructional phone wording is reported separately from contact fields/links. Network writes blocked and counted.',rows:[],healthBefore:{}};
for(const target of ['walk','site']){report.healthBefore[target]=await health(target);if(report.healthBefore[target].body.commit!==expected[target])throw Error('Unexpected '+target+' deployment');}
save('visible-rules.json',report);
for(const target of ['walk','site'])for(const device of ['desktop','phone']){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage();page.setDefaultTimeout(30000);
 const row={target,device,screens:[]};report.rows.push(row);watch(page,row);
 const inspect=async(name,selector)=>{
  const screen=await page.evaluate(({name,selector,allowedMeeting})=>{
   const root=selector?document.querySelector(selector):document.body;if(!root)throw Error('Missing audit root '+selector);
   const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)!==0&&r.width>0&&r.height>0;};
   const text=root.innerText,lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
   const fields=[...root.querySelectorAll('input,textarea,select')].filter(visible).map(e=>({tag:e.tagName,type:e.getAttribute('type'),name:e.getAttribute('name'),autocomplete:e.getAttribute('autocomplete'),ariaLabel:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),labels:[...(e.labels??[])].map(x=>x.innerText)}));
   const links=[...root.querySelectorAll('a[href]')].filter(visible).map(e=>({text:e.innerText,ariaLabel:e.getAttribute('aria-label'),href:e.href}));
   const allMeetingLinks=[...document.querySelectorAll('a[href]')].filter(e=>/calendly|meeting|book.{0,15}(?:call|appointment)|schedule.{0,15}(?:call|appointment)/i.test([e.href,e.innerText,e.getAttribute('aria-label')].join(' '))).map(e=>({text:e.innerText,href:e.href,visible:visible(e)}));
   const priceLines=lines.filter(s=>/\b(?:MUR|Rs\.?|USD|EUR|GBP)\b|[$€£₹]/i.test(s));
   const contactLinks=links.filter(e=>/^(?:tel|sms):|wa\.me|whatsapp/i.test(e.href));
   const contactFields=fields.filter(e=>e.type==='tel'||/\btel\b/.test(e.autocomplete??'')||/\b(?:client|customer|contact)\s*(?:name|phone|number)|\b(?:full name|phone number|mobile number|whatsapp)\b/i.test([e.name,e.ariaLabel,e.placeholder,...e.labels].join(' ')));
   const phoneMentions=lines.filter(s=>/\bphone\b|\bmobile\b|whatsapp|\+230[\s()-]*\d/i.test(s));
   const contactText=phoneMentions.filter(s=>/whatsapp|\+230[\s()-]*\d|\b(?:contact|call|phone number|mobile number)\b/i.test(s));
   const wrongMeetingLinks=allMeetingLinks.filter(e=>e.href!==allowedMeeting);
   return{name,url:location.href,text,fields,links,allMeetingLinks,priceLines,contactLinks,contactFields,phoneMentions,contactText,wrongMeetingLinks,passed:!priceLines.length&&!contactLinks.length&&!contactFields.length&&!contactText.length&&!wrongMeetingLinks.length};
  },{name,selector,allowedMeeting});
  row.screens.push(screen);if(!screen.passed)await page.screenshot({path:OUT+`${target}-${device}-${name}-rules-failure.jpg`,type:'jpeg',quality:70});save('visible-rules.json',report);
 };
 try{
  await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);await inspect('initial-designer');
  if(target==='walk'){await page.getByRole('button',{name:'Open Walk mode',exact:true}).click();await page.getByTestId('walk-chooser').waitFor();await inspect('walk-chooser','[data-world-walk]');}
  else{
   await page.goto(TARGETS[target]+'/demo?view=2d&pitch=1&site=1',{waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'Site from the map',exact:true}).click();await page.getByRole('heading',{name:'Start with the land',exact:true}).waitFor();await inspect('offline-site','.site-workspace');
  }
 }catch(error){row.failure=String(error);}
 finally{row.blockedWrites=log.blockedWrites;row.passed=!row.failure&&row.screens.length===2&&row.screens.every(s=>s.passed)&&!row.blockedWrites.length;await browser.close();row.browserClosed=true;save('visible-rules.json',report);console.log(JSON.stringify({target,device,passed:row.passed,screens:row.screens.map(s=>({name:s.name,price:s.priceLines,contacts:s.contactFields,phoneMentions:s.phoneMentions,wrongMeeting:s.wrongMeetingLinks})),failure:row.failure}));}
}
report.healthAfter={};for(const target of ['walk','site'])report.healthAfter[target]=await health(target);
report.healthStable=Object.keys(expected).every(target=>report.healthBefore[target].body.commit===report.healthAfter[target].body.commit);
report.passed=report.healthStable&&report.rows.length===4&&report.rows.every(r=>r.passed);report.endedAt=new Date().toISOString();save('visible-rules.json',report);if(!report.passed)process.exitCode=1;
