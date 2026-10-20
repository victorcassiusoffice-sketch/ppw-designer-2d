import { z } from 'zod';
import { serviceRunLengthM } from './buildingServices.js';

export const ServiceSystemSchema = z.enum([
  'cold-water',
  'hot-water',
  'waste',
  'electrical',
  'ventilation',
  'refrigerant',
  'fire-water',
  'data',
]);
const key = z.string().min(1).max(128),
  position = z.number().finite().min(-10000).max(10000);
const elevation = z.number().finite().min(-20).max(20),
  dimension = z.number().finite().min(0.005).max(5);
const connection = z.object({ fixtureId: key, portId: ServiceSystemSchema }).strict();
export const BuildingServicesSchema = z
  .object({
    version: z.literal(1),
    runs: z
      .array(
        z
          .object({
            id: key,
            levelId: key,
            system: ServiceSystemSchema,
            materialId: key,
            diameterMm: z.number().finite().min(5).max(1000),
            points: z
              .array(
                z
                  .object({
                    x: position,
                    y: position,
                    elevationM: elevation.optional(),
                    junctionId: key.optional(),
                  })
                  .strict(),
              )
              .min(2)
              .max(500),
            startElevationM: elevation,
            endElevationM: elevation,
            startConnection: connection.optional(),
            endConnection: connection.optional(),
          })
          .strict(),
      )
      .max(2000),
    fixtures: z
      .array(
        z
          .object({
            id: key,
            levelId: key,
            kind: z.enum([
              'toilet',
              'sink',
              'mains-tap',
              'electrical-board',
              'sewer-connection',
              'air-conditioner',
              'outdoor-ac',
              'air-grille',
              'extractor-fan',
              'sprinkler',
              'fire-extinguisher',
              'security-camera',
              'network-switch',
            ]),
            x: position,
            y: position,
            widthM: dimension,
            depthM: dimension,
            heightM: dimension,
            rotation: z.number().finite().min(-36000).max(36000),
            elevationM: elevation.optional(),
            productReferenceId: key.optional(),
            portElevationsM: z
              .object(
                Object.fromEntries(
                  ServiceSystemSchema.options.map((s) => [s, elevation.optional()]),
                ),
              )
              .strict()
              .optional(),
            connectionLabel: key.optional(),
          })
          .strict(),
      )
      .max(2000),
    junctions: z
      .array(
        z
          .object({
            id: key,
            levelId: key,
            system: ServiceSystemSchema,
            x: position,
            y: position,
            elevationM: elevation,
          })
          .strict(),
      )
      .max(2000)
      .optional(),
  })
  .strict()
  .superRefine((services, ctx) => {
    const seen = new Set<string>();
    for (const group of ['runs', 'fixtures', 'junctions'] as const) {
      (services[group] ?? []).forEach((entity, index) => {
        if (seen.has(entity.id))
          ctx.addIssue({
            code: 'custom',
            path: [group, index, 'id'],
            message: 'IDs must be unique across runs, fixtures and junctions.',
          });
        seen.add(entity.id);
      });
    }
    services.runs.forEach((run, index) => {
      if (serviceRunLengthM(run) < 0.01)
        ctx.addIssue({
          code: 'custom',
          path: ['runs', index, 'points'],
          message: 'A route must measure at least 0.01 m including its elevation change.',
        });
      for (const endpoint of ['start', 'end'] as const) {
        if (
          run[`${endpoint}Connection`] &&
          run.points[endpoint === 'start' ? 0 : run.points.length - 1].junctionId
        )
          ctx.addIssue({
            code: 'custom',
            path: ['runs', index, `${endpoint}Connection`],
            message: 'An endpoint may attach to a fixture or a junction, not both.',
          });
      }
    });
  });
