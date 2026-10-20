/** Presentation-only configuration. Never contains credentials, recipients or project data. */
export const ECO_CHAPTERS = [
  'The whole build',
  'Tools in context',
  'One project',
  'Logistics',
  'Eco + AI',
  'Real products',
  'Your pilot',
] as const;
export const ECO_SCENARIOS = [
  'Eco neighbourhood',
  'Apartment development',
  'Mixed-use district',
] as const;
export const ECO_AUDIENCES = [
  'Developer',
  'Construction team',
  'Public / infrastructure team',
  'Merchant / supplier',
] as const;
export type EcoScenario = (typeof ECO_SCENARIOS)[number];
export const ECO_THEMES = ['sage', 'ocean', 'graphite'] as const;
export interface EcoPitchConfig {
  company: string;
  project: string;
  scenario: EcoScenario;
  audience: (typeof ECO_AUDIENCES)[number];
  theme: (typeof ECO_THEMES)[number];
}
export const DEFAULT_ECO_CONFIG: EcoPitchConfig = {
  company: 'Your team',
  project: 'A better place to build',
  scenario: 'Eco neighbourhood',
  audience: 'Developer',
  theme: 'sage',
};
const label = (value: string | null, fallback: string) =>
  value
    ?.split('')
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 80) || fallback;
export function readEcoConfig(search: string): EcoPitchConfig {
  const query = new URLSearchParams(search);
  return {
    company: label(query.get('company'), DEFAULT_ECO_CONFIG.company),
    project: label(query.get('project'), DEFAULT_ECO_CONFIG.project),
    scenario:
      ECO_SCENARIOS.find((value) => value === query.get('scenario')) ?? DEFAULT_ECO_CONFIG.scenario,
    audience:
      ECO_AUDIENCES.find((value) => value === query.get('audience')) ?? DEFAULT_ECO_CONFIG.audience,
    theme: ECO_THEMES.find((value) => value === query.get('theme')) ?? DEFAULT_ECO_CONFIG.theme,
  };
}
/** Only allowlisted, non-sensitive presentation fields; unknown query values are not forwarded. */
export function ecoSharePath(config: EcoPitchConfig): string {
  const clean = readEcoConfig(new URLSearchParams({ ...config }).toString());
  return `/pitch/eco-city?${new URLSearchParams({ ...clean }).toString()}`;
}

export const ECO_TOOLS = [
  {
    id: 'build',
    name: 'Building & geometry',
    glyph: '⌂',
    shot: 'house-3d',
    title: 'From a room to a whole building.',
    detail:
      'Draw connected rooms, straight or curved walls, doors and custom openings. Coordinate floors, stairs, roof outlines, overhangs and glass thickness in one measured 2D / 3D model.',
    takeoff: 'Length, area, wall volume and product envelopes stay attached to the same geometry.',
    limit:
      'Curves use measured segments. Roof studies and screening do not replace structural design.',
    tags: ['Plan import', 'Shared walls', 'Floors + roofs', 'Materials'],
  },
  {
    id: 'materials',
    name: 'Foundations & quantities',
    glyph: '▱',
    shot: 'materials',
    title: 'Make the assumptions inspectable.',
    detail:
      'Set excavation depth, concrete fill, wall build-up, paint coats, pack sizes and waste. Review slabs, strips, pads and entered rebar schedules. Compare ready-mix with site-mix as alternatives.',
    takeoff:
      'Separate excavation m³, concrete m³, masonry, paint litres and whole packs; overlap-aware quantities.',
    limit:
      'Not a foundation design or a structural approval. Ground conditions and reinforcement need an engineer.',
    tags: ['Depth + volume', 'Editable ratios', 'Coats + packs', 'Rebar schedule'],
  },
  {
    id: 'services',
    name: 'Services & safety',
    glyph: '⌁',
    shot: 'services',
    title: 'Let each trade see its own work.',
    detail:
      'Coordinate plumbing routes, risers, electrical routes, HVAC, fire-protection and camera planning in 2D and 3D. Show only selected disciplines, with the walls or fixtures needed for context.',
    takeoff:
      'Route lengths and elevations, stock references, fixture endpoints and visible unresolved connections.',
    limit:
      'Hydraulics, cable ratings, fire safety and installation compliance require qualified design; a route is not an approval.',
    tags: ['Pipes + risers', 'HVAC', 'Fire planning', 'Visibility layers'],
  },
  {
    id: 'city',
    name: 'City & infrastructure',
    glyph: '▦',
    shot: 'city',
    title: 'Connect the buildings to their district.',
    detail:
      'Lay out roads, water, sewer, stormwater, power and fibre. Place solar streetlights, PV, batteries, tanks, EV charging, parks and a data-centre planning envelope.',
    takeoff:
      'Road surface / base volume, trench quantities and network length; data-centre energy scenarios from explicit inputs.',
    limit:
      'Planning and quantity coordination, not a certified utility network, energy guarantee or engineered data centre.',
    tags: ['Roads + trenches', 'Water / power / fibre', 'Solar + storage', 'Data-centre study'],
  },
  {
    id: 'landscape',
    name: 'Landscape & interiors',
    glyph: '♧',
    shot: 'house-2d',
    title: 'The site and the rooms belong together.',
    detail:
      'Coordinate trees, garden surfaces, paving thickness, swimming-pool excavation, furniture, lighting, paints and floor finishes. Keep sourced products at the same envelope size in both views.',
    takeoff:
      'Polygon area, surface / sub-base volume, pool water and shell quantities; product dimensions and finish coverage.',
    limit:
      'Tree / structural screening flags review questions. Pool planning geometry is not an exact supplier mould.',
    tags: ['Trees + gardens', 'Outdoor flooring', 'Pools', 'Furniture + light'],
  },
] as const;

