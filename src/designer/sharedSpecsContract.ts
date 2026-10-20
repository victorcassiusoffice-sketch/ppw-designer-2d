import { z } from 'zod';

export const SHARED_SPEC_ROLES = ['owner', 'architect', 'engineer', 'supplier', 'contractor', 'client'] as const;
export type SharedSpecRole = typeof SHARED_SPEC_ROLES[number];
export const SHARED_SPEC_CATEGORIES = ['wall', 'floor', 'roof', 'foundation', 'plumbing', 'electrical', 'hvac', 'fire', 'security', 'furniture', 'landscape', 'solar', 'other'] as const;
export const SHARED_SPEC_UNITS = ['m', 'm2', 'm3', 'kg', 'L', 'each'] as const;
export const PILOT_STAGES = ['brief', 'geometry', 'materials', 'engineering', 'supplier', 'logistics', 'client', 'release'] as const;
export type PilotStage = typeof PILOT_STAGES[number];
const Text = z.string().trim().max(2000);
const Identifier = z.string().trim().min(1).max(180).regex(/^[a-zA-Z0-9_.:@/-]+$/);
export const ClerkUserIdSchema = z.string().regex(/^user_[a-zA-Z0-9]{1,120}$/);
const Source = z.string().url().max(1500).refine((value) => /^https?:\/\//i.test(value), 'Use an http or https source URL.');
const Finite = z.number().finite();
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const SharedSurfaceAnalysisSchema = z.object({
  id: Identifier, name: z.string().trim().min(1).max(200), kind: z.enum(['moss', 'piezo', 'traffic-turbine']), areaM2: Finite.positive().max(1e9),
  exposure: z.enum(['windward', 'leeward', 'sheltered', 'unknown']).optional(),
  annualActivations: Finite.min(0).max(1e12).optional(), trafficSource: Source.optional(),
  joulesPerActivation: Finite.min(0).max(1e12).optional(), yieldSource: Source.optional(),
  annualAuxiliaryKwh: Finite.min(0).max(1e12).optional(), auxiliarySource: Source.optional(),
  embodiedCarbonKgCo2e: Finite.min(0).max(1e12).optional(), carbonBoundary: z.string().trim().max(300).optional(), carbonSource: Source.optional(),
  gridKgCo2ePerKwh: Finite.min(0).max(100).optional(), gridSource: Source.optional(),
  annualOtherOperatingKgCo2e: Finite.min(0).max(1e12).optional(), operatingCarbonSource: Source.optional(),
  annualVehiclePenaltyKgCo2e: Finite.min(0).max(1e12).optional(), vehiclePenaltySource: Source.optional(),
  serviceLifeYears: Finite.positive().max(1000).optional(), lifetimeSource: Source.optional(),
}).strict();
export const SharedSpecAnalysisSchema = z.object({
  airTempC: Finite.min(-30).max(70).optional(), relativeHumidityPct: Finite.min(0).max(100).optional(),
  surfaceTempC: Finite.min(-30).max(100).optional(), initialMoisturePct: Finite.min(0).max(100).optional(),
  targetMoisturePct: Finite.min(0).max(100).optional(), dryingRatePctPerDay: Finite.positive().max(100).optional(),
  rateEvidenceUrl: Source.optional(), mouldThresholdPct: Finite.min(0).max(100).optional(), thresholdEvidenceUrl: Source.optional(),
  mouldMinimumExposureHours: Finite.min(0).max(87600).optional(), exposureHours: Finite.min(0).max(87600).optional(), dryingConditionsMatch: z.boolean().optional(),
  surface: SharedSurfaceAnalysisSchema.optional(),
}).strict();
export const SharedSpecComponentSchema = z.object({
  id: Identifier, sourceKey: Identifier.optional(), sourceFingerprint: z.string().max(160).optional(), sourceRemoved: z.boolean().default(false),
  category: z.enum(SHARED_SPEC_CATEGORIES), name: z.string().trim().min(1).max(200), material: z.string().trim().max(300),
  quantity: Finite.min(0).max(1e9), unit: z.enum(SHARED_SPEC_UNITS),
  cost: z.object({ amount: Finite.min(0).max(1e12), currency: z.enum(['MUR', 'USD', 'EUR', 'GBP', 'CNY']), basis: z.enum(['per-unit', 'total']).default('per-unit') }).strict().optional(),
  carbon: z.object({ factor: Finite.min(-1e9).max(1e9), unit: z.literal('kgCO2e/unit'), boundary: z.string().trim().min(1).max(300), evidenceUrl: Source.optional(), notes: Text.optional() }).strict().refine((c) => c.factor >= 0 || !!c.evidenceUrl, 'Negative carbon factors require a declared evidence source.').optional(),
  deliveryDate: DateOnly.optional(), responsibleParty: z.string().trim().max(200).optional(), assigneeUserId: ClerkUserIdSchema.optional(),
  status: z.enum(['draft', 'review', 'approved', 'ordered', 'delivered']).default('draft'), sources: z.array(Source).max(12).default([]), notes: Text.default(''),
  origin: z.enum(['unknown', 'mauritius', 'imported']).default('unknown'), analysis: SharedSpecAnalysisSchema.optional(),
}).strict();
export type SharedSpecComponent = z.infer<typeof SharedSpecComponentSchema>;
export const SharedSpecPatchSchema = SharedSpecComponentSchema.omit({ id: true }).partial().extend({
  cost: SharedSpecComponentSchema.shape.cost.nullable(), carbon: SharedSpecComponentSchema.shape.carbon.nullable(),
  deliveryDate: DateOnly.nullable().optional(), responsibleParty: z.string().trim().max(200).nullable().optional(),
  assigneeUserId: ClerkUserIdSchema.nullable().optional(), analysis: SharedSpecAnalysisSchema.nullable().optional(),
}).strict().refine((p) => Object.keys(p).length > 0, 'Choose at least one field.');
export type SharedSpecPatch = z.infer<typeof SharedSpecPatchSchema>;
export const SharedSpecMemberSchema = z.object({ userId: ClerkUserIdSchema, role: z.enum(SHARED_SPEC_ROLES), active: z.boolean() }).strict();
export type SharedSpecMember = z.infer<typeof SharedSpecMemberSchema>;
export const PilotReviewSchema = z.object({ stageId: z.enum(PILOT_STAGES), decision: z.enum(['accepted', 'needs-work']), note: Text, actorUserId: ClerkUserIdSchema, reviewedAt: z.string().datetime(), basisRevision: z.number().int().min(0) }).strict();
export type PilotReview = z.infer<typeof PilotReviewSchema>;
export const SharedSpecProjectSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(180), sourceBuildId: Identifier,
  components: z.array(SharedSpecComponentSchema).max(500), members: z.array(SharedSpecMemberSchema).min(1).max(100),
  specRevision: z.number().int().min(0), pilotReviews: z.array(PilotReviewSchema).max(8),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.components.map((v) => v.id)).size !== p.components.length) ctx.addIssue({ code: 'custom', message: 'Duplicate component IDs.' });
  if (new Set(p.members.map((v) => v.userId)).size !== p.members.length) ctx.addIssue({ code: 'custom', message: 'Duplicate members.' });
  if (p.members.filter((v) => v.active && v.role === 'owner').length !== 1) ctx.addIssue({ code: 'custom', message: 'Exactly one active owner is required.' });
  if (new Set(p.pilotReviews.map((v) => v.stageId)).size !== p.pilotReviews.length) ctx.addIssue({ code: 'custom', message: 'Duplicate pilot stages.' });
});
export type SharedSpecProject = z.infer<typeof SharedSpecProjectSchema>;
export const SharedSpecCreateSchema = z.object({ requestId: z.string().uuid(), projectId: z.string().uuid(), name: z.string().trim().min(1).max(180), sourceBuildId: Identifier, components: z.array(SharedSpecComponentSchema).max(500).default([]) }).strict().refine((p) => new Set(p.components.map((v) => v.id)).size === p.components.length, 'Duplicate component IDs.');
export type SharedSpecCreate = z.infer<typeof SharedSpecCreateSchema>;
export const SharedSpecOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sync-components'), components: z.array(SharedSpecComponentSchema).max(500) }).strict(),
  z.object({ type: z.literal('patch-component'), componentId: Identifier, patch: SharedSpecPatchSchema }).strict(),
  z.object({ type: z.literal('set-member'), userId: ClerkUserIdSchema, role: z.enum(SHARED_SPEC_ROLES).exclude(['owner']), active: z.boolean() }).strict(),
  z.object({ type: z.literal('review-stage'), stageId: z.enum(PILOT_STAGES), decision: z.enum(['accepted', 'needs-work']), note: Text }).strict(),
]);
export type SharedSpecOperation = z.infer<typeof SharedSpecOperationSchema>;
export const SharedSpecWriteSchema = z.object({ requestId: z.string().uuid(), expectedRevision: z.number().int().min(1).max(2147483646), operation: SharedSpecOperationSchema }).strict();
export type SharedSpecWrite = z.infer<typeof SharedSpecWriteSchema>;
export const SharedSpecRecordSchema = z.object({ project: SharedSpecProjectSchema, revision: z.number().int().positive(), updatedAt: z.string().datetime(), role: z.enum(SHARED_SPEC_ROLES), replayed: z.boolean().optional(), latestRevision: z.number().int().positive().optional() });
export type SharedSpecRecord = z.infer<typeof SharedSpecRecordSchema>;
export interface SharedSpecChange { revision: number; actorUserId: string; changedAt: string; operation: string; componentId?: string }
export interface SharedSpecChanges { changes: SharedSpecChange[]; latestRevision: number; nextAfter: number; hasMore: boolean }
export interface SharedSpecProjectSummary { id: string; name: string; sourceBuildId: string; revision: number; updatedAt: string; role: SharedSpecRole }

