import { useDesignsStore } from '../store/designsStore';
import { usePropertyStore } from '../store/propertyStore';
import { useHistoryStore } from '../store/historyStore';
import { applyPage, captureCurrentPage, currentPageId, flushCurrentPage, promoteDraftToPage } from './pages';
import { getDesignById, saveDesignToApi, updateDesignToApi, type ApiDesign } from './designsApi';
import { isLikelyEmail } from './customerIdentity';

/** Keep the outgoing local work, open the cloud snapshot as a separate page. */
export function openCloudDesign(design: ApiDesign, email: string): string {
  if (!design.property || !Array.isArray(design.property.rooms)) throw new Error('That design has no valid property data.');
  const owner = email.trim().toLowerCase();
  if (design.customerEmail?.trim().toLowerCase() !== owner) throw new Error('This design belongs to a different email.');
  promoteDraftToPage();
  flushCurrentPage();
  const store = useDesignsStore.getState();
  // A new local page keeps any unsynced changes in earlier copies intact.
  const property = { ...design.property, name: design.name };
  const id = store.savePropertyAs(design.name, property);
  applyPage({ property });
  store.savePageBundle(id, captureCurrentPage());
  store.linkCloud(id, { id: design.id, email: owner, savedAt: design.updatedAt });
  useHistoryStore.getState().reset();
  return id;
}

/** Explicit Save/Update only; local autosave never performs network writes. */
export async function saveCurrentPageToCloud(email: string, name: string, updateExisting = false): Promise<ApiDesign> {
  const owner = email.trim().toLowerCase();
  const title = name.trim();
  if (!isLikelyEmail(owner)) throw new Error('Enter a valid email before saving.');
  if (!title) throw new Error('Give this plan a name before saving.');
  promoteDraftToPage(title);
  flushCurrentPage();
  const pageId = currentPageId();
  const page = useDesignsStore.getState().designs[pageId];
  // Capture before waiting on the network; switching pages must not save the
  // next page or attach this response to whatever the user opens meanwhile.
  const property = { ...usePropertyStore.getState().property, name: title };
  let saved: ApiDesign;
  if (updateExisting) {
    if (!page?.cloud || page.cloud.email !== owner) throw new Error('Load your cloud design before updating it, or save a new copy.');
    const remote = await getDesignById(page.cloud.id);
    if (!remote) throw new Error('The cloud copy no longer exists. Save a new copy.');
    if (remote.customerEmail?.trim().toLowerCase() !== owner) throw new Error('This cloud copy belongs to a different email.');
    saved = await updateDesignToApi(remote.id, {
      customerEmail: owner, name: title, property, cart: remote.cart, status: remote.status,
    });
  } else {
    saved = await saveDesignToApi({ customerEmail: owner, name: title, property, status: 'draft' });
  }
  useDesignsStore.getState().linkCloud(pageId, { id: saved.id, email: owner, savedAt: saved.updatedAt });
  return saved;
}
