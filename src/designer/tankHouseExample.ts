import type { PlacedItem, Property, Room } from '../store/propertyStore';
import { SOFAP_A_LA_CARTE } from '../data/sofapColours';
import { createTankRun } from './tankNetwork';
import { roofRoomIdFor, syncRoofRooms } from './roof';
import type { Opening } from './openings';

export const TANK_HOUSE_EXAMPLE_ID = 'water-tank-house';

function item(
  instanceId: string,
  productId: string,
  x: number,
  y: number,
  rotation = 0,
): PlacedItem {
  return { instanceId, productId, x, y, rotation };
}

function opening(
  id: string,
  kind: Opening['kind'],
  edgeIndex: number,
  offsetM: number,
  widthM: number,
): Opening {
  return {
    id,
    kind,
    edgeIndex,
    offsetM,
    widthM,
    flipFacing: false,
    flipHand: false,
    ...(kind === 'window' ? { sillM: 0.9, heightM: 1.2 } : { heightM: 2.1 }),
  };
}

function room(
  id: string,
  name: string,
  levelId: string,
  x: number,
  y: number,
  width: number,
  depth: number,
  openings: Opening[],
  placedItems: PlacedItem[],
  accent = false,
): Room {
  const paint = SOFAP_A_LA_CARTE.find((c) => c.id === 'sofap-alc-morning-haze')!;
  const moss = SOFAP_A_LA_CARTE.find((c) => c.id === 'sofap-alc-soft-moss')!;
  return {
    id,
    name,
    levelId,
    polygon: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + depth },
      { x, y: y + depth },
    ],
    openings,
    placedItems,
    wallPaint: [0, 1, 2, 3].map((edgeIndex) => ({
      edgeIndex,
      paintId: 'permoglaze-matt-emulsion',
      colourHex: accent && edgeIndex === 0 ? moss.hex : paint.hex,
      colourName: accent && edgeIndex === 0 ? moss.name : paint.name,
    })),
  };
}

/** Normal editable house geometry. All fittings and furniture retain their existing
 * catalogue envelopes; the roof slabs follow the rooms below through syncRoofRooms. */
