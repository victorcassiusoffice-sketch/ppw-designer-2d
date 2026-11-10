import type { Property } from '../../store/propertyStore';
import { type LinkPackage, packageStatus, type LinkStatus } from './exchange';
import { measuredAnchors, pinExists } from './workGeometry';
import { packageTrade, physicalState, type JobStatus, type TradeRole, type WorkPin } from './tradeJobs';
export { TRADE_ROLES, JOB_STATUSES, packageTrade, type CreateJobInput, type JobPatch, type JobStatus, type TradeRole, type WorkPin } from './tradeJobs';
export { workGeometry, pinExists } from './workGeometry';

export interface TimelineEntry { id:string;packageId:string;title:string;trade:TradeRole;at:string;actor:string;source:'person'|'trade-folder'|'unrecorded';label:string }
export interface WorkItem { id:string;packageId:string;trade:TradeRole;title:string;status:JobStatus;exchange:LinkStatus;anchors:WorkPin[];history:TimelineEntry[];updatedAt:string;kind:'job'|'package' }
function historyOf(row:LinkPackage):TimelineEntry[]{
  return row.history.map((h,i)=>({id:row.draft.id+':'+i,packageId:row.draft.id,title:row.draft.title,trade:packageTrade(row),
    at:h.at,actor:h.by?.name??h.worker??h.fileSender??'Name not recorded',source:h.fileSender?'trade-folder':(h.by||h.worker)?'person':'unrecorded',label:h.label})).reverse() as TimelineEntry[];
}
export function projectTimeline(projectId:string,rows:LinkPackage[]):TimelineEntry[]{
  return rows.filter(row=>row.draft.projectId===projectId).flatMap(historyOf).sort((a,b)=>b.at.localeCompare(a.at));
}
export function workItems(property:Property,rows:LinkPackage[]):WorkItem[]{
  return rows.filter(row=>row.draft.projectId===property.id).map((row):WorkItem=>({
    id:row.draft.id,packageId:row.draft.id,trade:packageTrade(row),title:row.draft.title,kind:row.job?'job':'package',
    status:physicalState(row),exchange:packageStatus(row),updatedAt:row.updatedAt,history:historyOf(row),
    anchors:row.job ? (pinExists(property,row.job.pin)?[row.job.pin]:[]) : measuredAnchors(property,row.draft.levelIds,row.draft.quantities),
  })).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
}
