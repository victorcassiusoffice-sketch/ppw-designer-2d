/** Strict boundary for external proposals; the editor uses the same physical validator. */
import { z } from 'zod';
import {
  defaultFoundationRebar,
  normaliseFoundation,
  FOUNDATION_ELEMENT_LIMIT,
} from './foundation.js';

const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const key = z.string().trim().min(1).max(128);
export const FoundationRebarSchema = z
  .object({
    enabled: z.boolean(),
    diameterMm: finite(4, 50),
    spacingMm: finite(10, 2000),
    layers: finite(1, 10).int(),
    coverMm: finite(0, 300),
    stockLengthM: finite(0.5, 30),
    lapLengthM: finite(0, 10),
    wastePct: finite(0, 100),
  })
  .strict();
export const FoundationSchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    concreteProductId: z.enum(['premix-classics', 'premix-pro']).optional(),
    elements: z
      .array(
        z
          .object({
            id: key,
            name: key,
            kind: z.enum(['slab', 'strip', 'pad']),
            x: finite(-10000, 10000),
            y: finite(-10000, 10000),
            lengthM: finite(0.1, 1000),
            widthM: finite(0.1, 1000),
            depthM: finite(0.01, 10),
            topElevationM: finite(-30, 10),
            rebar: FoundationRebarSchema,
            excavation: z
              .object({
                depthM: finite(0.01, 30),
                topElevationM: finite(-30, 10),
                marginM: finite(0, 20),
                stage: z.enum(['excavated', 'filled']),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(FOUNDATION_ELEMENT_LIMIT),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!normaliseFoundation(value))
      ctx.addIssue({
        code: 'custom',
        message:
          'Foundation IDs must be unique; laps must be shorter than stock; enabled steel and cover must fit; concrete must be contained within its excavation depth.',
      });
  });

export const FOUNDATION_SCHEMA_DESCRIPTION = {
  version: 1,
  units:
    'Plan centres, lengths, widths, depths and elevations in metres; bar diameter, spacing and cover in millimetres.',
  coordinateSystem:
    'x right, y down; x/y are each rectangle centre. topElevationM is relative to ground finished-floor datum; bottom = topElevationM − depthM.',
  kinds: ['slab', 'strip', 'pad'],
  excavation: {
    optional: true,
    depthM: [0.01, 30],
    topElevationM: [-30, 10],
    marginM: [0, 20],
    stage: ['excavated', 'filled'],
    meaning:
      'Design stages, not on-site completion. Hole footprint expands concrete rectangle by marginM on each side. Concrete must fit between excavation bottom and top.',
  },
  concreteProductId: {
    optional: true,
    values: ['premix-classics', 'premix-pro'],
    meaning:
      'Supplier product-family reference only, not an approved mix, price or stock confirmation.',
  },
  limits: {
    elements: FOUNDATION_ELEMENT_LIMIT,
    coordinatesM: [-10000, 10000],
    lengthWidthM: [0.1, 1000],
    depthM: [0.01, 10],
    topElevationM: [-30, 10],
    bodyBytes: 131072,
  },
  rules: [
    'Complete version, enabled, elements and all element/rebar fields are required. Unknown fields and any invalid entity reject the complete estimate.',
    'Rectangles are axis-aligned. Intersecting concrete boxes count once in three dimensions.',
    'Legacy elements without excavation remain filled. Excavated-only elements are planned concrete, excluded from filled concrete and steel quantities until their stage is filled. Excavation unions and remaining void are reported separately.',
    'Enabled drawn foundations replace the legacy base in the materials estimate, including an empty foundation. Do not add both totals.',
    'Rebar remains disabled until a project schedule is supplied. Overlapping reinforced elements withhold steel totals rather than double-counting.',
    'Site-mix parts are dry loose volume ratios, never a certified strength grade. Ready-mix does not also count site-mix ingredients.',
  ],
  example: {
    version: 1,
    enabled: true,
    elements: [
      {
        id: 'slab-1',
        name: 'Measured slab',
        kind: 'slab',
        x: 5,
        y: 4,
        lengthM: 10,
        widthM: 8,
        depthM: 0.2,
        topElevationM: 0,
        rebar: defaultFoundationRebar(),
      },
    ],
  },
  limitations:
    'Measured takeoff only. No soil bearing, loading, structural sizing, certified mix, bar bending schedule, excavation safety, formwork, drainage or installation approval. Vertical-sided hole volume excludes batter/support, bulking and disposal. Engineer-approved dimensions and reinforcement are required. No saved-design mutation or ordering.',
};
