import { makeSite, toLonLat } from './geometry';
import type { GeoSite, LonLat } from './types';
/** Geographic anchors are real; these outlines and levels are fictional practice inputs. */
export const sampleLocations: { name: string; origin: LonLat }[] = [
  { name: 'Tamarin, Mauritius', origin: [57.3776792, -20.3292161] },
  { name: 'Curepipe, Mauritius', origin: [57.5231, -20.3162] },
  { name: 'York, United Kingdom', origin: [-1.0827, 53.9654] },
];
export function sampleSite(index = 0): GeoSite {
  const location = sampleLocations[index],
    local = [
      { x: 0, y: 0 },
      { x: 25, y: 0 },
      { x: 25, y: 20 },
      { x: 0, y: 20 },
    ];
  const site = makeSite(
    local.map((p) => toLonLat(p, location.origin)),
    `${location.name} · practice plot`,
    { x: -5, y: -5 },
  );
  return {
    ...site,
    sample: true,
    terrain: {
      source: 'typed what-if',
      verticalReference: 'Fictional local datum 100 m; not a surveyed or sea-level elevation',
      platformM: 101,
      points: site.polygon.map((p, i) => ({ ...p, z: [100, 102, 102, 100][i] })),
    },
    publicData: {
      fetchedAt: '2026-10-27T00:00:00.000Z',
      errors: [
        'Offline practice sample. Solar, public terrain and mapped neighbours have not been fetched.',
      ],
    },
  };
}
