/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConstructionPitchPage from '../ConstructionPitchPage';
import { CONSTRUCTION_MEETING_URL, MATERIALS_NOTE, PENDING_CONSTRUCTION_SHOTS, STARTING_POINT } from '../constructionWorkflow';
import { MEETING_URL } from '../workflowModel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); act(() => root.render(<ConstructionPitchPage />)); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const click = (element: HTMLElement) => act(() => element.click());

describe('construction pitch', () => {
  it('uses the live story, the face-to-face meeting, and no prices', () => {
    const text = host.textContent ?? '';
    expect(text).toContain(MATERIALS_NOTE);
    expect(text).toContain('selectable mix ratios, pack sizes and waste');
    expect(text).toContain('alternatives are not counted twice');
    expect(text).toContain('Paint coats change coverage demand');
    expect(text).toContain('The same house, in 2D and in 3D.');
    expect(text).toContain('A plumbing layout for each floor.');
    expect(text).toContain('The electric floor follows the same plan.');
    expect(text).toContain('One reviewable brief for your team.');
    expect(text).toContain('Overlapping concrete is counted once');
    expect(text).toContain('Measure the excavation. Add the concrete.');
    expect(text).toContain('UBP / Premix');
    expect(text).toContain('Shared edges need no redraw');
    expect(text).toContain('returns to your original 2D or 3D view');
    expect(text).toContain('No live inventory is implied');
    expect(text).toContain('it does not design or approve foundations');
    expect(text).toContain('Unresolved overlapping steel is withheld for review');
    expect(text).toContain('Linked routes follow fixture moves and rotation');
    expect(text).toContain('share published outer dimensions in 2D and 3D');
    expect(text).toContain('live co-editing, orders and delivery scheduling require agreed integrations');
    expect(text).toContain(STARTING_POINT);
    expect(text).toContain('Peak Performance Wellness Ltd · based in Tamarin, Mauritius');
    expect(text).toContain('Book a meeting with a Live Demo');
    expect(host.querySelector(`a[href="${CONSTRUCTION_MEETING_URL}"]`)).not.toBeNull();
    expect(CONSTRUCTION_MEETING_URL).not.toBe(MEETING_URL);
    expect(text).not.toMatch(/\bRs\b/);
    expect(text).not.toMatch(/535,?402|1,623|805\.9|1\.68/);
    expect(text).not.toMatch(/(?:MUR|USD|\$|€|£)\s?\d/);
    expect(host.querySelector('a[href="/demo"]')).toBeNull();
    expect(host.querySelector('a[href^="/studio"]')).toBeNull();
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(PENDING_CONSTRUCTION_SHOTS).toHaveLength(8);
  });

  it('shows the four people and only the screenshots that exist', () => {
    expect(host.querySelectorAll('img[alt="Ravi, contractor"]')).toHaveLength(2);
    expect(host.querySelector('img[alt="Leena, quantity surveyor"]')).not.toBeNull();
    expect(host.querySelector('img[alt="Marc, plumber"]')).not.toBeNull();
    expect(host.querySelector('img[alt="Sophie, site manager"]')).not.toBeNull();
    expect(host.querySelector('.c-portrait.is-toned img[alt="Ravi, contractor"]')).not.toBeNull();
    expect(host.querySelector('.c-portrait.is-toned img[alt="Sophie, site manager"]')).not.toBeNull();
    expect(host.querySelector('.c-portrait.is-toned img[alt="Leena, quantity surveyor"]')).toBeNull();
    expect(host.querySelector('source[media="(max-width: 768px)"][srcset="/pitch/construction/shots/house-2d-phone.webp"]')).not.toBeNull();
    expect(host.querySelector('source[srcset="/pitch/construction/shots/house-3d-phone.webp"]')).not.toBeNull();
    expect(host.querySelector('source[srcset="/pitch/construction/shots/materials-phone.webp"]')).not.toBeNull();
    expect(host.querySelector('img[src="/pitch/construction/shots/materials-warning.webp"]')).not.toBeNull();
    expect(host.querySelector('img[src="/pitch/construction/shots/materials-report.webp"]')).not.toBeNull();
    for (const slot of ['plan-import', 'plumbing', 'electric']) {
      const step = host.querySelector(`#${slot} .c-try`);
      expect(step?.querySelector('button')?.textContent).toBe('Try this step');
    }
    expect(host.textContent).not.toContain('screenshot coming');
    const requested = [...host.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    for (const missing of PENDING_CONSTRUCTION_SHOTS) expect(requested).not.toContain(missing);
  });

  it('embeds the live steps with pitch=1 and opens the preview steps in place', () => {
    const frames = [...host.querySelectorAll('iframe')].map((frame) => frame.getAttribute('src'));
    expect(frames).toEqual([
      '/embed/designer?scene=home&view=3d&pitch=1',
      '/embed/designer?scene=home&view=2d&panel=materials&pitch=1',
    ]);
    const house = host.querySelector('#house')!;
    const frame = house.querySelector('iframe')!;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    click(house.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!);
    expect(house.querySelector('iframe')).toBe(frame);
    expect(frame.getAttribute('src')).toContain('pitch=1');
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ view: '2d' }), window.location.origin);
    for (const [id, panel] of [['plan-import', 'import'], ['foundation', 'foundation'], ['plumbing', 'services'], ['electric', 'services']]) {
      const section = host.querySelector(`#${id}`)!;
      click(section.querySelector<HTMLButtonElement>('button')!);
      expect(section.querySelector('iframe')?.getAttribute('src')).toBe(`/demo?view=2d&panel=${panel}&pitch=1`);
    }
  });
});
