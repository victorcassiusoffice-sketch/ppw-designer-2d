import type { Property } from '../store/propertyStore';
import { emptyEco } from '../designer/eco';
import { defaults } from '../eco/water';
import type { Site } from './contract';
export function ensurePlan(s: Site, plan: string) {
  const key = 'ppw-pilot-plan-' + plan;
  if (localStorage.getItem(key)) return;
  const example = plan === 'example-wall',
    room = 'pilot-room',
    property: Property = {
      id: plan,
      name: s.name,
      activeRoomId: room,
      wallHeightM: 4,
      rooms: [
        {
          id: room,
          name: example ? 'Demonstration wall' : 'New room',
          polygon: example
            ? [
                { x: 0, y: 0 },
                { x: 25, y: 0 },
                { x: 25, y: 3 },
                { x: 0, y: 3 },
              ]
            : [],
          placedItems: [],
          ...(example ? { removedWallEdges: [1, 2, 3] } : {}),
        },
      ],
      ...(example ? { eco: { ...emptyEco(), waterStudy: { ...defaults, mossRoom: room } } } : {}),
    };
  localStorage.setItem(
    key,
    JSON.stringify({ state: { property, showGrid: true, pxPerMetre: 50 }, version: 2 }),
  );
}
export function planLink(plan: string, view: 'house' | 'walk' | 'draw') {
  const qs = new URLSearchParams({ pilotPlan: plan, view: view === 'draw' ? '2d' : '3d' });
  if (view === 'walk') qs.set('pilotWalk', '1');
  return '/designer?' + qs;
}