export function tankHouseExample(): Property {
  const groundRooms: Room[] = [
    room(
      'ground-living',
      'Living room',
      'ground',
      0,
      0,
      4,
      5,
      [
        opening('living-front-window', 'window', 0, 2.0, 1.8),
        opening('living-side-window', 'window', 3, 2.5, 1.6),
        opening('living-hall-door', 'door', 1, 1.25, 0.9),
        opening('living-dining-opening', 'doorway', 2, 0.7, 1.0),
      ],
      [
        item('house-sofa', 'courts-comfy-3-seater-dove', 0.3, 0.35),
        item('house-coffee-table', 'courts-perera-coffee-table', 0.85, 2.0),
        item('house-tv-cabinet', 'courts-aurum-tv-cabinet', 0.3, 4.4),
        item('house-living-lamp', 'demo-floor-lamp', 3.1, 3.9),
      ],
      true,
    ),
    room(
      'ground-dining',
      'Kitchen and dining',
      'ground',
      0,
      5,
      4,
      3,
      [
        opening('dining-rear-window', 'window', 2, 2.0, 1.5),
        opening('dining-side-window', 'window', 3, 1.5, 1.2),
        opening('dining-hall-door', 'door', 1, 1.95, 0.9),
      ],
      [
        item('house-dining-set', 'courts-gessica-dining-6', 0.3, 5.85),
        item('house-fridge', 'courts-samsung-rb33-fridge', 3.15, 5.2),
        item('house-kitchen-basin', 'espace-durastyle-washbasin-800', 0.2, 5.12),
      ],
    ),
    room(
      'ground-hall',
      'Entrance and stairs',
      'ground',
      4,
      0,
      3,
      8,
      [
        opening('main-entrance', 'door', 0, 1.5, 1.15),
        opening('hall-rear-window', 'window', 2, 1.5, 1.4),
      ],
      [item('house-entry-sconce', 'demo-wall-sconce', 4.12, 0.6, 90)],
    ),
    room(
      'ground-bathroom',
      'Ground-floor bathroom',
      'ground',
      7,
      0,
      3,
      3,
      [
        opening('bath-ground-door', 'door', 3, 1.8, 0.85),
        opening('bath-ground-window', 'window', 0, 1.6, 0.9),
      ],
      [
        item('house-wc-ground', 'espace-emilia-toilet-bowl', 9.1, 0.25, 90),
        item('house-basin-ground', 'espace-durastyle-washbasin-800', 7.45, 0.12),
      ],
    ),
    room(
      'ground-utility',
      'Utility room',
      'ground',
      7,
      3,
      3,
      2,
      [
        opening('utility-door', 'door', 3, 1.2, 0.85),
        opening('utility-window', 'window', 1, 1, 1.2),
      ],
      [
        item('house-utility-basin', 'espace-durastyle-washbasin-800', 8.9, 3.12),
        item('house-utility-console', 'demo-console-table', 7.35, 4.35),
      ],
    ),
    {
      ...room(
        'ground-service-terrace',
        'Ground-floor tank terrace',
        'ground',
        7,
        5,
        3,
        3,
        [opening('terrace-ground-door', 'door', 3, 1.0, 0.95)],
        [item('house-tank-ground', 'resiglas-water-tank-500-c', 8.4075, 6.0575)],
      ),
      removedWallEdges: [1, 2],
    },
  ];
  const firstRooms: Room[] = [
    room(
      'first-bedroom-main',
      'Main bedroom',
      'first',
      0,
      0,
      4,
      4,
      [
        opening('main-bedroom-front-window', 'window', 0, 2.0, 1.8),
        opening('main-bedroom-side-window', 'window', 3, 2.0, 1.2),
        opening('main-bedroom-door', 'door', 1, 1.0, 0.9),
      ],
      [
        item('house-main-bed', 'courts-mika-bed-160', 0.5, 0.35),
        item('house-main-bedside', 'courts-arte-bedside', 2.3, 0.45),
        item('house-main-wardrobe', 'courts-beluga-wardrobe-4', 0.3, 3.25),
      ],
      true,
    ),
    room(
      'first-bedroom-second',
      'Second bedroom',
      'first',
      0,
      4,
      4,
      4,
      [
        opening('second-bedroom-rear-window', 'window', 2, 2.0, 1.5),
        opening('second-bedroom-side-window', 'window', 3, 2.0, 1.2),
        opening('second-bedroom-door', 'door', 1, 3.1, 0.9),
      ],
      [
        item('house-second-bed', 'courts-mika-bed-160', 0.5, 4.35),
        item('house-second-bedside', 'courts-arte-bedside', 2.3, 4.45),
        item('house-second-wardrobe', 'courts-beluga-wardrobe-4', 0.3, 7.25),
      ],
      true,
    ),
    room(
      'first-hall',
      'First-floor landing',
      'first',
      4,
      0,
      3,
      8,
      [
        opening('landing-front-window', 'window', 0, 1.5, 1.4),
        opening('landing-rear-window', 'window', 2, 1.5, 1.4),
      ],
      [],
    ),
    room(
      'first-bathroom',
      'First-floor bathroom',
      'first',
      7,
      0,
      3,
      3,
      [
        opening('bath-first-door', 'door', 3, 1.8, 0.85),
        opening('bath-first-window', 'window', 0, 1.6, 0.9),
      ],
      [
        item('house-wc-first', 'espace-emilia-toilet-bowl', 9.1, 0.25, 90),
        item('house-basin-first', 'espace-durastyle-washbasin-800', 7.45, 0.12),
      ],
    ),
    room(
      'first-study',
      'Study',
      'first',
      7,
      3,
      3,
      2,
      [opening('study-door', 'door', 3, 1.2, 0.85), opening('study-window', 'window', 1, 1, 1.2)],
      [
        item('house-study-desk', 'courts-touran-desk', 8.3, 3.15),
        item('house-study-chair', 'courts-stellar-celosia-chair', 8.55, 3.95),
      ],
    ),
    {
      ...room(
        'first-service-terrace',
        'First-floor tank terrace',
        'first',
        7,
        5,
        3,
        3,
        [opening('terrace-first-door', 'door', 3, 1.0, 0.95)],
        [item('house-tank-first', 'resiglas-water-tank-1000-c', 8.19, 5.84)],
      ),
      removedWallEdges: [1, 2],
    },
  ];
  const property = syncRoofRooms({
    id: TANK_HOUSE_EXAMPLE_ID,
    name: 'Two-storey home with connected water tanks',
    activeRoomId: 'ground-living',
    activeLevelId: 'ground',
    wallHeightM: 2.82,
    levels: [
      { id: 'ground', name: 'Ground floor', index: 0, heightM: 2.82 },
      { id: 'first', name: 'First floor', index: 1, heightM: 2.82 },
      { id: 'roof', name: 'Roof', index: 2, kind: 'roof' },
    ],
    rooms: [...groundRooms, ...firstRooms],
    stairs: [
      {
        id: 'house-ground-to-first',
        fromLevelId: 'ground',
        toLevelId: 'first',
        x: 4.75,
        y: 4.0,
        widthM: 1.05,
        runM: 4.6,
        rotation: 0,
      },
    ],
    roof: { style: 'flat', material: 'concrete', thicknessM: 0.12, overhangM: 0, pitchDeg: 5 },
    site: { widthM: 14, depthM: 12, originM: { x: -2, y: -2 } },
    garden: {
      surfaces: [
        {
          id: 'house-front-garden',
          kind: 'lawn',
          x: -1.5,
          y: -1.5,
          widthM: 12.8,
          depthM: 1.25,
          elevationM: 0,
        },
        {
          id: 'house-front-path',
          kind: 'path',
          x: 4.85,
          y: -1.5,
          widthM: 1.3,
          depthM: 1.5,
          elevationM: 0,
        },
        {
          id: 'house-east-path',
          kind: 'gravel',
          x: 10.15,
          y: 0.1,
          widthM: 1.0,
          depthM: 7.9,
          elevationM: 0,
        },
      ],
      fences: [],
    },
  });
  const roofDeck = property.rooms.find((r) => r.id === roofRoomIdFor('first-service-terrace'))!;
  roofDeck.placedItems.push(item('house-tank-roof', 'resiglas-water-tank-2000-c', 8.1675, 5.8175));
  property.services = {
    version: 1,
    fixtures: [],
    runs: [
      createTankRun(property, 'house-roof-to-first', {
        from: 'house-tank-roof',
        to: 'house-tank-first',
        riser: { x: 10.3, y: 6.5 },
      })!,
      createTankRun(property, 'house-first-to-ground', {
        from: 'house-tank-first',
        to: 'house-tank-ground',
        riser: { x: 10.3, y: 6.5 },
      })!,
    ],
  };
  return property;
}
