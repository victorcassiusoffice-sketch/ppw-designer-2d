import { z } from 'zod';

/** Collaborative snapshots contain only the measured Property. Camera, tool choice and current selection are local. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Build = { [key: string]: Json };
export type PathPart = string | { id: string };
export interface Change {
  path: PathPart[];
  before: Json | null;
  after: Json | null;
  had: boolean;
  has: boolean;
}
export const TRADES = [
  'Builder',
  'Architect',
  'Electrical',
  'Plumbing',
  'Foundation',
  'Survey',
  'Finishes',
] as const;
export const AVATARS = ['female-a', 'female-b', 'male-a', 'male-b', 'nadia'] as const;
const blocked = new Set(['__proto__', 'constructor', 'prototype']);
const safeKey = (v: string) => v.length > 0 && v.length <= 150 && !blocked.has(v);
const record = (v: unknown): v is Build => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (v: object, key: string) => Object.prototype.hasOwnProperty.call(v, key);
export function safeJson(value: unknown): value is Json {
  let budget = 60000;
  const visit = (v: unknown, d: number): boolean => {
    if (--budget < 0 || d > 32) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= 1e12;
    if (typeof v === 'string') return v.length <= 80000;
    if (Array.isArray(v)) return v.length <= 8192 && v.every((x) => visit(x, d + 1));
    return record(v) && Object.keys(v).every((k) => safeKey(k) && visit(v[k], d + 1));
  };
  return visit(value, 0);
}
export const PoseSchema = z
  .object({
    x: z.number().finite().min(-100000).max(100000),
    y: z.number().finite().min(-100000).max(100000),
    z: z.number().finite().min(-100000).max(100000),
    yaw: z.number().finite().min(-1000).max(1000),
    moving: z.boolean(),
  })
  .strict();
export type Pose = z.infer<typeof PoseSchema>;
export interface Player {
  id: string;
  trade: string;
  avatar: string;
  pose: Pose | null;
  seen: number;
}
export const ProfileSchema = z.object({ trade: z.enum(TRADES), avatar: z.enum(AVATARS) }).strict();
export const ChangeSchema = z
  .object({
    path: z
      .array(
        z.union([
          z.string().refine(safeKey),
          z.object({ id: z.string().refine(safeKey) }).strict(),
        ]),
      )
      .min(1)
      .max(30),
    before: z.custom<Json>(safeJson),
    after: z.custom<Json>(safeJson),
    had: z.boolean(),
    has: z.boolean(),
  })
  .strict()
  .refine((s) => s.had || s.has);
export const EditSchema = z
  .object({
    requestId: z.string().uuid(),
    revision: z.number().int().min(1),
    changes: z.array(ChangeSchema).min(1).max(512),
  })
  .strict();
const privateFields = new Set(['activeRoomId', 'activeLevelId', 'selectedItemId']);
export function sharedProperty(raw: unknown): Build {
  if (!record(raw)) throw Error('Invalid build.');
  const copy = JSON.parse(JSON.stringify(raw)) as Build;
  for (const k of privateFields) delete copy[k];
  // An initially empty collection still has stable, independently editable children.
  for (const name of ['boundaryComponents', 'walls', 'stairs', 'terrainCuts'])
    if (copy[name] === undefined) copy[name] = [];
  if (
    !safeJson(copy) ||
    typeof copy.id !== 'string' ||
    !safeKey(copy.id) ||
    !Array.isArray(copy.rooms) ||
    copy.rooms.length > 512 ||
    JSON.stringify(copy).length > 720000
  )
    throw Error('Invalid or oversized build.');
  for (const room of copy.rooms) {
    if (
      !record(room) ||
      typeof room.id !== 'string' ||
      !safeKey(room.id) ||
      !Array.isArray(room.polygon) ||
      !Array.isArray(room.placedItems) ||
      !Array.isArray(room.openings)
    )
      throw Error('Invalid room.');
    if (room.polygon.some((p) => !record(p) || typeof p.x !== 'number' || typeof p.y !== 'number'))
      throw Error('Invalid room coordinates.');
  }
  return copy;
}
export function sameJson(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  return (
    record(a) &&
    record(b) &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((k) => has(b, k) && sameJson(a[k], b[k]))
  );
}
function indexed(a: Json[]): Map<string, Json> | undefined {
  const m = new Map<string, Json>();
  for (const v of a) {
    if (!record(v) || typeof v.id !== 'string' || !safeKey(v.id) || m.has(v.id)) return;
    m.set(v.id, v);
  }
  return m;
}
export function buildChanges(before: Build, after: Build): Change[] {
  const changes: Change[] = [];
  function visit(a: Json | undefined, b: Json | undefined, path: PathPart[]) {
    if (sameJson(a, b)) return;
    if (record(a) && record(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
        visit(a[k], b[k], [...path, k]);
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const left = indexed(a),
        right = indexed(b);
      if (
        left &&
        right &&
        [...left.keys()].filter((id) => right.has(id)).join('\0') ===
          [...right.keys()].filter((id) => left.has(id)).join('\0')
      ) {
        for (const id of new Set([...left.keys(), ...right.keys()]))
          visit(left.get(id), right.get(id), [...path, { id }]);
        return;
      }
    }
    changes.push({
      path,
      had: a !== undefined,
      has: b !== undefined,
      before: a ?? null,
      after: b ?? null,
    });
  }
  visit(before, after, []);
  return changes;
}
export class EditConflict extends Error {}
/** Check every old value against the current model and apply the whole edit or none of it. */
export function applyChanges(current: Build, changes: readonly Change[]): Build {
  const next = structuredClone(current);
  for (const op of changes) {
    if (
      op.path.length === 0 ||
      typeof op.path[0] !== 'string' ||
      privateFields.has(op.path[0]) ||
      op.path[0] === 'id'
    )
      throw Error('Invalid build edit.');
    let parent: Json = next;
    for (let i = 0; i < op.path.length; i++) {
      const part = op.path[i],
        last = i === op.path.length - 1;
      if (typeof part === 'string' && !safeKey(part)) throw Error('Invalid build field.');
      if (typeof part === 'object' && !safeKey(part.id)) throw Error('Invalid build element.');
      let value: Json | undefined;
      if (typeof part === 'string' && record(parent))
        value = has(parent, part) ? parent[part] : undefined;
      else if (typeof part === 'object' && Array.isArray(parent))
        value = parent.find((v) => record(v) && v.id === part.id);
      else throw new EditConflict('The target changed.');
      if (!last) {
        if (value === undefined) throw new EditConflict('The target was removed.');
        parent = value;
        continue;
      }
      if (op.had !== (value !== undefined) || (op.had && !sameJson(value, op.before)))
        throw new EditConflict('Another player changed the same element.');
      if (typeof part === 'string' && record(parent)) {
        if (op.has) parent[part] = structuredClone(op.after);
        else delete parent[part];
      } else if (typeof part === 'object' && Array.isArray(parent)) {
        if (op.has && (!record(op.after) || op.after.id !== part.id))
          throw Error('Invalid element identity.');
        const at = parent.indexOf(value as Json);
        if (!op.has) parent.splice(at, 1);
        else if (at < 0) parent.push(structuredClone(op.after));
        else parent[at] = structuredClone(op.after);
      }
    }
  }
  return sharedProperty(next);
}
