import { exampleSlug, pilotSchema, type Pilot, type Site } from './contract';
export const stepTitles = [
  'Set up the sites',
  'Sort, weigh and recycle',
  'Test the render',
  'Observe the wall',
  'Measure the test panels',
  'Share the findings',
];
export function blankPilot(slug: string, name: string, lane: string): Pilot {
  return {
    slug,
    name,
    lane,
    state: 'concept',
    summary: '',
    sites: [],
    members: [
      {
        id: 'lead',
        name: 'The lead',
        organisation: 'Example Lead Ltd',
        role: 'lead',
        state: 'active',
      },
    ],
    readings: [],
    logs: [],
    steps: stepTitles.map((title, i) => ({
      id: 'step-' + i,
      title,
      date: new Date().toISOString().slice(0, 10),
      state: 'todo',
    })),
    photos: [],
    cameras: [],
    notes: [],
    papers: [],
  };
}
export function samplePilot(): Pilot {
  const places: Array<[string, string, Site['kind'], string, number, number]> = [
    ['rack', 'Harbour test rack', 'test rack', 'Port Louis', -20.16, 57.5],
    ['panel', 'Inland panel', 'test panel', 'Réduit', -20.23, 57.49],
    ['coast', 'Coastal panel', 'test panel', 'Blue Bay', -20.44, 57.71],
    ['island', 'Island host', 'host building', 'Port Mathurin', -19.68, 63.42],
    [
      'wall',
      'Plateau demonstration wall',
      'demonstration wall',
      'Central plateau, building to be chosen',
      -20.31,
      57.52,
    ],
  ];
  const dates = [
    '2026-01-10',
    '2026-02-12',
    '2026-03-14',
    '2026-05-10',
    '2026-06-10',
    '2027-02-10',
  ];
  const p = blankPilot(exampleSlug, 'Example pilot: moss render wall', 'Living walls');
  return pilotSchema.parse({
    ...p,
    state: 'filed',
    summary:
      'Follow a demonstration wall and test panels from their first survey to their monthly observations.',
    sites: places.map(([id, name, kind, place, lat, lon]) => ({
      id,
      name,
      kind,
      place,
      lat,
      lon,
      state: id === 'wall' ? 'measuring' : 'filed',
      ...(id === 'wall' ? { area: 100, plan: 'example-wall' } : {}),
    })),
    members: [
      ...p.members,
      {
        id: 'supplier',
        name: 'The supplier',
        organisation: 'Example Institute',
        role: 'technology supplier',
        state: 'active',
      },
      {
        id: 'tester',
        name: 'The specialist',
        organisation: 'Example Lab',
        role: 'tester',
        state: 'active',
      },
    ],
    steps: p.steps.map((s, i) => ({
      ...s,
      date: dates[i],
      state: i < 3 ? 'done' : i < 5 ? 'doing' : 'todo',
    })),
    photos: ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-10-02'].map(
      (date, i) => ({
        id: 'sample-photo-' + i,
        date,
        site: i === 0 ? 'rack' : 'wall',
        member: 'tester',
        kind: i === 4 ? '360 panorama' : 'photo',
        caption: i === 4 ? 'Example panorama' : 'Example wall study',
        hidden: false,
      }),
    ),
    readings: [12, 26, 41].map((cover, i) => ({
      id: 'reading-' + i,
      site: 'wall',
      month: '2026-' + ['08', '09', '10'][i],
      cover,
      condition: 'Intact',
      damage: 'none',
      note: 'Example observation',
      photo: 'sample-photo-' + (i + 1),
    })),
    logs: ['Masonry', 'Wood', 'Metal', 'Masonry'].map((type, i) => ({
      id: 'log-' + i,
      date: dates[i],
      type,
      quantity: [1.2, 0.3, 0.4, 2.1][i],
      unit: 't',
      destination: i === 1 ? 'Sorting yard' : 'Recovery yard',
    })),
    papers: [
      'Site agreement',
      'Reading protocol',
      'Materials register',
      'Field report',
      'Closing record',
    ].map((title, i) => ({
      id: 'paper-' + i,
      title,
      state: ['signed', 'filed', 'to sign', 'needed', 'needed'][i],
      note: '',
    })),
    notes: [
      'Baseline outline measured.',
      'Test racks ready for observation.',
      'Next reading scheduled.',
    ].map((text, i) => ({ id: 'note-' + i, text, date: dates[i], member: 'lead' })),
  });
}
