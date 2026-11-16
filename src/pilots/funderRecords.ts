import { z } from 'zod';
import { id, day } from './contract.js';
const short = z.string().trim().min(1).max(160),
  note = z.string().trim().max(500),
  amount = z.number().int().min(0).max(1e12),
  decimal = z.string().regex(/^(0|[1-9]\d{0,10})(\.\d{1,8})?$/),
  positive = z.number().int().min(1).max(600);
const base = { id, version: z.literal(2) };
export const signedLine = z
  .object({
    id,
    heading: short,
    kind: z.enum(['ordinary', 'staff', 'flat rate', 'contingency']),
    direct: z.boolean(),
    costType: short,
    unit: short,
    units: decimal,
    unitValue: amount,
    total: amount,
  })
  .strict();
const version = z
  .object({
    ...base,
    type: z.literal('plan_version'),
    number: positive,
    date: day,
    file: id,
    change: id.optional(),
    lines: signedLine.array().max(250).optional(),
  })
  .strict();
const move = z
  .object({
    ...base,
    type: z.literal('move'),
    from: id,
    to: id,
    amount,
    date: day,
    justification: short,
    objectiveUnchanged: z.boolean(),
    plan: id,
  })
  .strict();
const use = z
  .object({
    ...base,
    type: z.literal('contingency_use'),
    requestDate: day,
    reasonsFile: id,
    approvalDate: day,
    approvalFile: id,
    amount,
    receivers: z
      .array(z.object({ line: id, amount }).strict())
      .min(1)
      .max(50),
    plan: id,
  })
  .strict();
const change = z
  .object({
    ...base,
    type: z.literal('change_record'),
    kind: z.enum(['signed change', 'extension', 'suspension']),
    requestDate: day,
    appliesFrom: day,
    signedDate: day.optional(),
    file: id.optional(),
    months: positive.optional(),
    start: day.optional(),
    end: day.optional(),
  })
  .strict();
const source = z
  .object({
    ...base,
    type: z.literal('source'),
    giver: z.enum(['lead', 'partner', 'outside public', 'outside private', 'project income']),
    name: short,
    conditions: note,
    earmarked: z.boolean(),
    lines: id.array().max(100),
    returnsUnused: z.boolean(),
    kind: z.enum(['cash', 'paid staff time', 'in kind']),
    promised: amount,
    proofState: z.enum(['none', 'promised in writing', 'received']),
    proofBy: day.optional(),
    file: id.optional(),
  })
  .strict();
const cut = z
  .object({ ...base, type: z.literal('cut'), amount, reasonFile: id, date: day })
  .strict();
const forecast = z
  .object({
    ...base,
    type: z.literal('forecast'),
    line: id,
    period: id,
    unit: short,
    units: decimal,
    unitValue: amount,
    variationNote: note.optional(),
    variationPercentNote: note.optional(),
    forecastNote: note.optional(),
  })
  .strict();
const purchase = z.enum(['service', 'supply', 'works']);
const bands = z
  .object({
    ...base,
    type: z.literal('band_table'),
    purchaseType: purchase,
    edges: z.array(z.object({ value: amount, lower: z.boolean() }).strict()).max(12),
    includeTax: z.boolean(),
    bands: z
      .array(z.object({ procedure: short, providers: z.number().int().min(1).max(100) }).strict())
      .min(1)
      .max(13),
    committeeFrom: amount.optional(),
  })
  .strict();
const procurement = z
  .object({
    ...base,
    type: z.literal('procurement_plan'),
    file: id,
    sent: day,
    noObjection: day.optional(),
    approvalFile: id.optional(),
    renewal: day.optional(),
  })
  .strict();
const check = z
  .object({
    ...base,
    type: z.literal('buying_check'),
    ownerBids: z.boolean(),
    procedure: short,
    consulted: z.number().int().nonnegative().max(1000),
    offerCount: z.number().int().nonnegative().max(1000),
    outcome: z.enum(['pending', 'passed', 'failed']),
    awardedProvider: short.optional(),
    awardDate: day.optional(),
    line: id.optional(),
    purchaseType: purchase.optional(),
    value: amount.optional(),
    tax: amount.optional(),
    label: short.optional(),
    supplier: short.optional(),
    plan: id.optional(),
    afterSales: z.boolean().optional(),
    date: day.optional(),
    noticeWhere: short.optional(),
    noticeDate: day.optional(),
    singleReason: short.optional(),
    integrity: id.optional(),
    awardBasis: z.enum(['lowest price', 'best value']).optional(),
    committee: short.array().max(25).optional(),
    committeeReport: id.optional(),
    scores: note.optional(),
    tender: id.optional(),
  })
  .strict();
const offer = z
  .object({ ...base, type: z.literal('offer'), check: id, provider: short, amount, file: id })
  .strict();
const guarantee = z
  .object({
    ...base,
    type: z.literal('guarantee'),
    applies: z.boolean(),
    issuer: note,
    state: z.enum(['not asked', 'asked', 'issued', 'released', 'called']),
    issuedFile: id.optional(),
    releaseDate: day.optional(),
    releaseFile: id.optional(),
    calledAmount: amount.optional(),
  })
  .strict();
const asset = z
  .object({
    ...base,
    type: z.literal('asset'),
    costId: id,
    receiver: short,
    planned: day.optional(),
    actual: day.optional(),
    file: id.optional(),
    insured: z.boolean(),
    state: z.enum(['held', 'handover planned', 'handed over', 'keep asked', 'keep approved']),
    requestFile: id.optional(),
    approvalFile: id.optional(),
    comments: note,
  })
  .strict();
const staff = z
  .object({
    ...base,
    type: z.literal('staff_month'),
    memberId: id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    hours: decimal,
    totalHours: decimal,
    line: id.optional(),
    step: id,
    timeSheet: id.optional(),
    paySlip: id.optional(),
    approved: z.boolean().default(false),
  })
  .strict();
const wrong = z
  .object({
    ...base,
    type: z.literal('wrong_sum'),
    date: day,
    what: short,
    amount,
    recovered: amount,
    file: id.optional(),
  })
  .strict();
export const funderSchemas = [
  version,
  move,
  use,
  change,
  source,
  cut,
  forecast,
  bands,
  procurement,
  check,
  offer,
  guarantee,
  asset,
  staff,
  wrong,
] as const;
