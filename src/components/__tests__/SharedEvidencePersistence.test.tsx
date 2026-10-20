/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedComponentEditor } from '../SharedComponentEditor';
import { SharedSustainabilityPanel } from '../SharedSustainabilityPanel';
import {
  SharedSpecComponentSchema,
  type SharedSpecComponent,
  type SharedSpecPatch,
  type SharedSpecRole,
} from '../../designer/sharedSpecsContract';

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const original = (overrides: Partial<SharedSpecComponent> = {}) =>
  SharedSpecComponentSchema.parse({
    id: 'wall:ground',
    name: 'Ground walls',
    category: 'wall',
    material: 'Original product',
    quantity: 12,
    unit: 'm2',
    assigneeUserId: 'user_supplier',
    responsibleParty: 'Test organisation',
    deliveryDate: '2026-12-01',
    sources: ['https://example.org/original-product'],
    cost: { amount: 12, currency: 'MUR', basis: 'per-unit' },
    carbon: {
      factor: 2,
      unit: 'kgCO2e/unit',
      boundary: 'A1-A3',
      evidenceUrl: 'https://example.org/original-epd',
      notes: 'Existing EPD method and service-life notes',
    },
    analysis: {
      airTempC: 30,
      relativeHumidityPct: 80,
      surfaceTempC: 24,
      rateEvidenceUrl: 'https://example.org/original-drying',
      initialMoisturePct: 20,
      targetMoisturePct: 10,
      dryingRatePctPerDay: 1,
      dryingConditionsMatch: true,
      surface: { id: 'wall:ground', name: 'Ground walls', kind: 'moss', areaM2: 12 },
    },
    ...overrides,
  });
