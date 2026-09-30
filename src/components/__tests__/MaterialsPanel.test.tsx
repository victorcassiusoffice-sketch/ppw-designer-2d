/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialsPanel } from '../MaterialsPanel';
import { usePropertyStore } from '../../store/propertyStore';
import { applyPage, captureCurrentPage } from '../../lib/pages';
import { defaultMaterialsSettings, type MaterialsReport } from '../../designer/materials';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  const state = usePropertyStore.getState();
  state.resetToDefault();
  state.setRoomPolygon(usePropertyStore.getState().property.activeRoomId, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }]);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function render() { act(() => root.render(<MaterialsPanel />)); }
function click(label: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent?.trim() === label);
  expect(button, `Button ${label}`).toBeDefined(); act(() => button!.click());
}
function field(label: string) {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, `Input ${label}`).not.toBeNull(); return input!;
}
function enter(label: string, value: string) {
  const input = field(label);
  act(() => { input.focus(); input.value = value; input.blur(); });
}
function select(label: string, value: string) {
  const element = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)
    ?? [...host.querySelectorAll('label')].find((node) => node.querySelector('span')?.textContent === label)?.querySelector('select');
  expect(element, `Select ${label}`).toBeDefined();
  act(() => { element!.value = value; element!.dispatchEvent(new Event('change', { bubbles: true })); });
}
function check(label: string) {
  const input = [...host.querySelectorAll('label')].find((node) => node.textContent?.trim() === label)?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  expect(input, `Checkbox ${label}`).toBeDefined(); act(() => input!.click());
}
function result(id: string) { return host.querySelector(`[data-quantity-id="${id}"]`)?.textContent ?? ''; }