const TECHNICAL = ['name', 'material', 'quantity', 'unit', 'category', 'sourceKey', 'sourceFingerprint', 'sourceRemoved', 'cost', 'carbon', 'deliveryDate', 'responsibleParty', 'assigneeUserId', 'status', 'sources', 'notes', 'origin'];
export const SHARED_SPEC_EDITABLE_FIELDS: Record<SharedSpecRole, readonly string[]> = {
  owner: [...TECHNICAL, 'analysis'], architect: TECHNICAL, engineer: [...TECHNICAL, 'analysis'],
  supplier: ['material', 'cost', 'carbon', 'deliveryDate', 'status', 'sources', 'notes', 'origin'], contractor: ['deliveryDate', 'responsibleParty', 'status', 'notes'], client: ['notes'],
};
export const PILOT_STAGE_ROLES: Record<PilotStage, readonly SharedSpecRole[]> = {
  brief: ['owner', 'architect'], geometry: ['architect', 'engineer'], materials: ['architect', 'engineer'], engineering: ['engineer'],
  supplier: ['supplier'], logistics: ['contractor'], client: ['client'], release: ['owner'],
};
/** A view role is never authority. The server resolves live membership for every read/write. */
export function canEditSharedSpec(role: SharedSpecRole, userId: string, component: SharedSpecComponent, patch: SharedSpecPatch): boolean {
  if (role === 'supplier' && component.assigneeUserId !== userId) return false;
  return Object.keys(patch).every((key) => SHARED_SPEC_EDITABLE_FIELDS[role].includes(key));
}