const members = [
  { userId: 'user_owner', role: 'owner' as const, active: true },
  { userId: 'user_supplier', role: 'supplier' as const, active: true },
  { userId: 'user_contractor', role: 'contractor' as const, active: true },
];
function renderEditor(component = original(), role: SharedSpecRole = 'owner', stale = false) {
  const save = vi.fn<(patch: SharedSpecPatch) => void>();
  act(() =>
    root.render(
      <SharedComponentEditor
        component={component}
        role={role}
        userId={`user_${role}`}
        members={members}
        onSave={save}
        onCancel={() => {}}
        stale={stale}
        busy={false}
      />,
    ),
  );
  return save;
}
function set(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[name="${name}"]`,
  )!;
  expect(input, name).toBeTruthy();
  input.value = value;
}
async function submit() {
  await act(async () => {
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
async function button(label: string) {
  const target = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
  expect(target, label).toBeTruthy();
  await act(async () => target!.click());
}

describe('component evidence editing', () => {
  it('preserves carbon declaration notes and references during an unrelated edit', async () => {
    const component = original(),
      save = renderEditor(component);
    set('notes', 'Coordinator added a note');
    await submit();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].carbon).toEqual(component.carbon);
    expect(save.mock.calls[0][0].sources).toEqual(component.sources);
    expect(save.mock.calls[0][0]).not.toHaveProperty('analysis');
  });
  it('invalidates unchanged product evidence when material changes despite optional declaration notes', async () => {
    const save = renderEditor();
    set('material', 'Replacement product');
    await submit();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      material: 'Replacement product',
      carbon: null,
      cost: null,
      analysis: null,
      sources: [],
    });
  });
  it('preserves an explicitly replaced declaration and quote without copying old declaration notes', async () => {
    const save = renderEditor();
    set('material', 'Replacement product');
    set('carbon', '3.5');
    set('carbonSource', 'https://example.org/replacement-epd');
    set('cost', '18');
    set('sources', 'https://example.org/replacement-product');
    await submit();
    expect(save.mock.calls[0][0]).toMatchObject({
      carbon: {
        factor: 3.5,
        unit: 'kgCO2e/unit',
        boundary: 'A1-A3',
        evidenceUrl: 'https://example.org/replacement-epd',
      },
      cost: { amount: 18 },
      analysis: null,
      sources: ['https://example.org/replacement-product'],
    });
    expect(save.mock.calls[0][0].carbon).not.toHaveProperty('notes');
  });
  it('normalises source ordering and whitespace without mistaking unchanged declarations for new evidence', async () => {
    const save = renderEditor(
      original({ sources: ['https://example.org/a', 'https://example.org/b'] }),
    );
    set('material', 'Replacement');
    set('boundary', ' A1-A3 ');
    set('carbonSource', ' https://example.org/original-epd ');
    set('sources', 'https://example.org/b\nhttps://example.org/a\nhttps://example.org/a');
    await submit();
    expect(save.mock.calls[0][0].sources).toEqual([]);
    expect(save.mock.calls[0][0].carbon).toBeNull();
  });
  it('does not send an unauthorized engineering patch for a supplier material replacement', async () => {
    const save = renderEditor(original(), 'supplier');
    set('material', 'Supplier replacement');
    await submit();
    expect(save.mock.calls[0][0]).toMatchObject({
      material: 'Supplier replacement',
      carbon: null,
      cost: null,
    });
    expect(save.mock.calls[0][0]).not.toHaveProperty('analysis');
    expect(save.mock.calls[0][0]).not.toHaveProperty('assigneeUserId');
  });
  it('keeps contractor edits scoped to permitted fields without clearing disabled evidence', async () => {
    const save = renderEditor(original(), 'contractor');
    set('notes', 'Updated site note');
    await submit();
    expect(save.mock.calls[0][0]).toMatchObject({ notes: 'Updated site note' });
    for (const field of ['material', 'carbon', 'cost', 'analysis', 'sources'])
      expect(save.mock.calls[0][0]).not.toHaveProperty(field);
  });
  it('guards form submission itself when a draft is stale', async () => {
    const save = renderEditor(original(), 'owner', true);
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Review the latest component before saving this draft');
  });
});

function renderPanel(component = original(), editable = true) {
  const save = vi.fn<(id: string, patch: SharedSpecPatch) => Promise<void>>().mockResolvedValue();
  act(() =>
    root.render(
      <SharedSustainabilityPanel
        components={[component]}
        selected={component}
        choose={() => {}}
        canAnalyse={editable}
        canSpecify={editable}
        save={save}
        busy={false}
      />,
    ),
  );
  return save;
}
async function selectUbp() {
  await button('Local / import evidence');
  const article = [...host.querySelectorAll('article')].find(
    (a) => a.querySelector('h3')?.textContent === 'UBP — blocks and basalt aggregates',
  );
  expect(article).toBeTruthy();
  await act(async () => article!.querySelector('button')!.click());
}
describe('sourcing and environmental evidence persistence', () => {
  it('proposes replacement references without carrying the previous product carbon or quote', async () => {
    const save = renderPanel();
    await selectUbp();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]).toEqual([
      'wall:ground',
      {
        material: 'UBP — blocks and basalt aggregates',
        origin: 'mauritius',
        sources: ['https://www.ubp.mu/'],
        carbon: null,
        cost: null,
      },
    ]);
    expect(host.textContent).toContain(
      'Previous carbon, quote and environmental analysis need new evidence',
    );
  });
  it('retains current evidence when the same material reference is selected again', async () => {
    const save = renderPanel(original({ material: 'UBP — blocks and basalt aggregates' }));
    await selectUbp();
    expect(save.mock.calls[0][1].sources).toEqual([
      'https://www.ubp.mu/',
      'https://example.org/original-product',
    ]);
    expect(save.mock.calls[0][1]).not.toHaveProperty('carbon');
    expect(save.mock.calls[0][1]).not.toHaveProperty('cost');
    expect(save.mock.calls[0][1]).not.toHaveProperty('analysis');
  });
  it('refuses reference overflow rather than silently dropping existing evidence', async () => {
    const save = renderPanel(
      original({
        material: 'UBP — blocks and basalt aggregates',
        sources: Array.from({ length: 12 }, (_, i) => `https://example.org/source-${i}`),
      }),
    );
    await selectUbp();
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('none were discarded');
  });
  it('keeps the surface scenario while modifying or clearing moisture evidence', async () => {
    const component = original(),
      save = renderPanel(component);
    set('airTempC', '28');
    set('rateEvidenceUrl', '');
    await submit();
    expect(save.mock.calls[0][1].analysis).toMatchObject({
      airTempC: 28,
      surface: component.analysis!.surface,
    });
    expect(save.mock.calls[0][1].analysis).not.toHaveProperty('rateEvidenceUrl');
  });
  it('keeps moisture data while explicitly replacing the surface scenario', async () => {
    const save = renderPanel();
    await button('Surface technologies');
    set('areaM2', '20');
    await submit();
    expect(save.mock.calls[0][1].analysis).toMatchObject({
      airTempC: 30,
      rateEvidenceUrl: 'https://example.org/original-drying',
      surface: { areaM2: 20, id: 'wall:ground', kind: 'moss' },
    });
  });
  it('does not submit disabled environmental forms or save zeroes from omitted disabled inputs', async () => {
    const save = renderPanel(original(), false);
    await submit();
    expect(save).not.toHaveBeenCalled();
    await button('Surface technologies');
    await submit();
    expect(save).not.toHaveBeenCalled();
  });
});