export const ECO_ROLES = [
  {
    id: 'owner',
    title: 'Developer',
    reads: 'Scope, unresolved decisions and release readiness',
    writes: 'Owners, milestones and approval decisions',
    action: 'Hold the affected package until the revised specification is reviewed.',
  },
  {
    id: 'architect',
    title: 'Architect',
    reads: 'Measured geometry and the client’s current choices',
    writes: 'Design intent, dimensions and material proposals',
    action: 'Compare the revised wall and check openings, thickness and adjoining rooms.',
  },
  {
    id: 'engineer',
    title: 'Engineer',
    reads: 'Technical changes, assumptions and missing evidence',
    writes: 'Review comments and evidence requirements',
    action: 'Review loads, moisture conditions, connections and technical suitability.',
  },
  {
    id: 'supplier',
    title: 'Supplier',
    reads: 'Assigned specifications, quantities and target dates',
    writes: 'Product evidence, availability and proposed delivery',
    action: 'Confirm the product declaration and quote for the current revision.',
  },
  {
    id: 'contractor',
    title: 'Contractor',
    reads: 'Approved scope, dependencies and site requirements',
    writes: 'Readiness, installation comments and date proposals',
    action: 'Check access, sequence, interfaces and material receipt before installation.',
  },
  {
    id: 'client',
    title: 'Client',
    reads: 'Design choices, impacts and decisions awaiting review',
    writes: 'Comments and acknowledgement of current choices',
    action: 'Review the changed appearance and acknowledge the current decision.',
  },
] as const;

export const ECO_LOGISTICS = [
  {
    title: 'Design',
    owner: 'Architect + client',
    input: 'Agreed brief and measured geometry',
    output: 'Revisioned geometry and component choices',
    gate: 'Scale and scope reviewed',
  },
  {
    title: 'Quantities',
    owner: 'Designer + quantity surveyor',
    input: 'Current geometry and editable assumptions',
    output: 'Material takeoff with units and source references',
    gate: 'Assumptions, duplicates and unknowns checked',
  },
  {
    title: 'Review',
    owner: 'Engineer + project owner',
    input: 'Changed components and supporting evidence',
    output: 'Current decisions and unresolved issues',
    gate: 'Required reviews and acknowledgements current',
  },
  {
    title: 'Supplier',
    owner: 'Assigned merchant',
    input: 'Reviewed specification and quantities',
    output: 'Confirmed product, availability and quotation',
    gate: 'Supplier acceptance and purchasing authorization',
  },
  {
    title: 'Schedule',
    owner: 'Procurement + site lead',
    input: 'Confirmed lead time and site readiness',
    output: 'Order, invoice and delivery dates; chosen recipient emails',
    gate: 'Dependencies and dates validated; dispatch requires integration',
  },
  {
    title: 'Site',
    owner: 'Contractor + trades',
    input: 'Confirmed deliveries and approved installation information',
    output: 'Receipt, installation review and issue resolution',
    gate: 'Materials received and site ready',
  },
  {
    title: 'Handover',
    owner: 'Client + project owner',
    input: 'Reviewed work and resolved changes',
    output: 'Agreed specification history and handover information',
    gate: 'Inspection and client acceptance',
  },
] as const;