/** Measured sync preserves manual fields. A changed unit invalidates per-unit cost/carbon evidence. */
export function mergeMeasuredSpecs(existing: SharedSpecComponent[], incoming: SharedSpecComponent[]): SharedSpecComponent[] {
  const incomingIds = new Set(incoming.map((c) => c.id));
  const result = new Map(existing.map((c) => [c.id, c.sourceKey && !incomingIds.has(c.id) ? { ...c, sourceRemoved: true } : c]));
  for (const next of incoming) {
    const old = result.get(next.id);
    if (!old) { result.set(next.id, next); continue; }
    const merged = { ...old, name: next.name, category: next.category, quantity: next.quantity, unit: next.unit, sourceKey: next.sourceKey, sourceFingerprint: next.sourceFingerprint, sourceRemoved: next.sourceRemoved };
    if (old.unit !== next.unit) { delete merged.carbon; if (merged.cost?.basis !== 'total') delete merged.cost; }
    result.set(next.id, SharedSpecComponentSchema.parse(merged));
  }
  return [...result.values()];
}

export class SharedSpecOperationError extends Error {
  constructor(public code: 'forbidden' | 'invalid' | 'not-found', message: string) { super(message); }
}

/** Minimum pilot data, not regulatory approval. Missing evidence is never inferred. */
export function pilotStageBlockers(project: SharedSpecProject, stage: PilotStage): string[] {
  const active = project.components.filter((c) => !c.sourceRemoved);
  const stages = stage === 'release' ? ['geometry', 'materials', 'supplier', 'logistics'] : [stage];
  const blockers: string[] = [];
  if (stages.some((s) => ['geometry', 'materials', 'supplier', 'logistics'].includes(s)) && !active.length) return ['Synchronize at least one active measured component.'];
  for (const selected of stages) {
    if (selected === 'materials') {
      const missing = active.filter((c) => !c.material.trim() || !c.sources.length);
      if (missing.length) blockers.push(`${missing.length} component(s) need a material and a source URL: ${missing.slice(0, 3).map((c) => c.name).join(', ')}.`);
    }
    if (selected === 'supplier') {
      const missing = active.filter((c) => !project.members.some((m) => m.active && m.role === 'supplier' && m.userId === c.assigneeUserId));
      if (missing.length) blockers.push(`${missing.length} component(s) need an active supplier assignment: ${missing.slice(0, 3).map((c) => c.name).join(', ')}.`);
    }
    if (selected === 'logistics') {
      const missing = active.filter((c) => !c.responsibleParty?.trim() || !c.deliveryDate);
      if (missing.length) blockers.push(`${missing.length} component(s) need a responsible party and delivery date: ${missing.slice(0, 3).map((c) => c.name).join(', ')}.`);
    }
  }
  return blockers;
}

