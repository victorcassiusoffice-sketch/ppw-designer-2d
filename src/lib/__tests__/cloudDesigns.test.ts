import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_ID, useDesignsStore } from '../../store/designsStore';
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { useWallStore } from '../../store/wallStore';
import { useHistoryStore } from '../../store/historyStore';
import { createPage, flushCurrentPage } from '../pages';
import { openCloudDesign, saveCurrentPageToCloud } from '../cloudDesigns';
import { getDesignById, saveDesignToApi, updateDesignToApi, type ApiDesign } from '../designsApi';

vi.mock('../designsApi', () => ({ getDesignById: vi.fn(), saveDesignToApi: vi.fn(), updateDesignToApi: vi.fn() }));

const property: Property = {
  id: 'cloud-property', name: 'Cloud house', activeRoomId: 'upper',
  levels: [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'upper-floor', name: 'Upper', index: 1 }],
  activeLevelId: 'upper-floor',
  rooms: [
    { id: 'ground-room', name: 'Kitchen', levelId: 'ground', polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }], placedItems: [] },
    { id: 'upper', name: 'Bedroom', levelId: 'upper-floor', polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }], placedItems: [] },
  ],
};
const remote: ApiDesign = {
  id: 42, customerEmail: 'vic@example.test', userId: null, name: 'Cloud house', property,
  cart: { merchantQuote: 'kept' }, status: 'quoted', createdAt: '2026-09-23T00:00:00Z', updatedAt: '2026-09-23T01:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  useDesignsStore.setState({ designs: {}, currentId: null });
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().replace([]);
  useHistoryStore.getState().reset();
});

describe('cloud designs use the local page lifecycle', () => {
  it('preserves outgoing edits, clears foreign walls/history and loads every level into a separate page', () => {
    const original = createPage('Local project');
    usePropertyStore.getState().renameProperty('Latest unsaved edit');
    useWallStore.getState().replace([{ id: 'legacy', start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' }]);
    useHistoryStore.getState().recordSnapshot('Old project');
    const opened = openCloudDesign(remote, 'VIC@example.test');
    expect(opened).not.toBe(original);
    expect(useDesignsStore.getState().designs[original].property.name).toBe('Latest unsaved edit');
    expect(useDesignsStore.getState().designs[original].walls).toHaveLength(1);
    expect(useWallStore.getState().walls).toEqual([]);
    expect(useHistoryStore.getState().canUndo()).toBe(false);
    expect(usePropertyStore.getState().property.rooms).toHaveLength(2);
    expect(useDesignsStore.getState().designs[opened].cloud?.id).toBe(42);
    flushCurrentPage();
    expect(useDesignsStore.getState().designs[opened].cloud?.id).toBe(42);
    const copy = useDesignsStore.getState().savePropertyAs('Copy', property);
    expect(useDesignsStore.getState().designs[copy].cloud).toBeUndefined();
  });

  it('never updates an arbitrary cloud ID or a copy belonging to another email', async () => {
    createPage('Local');
    await expect(saveCurrentPageToCloud('vic@example.test', 'Local', true)).rejects.toThrow(/Load your cloud design/);
    const opened = openCloudDesign(remote, 'vic@example.test');
    await expect(saveCurrentPageToCloud('other@example.test', 'Local', true)).rejects.toThrow(/Load your cloud design/);
    expect(updateDesignToApi).not.toHaveBeenCalled();
    expect(useDesignsStore.getState().currentId).toBe(opened);
  });

  it('keeps cart/status on explicit update and ties a delayed response to its original page', async () => {
    const opened = openCloudDesign(remote, 'vic@example.test');
    let finish!: (design: ApiDesign | null) => void;
    vi.mocked(getDesignById).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    vi.mocked(updateDesignToApi).mockResolvedValue({ ...remote, updatedAt: '2026-09-23T02:00:00Z' });
    const updating = saveCurrentPageToCloud('vic@example.test', 'Revised cloud house', true);
    const otherPage = createPage('Another project');
    finish(remote);
    await updating;
    expect(updateDesignToApi).toHaveBeenCalledWith(42, expect.objectContaining({
      cart: remote.cart, status: 'quoted', property: expect.objectContaining({ id: 'cloud-property', rooms: expect.any(Array) }),
    }));
    expect(useDesignsStore.getState().currentId).toBe(otherPage);
    expect(useDesignsStore.getState().designs[otherPage].cloud).toBeUndefined();
    expect(useDesignsStore.getState().designs[opened].cloud?.savedAt).toBe('2026-09-23T02:00:00Z');
    expect(saveDesignToApi).not.toHaveBeenCalled();
  });

  it('creates a new cloud copy only after explicit Save and keeps local work on network failure', async () => {
    const local = createPage('Local');
    vi.mocked(saveDesignToApi).mockRejectedValueOnce(new Error('Offline'));
    await expect(saveCurrentPageToCloud('vic@example.test', 'Local')).rejects.toThrow('Offline');
    expect(useDesignsStore.getState().designs[local]).toBeDefined();
    expect(useDesignsStore.getState().designs[local].cloud).toBeUndefined();
    vi.mocked(saveDesignToApi).mockResolvedValue(remote);
    await saveCurrentPageToCloud('vic@example.test', 'Local');
    expect(useDesignsStore.getState().designs[local].cloud?.id).toBe(42);
    expect(updateDesignToApi).not.toHaveBeenCalled();
  });

  it('saves a garden without rooms and attaches the cloud link to a reachable named page', async () => {
    const garden = { surfaces: [{ id: 'lawn', kind: 'lawn' as const, x: -4, y: -4, widthM: 8, depthM: 8, elevationM: 0 }], fences: [] };
    usePropertyStore.setState((state) => ({ property: { ...state.property, garden } }));
    vi.mocked(saveDesignToApi).mockResolvedValue({ ...remote, name: 'Landscape' });
    await saveCurrentPageToCloud('vic@example.test', 'Landscape');
    expect(saveDesignToApi).toHaveBeenCalledWith(expect.objectContaining({
      property: expect.objectContaining({ garden }),
    }));
    const pageId = useDesignsStore.getState().currentId;
    expect(pageId).not.toBeNull();
    expect(pageId).not.toBe(DRAFT_ID);
    expect(useDesignsStore.getState().designs[pageId!].cloud?.id).toBe(42);
  });
});
