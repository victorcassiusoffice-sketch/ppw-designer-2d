import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as format from '../designFormat';
import { COST_LINE_KINDS, MEMBER_ROLES } from '../formatV2';
import { BULGE_MAX, WALL_ARC_LIMIT } from '../arcSegment';

// The format's page for both fronts. A test run starts at the root of the repository.
const page = readFileSync('docs/DESIGN-FORMAT.md', 'utf8');

/** True when the page writes the name as a key: inside backticks, as a whole word. */
const names = (name: string) =>
  new RegExp('`[^`\\n]*(?<![A-Za-z0-9_])' + name + '(?![A-Za-z0-9_])[^`\\n]*`').test(page);

const TABLES: Record<string, Iterable<string>> = {
  DESIGN_KEYS: format.DESIGN_KEYS,
  ROOM_KEYS: format.ROOM_KEYS,
  LEVEL_KEYS: format.LEVEL_KEYS,
  FREE_WALL_KEYS: format.FREE_WALL_KEYS,
  SITE_KEYS: format.SITE_KEYS,
  STAIR_KEYS: format.STAIR_KEYS,
  ROOF_KEYS: format.ROOF_KEYS,
  GARDEN_KEYS: format.GARDEN_KEYS,
  GARDEN_SURFACE_KEYS: format.GARDEN_SURFACE_KEYS,
  GARDEN_POOL_KEYS: format.GARDEN_POOL_KEYS,
  GARDEN_FENCE_KEYS: format.GARDEN_FENCE_KEYS,
  WALL_PAINT_KEYS: format.WALL_PAINT_KEYS,
  WALL_CLADDING_KEYS: format.WALL_CLADDING_KEYS,
  WALL_CONSTRUCTION_KEYS: format.WALL_CONSTRUCTION_KEYS,
  FLOOR_ZONE_KEYS: format.FLOOR_ZONE_KEYS,
  FLOOR_FINISH_KEYS: format.FLOOR_FINISH_KEYS,
  MATERIALS_KEYS: format.MATERIALS_KEYS,
  SECTION_NAMES: format.SECTION_NAMES,
  CARRIED_ASIDE_NAMES: format.CARRIED_ASIDE_NAMES,
};

describe('the page of the design format is held to the table of names in the code', () => {
  it('every table of names of the code is checked here', () => {
    // A table added to `designFormat.ts` must be added to this test, and so to the page.
    const inCode = Object.entries(format)
      .filter(([, value]) => value instanceof Set || Array.isArray(value))
      .map(([name]) => name)
      .filter((name) => name !== 'NO_KEYS')
      .sort();
    expect(Object.keys(TABLES).sort()).toEqual(inCode);
  });

  it('every name of every table stands on the page', () => {
    const missing: string[] = [];
    for (const [table, keys] of Object.entries(TABLES))
      for (const key of keys) if (!names(key)) missing.push(`${table}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('the page says the version this build reads', () => {
    expect(page).toContain(`\`DESIGN_FORMAT_VERSION\` is ${format.DESIGN_FORMAT_VERSION}`);
  });

  it('the page names every role and every kind of cost line, and the limits of a curved wall', () => {
    for (const role of MEMBER_ROLES) expect(page, role).toContain(`"${role}"`);
    for (const kind of COST_LINE_KINDS) expect(page, kind).toContain(`"${kind}"`);
    expect(page).toContain(`The largest kept is ${BULGE_MAX}`);
    expect(page).toContain(`At most ${WALL_ARC_LIMIT} entries`);
  });

  it('the page keeps the rules of the format, by number', () => {
    for (let rule = 1; rule <= 8; rule++)
      expect(page).toMatch(new RegExp(`^${rule}\\. \\*\\*`, 'm'));
  });
});
