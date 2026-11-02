/** Strict boundary for external proposals; the editor uses the same physical validator. */
import { z } from 'zod';
import { normaliseShade, SHADE_MAX_ANCHORS, SHADE_MIN_ANCHORS, SHADE_SAIL_LIMIT } from './shade.js';

const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const key = z.string().trim().min(1).max(128);
export const ShadeAnchorSchema = z
  .object({
    id: key,
    x: finite(-10000, 10000),
    y: finite(-10000, 10000),
    heightM: finite(0.5, 12),
    support: z.enum(['post', 'wall']),
  })
  .strict();
export const ShadeSailSchema = z
  .object({
    id: key,
    name: key,
    fabric: z.enum(['hdpe-knit', 'pvc-coated']),
    anchors: z.array(ShadeAnchorSchema).min(SHADE_MIN_ANCHORS).max(SHADE_MAX_ANCHORS),
    cornerGapM: finite(0.05, 1),
    edgeCurvePct: finite(0, 15),
    colour: z.string().regex(/^#[0-9a-f]{6}$/i),
    made: z.object({ edgesM: z.array(finite(0.3, 60)).min(SHADE_MIN_ANCHORS).max(SHADE_MAX_ANCHORS) }).strict().optional(),
  })
  .strict();
export const ShadeSchema = z
  .object({ version: z.literal(1), enabled: z.boolean(), sails: z.array(ShadeSailSchema).max(SHADE_SAIL_LIMIT) })
  .strict()
  .superRefine((value, context) => {
    if (!normaliseShade(value)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Shade sails must keep unique ids, a simple outline of 3 to 6 fixing points and one made edge length per edge.' });
  });
export const SHADE_SCHEMA_DESCRIPTION =
  'shade: { version: 1, enabled, sails: [{ id, name, fabric: hdpe-knit | pvc-coated, anchors: 3 to 6 of { id, x, y (plan metres), heightM (0.5 to 12), support: post | wall }, cornerGapM (0.05 to 1), edgeCurvePct (0 to 15), colour #rrggbb, made?: { edgesM: one finished chord per edge } }] }. Quantities come from the engine, never from the proposal.';
