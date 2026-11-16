import { z } from 'zod';
import { id } from './contract.js';
export const recordKinds = [
  'report',
  'ticket',
  'permit',
  'signed copy',
  'minutes',
  'attendance list',
  'handover record',
  'other',
] as const;
export const proofKinds = [
  'buying paper',
  'offer',
  'contract',
  'order',
  'delivery note',
  'invoice',
  'receipt',
  'proof of payment',
  'tax note',
  'pay slip',
  'time sheet',
  'bank notice',
  'approval',
  'transfer proof',
] as const;
export const fileKind = z.enum([...recordKinds, ...proofKinds]);
export const evidenceInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    kind: fileKind,
    source: z.enum(['record', 'money', 'report pack']).default('record'),
    linkedId: id.optional(),
  })
  .strict();
export const evidenceMeta = evidenceInput.extend({
  id,
  money: z.boolean(),
  mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  addedBy: id,
  addedAt: z.string().datetime(),
});
export type Evidence = z.infer<typeof evidenceMeta>;
export const fileCap = 1_000_000;
