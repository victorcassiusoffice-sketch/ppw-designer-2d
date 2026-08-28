/**
 * Pages — separate plans, and the leak they exist to prevent.
 *
 * The headline test is `walls do NOT leak between plans`. A page is not just a
 * Property: `wallStore` is a global singleton with no page key, so switching
 * plans used to drag the previous plan's interior walls onto the new one. That
 * is the thing that makes a plan switcher either trustworthy or useless.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore, DRAFT_ID } from '../../store/designsStore';
import { useWallStore } from '../../store/wallStore';
import { useHistoryStore } from '../../store/historyStore';
import {
  captureCurrentPage,
  applyPage,
  flushCurrentPage,
  switchToPage,
  createPage,
  currentPageId,
} from '../pages';

function wall(x: number) {
  return {
    id: `w${x}`,
    start: { x_mm: x, y_mm: 0 },
    end: { x_mm: x, y_mm: 1000 },
    thickness_mm: 100,
    height_mm: 2700,
    type: 'full' as const,
  };
}

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().replace([]);
  useHistoryStore.getState().reset();
  useDesignsStore.setState({ designs: {}, currentId: null });
});

describe('capture / apply', () => {
  it('captures the whole plan, not just the property', () => {
    useWallStore.getState().replace([wall(500)]);
    const b = captureCurrentPage();
    expect(b.property).toBeTruthy();
    expect(b.walls).toHaveLength(1);
  });

  it('applying a bundle with no walls CLEARS the walls on the canvas', () => {
    useWallStore.getState().replace([wall(500), wall(900)]);
    applyPage({ walls: [] });
    // Skipping a missing key is exactly what would let the previous page's
    // walls survive onto this one.
    expect(useWallStore.getState().walls).toHaveLength(0);
  });
});

describe('flush', () => {
  it('writes into the DRAFT slot when nothing is named', () => {
    expect(currentPageId()).toBe(DRAFT_ID);
    useWallStore.getState().replace([wall(500)]);
    flushCurrentPage();
    const draft = useDesignsStore.getState().designs[DRAFT_ID];
    expect(draft).toBeTruthy();
    expect(draft.walls).toHaveLength(1);
  });

  it('writes into the NAMED page once one is current', () => {
    const id = createPage('Tamarin Studio');
    useWallStore.getState().replace([wall(500)]);
    flushCurrentPage();
    expect(useDesignsStore.getState().designs[id].walls).toHaveLength(1);
  });
});

describe('switching plans', () => {
  it('walls do NOT leak between plans', () => {
    // Plan A: one interior wall.
    const a = createPage('Client A');
    useWallStore.getState().replace([wall(500)]);
    flushCurrentPage();

    // Plan B: none.
    const b = createPage('Client B');
    expect(useWallStore.getState().walls, 'a new plan starts clean').toHaveLength(0);
    flushCurrentPage();

    // Back to A — its wall returns.
    switchToPage(a);
    expect(useWallStore.getState().walls).toHaveLength(1);

    // ...and forward to B again — A's wall must NOT come with it.
    switchToPage(b);
    expect(
      useWallStore.getState().walls,
      "plan A's interior wall must not follow the user onto plan B",
    ).toHaveLength(0);
  });

  it('saves the outgoing plan before leaving it', () => {
    const a = createPage('Plan A');
    const b = createPage('Plan B');

    switchToPage(a);
    const roomId = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().renameRoom(roomId, 'Sauna');

    switchToPage(b);
    switchToPage(a);
    expect(
      usePropertyStore.getState().property.rooms[0].name,
      'edits made on a plan must survive switching away and back',
    ).toBe('Sauna');
  });

  it('clears undo history on switch', () => {
    const a = createPage('Plan A');
    createPage('Plan B');
    useHistoryStore.getState().recordSnapshot('something');
    useHistoryStore.getState().flush();

    switchToPage(a);
    // Frames from the previous plan would let a Ctrl+Z apply the OTHER plan's
    // state over this one.
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('is a no-op for an unknown page', () => {
    expect(switchToPage('nope')).toBe(false);
  });

  it('switching to the page already open does nothing', () => {
    const a = createPage('Plan A');
    expect(switchToPage(a)).toBe(true);
    expect(currentPageId()).toBe(a);
  });
});

describe('promoting an unsaved draft', () => {
  it('pressing + from unsaved work keeps that work reachable as a tab', () => {
    // Draw something while still on the draft slot.
    const roomId = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().setRoomPolygon(roomId, [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 },
    ]);
    usePropertyStore.getState().renameProperty('Tamarin Studio');
    expect(currentPageId()).toBe(DRAFT_ID);

    createPage('Plan 2');

    // The original work now has its OWN named page, not just a draft blob.
    const named = Object.values(useDesignsStore.getState().designs)
      .filter((d) => d.id !== DRAFT_ID)
      .map((d) => d.name);
    expect(named).toContain('Tamarin Studio');
    expect(named).toContain('Plan 2');
  });

  it('does not promote a genuinely empty canvas', () => {
    createPage('Plan 1');
    const named = Object.values(useDesignsStore.getState().designs)
      .filter((d) => d.id !== DRAFT_ID);
    expect(named).toHaveLength(1);
  });
});

describe('createPage', () => {
  it('starts a blank plan and makes it current', () => {
    const id = createPage('Fresh');
    expect(currentPageId()).toBe(id);
    expect(useDesignsStore.getState().designs[id].name).toBe('Fresh');
    expect(useWallStore.getState().walls).toHaveLength(0);
  });

  it('does not lose the plan it was called from', () => {
    const a = createPage('Keep me');
    const roomId = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().renameRoom(roomId, 'Gym Floor');
    createPage('Second');
    switchToPage(a);
    expect(usePropertyStore.getState().property.rooms[0].name).toBe('Gym Floor');
  });
});