describe('MaterialsPanel real property integration', () => {
  it('does not add settings or alter the drawing when an unchanged field is visited', () => {
    const before = usePropertyStore.getState().property;
    render(); enter('Joint mm', '10'); click('Roof'); click('Walls');
    expect(usePropertyStore.getState().property).toBe(before);
    expect(usePropertyStore.getState().property.materials).toBeUndefined();
  });

  it('updates the quantity from the entered joint and follows later drawing changes', () => {
    render(); click('Report'); expect(result('blocks')).toContain('587 blocks');
    click('Walls'); enter('Joint mm', '0'); click('Report');
    expect(result('blocks')).toContain('630 blocks');
    expect(result('blocks')).toContain('54 m²');
    const state = usePropertyStore.getState();
    act(() => state.setRoomPolygon(state.property.activeRoomId, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }]));
    expect(result('blocks')).toContain('945 blocks');
  });

  it('persists customer inputs through local hydration and exported page bundles', async () => {
    render(); enter('Joint mm', '12'); select('Block size preset', 'gamma-200');
    const expected = usePropertyStore.getState().property.materials;
    expect(expected).toMatchObject({ wall: { jointMm: 12, thicknessM: 0.2, presetId: 'gamma-200' } });
    const payload = localStorage.getItem('ppw_property_v2')!;
    expect(JSON.parse(payload).state.property.materials).toEqual(expected);
    const page = JSON.parse(JSON.stringify(captureCurrentPage()));
    act(() => usePropertyStore.getState().resetToDefault());
    localStorage.setItem('ppw_property_v2', payload);
    await act(async () => { await usePropertyStore.persist.rehydrate(); });
    expect(usePropertyStore.getState().property.materials).toEqual(expected);
    act(() => { usePropertyStore.getState().resetToDefault(); applyPage(page); });
    expect(usePropertyStore.getState().property.materials).toEqual(expected);
    expect(field('Joint mm').value).toBe('12');
  });

  it('shows the persisted clamp even when a second oversized input normalizes to the existing number', () => {
    render(); enter('Wall thickness m', '2'); enter('Wall thickness m', '500');
    expect(usePropertyStore.getState().property.materials?.wall.thicknessM).toBe(2);
    expect(field('Wall thickness m').value).toBe('2');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Adjusted to 2');
    expect(usePropertyStore.getState().property.materials?.wall.presetId).toBe('custom');
  });

  it('keeps the previous value for blank or negative input', () => {
    render(); enter('Block length m', ''); expect(field('Block length m').value).toBe('0.45');
    enter('Block length m', '-1'); expect(field('Block length m').value).toBe('0.45');
    expect(usePropertyStore.getState().property.materials).toBeUndefined();
  });

  it('lets ready-mix allowance update base volume without buying raw ingredients too', () => {
    render(); click('Concrete'); check('Include ground concrete base'); enter('Base depth m', '0.2'); enter('Concrete volume allowance %', '10');
    click('Report');
    expect(result('base-concrete')).toContain('5.5 m³');
    expect(result('base-concrete')).toContain('Net: 5 m³');
    expect(result('concrete-total')).toContain('Ready-mix concrete');
    expect(result('concrete-cement')).toBe('');
    expect(host.textContent).toContain('Do not add them again');
  });

  it('suppresses invalid roof rebar results and recovers when the lap is corrected', () => {
    render(); click('Roof'); select('Roof estimate type', 'reinforced-concrete'); check('Estimate an entered rebar grid');
    enter('Stock bar length m', '6'); enter('Lap length m', '6');
    expect(host.textContent).toContain('lap shorter than stock');
    click('Report'); expect(result('rebar-mass')).toBe('');
    expect(result('roof-concrete')).toContain('m³');
    click('Roof'); enter('Lap length m', '0.4'); click('Report');
    expect(result('rebar-mass')).toContain('kg');
    expect(result('rebar-bars')).toContain('bars');
    expect(result('rebar-mass')).toContain('7,850 kg/m³');
  });

  it('suppresses invalid end-lapped sheets without a crash or phantom concrete roof', () => {
    render(); click('Roof'); select('Roof estimate type', 'sheet');
    expect(host.querySelector('input[aria-label="Roof area m²"]')).toBeNull(); // sheet counts consume dimensions, not a standalone area
    enter('Sheet length m', '1'); enter('End lap m', '1');
    expect(host.textContent).toContain('Sheet end lap must be shorter');
    click('Report'); expect(result('sheets')).toBe(''); expect(result('roof-concrete')).toBe('');
    click('Roof'); enter('End lap m', '0.2'); click('Report');
    expect(result('sheets')).toContain('sheets'); expect(result('sheets')).toContain('side lap already in effective cover');
    expect(host.textContent).not.toContain('NaN'); expect(host.textContent).not.toContain('Infinity');
  });

  it('downloads the same saved settings, unrounded quantities, formulas and supplier references shown by the panel', () => {
    const RealBlob = Blob;
    let exported = '';
    vi.stubGlobal('Blob', class extends RealBlob {
      constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) { super(parts, options); exported = String(parts[0]); }
    });
    const makeUrl = vi.fn(() => 'blob:materials-test'), revokeUrl = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = makeUrl; static revokeObjectURL = revokeUrl; });
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.useFakeTimers();
    render(); enter('Joint mm', '12'); click('Report'); click('Download quantities & assumptions');
    const payload = JSON.parse(exported) as { propertyId: string; geometry: { walls: unknown[] }; report: MaterialsReport; sources: Array<{ checkedAt: string }> };
    expect(payload.propertyId).toBe(usePropertyStore.getState().property.id);
    expect(payload.report.settings).toEqual(usePropertyStore.getState().property.materials);
    expect(payload.geometry.walls.length).toBeGreaterThan(0);
    expect(payload.report.lines.find((line) => line.id === 'blocks')?.formula).toContain('ceil');
    expect(payload.report.assumptions.some((text) => text.includes('not supplier-certified yields'))).toBe(true);
    expect(payload.sources.every((source) => source.checkedAt === '2026-09-30')).toBe(true);
    expect(makeUrl).toHaveBeenCalledOnce(); expect(download).toHaveBeenCalledOnce();
    vi.runAllTimers(); expect(revokeUrl).toHaveBeenCalledWith('blob:materials-test');
  });

  it('renders sane units from normalized settings after a malformed imported recipe', () => {
    const property = usePropertyStore.getState().property;
    act(() => usePropertyStore.getState().loadProperty({ ...property, materials: { ...defaultMaterialsSettings(), mortar: { ...defaultMaterialsSettings().mortar, bagKg: 0, cement: NaN } } }));
    render(); click('Report');
    expect(host.textContent).not.toContain('NaN'); expect(host.textContent).not.toContain('Infinity');
    expect(result('mortar-bags')).toContain('bags');
    expect(result('mortar-volume')).toContain('m³');
  });
});
