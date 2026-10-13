/** Strict shared boundary for external City Build proposals. */
import { z } from 'zod';
import { CITY_LIMITS, normaliseCity } from './city.js';
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const key = z.string().trim().min(1).max(128);
const point = z.object({ x: finite(-10000, 10000), y: finite(-10000, 10000) }).strict();
const routePoints = point.array().min(2).max(CITY_LIMITS.pointsPerRoute);
export const CityRoadSchema = z
  .object({
    id: key,
    name: key,
    presetId: key,
    points: routePoints,
    widthM: finite(0.5, 100),
    surfaceDepthM: finite(0.001, 2),
    baseDepthM: finite(0, 5),
    supplierRef: key.optional(),
  })
  .strict();
export const CityNetworkSchema = z
  .object({
    id: key,
    name: key,
    system: z.enum(['water', 'sewer', 'stormwater', 'power', 'fibre']),
    points: z
      .object({ x: finite(-10000, 10000), y: finite(-10000, 10000), z: finite(-30, 100) })
      .strict()
      .array()
      .min(2)
      .max(CITY_LIMITS.pointsPerRoute),
    diameterMm: finite(1, 5000),
    trenchWidthM: finite(0.05, 20),
    trenchDepthM: finite(0.05, 30),
    supplierRef: key.optional(),
    stockLengthM: finite(0.1, 10000).optional(),
  })
  .strict();
export const CityAssetSchema = z
  .object({
    id: key,
    name: key,
    kind: z.enum([
      'solar-light',
      'pv-array',
      'battery',
      'water-tank',
      'transformer',
      'ev-charger',
      'park',
      'data-centre',
      'building',
    ]),
    x: finite(-10000, 10000),
    y: finite(-10000, 10000),
    widthM: finite(0.05, 1000),
    lengthM: finite(0.05, 1000),
    heightM: finite(0.01, 500),
    rotation: finite(-36000, 36000),
    supplierRef: key.optional(),
    buildingLink: z.literal('current').optional(),
    powerW: finite(0, 1e9).optional(),
    solarKWp: finite(0, 1e9).optional(),
    batteryKWh: finite(0, 1e9).optional(),
    tankCapacityL: finite(0, 1e9).optional(),
    hoursPerDay: finite(0, 24).optional(),
  })
  .strict();
export const CityDataCentreSchema = z
  .object({
    racks: finite(0, 100000).int(),
    kWPerRack: finite(0, 1000),
    utilisation: finite(0, 1),
    pue: finite(1, 5),
    annualHours: finite(0, 8784),
    pvKWp: finite(0, 1e9),
    yieldKWhPerKWp: finite(0, 8760),
    batteryKWh: finite(0, 1e9),
    batteryUsableFraction: finite(0, 1),
    wueLPerKWh: finite(0, 100).optional(),
  })
  .strict();
export const CitySchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    site: z
      .object({ originM: point, widthM: finite(1, 10000), lengthM: finite(1, 10000) })
      .strict(),
    roads: CityRoadSchema.array().max(CITY_LIMITS.roads),
    networks: CityNetworkSchema.array().max(CITY_LIMITS.networks),
    assets: CityAssetSchema.array().max(CITY_LIMITS.assets),
    dataCentre: CityDataCentreSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!normaliseCity(value))
      ctx.addIssue({
        code: 'custom',
        message:
          'City IDs must be unique; route segments must have non-zero length and fit the aggregate segment limits; diameter must fit trench dimensions; only one building can link the house; site extents must fit coordinate limits.',
      });
  });
export const CITY_SCHEMA_DESCRIPTION = {
  version: 1,
  units:
    'Metres, except diameterMm. x right, y down; z is elevation above ground datum. Asset x/y are centres. Clockwise rotation in degrees.',
  limits: CITY_LIMITS,
  systems: ['water', 'sewer', 'stormwater', 'power', 'fibre'],
  geometry:
    'Roads and trenches use unions of butt-ended segment strips. Network length includes individual segment elevations; a crossing never creates a utility connection.',
  quantities:
    'Road crossings with identical layer/specification inputs count once. Differing overlapping road profiles withhold layer totals. Trench volume unions below-ground vertical prisms, including differing depths. No road/trench excavation sum is claimed because those works can overlap.',
  dataCentre:
    'Average IT kW = racks × kWPerRack × utilisation. Facility kW = IT kW × PUE. Annual energy uses annualHours; WUE, when supplied, multiplies IT energy. PV generation and storage remain separate scenario inputs, never inferred from asset footprint or supplier marketing.',
  limitations:
    'Measured planning and scenario estimation only. No structural or pavement design, hydraulic/electrical capacity, road approval, utility consent, fire design, uptime certification, verified carbon saving, supplier stock, confirmed price, invoicing or orders.',
};
