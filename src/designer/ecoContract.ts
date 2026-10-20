import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const reference = z.string().trim().min(1).max(500);
const number = (min: number, max: number) => z.number().finite().min(min).max(max);

/** Numeric bounds protect the editor, not a species recommendation or design limit. */
export const EcoTreeSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(160),
    x: number(-10000, 10000),
    y: number(-10000, 10000),
    heightM: number(0.1, 100),
    canopyRadiusM: number(0.1, 50),
    status: z.enum(['existing', 'proposed']),
    species: z.string().trim().min(1).max(160).optional(),
    stemDiameterMm: number(1, 5000).optional(),
    protectionMethod: z.enum(['unconfirmed', 'bs5837-single-stem', 'surveyed']),
    protectionRadiusM: number(0.1, 100).optional(),
    surveyRef: reference.optional(),
    veteran: z.boolean().optional(),
  })
  .strict();

/** Additional capacity is an engineer-entered incremental allowance, not total roof capacity. */
export const GreenRoofSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(160),
    roomId: id,
    areaM2: number(0.01, 1000000).optional(),
    saturatedKgM2: number(0.01, 10000).optional(),
    /** Water not already included in the supplied saturated assembly weight. */
    extraRetainedWaterMm: number(0, 1000).optional(),
    additionalLoadCapacityKPa: number(0, 1000).optional(),
    capacityRef: reference.optional(),
    specificationRef: reference.optional(),
  })
  .strict();

export const EcoSchema = z
  .object({
    version: z.literal(1),
    trees: z.array(EcoTreeSchema).max(300),
    greenRoofs: z.array(GreenRoofSchema).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    for (const [kind, items] of [
      ['trees', value.trees],
      ['greenRoofs', value.greenRoofs],
    ] as const) {
      items.forEach((item, i) => {
        if (ids.has(item.id))
          ctx.addIssue({
            code: 'custom',
            path: [kind, i, 'id'],
            message: 'Entity ids must be unique.',
          });
        ids.add(item.id);
      });
    }
    const roofs = new Set<string>();
    value.greenRoofs.forEach((roof, i) => {
      if (roofs.has(roof.roomId))
        ctx.addIssue({
          code: 'custom',
          path: ['greenRoofs', i, 'roomId'],
          message: 'Use one assembly per roof room to avoid counting its area twice.',
        });
      roofs.add(roof.roomId);
    });
  });

/** References identify project evidence; storing a reference never marks it verified. */
export const EngineeringInputsSchema = z
  .object({
    version: z.literal(1),
    geotechnicalReportRef: reference.optional(),
    structuralDesignRef: reference.optional(),
    concreteGrade: reference.optional(),
    reinforcementGrade: reference.optional(),
    utilityDesignRef: reference.optional(),
  })
  .strict();

export type EcoTree = z.infer<typeof EcoTreeSchema>;
export type GreenRoof = z.infer<typeof GreenRoofSchema>;
export type EcoModel = z.infer<typeof EcoSchema>;
export type EngineeringInputs = z.infer<typeof EngineeringInputsSchema>;
