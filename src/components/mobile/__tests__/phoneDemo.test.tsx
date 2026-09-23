/**
 * Phone pass (2026-09-16) — what Vic hit on his phone with the Sofap demo.
 *
 *   1. MobileProductPopup closed itself: the scrim listened for `click`, and
 *      a finger fires a compatibility click ~1 ms after the tap that opened
 *      the popup, by which time the scrim is under the finger. It now closes
 *      on a fresh pointerdown (a new gesture) and ignores that click.
 *   2. SimsBottomToolbar folds to its category row when a FURNISHED plan
 *      arrives on a phone (the demo show flat), and a category tap unfolds.
 *   3. WallPaintHudColourStrip puts the brand's shades in the HUD and sets
 *      the tint on the brush; a white-only line renders no strip.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MobileProductPopup } from '../MobileProductPopup';
import { SimsBottomToolbar } from '../SimsBottomToolbar';
import { WallPaintHudColourStrip } from '../WallPaintHudColourStrip';
import { getAllProducts } from '../../../data/products';
import { usePropertyStore } from '../../../store/propertyStore';
import { useDesignerUIStore } from '../../../store/designerUIStore';
import { buildSofapShowFlat } from '../../../demo/sofap';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // Keep plan auto-fold coverage independent of the app's 3D starting view.
  useDesignerUIStore.setState({ viewMode: 'plan' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** jsdom has no matchMedia; the phone tier is whatever this says. */
function stubPhone(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('MobileProductPopup — scrim closes on a new gesture, not on the tap that opened it', () => {
  const product = getAllProducts()[0];

  it('ignores a click on the scrim and closes on a pointerdown there', () => {
    const onClose = vi.fn();
    act(() => {
      flushSync(() =>
        root.render(<MobileProductPopup product={product} onAdd={vi.fn()} onDragPlace={vi.fn()} onClose={onClose} />),
      );
    });
    const scrim = container.querySelector('[data-testid="mobile-product-popup"]') as HTMLElement;
    // The browser's compatibility click after the opening tap lands here.
    act(() => {
      scrim.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      scrim.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a pointerdown inside the card does not close it', () => {
    const onClose = vi.fn();
    act(() => {
      flushSync(() =>
        root.render(<MobileProductPopup product={product} onAdd={vi.fn()} onDragPlace={vi.fn()} onClose={onClose} />),
      );
    });
    const addBtn = container.querySelector('[data-testid="popup-add-to-room"]') as HTMLElement;
    act(() => {
      addBtn.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    act(() => {
      flushSync(() =>
        root.render(<MobileProductPopup product={product} onAdd={vi.fn()} onDragPlace={vi.fn()} onClose={onClose} />),
      );
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SimsBottomToolbar — a furnished plan opens folded on a phone', () => {
  const initialProperty = usePropertyStore.getState().property;
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    usePropertyStore.getState().loadProperty(initialProperty);
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia });
  });

  it('folds to the category row for the Sofap show flat and a category tap unfolds it', async () => {
    stubPhone(true);
    usePropertyStore.getState().loadProperty(buildSofapShowFlat());
    act(() => {
      flushSync(() => root.render(<SimsBottomToolbar />));
    });
    await flushAsync();
    expect(container.querySelector('[data-testid="sims-thumb-strip"]')).toBeNull();
    const minBtn = container.querySelector('[data-testid="sims-toolbar-minimize"]') as HTMLButtonElement;
    expect(minBtn.getAttribute('aria-expanded')).toBe('false');
    const cardio = container.querySelector('[data-testid="sims-cat-cardio"]') as HTMLButtonElement;
    act(() => cardio.click());
    expect(container.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
  });

  it('stays open on a blank plan on a phone, and on a furnished plan at md+', async () => {
    stubPhone(true);
    act(() => {
      flushSync(() => root.render(<SimsBottomToolbar />));
    });
    await flushAsync();
    expect(container.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);

    stubPhone(false);
    usePropertyStore.getState().loadProperty(buildSofapShowFlat());
    act(() => {
      flushSync(() => root.render(<SimsBottomToolbar />));
    });
    await flushAsync();
    expect(container.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
  });
});

describe('WallPaintHudColourStrip — colours on the plan', () => {
  const setDraft = (patch: Parameters<ReturnType<typeof useDesignerUIStore.getState>['setWallPaintDraft']>[0]) =>
    act(() => useDesignerUIStore.getState().setWallPaintDraft(patch));

  afterEach(() => {
    setDraft({ paintId: 'permoglaze-matt-emulsion', colourHex: undefined, colourName: undefined, erase: false });
  });

  it('lists base white + the brand shades for a tintable line and sets the tint on the brush', () => {
    setDraft({ paintId: 'permoglaze-matt-emulsion', colourHex: undefined, colourName: undefined });
    act(() => {
      flushSync(() => root.render(<WallPaintHudColourStrip />));
    });
    expect(container.querySelector('[data-testid="wallpaint-hud-colours"]')).not.toBeNull();
    const base = container.querySelector('[data-testid="wallpaint-hud-colour-base"]') as HTMLButtonElement;
    expect(base.getAttribute('aria-checked')).toBe('true');
    const chips = container.querySelectorAll('[data-testid^="wallpaint-hud-colour-sofap-"]');
    expect(chips.length).toBeGreaterThan(10);
    // Every chip is a 40 px control (the phone floor).
    for (const c of chips) expect(c.className).toContain('h-10 w-10');
    const haze = container.querySelector('[data-testid="wallpaint-hud-colour-sofap-alc-morning-haze"]') as HTMLButtonElement;
    act(() => haze.click());
    const draft = useDesignerUIStore.getState().wallPaintDraft;
    expect(draft.colourHex).toBe('#EDEBDF');
    expect(draft.colourName).toBe('Morning Haze');
    expect(draft.erase).toBe(false);
    expect(haze.getAttribute('aria-checked')).toBe('true');
    // Base white takes the tint off again.
    act(() => base.click());
    expect(useDesignerUIStore.getState().wallPaintDraft.colourHex).toBeUndefined();
  });

  it('renders nothing for a white-only line', () => {
    setDraft({ paintId: 'permoglaze-xtreme-white', colourHex: undefined, colourName: undefined });
    act(() => {
      flushSync(() => root.render(<WallPaintHudColourStrip />));
    });
    expect(container.querySelector('[data-testid="wallpaint-hud-colours"]')).toBeNull();
  });

  it('"More" asks for the sheet at the paint section', () => {
    setDraft({ paintId: 'permoglaze-soft-feel' });
    const seen: string[] = [];
    const onOpen = (e: Event) => seen.push((e as CustomEvent<{ section: string }>).detail.section);
    window.addEventListener('ppw:open-menu', onOpen);
    act(() => {
      flushSync(() => root.render(<WallPaintHudColourStrip />));
    });
    const more = container.querySelector('[data-testid="wallpaint-hud-colour-more"]') as HTMLButtonElement;
    act(() => more.click());
    window.removeEventListener('ppw:open-menu', onOpen);
    expect(seen).toEqual(['wallpaint']);
  });
});