/** Shared pure reducer for local rehearsal and server validation. Local use grants no cloud rights. */
export function applySharedSpecOperation(project: SharedSpecProject, operation: SharedSpecOperation, actorUserId: string, now: string): SharedSpecProject {
  const actor = project.members.find((m) => m.userId === actorUserId && m.active);
  if (!actor) throw new SharedSpecOperationError('forbidden', 'Active project membership is required.');
  let next = structuredClone(project);
  switch (operation.type) {
    case 'sync-components': {
      if (!['owner', 'architect', 'engineer'].includes(actor.role)) throw new SharedSpecOperationError('forbidden', 'Your project role cannot synchronize measured components.');
      if (new Set(operation.components.map((c) => c.id)).size !== operation.components.length) throw new SharedSpecOperationError('invalid', 'Duplicate component IDs.');
      if (actor.role === 'architect' && operation.components.some((c) => !next.components.some((old) => old.id === c.id) && c.analysis)) throw new SharedSpecOperationError('forbidden', 'Engineering inputs require the engineer role.');
      next.components = mergeMeasuredSpecs(next.components, operation.components);
      if (operation.components.some((c) => c.assigneeUserId && !next.members.some((m) => m.userId === c.assigneeUserId && m.active))) throw new SharedSpecOperationError('invalid', 'Assign an active project member.');
      if (JSON.stringify(next.components) !== JSON.stringify(project.components)) next.specRevision += 1;
      break;
    }
    case 'patch-component': {
      const component = next.components.find((c) => c.id === operation.componentId);
      if (!component) throw new SharedSpecOperationError('not-found', 'Component not found.');
      if (!canEditSharedSpec(actor.role, actorUserId, component, operation.patch)) throw new SharedSpecOperationError('forbidden', 'Your project role cannot edit these component fields.');
      const patch = operation.patch;
      if (patch.assigneeUserId && !next.members.some((m) => m.userId === patch.assigneeUserId && m.active)) throw new SharedSpecOperationError('invalid', 'Assign an active project member.');
      const modified: Record<string, unknown> = { ...component, ...patch };
      for (const [key, value] of Object.entries(modified)) if (value === null) delete modified[key];
      // Technical evidence belongs to the declared material. System-owned invalidation
      // also applies when a supplier/architect cannot edit engineering inputs directly.
      if (typeof patch.material === 'string' && patch.material.trim() !== component.material.trim()) {
        if (!Object.prototype.hasOwnProperty.call(patch, 'analysis')) delete modified.analysis;
        if (!Object.prototype.hasOwnProperty.call(patch, 'carbon')) delete modified.carbon;
      }
      // Never carry factors expressed per old unit into a new unit without explicit replacement.
      if (patch.unit && patch.unit !== component.unit) {
        if (!Object.prototype.hasOwnProperty.call(patch, 'carbon')) delete modified.carbon;
        if (!Object.prototype.hasOwnProperty.call(patch, 'cost') && component.cost?.basis !== 'total') delete modified.cost;
      }
      next.components = next.components.map((c) => c.id === component.id ? SharedSpecComponentSchema.parse(modified) : c);
      if (JSON.stringify(next.components) !== JSON.stringify(project.components)) next.specRevision += 1;
      break;
    }
    case 'set-member': {
      if (actor.role !== 'owner') throw new SharedSpecOperationError('forbidden', 'Only the project owner manages membership.');
      if (next.members.some((m) => m.userId === operation.userId && m.role === 'owner')) throw new SharedSpecOperationError('forbidden', 'The project owner cannot be removed or reassigned.');
      const member = { userId: operation.userId, role: operation.role, active: operation.active };
      next.members = next.members.some((m) => m.userId === member.userId) ? next.members.map((m) => m.userId === member.userId ? member : m) : [...next.members, member];
      break;
    }
    case 'review-stage': {
      if (!PILOT_STAGE_ROLES[operation.stageId].includes(actor.role)) throw new SharedSpecOperationError('forbidden', 'Your project role cannot acknowledge this pilot stage.');
      const blockers = pilotStageBlockers(next, operation.stageId);
      if (operation.decision === 'accepted' && blockers.length) throw new SharedSpecOperationError('invalid', blockers.join(' '));
      if (operation.stageId === 'release' && operation.decision === 'accepted' && PILOT_STAGES.filter((s) => s !== 'release').some((stageId) => !next.pilotReviews.some((r) => r.stageId === stageId && r.decision === 'accepted' && r.basisRevision === next.specRevision && next.members.some((m) => m.userId === r.actorUserId && m.active && PILOT_STAGE_ROLES[stageId].includes(m.role))))) throw new SharedSpecOperationError('invalid', 'Every pilot stage needs a current acknowledgement from its active responsible role.');
      const review: PilotReview = { stageId: operation.stageId, decision: operation.decision, note: operation.note, actorUserId, reviewedAt: now, basisRevision: next.specRevision };
      next.pilotReviews = [...next.pilotReviews.filter((r) => r.stageId !== operation.stageId), review];
      break;
    }
  }
  next = SharedSpecProjectSchema.parse(next);
  return next;
}
