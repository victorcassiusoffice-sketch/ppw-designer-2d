/**
 * useEnergyReport — the balance re-derives when the merchant catalog lands
 * (electrics audit E-01), and the "add N panels" hint names a panel the
 * catalog actually sells (E-06).
 *
 * E-01 reproduction: on production every merchant product is `m-<dbId>`,
 * resolved through `apiCatalogAdapter`'s module cache, which fills after the
 * plan has loaded and then bumps `useCatalogStore`. Before the fix the memo
 * depended on `rooms` only, so a reloaded K1 gym read "⚡ 0 Wh".
 *
 * Raw react-dom/client render pattern (no @testing-library), as
 * RoomEstimatePanel.test.tsx.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { useCatalogStore } from '../../store/catalogStore';
import { __setApiProductForTests, apiProductToProduct, type ApiProductSummary } from '../../data/apiCatalogAdapter';
import { getAllProducts } from '../../data/products';
import { MAURITIUS_SOLAR } from '../../data/mauritiusSolar';
import { coverPanelFromCatalog, defaultCoverPanel, energyReportForProperty, useEnergyReport } from '../useEnergyReport';
import { meterReading } from '../energyMeter';

const RECT = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 5 },
  { x: 0, y: 5 },
];

function seed(items: Array<{ instanceId: string; productId: string }>): void {
  const property: Property = {
    id: 'p',
    name: 'T',
    activeRoomId: 'r1',
    rooms: [{ id: 'r1', name: 'Gym', polygon: RECT, placedItems: items.map((i) => ({ ...i, x: 1, y: 1, rotation: 0 })) }],
  };
  usePropertyStore.setState({ property });
}

function merchantRow(over: Partial<ApiProductSummary> = {}): ApiProductSummary {
  return {
    id: 1,
    sku: 'K1-NT-2450',
    name: 'NordicTrack Commercial 2450 Treadmill',
    category: 'fitness',
    description: null,
    widthMm: 2000,
    depthMm: 900,
    heightMm: 1500,
    weightG: 150000,
    priceMinor: 12000000,
    currency: 'MUR',
    imageUrl: null,
    region: 'MU',
    ...over,
  };
}

function Probe(): JSX.Element {
  const r = useEnergyReport();
  return <div data-testid="probe" data-consumers={r.consumers.length} data-load={r.loadWhDay} data-status={r.status} />;
}

let container: HTMLDivElement;
let root: Root;
function probe(): HTMLElement {
  return container.querySelector('[data-testid="probe"]') as HTMLElement;
}

beforeEach(() => {
  __setApiProductForTests('m-1', null);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  __setApiProductForTests('m-1', null);
});

describe('useEnergyReport re-derives when the merchant catalog lands (E-01)', () => {
  it('a plan of m-<id> items reads 0 until the cache fills AND the catalog store bumps', () => {
    seed([{ instanceId: 'i1', productId: 'm-1' }]);
    act(() => {
      flushSync(() => {
        root.render(<Probe />);
      });
    });
    // The plan loaded before /api/products answered: nothing resolves.
    expect(probe().dataset.consumers).toBe('0');
    expect(probe().dataset.load).toBe('0');
    expect(probe().dataset.status).toBe('none');

    // The rows arrive in the module cache — nothing has told React, exactly
    // the production sequence — and the memo still says 0.
    __setApiProductForTests('m-1', apiProductToProduct(merchantRow()));
    expect(probe().dataset.consumers).toBe('0');

    // fetchApiProducts bumps the catalog store after its loop; that is the
    // signal the hook must listen to.
    act(() => {
      useCatalogStore.getState().bump();
    });
    expect(probe().dataset.consumers).toBe('1');
    // Home treadmill row: 350 W × 1 h.
    expect(probe().dataset.load).toBe('350');
    expect(probe().dataset.status).toBe('short');
  });

  it('the pure report sees a cached merchant product straight away', () => {
    __setApiProductForTests('m-1', apiProductToProduct(merchantRow()));
    seed([{ instanceId: 'i1', productId: 'm-1' }]);
    const r = energyReportForProperty(usePropertyStore.getState().property);
    expect(r.consumers).toHaveLength(1);
    expect(r.consumers[0]).toMatchObject({ productId: 'm-1', powerW: 350, referenceKey: 'treadmill' });
  });
});

describe('the "add N panels" hint names a panel in the catalog (E-06)', () => {
  it('picks the largest roof product in the seed: the Jinko 475 W, 1.903 × 1.134 m', () => {
    expect(coverPanelFromCatalog(getAllProducts())).toEqual({ wp: 475, areaM2: 2.16 });
    expect(defaultCoverPanel()).toEqual({ wp: 475, areaM2: 2.16 });
  });

  it('falls back to the Mauritius reference panel when the catalog has no roof product', () => {
    expect(coverPanelFromCatalog([])).toEqual({ wp: MAURITIUS_SOLAR.defaultPanelWp, areaM2: MAURITIUS_SOLAR.defaultPanelAreaM2 });
    const noRoof = getAllProducts().filter((p) => p.placement !== 'roof' && !(p.category === 'solar' && (p.pv_wp ?? 0) > 0));
    expect(coverPanelFromCatalog(noRoof).wp).toBe(450);
  });

  it('a plan with a treadmill and no panels is told to add the 475 W panel', () => {
    seed([{ instanceId: 't1', productId: 'k1-nordictrack-2450' }]);
    const r = energyReportForProperty(usePropertyStore.getState().property);
    expect(r.coverPanelWp).toBe(475);
    // 350 Wh/day against 475 × 5.17 × 0.775 ≈ 1903 Wh per panel → one panel.
    expect(r.panelsToCover).toBe(1);
    expect(meterReading(r).action).toBe('1 × 475 W panel on the roof would cover it — they are in the Eco tab.');
  });
});
