/**
 * @vitest-environment jsdom
 *
 * floorZoneStore + wallTreatmentStore + historyStore integration tests.
 *
 * Covers:
 *   - addZone / removeZone / clearZones produce the right local state
 *   - setTreatment / removeTreatment / clearTreatments shape
 *   - Both stores feed into the unified history snapshot
 *   - undo restores zones + treatments alongside placedItems + walls
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useFloorZoneStore, FLOOR_ZONES_LS_KEY } from '../floorZoneStore';
import { useWallTreatmentStore, WALL_TREATMENTS_LS_KEY } from '../wallTreatmentStore';
import { useHistoryStore, installHistorySubscriptions, __test } from '../historyStore';
import { usePropertyStore } from '../propertyStore';
import { useWallStore } from '../wallStore';

let teardown: (() => void) | null = null;

beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().clearWalls();
  useFloorZoneStore.getState().clearZones();
  useWallTreatmentStore.getState().clearTreatments();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(FLOOR_ZONES_LS_KEY);
    localStorage.removeItem(WALL_TREATMENTS_LS_KEY);
  }
  teardown = installHistorySubscriptions({ coalesceMs: 0 });
});

afterEach(() => {
  if (teardown) {
    teardown();
    teardown = null;
  }
});

describe('floorZoneStore — basic actions', () => {
  it('addZone appends and removeZone deletes', () => {
    const id = useFloorZoneStore.getState().addZone({
      polygon: [
        { x_mm: 0, y_mm: 0 },
        { x_mm: 2000, y_mm: 0 },
        { x_mm: 2000, y_mm: 1500 },
        { x_mm: 0, y_mm: 1500 },
      ],
      material_id: 'k1-rubber-interlock',
    });
    expect(useFloorZoneStore.getState().zones).toHaveLength(1);
    useFloorZoneStore.getState().removeZone(id);
    expect(useFloorZoneStore.getState().zones).toHaveLength(0);
  });

  it('clearZones wipes all', () => {
    const fs = useFloorZoneStore.getState();
    fs.addZone({ polygon: [{ x_mm: 0, y_mm: 0 }], material_id: 'k1-eva-combat-mat' });
    fs.addZone({ polygon: [{ x_mm: 0, y_mm: 0 }], material_id: 'k1-epdm-roll-6mm' });
    expect(useFloorZoneStore.getState().zones).toHaveLength(2);
    useFloorZoneStore.getState().clearZones();
    expect(useFloorZoneStore.getState().zones).toHaveLength(0);
  });

  it('persists to localStorage', () => {
    useFloorZoneStore.getState().addZone({
      polygon: [{ x_mm: 0, y_mm: 0 }],
      material_id: 'k1-outdoor-rubber-tile',
    });
    const raw = localStorage.getItem(FLOOR_ZONES_LS_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });
});

describe('wallTreatmentStore — basic actions', () => {
  it('setTreatment + removeTreatment shape (paint + panel stack)', () => {
    const ts = useWallTreatmentStore.getState();
    ts.setTreatment({ wall_id: 'w1', kind: 'paint', product_id: 'cream-shell' });
    ts.setTreatment({ wall_id: 'w1', kind: 'panel', product_id: 'cork-tile' });
    expect(useWallTreatmentStore.getState().treatments.w1?.paint?.product_id).toBe('cream-shell');
    expect(useWallTreatmentStore.getState().treatments.w1?.panel?.product_id).toBe('cork-tile');

    useWallTreatmentStore.getState().removeTreatment('w1', 'paint');
    expect(useWallTreatmentStore.getState().treatments.w1?.paint).toBeUndefined();
    expect(useWallTreatmentStore.getState().treatments.w1?.panel?.product_id).toBe('cork-tile');
  });

  it('removes empty wall record on last treatment removal', () => {
    const ts = useWallTreatmentStore.getState();
    ts.setTreatment({ wall_id: 'w2', kind: 'paint', product_id: 'sage-leaf' });
    ts.removeTreatment('w2', 'paint');
    expect(Object.keys(useWallTreatmentStore.getState().treatments)).not.toContain('w2');
  });
});

describe('historyStore — Phase C stores feed unified snapshot', () => {
  it('records a floor zone add as one undoable frame', () => {
    useFloorZoneStore.getState().addZone({
      polygon: [{ x_mm: 0, y_mm: 0 }],
      material_id: 'k1-rubber-interlock',
    });
    expect(useFloorZoneStore.getState().zones).toHaveLength(1);
    useHistoryStore.getState().undo();
    expect(useFloorZoneStore.getState().zones).toHaveLength(0);
  });

  it('records a wall treatment as one undoable frame', () => {
    useWallTreatmentStore.getState().setTreatment({
      wall_id: 'w3',
      kind: 'paint',
      product_id: 'wellness-gold',
    });
    expect(useWallTreatmentStore.getState().treatments.w3?.paint).toBeDefined();
    useHistoryStore.getState().undo();
    expect(useWallTreatmentStore.getState().treatments.w3).toBeUndefined();
  });

  it('undo can interleave floor + treatment + item actions', () => {
    const ps = usePropertyStore.getState();
    ps.addItem({ productId: 'mat', x: 1, y: 1, rotation: 0 });
    useFloorZoneStore.getState().addZone({
      polygon: [{ x_mm: 0, y_mm: 0 }],
      material_id: 'k1-rubber-interlock',
    });
    useWallTreatmentStore.getState().setTreatment({
      wall_id: 'w4',
      kind: 'paint',
      product_id: 'mist-blue',
    });

    // Three actions → three frames.
    expect(useHistoryStore.getState().past.length).toBeGreaterThanOrEqual(3);

    // Undo each in reverse order.
    useHistoryStore.getState().undo();
    expect(useWallTreatmentStore.getState().treatments.w4).toBeUndefined();
    useHistoryStore.getState().undo();
    expect(useFloorZoneStore.getState().zones).toHaveLength(0);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(0);
  });
});
