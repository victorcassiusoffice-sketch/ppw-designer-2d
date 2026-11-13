import { z } from 'zod';
import {
  siteSchema,
  photoSchema,
  readingSchema,
  logSchema,
  stepSchema,
  paperSchema,
  noteSchema,
  cameraSchema,
  id,
} from './contract.js';
export const kindsToCollection = {
  site: 'sites',
  photo: 'photos',
  reading: 'readings',
  log: 'logs',
  step: 'steps',
  paper: 'papers',
  note: 'notes',
  camera: 'cameras',
} as const;
export type ItemKind = keyof typeof kindsToCollection;
export const validators = {
  site: siteSchema,
  photo: photoSchema,
  reading: readingSchema,
  log: logSchema,
  step: stepSchema,
  paper: paperSchema,
  note: noteSchema,
  camera: cameraSchema,
};
export const revision = z.number().int().positive();
export const itemWrite = z
  .object({
    revision,
    kind: z.enum(['site', 'photo', 'reading', 'log', 'step', 'paper', 'note', 'camera']),
    id,
    hidden: z.boolean().optional(),
    payload: z.unknown(),
  })
  .strict();
