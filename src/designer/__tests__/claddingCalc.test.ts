/**
 * Sample cladding quantity: wall area (openings deducted) → boards → packs
 * at the fictitious catalog price. Not a merchant feed.
 */
import { describe, expect, it } from 'vitest';
import { deriveCladdingOrders } from '../claddingCalc';
import { boardFaceM2, findCladdingProduct } from '../../data/claddingCatalog';
import { applyCladdingBrush } from '../claddingBrush';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';

const cedar = findCladdingProduct('demo-clad-cedar-140')!;

describe('deriveCladdingOrders', () => {
  it('turns a bare wall into whole packs from board face area', () => {
    // 4 m wall × 2.7 m = 10.8 m². Board 0.14 × 2.4 = 0.336 m².
    const orders = deriveCladdingOrders(
      {
        wallHeightM: 2.7,
        rooms: [
          {
            id: 'r1',
            name: 'Room',
            polygon: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 3 },
              { x: 0, y: 3 },
            ],
            wallCladding: [{ edgeIndex: 0, productId: cedar.id }],
          },
        ],
      },
      2.7,
    );
    expect(orders).toHaveLength(1);
    const face = boardFaceM2(cedar);
    const area = 4 * 2.7;
    const boards = Math.ceil((area / face) * (1 + cedar.wasteFraction) - 1e-9);
    expect(orders[0].areaM2).toBeCloseTo(area, 1);
    expect(orders[0].boards).toBe(boards);
    expect(orders[0].packs).toBe(Math.ceil(boards / cedar.boardsPerPack));
    expect(orders[0].totalMur).toBe(orders[0].packs * cedar.samplePackPriceMur);
    expect(orders[0].product.sample).toBe(true);
  });

  it('deducts a door from the clad face', () => {
    const bare = deriveCladdingOrders(
      {
        wallHeightM: 2.7,
        rooms: [
          {
            id: 'r1',
            name: 'Room',
            polygon: [
              { x: 0, y: 0 },
              { x: 5, y: 0 },
              { x: 5, y: 4 },
              { x: 0, y: 4 },
            ],
            wallCladding: [{ edgeIndex: 0, productId: cedar.id }],
          },
        ],
      },
      2.7,
    );
    const withDoor = deriveCladdingOrders(
      {
        wallHeightM: 2.7,
        rooms: [
          {
            id: 'r1',
            name: 'Room',
            polygon: [
              { x: 0, y: 0 },
              { x: 5, y: 0 },
              { x: 5, y: 4 },
              { x: 0, y: 4 },
            ],
            openings: [{ id: 'd', edgeIndex: 0, offsetM: 2, widthM: 0.9, kind: 'door', flipFacing: false, flipHand: false }],
            wallCladding: [{ edgeIndex: 0, productId: cedar.id }],
          },
        ],
      },
      2.7,
    );
    expect(withDoor[0].areaM2).toBeLessThan(bare[0].areaM2);
  });
});

describe('applyCladdingBrush', () => {
  it('clads one wall and Shift clads the room', () => {
    usePropertyStore.setState((s) => ({
      property: {
        ...s.property,
        activeRoomId: 'r1',
        rooms: [
          {
            id: 'r1',
            name: 'Room 1',
            polygon: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 3 },
              { x: 0, y: 3 },
            ],
            placedItems: [],
          } as never,
        ],
      },
    }));
    useDesignerUIStore.setState(() => ({
      claddingDraft: { productId: 'demo-clad-cedar-140', scope: 'wall', erase: false },
    }));
    applyCladdingBrush({ kind: 'edge', roomId: 'r1', edgeIndex: 1 });
    expect(usePropertyStore.getState().property.rooms[0].wallCladding).toEqual([
      { edgeIndex: 1, productId: 'demo-clad-cedar-140' },
    ]);
    applyCladdingBrush({ kind: 'edge', roomId: 'r1', edgeIndex: 0 }, { shift: true });
    expect(usePropertyStore.getState().property.rooms[0].wallCladding).toHaveLength(4);
    expect(useDesignerUIStore.getState().claddingDraft.scope).toBe('wall');
  });
});
