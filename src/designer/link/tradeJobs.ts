import { z } from 'zod';
import { canonical, realDay } from './vendor/tradefolder/lib/jobPack/protocol';
import type { LinkPackage, PackageDraft } from './exchange';

// Role is a local workspace choice. The pinned Trade Folder v1 trade name
// stays in the request. General work is differentiated locally without
// inventing a new receiving-app category or permission.
export const TRADE_ROLES = [
  {id:'painting',label:'Painter',wire:'painting'}, {id:'tiling',label:'Tiler',wire:'tiling'},
  {id:'flooring',label:'Flooring installer',wire:'flooring'}, {id:'plaster',label:'Plasterer',wire:'plastering'},
  {id:'waterproofing',label:'Waterproofer',wire:'waterproofing'}, {id:'plumbing',label:'Plumber',wire:'plumbing'},
  {id:'electrical',label:'Electrician',wire:'electrical'}, {id:'carpentry',label:'Carpenter',wire:'carpentry'},
  {id:'repairs',label:'Repair worker',wire:'general'}, {id:'builder',label:'Builder',wire:'general'},
  {id:'architect',label:'Architect',wire:'general'}, {id:'engineer',label:'Engineer',wire:'general'},
  {id:'supplier',label:'Supplier',wire:'general'},
] as const;
export type TradeRole=typeof TRADE_ROLES[number]['id'];
export const JOB_STATUSES=['planned','started','waiting','done','snagged'] as const;
export type JobStatus=typeof JOB_STATUSES[number];
const role=z.custom<TradeRole>(v=>TRADE_ROLES.some(r=>r.id===v),'Choose a trade.');
const id=z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), day=z.string().refine(realDay,'Choose a real date.');
export const workerName=z.string().trim().min(1,'Enter your name.').max(120);
const title=z.string().trim().min(1,'Enter a job name.').max(160);
const note=z.string().trim().max(1000);
export const pinSchema=z.object({
  levelId:z.string().min(1).max(100),x:z.number().finite().min(-100_000).max(100_000),
  y:z.number().finite().min(-100_000).max(100_000),z:z.number().finite().min(-10000).max(10000),
  planRef:z.string().regex(/^olb:(?:level|room|wall|opening|run|item|fnd):[A-Za-z0-9_.:-]+$/).max(120),
}).strict();
export type WorkPin=z.infer<typeof pinSchema>;
// Store/export only bounded raster data, never an external URL or SVG.
const photo=z.object({ref:z.string().max(80_000),sizeBytes:z.number().int().min(1).max(60_000)}).strict().refine(p=>{
  const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(p.ref);
  if(!m || m[2].length%4!==0 || Math.floor(m[2].length*3/4)-(m[2].match(/=*$/)?.[0].length??0)!==p.sizeBytes)return false;
  const b=atob(m[2].slice(0,24));
  return m[1]==='png'?b.startsWith('\x89PNG\r\n\x1a\n'):m[1]==='jpeg'?b.startsWith('\xff\xd8\xff'):b.startsWith('RIFF')&&b.slice(8,12)==='WEBP';
},'Choose a small PNG, JPEG or WebP photo.');
const status=z.enum(JOB_STATUSES);
export const createJobSchema=z.object({
  id,projectId:id,projectLabel:title,role,parentId:id.optional(),title,note,photo:photo.optional(),
  pin:pinSchema,status,startDate:day.optional(),dueDate:day.optional(),by:workerName,
}).strict();
export type CreateJobInput=z.input<typeof createJobSchema>;
export const editJobSchema=z.object({title:title.optional(),note:note.optional(),photo:photo.nullable().optional(),
  pin:pinSchema.optional(),status:status.optional(),startDate:day.nullable().optional(),dueDate:day.nullable().optional()}).strict();
export type JobPatch=z.input<typeof editJobSchema>;
export type JobInfo={role:TradeRole;parentId?:string;pin:WorkPin;status:JobStatus;statusAt:string;statusIndex:number;photo?:z.infer<typeof photo>;startDate?:string;dueDate?:string};
export type TradeClaim={role:TradeRole;name:string;at:string};
export type JobEvent =
  | {kind:'trade-job';at:string;input:CreateJobInput}
  | {kind:'trade-edit';at:string;id:string;patch:JobPatch;by:string}
  | {kind:'trade-take';at:string;id:string;role:TradeRole;by:string};
export const roleSchema=role;
export function packageTrade(row:LinkPackage):TradeRole{
  if(row.job)return row.job.role;
  if(row.claim)return row.claim.role;
  const d=row.draft;
  if(d.trade==='general')return /^(?:masonry|concrete|roofing)(?:[/:]|$)/.test(d.sourceKey)?'builder':'repairs';
  return TRADE_ROLES.find(r=>r.wire===d.trade || r.id===d.trade)?.id??'builder';
}
function dates(start?:string,due?:string){
  if(start&&due&&start>due)throw new Error('The due date must be on or after the start.');
  return [start,due].filter((v):v is string=>!!v);
}
export function physicalState(row:LinkPackage):JobStatus {
  const own=row.job, current=row.sends[row.sends.length-1];
  if(!current)return own?.status??'planned';
  const chosen=current.quotes.find(q=>q.decision?.choice==='approved');
  const report=[...current.statuses].reverse().find(r=>(r.state==='started'||r.state==='done')&&(!chosen||r.quoteId===chosen.pack.id));
  if(!report)return own?.status??'planned';
  if(own && (report.createdAt<own.statusAt || (report.createdAt===own.statusAt && row.history.findIndex(h=>h.fileId===report.id)<=own.statusIndex)))return own.status;
  return report.state==='done'?'done':'started';
}
function parse<T>(schema:z.ZodType<T>,value:unknown):T{
  const r=schema.safeParse(value);
  if(!r.success)throw new Error(r.error.issues.map(i=>[i.path.join('.'),i.message].filter(Boolean).join(': ')).join('; '));
  return r.data;
}
/** One atomic event creates the job AND its exportable draft. Replays keep
 * the original owner-entered labels; there is no separate shadow job list. */
