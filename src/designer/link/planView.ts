import Ajv from 'ajv';
import schema from './contract/plan-view.schema.json';
import { canonical, hashPack, parsePack, readPack, signPack } from './vendor/tradefolder/lib/jobPack/protocol';
import type { InvoicePack, Photo, Quantity, QuotePack, RequestPack, StatusPack } from './vendor/tradefolder/lib/jobPack/types';
import type { Property } from '../../store/propertyStore';
import { projectFingerprint } from '../projectHub';
import { projectGeometry } from './planGeometry';
import { pinExists } from './workGeometry';
import { pinSchema, type WorkPin } from './tradeJobs';

type Point2 = [number, number];
type Point3 = [number, number, number];
export type PlanSite = { id: string; label: string; kind: 'build-site' | 'lot' | 'house' };
export interface PlanView {
  type: 'ppw-plan-view'; v: 1; id: string; requestId: string; createdAt: string;
  from: { app: 'onelivebuild'; label: string }; project: { id: string; label: string };
  site: PlanSite; phase: string; package: { id: string; trade: string; title: string };
  plan: { revision: number; fingerprint: string }; units: 'm';
  levels: { id: string; label: string; elevationM: number; heightM: number }[];
  rooms: { id: string; levelId: string; label: string; polygon: Point2[]; areaM2: number }[];
  walls: { id: string; levelId: string; a: Point2; b: Point2; thicknessM: number; heightM: number }[];
  openings: { id: string; wallId: string; kind: 'door' | 'window' | 'opening'; offsetM: number; widthM: number; heightM: number; sillM?: number }[];
  runs: { id: string; levelId: string; system: string; label: string; points: Point3[]; lengthM: number }[];
  items: { id: string; levelId: string; roomId?: string; label: string; center: Point2; sizeM: Point2; rotationDeg: number }[];
  highlights: string[]; quantities: Quantity[]; notes: string[]; sha256: string;
}
export interface WorkPackage { type: 'ppw-work-package'; v: 1; request: RequestPack; planView: PlanView | null }
export interface WorkPackageInput {
  property: Property; requestId: string; viewId: string; now: string; project: PlanView['project']; site: PlanSite;
  package: PlanView['package']; phase: string; companyName: string; requesterType: 'company' | 'developer';
  description: string; currency: string; preferredDates?: string[]; quantities: Quantity[];
  revision: number; levelIds: string[]; highlights?: string[];
  resolveItem?: (productId: string) => { label: string; widthM: number; depthM: number } | undefined;
  photo?: Photo;
  jobPin?: WorkPin;
}
export type TradeAnswer = QuotePack | StatusPack | InvoicePack;
const validate = new Ajv({ strict: false }).compile<PlanView | WorkPackage>(schema);
const tooLarge = 'This design file is too large. Ask for one level or one work package at a time.';
const newer = 'This design file uses a newer version. Ask for a new copy.';
const encoder = new TextEncoder();
const refPattern = new RegExp(schema.definitions.planRef.pattern);
function boundedValue(raw: unknown, limit: number): unknown {
  let text: string;
  try { text = typeof raw === 'string' ? raw : JSON.stringify(raw); }
  catch { throw new Error('This design file is not readable. Ask for a new copy.'); }
  // Count the untrimmed UTF-8 input before parsing. A whitespace-padded file still counts.
  if (text == null) throw new Error(newer);
  if (text.length > limit || encoder.encode(text).byteLength > limit) throw new Error(tooLarge);
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(text); }
  catch { throw new Error('This design file is not readable. Ask for a new copy.'); }
}
function instant(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

/** The pinned signPack implementation is format-independent: spread + canonical hash.
 * Its TypeScript overload describes only JobPack envelopes. Narrow that adapter here;
 * never add a fake expiresAt/kind to a plan view or fork the hash algorithm. */
export function signPlanView(body: Omit<PlanView, 'sha256'>): Promise<PlanView> {
  const sign = signPack as unknown as (input: Omit<PlanView, 'sha256'>) => Promise<PlanView>;
  return sign(body);
}
export async function parsePlanView(raw: unknown, now: string): Promise<PlanView> {
  const view = boundedValue(raw, 300_000);
  if (!validate(view) || view.type !== 'ppw-plan-view') throw new Error(newer);
  if (view.sha256 !== await hashPack(view)) throw new Error('This design file has changed or is damaged. Ask for a new copy.');
  if (!instant(now) || !instant(view.createdAt) || view.createdAt > now)
    throw new Error('The design date is not valid or is in the future. Ask for a new copy.');
  const refs = new Set<string>();
  const add = (kind: string, items: { id:string }[]) => {
    for (const { id } of items) {
      const ref = 'olb:' + kind + ':' + id;
      if (refs.has(ref)) throw new Error('The design has two ' + kind + ' entries with the same ID.');
      refs.add(ref);
    }
  };
  add('level',view.levels); add('room',view.rooms); add('wall',view.walls);
  add('opening',view.openings); add('run',view.runs); add('item',view.items);
  for (const el of [...view.rooms,...view.walls,...view.runs,...view.items])
    if (!refs.has('olb:level:' + el.levelId)) throw new Error('A design element refers to a level missing from the file.');
  for (const el of view.openings) if (!refs.has('olb:wall:' + el.wallId)) throw new Error('An opening refers to a wall missing from the file.');
  for (const el of view.items) if (el.roomId !== undefined && !refs.has('olb:room:' + el.roomId))
    throw new Error('An item refers to a room missing from the file.');
  for (const q of view.quantities) if (q.planRef !== undefined) {
    if (!refPattern.test(q.planRef)) throw new Error('A quantity has an invalid plan reference.');
    refs.add(q.planRef);
  }
  if (view.highlights.some(ref => !refs.has(ref))) throw new Error('A highlight refers to something missing from the design.');
  return JSON.parse(JSON.stringify(view)) as PlanView;
}
export async function parseWorkPackage(raw: unknown, now: string): Promise<WorkPackage> {
  const work = boundedValue(raw, 400_000);
  if (!validate(work) || work.type !== 'ppw-work-package') throw new Error(newer);
  const request = await parsePack(work.request, now);
  if (request.kind !== 'request' || request.from.app !== 'onelivebuild' ||
      !['build-site','house','lot'].includes(request.site.kind) || !['developer','company'].includes(request.requester.type))
    throw new Error('This work file needs a One Live Build request from a developer or company.');
  const view = work.planView === null ? null : await parsePlanView(work.planView, now);
  if (view) {
    if (view.requestId !== request.id) throw new Error('This design names a different request.');
    if (canonical(view.from) !== canonical(request.from)) throw new Error('The request and design name different senders.');
    if (canonical(view.quantities) !== canonical(request.quantities ?? [])) throw new Error('The request and design have different quantities.');
  }
  return { type: 'ppw-work-package', v: 1, request, planView: view };
}
export async function readAnswer(text: string, now: string): Promise<TradeAnswer> {
  const answer = await readPack(text, now);
  if (answer.kind === 'request' || answer.from.app !== 'tradefolder')
    throw new Error('Choose a Trade Folder quote, progress report or invoice.');
  return answer;
}

/** Only explicitly listed coordination fields leave this boundary. IDs, time and
 * optional catalogue lookup come from the caller; the builders do no I/O. */
export async function buildPlanView(input: WorkPackageInput): Promise<PlanView> {
  const { property, project, site, phase, companyName, revision, quantities } = input;
  const geometry = projectGeometry(property, input.levelIds, input.resolveItem);
  if(input.jobPin){
    const p=pinSchema.parse(input.jobPin);
    if(!input.levelIds.includes(p.levelId)||!pinExists(property,p))throw new Error('The pinned part is no longer on this storey. Move the pin before sharing this job.');
    geometry.notes.push('Job pin on '+p.planRef+': x '+p.x+' m, y '+p.y+' m, height '+p.z+' m relative to '+p.levelId+'. Check on site.');
  }
  const refs = [...new Set([...(input.highlights ?? []), ...quantities.flatMap(q => q.planRef ? [q.planRef] : [])])];
  const view = await signPlanView({
    type: 'ppw-plan-view', v: 1, id: input.viewId, requestId: input.requestId, createdAt: input.now,
    from: {app:'onelivebuild',label:companyName}, project: {id:project.id,label:project.label},
    site: {id:site.id,label:site.label,kind:site.kind}, phase,
    package: {id:input.package.id,trade:input.package.trade,title:input.package.title},
    plan: {revision, fingerprint:await projectFingerprint(property)}, units:'m',
    ...geometry, highlights:refs, quantities:quantities.map(exportQuantity),
  });
  return parsePlanView(view, input.now);
}
function exportQuantity(q: Quantity): Quantity {
  return {item:q.item,qty:q.qty,unit:q.unit,...(q.planRef === undefined ? {} : {planRef:q.planRef})};
}
export async function buildWorkPackage(input: WorkPackageInput): Promise<WorkPackage> {
  if (!instant(input.now)) throw new Error('Choose a valid send date.');
  if (input.photo && input.photo.sizeBytes > 60_000) throw new Error('This plan picture is too large to attach.');
  const request = await signPack<RequestPack>({
    type:'ppw-job-pack',v:1,kind:'request',id:input.requestId,requestId:input.requestId,createdAt:input.now,
    expiresAt:new Date(Date.parse(input.now) + 30 * 86_400_000).toISOString(),
    from:{app:'onelivebuild',label:input.companyName},site:{kind:input.site.kind,label:input.site.label},
    requester:{type:input.requesterType,label:input.companyName},
    title:input.package.title,trade:input.package.trade,description:input.description,urgency:3,
    currency:input.currency,quantities:input.quantities.map(exportQuantity),
    ...(input.preferredDates?.length ? {preferredDates:[...input.preferredDates]} : {}),
    ...(input.photo ? {photos:[{ref:input.photo.ref,sizeBytes:input.photo.sizeBytes}]} : {}),
  });
  const planView = await buildPlanView(input);
  return parseWorkPackage({type:'ppw-work-package',v:1,request,planView},input.now);
}
