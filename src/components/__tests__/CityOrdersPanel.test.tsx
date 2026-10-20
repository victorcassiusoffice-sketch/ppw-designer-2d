/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ readOnly: false, save: vi.fn(), load: vi.fn(), download: vi.fn() }));
vi.mock('../../lib/showcaseSafety', () => ({ isShowcaseReadOnly: () => mocks.readOnly }));
vi.mock('../../lib/cityProcurementClient', () => ({ saveCityProcurement: mocks.save, loadCityProcurement: mocks.load }));
vi.mock('../../lib/downloadJson', () => ({ downloadJson: mocks.download }));
vi.mock('../RequireMerchant', () => ({
  SESSION_STORAGE_KEY: 'merchant-test',
  readActiveMerchantSession: (slug: string) => slug === 'alpha' ? { slug, token: 'signed-test', email: 'alpha@example.com', exp: Date.now() + 60_000 } : null,
  inspectToken: () => ({ slug: 'alpha', email: 'alpha@example.com', exp: Date.now() + 60_000 }),
}));
import CityOrdersPanel from '../CityOrdersPanel';
import { useCityProcurementStore } from '../../store/cityProcurementStore';
import { createCityProcurementPackage } from '../../designer/cityProcurement';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); mocks.readOnly = false; vi.clearAllMocks(); mocks.save.mockReset(); mocks.load.mockReset();
  window.history.replaceState({}, '', '/designer');
  useCityProcurementStore.setState({ plans: {}, cloud: {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); }));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = (onDirtyChange?: (dirty: boolean) => void) => act(() => root.render(<CityOrdersPanel projectId="city-test" projectName="Test city" onDirtyChange={onDirtyChange} />));
function button(label: string) { const element = [...host.querySelectorAll('button')].find(value => value.textContent?.trim() === label); expect(element, label).toBeDefined(); return element!; }
const click = (label: string) => act(() => button(label).click());
function enter(label: string, value: string) {
  const element = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`); expect(element, label).not.toBeNull();
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value); element!.dispatchEvent(new Event('input', { bubbles: true })); });
}
function setupPackage() { render(); click('+ Add draft'); }

describe('City ordering dashboard', () => {
  it('keeps incomplete email typing local until an explicit valid package save', () => {
    setupPackage(); enter('Order recipient email', 'pending@');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Order recipient email"]')?.value).toBe('pending@');
    expect(useCityProcurementStore.getState().plans['city-test'].packages[0].recipientEmail).toBe('');
    click('Save package'); expect(host.querySelector('[role=alert]')?.textContent).toContain('Order recipient email');
    enter('Order recipient email', 'orders@example.com'); click('Save package');
    expect(useCityProcurementStore.getState().plans['city-test'].packages[0].recipientEmail).toBe('orders@example.com');
    expect(host.textContent).toContain('No order, invoice or email has been sent'); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects delivery before ordering and incomplete reviewed packages', () => {
    setupPackage(); enter('Order date', '2026-10-20'); enter('Delivery date', '2026-10-19'); click('Save package');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Delivery cannot precede ordering');
    enter('Delivery date', '2026-10-21');
    const reviewed = [...host.querySelectorAll('label')].find(label => label.textContent?.includes('I reviewed quantities'))?.querySelector<HTMLInputElement>('input');
    act(() => reviewed!.click()); click('Save package');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Complete this field');
    expect(useCityProcurementStore.getState().plans['city-test'].packages[0].state).toBe('draft');
  });
  it('preserves unsaved equipment when a second package is requested', () => {
    setupPackage(); click('+ Add equipment'); enter('Equipment 1 description', 'Solar light'); enter('Equipment 1 quantity', '12'); click('+ Add draft');
    expect(host.textContent).toContain('Save this package or discard');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Equipment 1 quantity"]')?.value).toBe('12');
    click('Save package'); click('+ Add draft');
    expect(useCityProcurementStore.getState().plans['city-test'].packages).toHaveLength(2);
    expect(useCityProcurementStore.getState().plans['city-test'].packages[0].lines[0]).toMatchObject({ quantity: 12, unit: 'each', description: 'Solar light' });
  });
  it('isolates public demo drafts from private supplier names and recipients', () => {
    const store = useCityProcurementStore.getState(); store.ensurePlan('city-test', 'Private city');
    store.upsertPackage('city-test', { ...createCityProcurementPackage('Private supplier name', 'Water'), recipientEmail: 'private@example.com' });
    window.history.replaceState({}, '', '/demo'); mocks.readOnly = true; render();
    expect(host.textContent).not.toContain('Private supplier'); expect(host.innerHTML).not.toContain('private@example.com');
    expect(useCityProcurementStore.getState().plans['demo:city-test'].packages).toHaveLength(0);
    click('Connection'); expect(host.textContent).toContain('Cloud writes, orders and email dispatch are disabled');
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('retains the request id across uncertain cloud save retries', async () => {
    localStorage.setItem('merchant-test', JSON.stringify({ slug: 'alpha' })); render(); click('Connection');
    mocks.save.mockRejectedValueOnce(new Error('Temporary connection failure'));
    await act(async () => button('Save draft securely').click()); expect(mocks.save).toHaveBeenCalledTimes(1);
    const first = mocks.save.mock.calls[0];
    mocks.save.mockResolvedValueOnce({ plan: first[1], revision: 1, updatedAt: '2026-10-13T00:00:00.000Z', execution: 'manual-review-required' });
    await act(async () => button('Retry secure save').click());
    expect(mocks.save.mock.calls[1][4]).toBe(first[4]); expect(host.textContent).toContain('Saved securely as revision 1');
    expect(useCityProcurementStore.getState().cloud['city-test'].revision).toBe(1);
  });
  it('exports reviewed packages without recipients until explicitly opted in', () => {
    const store = useCityProcurementStore.getState(); store.ensurePlan('city-test', 'City');
    store.upsertPackage('city-test', { ...createCityProcurementPackage('Supplier', 'Energy'), recipientEmail: 'orders@example.com', invoiceRecipientEmail: 'accounts@example.com', orderOn: '2026-10-20', invoiceOn: '2026-10-19', deliveryOn: '2026-10-22', state: 'reviewed', lines: [{ id: 'a', productRef: 'PV', description: 'PV kit', quantity: 1, unit: 'each' }] });
    render(); click('Download JSON'); expect(JSON.stringify(mocks.download.mock.calls[0][1])).not.toContain('orders@example.com');
    const optIn = [...host.querySelectorAll('label')].find(label => label.textContent?.includes('Include recipient emails'))?.querySelector<HTMLInputElement>('input');
    act(() => optIn!.click()); click('Download JSON'); expect(JSON.stringify(mocks.download.mock.calls[1][1])).toContain('orders@example.com');
    click('Timeline'); expect(host.textContent).toContain('19 Oct 2026'); expect(host.textContent).toContain('Invoice target');
  });
  it('reports pending edits to parent navigation and preserves them across internal views', () => {
    const dirty = vi.fn(); render(dirty); click('+ Add draft'); enter('Order recipient email', 'incomplete@');
    expect(dirty).toHaveBeenLastCalledWith(true);
    click('Timeline'); click('Connection'); click('Packages');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Order recipient email"]')?.value).toBe('incomplete@');
    expect(dirty).toHaveBeenLastCalledWith(true);
    click('Discard edits'); expect(dirty).toHaveBeenLastCalledWith(false);
    enter('Order recipient email', 'another@'); expect(dirty).toHaveBeenLastCalledWith(true);
    act(() => root.render(<div />)); expect(dirty).toHaveBeenLastCalledWith(false);
  });
});