export function applyJobEvent(rows:LinkPackage[],e:JobEvent):LinkPackage[]{
  if(e.kind==='trade-job'){
    const i=parse(createJobSchema,e.input);
    if(rows.some(r=>r.draft.id===i.id))throw new Error('This job ID already exists.');
    const parent=i.parentId?rows.find(r=>r.draft.id===i.parentId):undefined;
    if(i.parentId&&(!parent||parent.job||parent.draft.projectId!==i.projectId||packageTrade(parent)!==i.role))
      throw new Error('Choose a package for this trade in the current project.');
    const meta=parent?.draft, claim={role:i.role,name:i.by,at:e.at};
    const draft:PackageDraft={id:i.id,projectId:i.projectId,projectLabel:i.projectLabel,sourceKey:'field:'+i.role+':'+i.id,
      title:i.title,scope:i.note,trade:TRADE_ROLES.find(r=>r.id===i.role)!.wire,levelIds:[i.pin.levelId],
      quantities:[{item:i.title,qty:1,unit:'each',planRef:i.pin.planRef}],siteId:meta?.siteId??i.projectId,
      siteLabel:meta?.siteLabel??i.projectLabel,siteKind:meta?.siteKind??'build-site',phase:meta?.phase??'Site work',
      preferredDates:dates(i.startDate,i.dueDate),currency:meta?.currency??'MUR',company:meta?.company??i.by,
      requester:meta?.requester??'company'};
    const job:JobInfo={role:i.role,pin:i.pin,status:i.status,statusAt:e.at,statusIndex:0,
      ...(i.photo?{photo:i.photo}:{}),...(i.parentId?{parentId:i.parentId}:{}),
      ...(i.startDate?{startDate:i.startDate}:{}),...(i.dueDate?{dueDate:i.dueDate}:{})};
    return [...rows,{draft,job,claim,updatedAt:e.at,sends:[],history:[{at:e.at,label:'Job added · '+i.status,worker:i.by}]}];
  }
  const row=rows.find(r=>r.draft.id===e.id);
  if(!row)throw new Error('This package or job was not found in this browser.');
  const by=parse(workerName,e.by);
  if(e.kind==='trade-take'){
    const trade=parse(role,e.role);
    if(trade!==packageTrade(row))throw new Error('This package belongs to a different trade.');
    if(row.claim){if(row.claim.name===by)return rows;throw new Error('This package is already taken by '+row.claim.name+'.');}
    return rows.map(r=>r!==row?r:{...r,claim:{role:trade,name:by,at:e.at},updatedAt:e.at,
      history:[...r.history,{at:e.at,label:'Package taken',worker:by}]});
  }
  if(!row.job)throw new Error('Choose a pinned job to edit.');
  const patch=parse(editJobSchema,e.patch), job={...row.job}, draft={...row.draft}, changes:string[]=[];
  if(patch.title!==undefined&&patch.title!==draft.title){draft.title=patch.title;changes.push('name');}
  if(patch.note!==undefined&&patch.note!==draft.scope){draft.scope=patch.note;changes.push('note');}
  if(patch.pin&&canonical(patch.pin)!==canonical(job.pin)){job.pin=patch.pin;draft.levelIds=[patch.pin.levelId];changes.push('pin');}
  if(patch.photo!==undefined&&canonical(patch.photo??null)!==canonical(job.photo??null)){
    if(patch.photo)job.photo=patch.photo;else delete job.photo;changes.push('photo');}
  if(patch.startDate!==undefined&&(patch.startDate??undefined)!==job.startDate){if(patch.startDate)job.startDate=patch.startDate;else delete job.startDate;changes.push('start date');}
  if(patch.dueDate!==undefined&&(patch.dueDate??undefined)!==job.dueDate){if(patch.dueDate)job.dueDate=patch.dueDate;else delete job.dueDate;changes.push('due date');}
  if(patch.status!==undefined&&patch.status!==physicalState(row)){job.status=patch.status;job.statusAt=e.at;job.statusIndex=row.history.length;changes.push('status → '+job.status);}
  if(!changes.length)return rows;
  draft.preferredDates=dates(job.startDate,job.dueDate);
  draft.quantities=draft.quantities.map(q=>({...q,...(q.planRef===row.job!.pin.planRef?{planRef:job.pin.planRef}:{}),...(q.item===row.draft.title?{item:draft.title}:{})}));
  return rows.map(r=>r!==row?r:{...r,draft,job,updatedAt:e.at,history:[...r.history,{at:e.at,label:'Job edited · '+changes.join(', '),worker:by}]});
}
