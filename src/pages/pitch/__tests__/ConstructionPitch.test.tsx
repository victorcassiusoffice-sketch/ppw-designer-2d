/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConstructionPitchPage from '../ConstructionPitchPage';
import { constructionDeliveryStudy } from '../constructionWorkflow';
import { MEETING_URL } from '../workflowModel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); act(() => root.render(<ConstructionPitchPage />)); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const click = (element: HTMLElement) => act(() => element.click());
const chapter = (index: number) => click(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]);
function button(text: string) {
  const item = [...host.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent?.includes(text));
  if (!item) throw new Error(`Button missing: ${text}`);
  return item;
}

describe('construction pitch', () => {
  it('clearly identifies an independent pitch with actual app capture and a meeting link', () => {
    expect(host.textContent).toContain('not an official UBP platform');
    expect(host.querySelector('.pitch-app-capture img')?.getAttribute('src')).toBe('/showcase/designer-3d.webp');
    expect(host.querySelector(`a[href="${MEETING_URL}"]`)).not.toBeNull();
    expect(host.querySelector('form')).toBeNull();
  });
  it('opens Materials inside the real protected demo and preserves the iframe when switching views', () => {
    chapter(1);
    const frame = host.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d&panel=materials');
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    click(button('2D · to scale'));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ view: '2d' }), window.location.origin);
    expect(host.textContent).toContain('no orders or payments');
  });
  it('shows traceable block dimensions and distinguishes reinforced detailing from a structural frame', () => {
    chapter(2);
    expect(host.querySelector('.construction-dimension')?.textContent).toContain('450 × 200 × 150');
    expect(host.textContent).toContain('Switch to nominal');
    click(button('U Block & Corner Block'));
    expect(host.textContent).toContain('not interchangeable with a designed reinforced concrete frame');
    expect(host.querySelector('a[href="https://ubp.mu/sites/default/files/dta_vf_6.pdf"]')).not.toBeNull();
  });
  it('keeps release a workflow study rather than an order action', () => {
    chapter(3); click(button('Authorized release'));
    expect(host.textContent).toContain('does not create an order');
    expect(host.textContent).toContain('2026-11-16');
    expect(host.textContent).toContain('Unconfirmed · not a booking');
    expect(host.querySelector('form')).toBeNull();
  });
});

describe('construction calendar study', () => {
  it('counts calendar days across month and year boundaries and rounds partial lead days up', () => {
    expect(constructionDeliveryStudy('2027-01-05', 7.5)).toEqual({ delivery: '2027-01-05', release: '2026-12-28', review: '2026-12-26' });
    expect(constructionDeliveryStudy('2026-11-30', 30)?.release).toBe('2026-10-31');
  });
  it('rejects impossible dates and invalid lead times instead of inventing a schedule', () => {
    expect(constructionDeliveryStudy('2026-02-30', 14)).toBeNull();
    for (const days of [-1, Number.NaN, Infinity, 366]) expect(constructionDeliveryStudy('2026-11-30', days)).toBeNull();
    expect(constructionDeliveryStudy('', 14)).toBeNull();
  });
});
