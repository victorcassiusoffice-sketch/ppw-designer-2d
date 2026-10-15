/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharedProjectWorkbench from '../SharedProjectWorkbench';
import { SharedSpecComponentSchema, type SharedSpecRecord, type SharedSpecRole } from '../../designer/sharedSpecsContract';
import { usePropertyStore } from '../../store/propertyStore';
import { useSharedPilotStore } from '../../store/sharedPilotStore';
import { SharedSpecApiError } from '../../lib/sharedSpecsApi';
import type { SharedSession } from '../SharedProjectConnection';

const connection = vi.hoisted(() => ({ session: null as unknown, callback: null as ((value: unknown) => void) | null }));
vi.mock('../SharedProjectConnection', async () => {
  const { useEffect } = await import('react');
  return { default: function TestConnection({ onSession }: { onSession: (value: unknown) => void }) { useEffect(() => { connection.callback = onSession; onSession(connection.session); return () => { connection.callback = null; onSession(null); }; }, [onSession]); return <p>Test verified account connection</p>; } };
});
vi.mock('../../hooks/useWorkspaceFocus', () => ({ useWorkspaceFocus: () => undefined }));
vi.mock('../../i18n/AppPreferences', () => ({ useAppPreferences: () => ({ locale: 'en', formatNumber: (n: number) => String(n) }) }));
vi.mock('../LocaleThemeControls', () => ({ LocaleThemeControls: () => null }));
vi.mock('../SharedSustainabilityPanel', () => ({ SharedSustainabilityPanel: () => <form aria-label="Environmental test inputs"><input name="airTempC" defaultValue="" /></form>, SharedCarbonSummary: () => null }));
vi.mock('../../designer/sharedBuildAdapter', async () => {
  const { mergeMeasuredSpecs, SharedSpecComponentSchema: Schema } = await import('../../designer/sharedSpecsContract');
  return {
    measuredBuildSpecs: () => [Schema.parse({ id: 'wall:ground', sourceKey: 'walls:ground', sourceFingerprint: 'fixture', category: 'wall', name: 'Ground walls', material: 'Measured block', quantity: 12, unit: 'm2' })],
    measuredSyncPayload: mergeMeasuredSpecs,
    specFingerprint: (value: unknown) => JSON.stringify(value),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let host: HTMLDivElement; let session: SharedSession;
const userId = 'user_cloudowner';
const fixture = () => SharedSpecComponentSchema.parse({ id: 'wall:ground', sourceKey: 'walls:ground', sourceFingerprint: 'fixture', category: 'wall', name: 'Ground walls', material: 'Server block', quantity: 12, unit: 'm2' });
function record(role: SharedSpecRole = 'owner', revision = 1): SharedSpecRecord {
  return { project: { id: 'd987970f-8b3c-4b09-84a0-6d63fe0c365d', name: 'Cloud project', sourceBuildId: usePropertyStore.getState().property.id, components: [fixture()], members: [{ userId, role: 'owner', active: true }, { userId: 'user_supplier', role: 'supplier', active: true }], pilotReviews: [], specRevision: revision }, role, revision, updatedAt: '2026-10-16T08:00:00.000Z' };
}
const buttons = () => [...host.querySelectorAll<HTMLButtonElement>('button')];
const button = (text: string) => buttons().find((b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text)!;
async function click(text: string) { expect(button(text), text).toBeDefined(); await act(async () => { button(text).click(); }); }
function input(name: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  expect(field, name).not.toBeNull();
  act(() => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); });
}
function selectRole(role: SharedSpecRole) { const select = host.querySelector<HTMLSelectElement>('.shared-nav select')!; act(() => { select.value = role; select.dispatchEvent(new Event('change', { bubbles: true })); }); }
function editor() { return host.querySelector<HTMLFormElement>('form[aria-label="Edit component specification"]'); }
async function submit() { await act(async () => { editor()!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
async function openComponent() { await click('Components'); const entry = host.querySelector<HTMLButtonElement>('.shared-component-list button')!; await act(async () => entry.click()); }
async function connect(role: SharedSpecRole = 'owner') {
  const current = record(role);
  vi.mocked(session.api.list).mockResolvedValue([{ id: current.project.id, name: current.project.name, role, revision: 1, updatedAt: current.updatedAt, sourceBuildId: current.project.sourceBuildId }]);
  vi.mocked(session.api.read).mockResolvedValue(current);
  await click('Shared connection'); await click('Connected project'); await click('Find my projects');
  await click(`Cloud project · ${role} · version 1`); return current;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
beforeEach(async () => {
  localStorage.clear(); usePropertyStore.getState().resetToDefault(); useSharedPilotStore.setState({ pilots: {} });
  session = { userId, api: { list: vi.fn(async () => []), read: vi.fn(async () => record()), create: vi.fn(async () => record()), write: vi.fn(async () => record('owner', 2)), changes: vi.fn(async () => ({ changes: [], latestRevision: 1, nextAfter: 1, hasMore: false })), revision: vi.fn(async () => record()) } };
  connection.session = session; connection.callback = null;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<SharedProjectWorkbench open onClose={vi.fn()} />); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('shared project station isolation and conflict handling', () => {
  it('keeps role rehearsal local and limits client editing to notes', async () => {
    selectRole('client'); await openComponent();
    expect(host.querySelector<HTMLInputElement>('[name="material"]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLTextAreaElement>('[name="notes"]')?.disabled).toBe(false);
    input('notes', 'Local client note'); await submit();
    expect(useSharedPilotStore.getState().pilots[usePropertyStore.getState().property.id].record.project.components[0].notes).toBe('Local client note');
    expect(session.api.write).not.toHaveBeenCalled(); expect(session.api.create).not.toHaveBeenCalled();
  });
  it('uses the authenticated project role, not the rehearsal selector, for cloud fields', async () => {
    selectRole('engineer'); await connect('client'); await openComponent();
    const selector = host.querySelector<HTMLSelectElement>('.shared-nav select')!;
    expect(selector.disabled).toBe(true); expect(selector.value).toBe('client');
    expect(host.querySelector<HTMLInputElement>('[name="material"]')?.disabled).toBe(true);
    input('notes', 'Shared client note'); await submit();
    expect(session.api.write).toHaveBeenCalledWith(record().project.id, expect.objectContaining({ expectedRevision: 1, operation: { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'Shared client note' } } }));
  });
  it('retains the component form and draft when the server rejects a stale save', async () => {
    await connect(); await openComponent(); input('material', 'Unsaved material');
    vi.mocked(session.api.write).mockRejectedValueOnce(new SharedSpecApiError('Conflict', 409, 'SHARED_REVISION_CONFLICT'));
    await submit();
    expect(editor()).not.toBeNull(); expect(host.querySelector<HTMLInputElement>('[name="material"]')?.value).toBe('Unsaved material');
    expect(host.textContent).toContain('Your draft is retained');
  });
  it('marks a retained component form stale after a newer shared revision arrives', async () => {
    vi.useFakeTimers(); await connect(); await openComponent(); input('material', 'Unsaved material');
    vi.mocked(session.api.changes).mockResolvedValue({ changes: [], latestRevision: 2, nextAfter: 2, hasMore: false });
    vi.mocked(session.api.read).mockResolvedValue(record('owner', 2));
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(host.querySelector<HTMLInputElement>('[name="material"]')?.value).toBe('Unsaved material');
    expect(host.textContent).toContain('register changed while you were editing');
    expect(button('Save new version').disabled).toBe(true); expect(session.api.write).not.toHaveBeenCalled();
  });
  it('does not expose cloud membership mutations while using the local pilot', async () => {
    await connect(); await click('Local pilot');
    expect(button('Revoke')).toBeUndefined();
    expect(session.api.write).not.toHaveBeenCalled();
  });
  it('ignores an outstanding shared-project read after account sign-out', async () => {
    const current = record();
    vi.mocked(session.api.list).mockResolvedValue([{ id: current.project.id, name: 'Cloud project', role: 'owner', revision: 1, updatedAt: current.updatedAt, sourceBuildId: current.project.sourceBuildId }]);
    await click('Shared connection'); await click('Connected project'); await click('Find my projects');
    const pending = deferred<SharedSpecRecord>(); vi.mocked(session.api.read).mockReturnValueOnce(pending.promise);
    await click('Cloud project · owner · version 1');
    await act(async () => { connection.callback?.(null); });
    await act(async () => { pending.resolve(current); });
    expect(host.textContent).not.toContain('Connected · version');
    expect(host.textContent).not.toContain(current.project.id);
  });
  it('requires save or cancel before changing tabs with a component draft', async () => {
    await openComponent(); input('material', 'Keep this draft'); await click('Change history');
    expect(editor()).not.toBeNull(); expect(host.querySelector<HTMLInputElement>('[name="material"]')?.value).toBe('Keep this draft');
    await click('Cancel'); await click('Change history'); expect(editor()).toBeNull();
  });
  it('does not change rehearsal roles while a component draft is open', async () => {
    await openComponent(); input('material', 'Owner draft'); selectRole('client');
    expect(host.querySelector<HTMLSelectElement>('.shared-nav select')?.value).toBe('owner');
    expect(host.querySelector<HTMLInputElement>('[name="material"]')?.value).toBe('Owner draft');
  });
  it('protects environmental inputs while allowing explicit discard and navigation', async () => {
    await click('Environment'); input('airTempC', '28'); await click('Change history');
    expect(host.querySelector<HTMLInputElement>('[name="airTempC"]')?.value).toBe('28');
    await click('Discard environmental draft');
    expect(host.querySelector<HTMLInputElement>('[name="airTempC"]')?.value).toBe('');
    await click('Change history'); expect(host.querySelector('[name="airTempC"]')).toBeNull();
  });
  it('ignores a slow poll result that arrives after a newer save', async () => {
    vi.useFakeTimers(); await connect();
    const pending = deferred<SharedSpecRecord>();
    vi.mocked(session.api.changes).mockResolvedValue({ changes: [], latestRevision: 2, nextAfter: 2, hasMore: false });
    vi.mocked(session.api.read).mockReturnValueOnce(pending.promise);
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    await openComponent(); input('material', 'Version three');
    vi.mocked(session.api.write).mockResolvedValueOnce(record('owner', 3)); await submit();
    expect(host.textContent).toContain('Connected · version 3');
    await act(async () => { pending.resolve(record('owner', 2)); });
    expect(host.textContent).toContain('Connected · version 3');
  });
  it('serializes a pending write and prevents a second submission', async () => {
    await connect(); await openComponent(); input('material', 'One write');
    const pending = deferred<SharedSpecRecord>(); vi.mocked(session.api.write).mockReturnValueOnce(pending.promise);
    await submit(); await submit(); expect(session.api.write).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(record('owner', 2)); });
    expect(editor()).toBeNull();
  });
  it('opens a new section at its top rather than retaining the previous section scroll', async () => {
    const content = host.querySelector<HTMLElement>('.shared-content')!; content.scrollTop = 900;
    await click('Components'); expect(content.scrollTop).toBe(0);
    content.scrollTop = 700; await click('Environment'); expect(content.scrollTop).toBe(0);
  });
});
