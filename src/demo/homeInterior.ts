import type { Property, Room } from '../store/propertyStore';
import { SOFAP_A_LA_CARTE } from '../data/sofapColours';
import { buildCourtsShowHome } from './courts';

/** Apply catalog selections to the fresh generic demo, never to a saved plan. */
function roomPaint(room: Room, paintId: string, accent?: { edge: number; colourId: string }): Room['wallPaint'] {
  return room.polygon.map((_, edgeIndex) => {
    const colourId = accent?.edge === edgeIndex ? accent.colourId : 'sofap-alc-morning-haze';
    const colour = SOFAP_A_LA_CARTE.find(candidate => candidate.id === colourId);
    if (!colour) throw new Error(`Home demo: missing sourced Sofap colour ${colourId}`);
    return { edgeIndex, paintId, colourHex: colour.hex, colourName: colour.name };
  });
}

/**
 * A coordinated edition of the existing measured show home. Products retain
 * their actual catalog IDs, footprints, prices and surface-parent links, so
 * the usual cart, paint quantities and lighting calculations apply.
 *
 * Residential timber/tile flooring is deliberately not simulated here: the
 * current purchasable floor catalog only contains K1 rubber/EVA products.
 * Bare residential floors stay bare until a sourced finish is selected.
 */
export function buildHomeInterior(): Property {
  const home = buildCourtsShowHome();
  for (const room of home.rooms) {
    const accent = room.id === 'living' ? { edge: 0, colourId: 'sofap-alc-soft-moss' }
      : room.id === 'bedroom' ? { edge: 1, colourId: 'sofap-alc-soft-moss' }
        : room.id === 'office' || room.id === 'dining' ? { edge: 1, colourId: 'sofap-alc-elmwood' }
          : undefined;
    const paintId = room.id === 'living' || room.id === 'dining' ? 'permoglaze-soft-feel' : 'permoglaze-matt-emulsion';
    room.wallPaint = roomPaint(room, paintId, accent);
  }
  const bedroom = home.rooms.find(room => room.id === 'bedroom');
  if (bedroom) {
    // A second bedside balances the existing head-of-bed table. The lamp fits
    // entirely on its 41.5 × 35 cm surface; the 114 × 180 cm rug stays clear
    // of the doorway, bed footprint and wardrobe without scaling its SKU.
    bedroom.placedItems.push(
      { instanceId: 'home-arte-bedside-second', productId: 'courts-arte-bedside', x: 11.05, y: 7.72, rotation: 0 },
      { instanceId: 'home-bedside-lamp-second', productId: 'courts-table-lamp-wood-d25', x: 11.13, y: 7.77, rotation: 0, parentInstanceId: 'home-arte-bedside-second' },
      { instanceId: 'home-bedroom-elit-rug', productId: 'courts-elit-rug', x: 8.62, y: 5.62, rotation: 90 },
    );
  }
  return { ...home, id: 'generic-demo-home', name: 'Demo' };
}
