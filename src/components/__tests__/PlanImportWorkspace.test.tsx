/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PlanImportWorkspace } from '../PlanImportWorkspace';
import { normaliseLoadedProperty, usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useHistoryStore } from '../../store/historyStore';
import { switchToPage } from '../../lib/pages';
import { createGuidedDesign } from '../../designer/aiDesignContract';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const beforeOpen = vi.fn();
const click = (text: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button, text).toBeDefined();
  act(() => button!.click());
};
const open = () => act(() => window.dispatchEvent(new Event('ppw:open-plan-import')));
const ack = () =>
  act(() => document.querySelector<HTMLInputElement>('.plan-import-ack input')!.click());
async function file(value: {
  name: string;
  size: number;
  text: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [value], configurable: true });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
beforeEach(() => {
  localStorage.clear();
  usePropertyStore.getState().resetToDefault();
  useDesignsStore.setState({ designs: {}, currentId: null });
  useHistoryStore.getState().reset();
  usePropertyStore.getState().renameProperty('Existing measured house');
  usePropertyStore.getState().setRoomPolygon(usePropertyStore.getState().property.activeRoomId, [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 5 },
    { x: 0, y: 5 },
  ]);
  useDesignerUIStore.getState().setViewMode('3d');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<PlanImportWorkspace onBeforeOpen={beforeOpen} />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

describe('review-and-apply plan import', () => {
  it('opens a fullscreen local review and Escape returns without changing the canvas', () => {
    const previous = usePropertyStore.getState().property;
    open();
    expect(host.hasAttribute('inert')).toBe(true);
    click('Try an example');
    expect(beforeOpen).toHaveBeenCalled();
    expect(document.querySelector('[aria-label="Imported geometry preview"]')).not.toBeNull();
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('Add as a new plan'),
      )?.disabled,
    ).toBe(true);
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(host.hasAttribute('inert')).toBe(false);
    expect(usePropertyStore.getState().property).toBe(previous);
  });
  it('adds two floors as an editable new page and preserves the previous unsaved drawing', () => {
    const previous = structuredClone(usePropertyStore.getState().property);
    open();
    click('Try an example');
    ack();
    click('Add as a new plan →');
    const property = usePropertyStore.getState().property;
    expect(property.name).toBe('Two-storey example');
    expect(property.rooms.filter((r) => r.polygon.length >= 3)).toHaveLength(3);
    expect(property.levels?.filter((l) => l.kind !== 'roof')).toHaveLength(2);
    expect(property.rooms[0].polygon[1].x).toBe(5);
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    expect(useHistoryStore.getState().past).toEqual([]);
    const saved = useDesignsStore
      .getState()
      .list()
      .find((p) => p.property.id === previous.id);
    expect(saved).toBeDefined();
    act(() => {
      switchToPage(saved!.id);
    });
    expect(usePropertyStore.getState().property.rooms).toEqual(
      normaliseLoadedProperty(previous).rooms,
    );
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('requires renewed acknowledgement after the scale or layer choice changes', () => {
    open();
    click('Try an example');
    ack();
    const select = document.querySelector<HTMLSelectElement>('.plan-import-settings-card select')!;
    act(() => {
      select.value = 'cm';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.querySelector<HTMLInputElement>('.plan-import-ack input')?.checked).toBe(false);
    expect(document.querySelector('.plan-import-facts')?.textContent).toContain('5200.0 m²');
  });
  it('invalidates an existing review when an unsupported or oversized file is chosen', async () => {
    open();
    click('Try an example');
    ack();
    await file({ name: 'house.rvt', size: 12, text: vi.fn() });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('not supported');
    expect(document.querySelector('.plan-import-ack')).toBeNull();
    await file({ name: 'huge.dxf', size: 2_000_001, text: vi.fn() });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('2 MB');
    expect(usePropertyStore.getState().property.name).toBe('Existing measured house');
  });
  it('accepts validated Designer draft JSON and rejects arbitrary property JSON', async () => {
    open();
    await file({
      name: 'proposal.json',
      size: 100,
      text: async () => JSON.stringify(createGuidedDesign({ bedrooms: 1 })),
    });
    expect(document.querySelector('[role=alert]')).toBeNull();
    expect(document.querySelector('.plan-import-ack')).not.toBeNull();
    await file({
      name: 'random.json',
      size: 100,
      text: async () => JSON.stringify({ rooms: [], id: 'unvalidated' }),
    });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Designer draft JSON');
    expect(document.querySelector('.plan-import-ack')).toBeNull();
  });
  it('opens a whole design file as a new plan, keeps every placed thing and the plan on screen', async () => {
    const previous = structuredClone(usePropertyStore.getState().property);
    // A design as this app keeps it, and as the desktop game saves it: with a thing of a merchant's product,
    // which this catalogue has not read from the server.
    const design = {
      id: 'saved-by-the-game',
      name: 'House from the game',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Living room',
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 4 },
            { x: 0, y: 4 },
          ],
          placedItems: [{ instanceId: 'thing00001', productId: 'm-903', x: 1, y: 1, rotation: 90 }],
        },
        {
          id: 'r2',
          name: 'Bedroom',
          polygon: [
            { x: 6, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 4 },
            { x: 6, y: 4 },
          ],
          placedItems: [],
        },
      ],
    };
    open();
    await file({ name: 'house.json', size: 900, text: async () => JSON.stringify(design) });
    expect(document.querySelector('[role=alert]')).toBeNull();
    expect(document.querySelector('.plan-import-review-heading h2')?.textContent).toBe(
      'House from the game',
    );
    const words = document.querySelector('[role=dialog]')?.textContent ?? '';
    expect(words).toContain('A whole design file');
    expect(words).toContain('1 placed thing names a product this catalogue does not have now');
    ack();
    click('Add as a new plan →');
    const property = usePropertyStore.getState().property;
    expect(property.name).toBe('House from the game');
    expect(property.rooms.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(property.rooms[1].polygon[1].x).toBe(10);
    // The thing whose product is not known here is still in the design, as it was saved.
    expect(property.rooms[0].placedItems).toEqual([
      { instanceId: 'thing00001', productId: 'm-903', x: 1, y: 1, rotation: 90 },
    ]);
    expect(useHistoryStore.getState().past).toEqual([]);
    const saved = useDesignsStore
      .getState()
      .list()
      .find((p) => p.property.id === previous.id);
    expect(saved).toBeDefined();
    act(() => {
      switchToPage(saved!.id);
    });
    expect(usePropertyStore.getState().property.name).toBe('Existing measured house');
  });
  it('opens the design inside a project hand-over file and says that its tasks are not opened', async () => {
    open();
    await file({
      name: 'handover.json',
      size: 900,
      text: async () =>
        JSON.stringify({
          tasks: [{ id: 't1', title: 'Order the tiles' }],
          snapshot: {
            id: 'in-a-handover',
            name: 'House in a hand-over',
            activeRoomId: 'r1',
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
                placedItems: [],
              },
            ],
          },
        }),
    });
    expect(document.querySelector('[role=alert]')).toBeNull();
    expect(document.querySelector('.plan-import-review-heading h2')?.textContent).toBe(
      'House in a hand-over',
    );
    expect(document.querySelector('[role=dialog]')?.textContent).toContain(
      'the design in it is opened, its tasks are not',
    );
    expect(usePropertyStore.getState().property.name).toBe('Existing measured house');
  });
  it('says so when a design file is in a newer format, and keeps what it does not know', async () => {
    open();
    await file({
      name: 'newer.json',
      size: 900,
      text: async () =>
        JSON.stringify({
          id: 'from-a-newer-build',
          name: 'House in a newer format',
          activeRoomId: 'r1',
          formatVersion: 3,
          futureDesignField: [{ kind: 'made up', hours: 6 }],
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
              placedItems: [],
            },
          ],
        }),
    });
    expect(document.querySelector('[role=alert]')).toBeNull();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain(
      'written in a newer format (version 3; this app reads version 2)',
    );
    ack();
    click('Add as a new plan →');
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown>;
    expect(property.name).toBe('House in a newer format');
    expect(property.formatVersion).toBe(3);
    expect(property.futureDesignField).toEqual([{ kind: 'made up', hours: 6 }]);
  });
  it('says in words what a design holds that this app keeps and does not show yet', async () => {
    open();
    await file({
      name: 'curved.json',
      size: 900,
      text: async () =>
        JSON.stringify({
          id: 'with-a-curved-wall',
          name: 'House with a curved wall',
          activeRoomId: 'r1',
          formatVersion: 2,
          walls: [{ id: 'w1', a: { x: 1, y: 1 }, b: { x: 3, y: 1 }, thicknessM: 0.1, bulge: 0.5 }],
          members: [{ id: 'm1', role: 'owner' }],
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
              placedItems: [],
            },
          ],
        }),
    });
    expect(document.querySelector('[role=alert]')).toBeNull();
    const review = document.querySelector('[role=dialog]')?.textContent ?? '';
    expect(review).toContain('1 curved wall is kept');
    expect(review).toContain('1 member is named');
    expect(review).not.toContain('written in a newer format');
    ack();
    click('Add as a new plan →');
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown>;
    expect((property.walls as Record<string, unknown>[])[0].bulge).toBe(0.5);
    expect(property.members).toEqual([{ id: 'm1', role: 'owner' }]);
    expect(property.formatVersion).toBe(2);
  });
  it('a building file keeps the floors it names itself, whatever its storeys are called', async () => {
    // Two storeys whose names say nothing of a floor to a reader of English: the upper one holds one wall.
    const ifc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#3=IFCUNITASSIGNMENT((#1));
#10=IFCCARTESIANPOINT((0.,0.,0.));
#13=IFCAXIS2PLACEMENT3D(#10,$,$);
#14=IFCLOCALPLACEMENT($,#13);
#20=IFCBUILDINGSTOREY('1',$,'EG',$,$,#14,$,$,.ELEMENT.,0.);
#21=IFCBUILDINGSTOREY('2',$,'OG',$,$,#14,$,$,.ELEMENT.,3.);
#30=IFCCARTESIANPOINT((0.,0.));
#31=IFCCARTESIANPOINT((6.,0.));
#32=IFCCARTESIANPOINT((6.,4.));
#33=IFCCARTESIANPOINT((0.,4.));
#34=IFCPOLYLINE((#30,#31,#32,#33));
#35=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#34);
#36=IFCEXTRUDEDAREASOLID(#35,#13,$,2.7);
#37=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#36));
#38=IFCPRODUCTDEFINITIONSHAPE($,$,(#37));
#39=IFCSPACE('3',$,'Raum',$,$,#14,#38,$,.ELEMENT.,$,$);
#40=IFCRELAGGREGATES('4',$,$,$,#20,(#39));
#60=IFCCARTESIANPOINT((1.,1.));
#61=IFCCARTESIANPOINT((5.,1.));
#62=IFCPOLYLINE((#60,#61));
#63=IFCSHAPEREPRESENTATION($,'Axis','Curve2D',(#62));
#64=IFCPRODUCTDEFINITIONSHAPE($,$,(#63));
#68=IFCWALLSTANDARDCASE('5',$,'Wand',$,$,#14,#64,$);
#70=IFCRELCONTAINEDINSPATIALSTRUCTURE('6',$,$,$,(#68),#21);
ENDSEC;
END-ISO-10303-21;
`;
    open();
    await file({ name: 'haus.ifc', size: ifc.length, text: async () => ifc });
    expect(document.querySelector('[role=alert]')).toBeNull();
    ack();
    click('Add as a new plan →');
    const property = usePropertyStore.getState().property;
    expect(property.rooms.filter((r) => r.polygon.length >= 3 && !r.levelId)).toHaveLength(1);
    expect(property.walls).toHaveLength(1);
    expect(property.walls![0].levelId).toBe('import-floor-1');
  });

  it('a 3D model comes in as its outline seen from above', async () => {
    const obj =
      'v 0 0 0\nv 6 0 0\nv 6 0 4\nv 0 0 4\nv 0 3 0\nv 6 3 0\nv 6 3 4\nv 0 3 4\n' +
      'f 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 4 8 5 1\n';
    const bytes = new TextEncoder().encode(obj);
    open();
    await file({
      name: 'block.obj',
      size: bytes.length,
      text: async () => obj,
      arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
    });
    expect(document.querySelector('[role=alert]')).toBeNull();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain(
      'Its outline seen from above becomes one room',
    );
    ack();
    click('Add as a new plan →');
    const room = usePropertyStore.getState().property.rooms.find((r) => r.polygon.length >= 3)!;
    const xs = room.polygon.map((p) => p.x);
    const ys = room.polygon.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4, 1);
  });

  it('refuses a design file too large to open, in words', async () => {
    open();
    const room = (i: number) => ({ id: `r${i}`, polygon: [], placedItems: [] });
    await file({
      name: 'city.json',
      size: 900,
      text: async () => JSON.stringify({ rooms: Array.from({ length: 401 }, (_, i) => room(i)) }),
    });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('more than 400 rooms');
    expect(document.querySelector('.plan-import-ack')).toBeNull();
  });
  it('does not let an older asynchronous upload replace the newer example', async () => {
    open();
    let resolve!: (text: string) => void;
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', {
      value: [
        {
          name: 'old.svg',
          size: 20,
          text: () =>
            new Promise<string>((done) => {
              resolve = done;
            }),
        },
      ],
      configurable: true,
    });
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    click('Try an example');
    await act(async () =>
      resolve('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>'),
    );
    expect(document.querySelector('.plan-import-review-heading h2')?.textContent).toBe(
      'Two-storey example',
    );
  });
  it('captures canvas shortcuts and closes when another workspace opens', () => {
    open();
    const behind = vi.fn();
    window.addEventListener('keydown', behind);
    try {
      act(() =>
        document
          .querySelector<HTMLButtonElement>('[aria-label="Back to designer"]')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })),
      );
      expect(behind).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', behind);
    }
    act(() => window.dispatchEvent(new Event('ppw:open-services')));
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
