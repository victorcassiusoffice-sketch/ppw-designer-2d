/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConstructionPitchPage from '../ConstructionPitchPage';
import {
  ECO_CHAPTERS,
  ECO_LOGISTICS,
  ECO_ROLES,
  ECO_TOOLS,
  ecoSharePath,
  readEcoConfig,
} from '../ecoCityPitchModel';
import { MEETING_URL } from '../workflowModel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.history.replaceState({}, '', '/pitch/construction');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});
const render = () => act(() => root.render(<ConstructionPitchPage />));
const click = (element: HTMLElement) => act(() => element.click());
const chapter = (index: number) =>
  click(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]);
function button(text: string) {
  const value = [...host.querySelectorAll('button')].find((node) =>
    node.textContent?.includes(text),
  );
  if (!value) throw new Error(`Missing: ${text}`);
  return value;
}

describe('guided construction and eco-city presentation', () => {
  it('keeps every chapter a presentation without project writes or an embedded editor', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    render();
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(ECO_CHAPTERS.length);
    for (let index = 0; index < ECO_CHAPTERS.length; index++) {
      chapter(index);
      expect(host.querySelector('iframe')).toBeNull();
      expect(
        host.querySelector('a[href^="/demo"], a[href^="/designer"], a[href^="/studio"]'),
      ).toBeNull();
      expect(host.textContent).not.toMatch(/(?:Rs|MUR|USD|\$|€|£)\s?\d/);
      expect(host.textContent).toContain('no orders or project writes');
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(host.querySelector(`a[href="${MEETING_URL}"]`)).not.toBeNull();
    expect(host.querySelector('[data-testid="eco-chapter-stage"]')).not.toBeNull();
  });
  it('supports arrow/home/end chapter navigation with the correct selected panel', () => {
    render();
    const first = host.querySelector<HTMLButtonElement>('[role="tab"]')!;
    act(() => {
      first.focus();
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    const selected = host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
    expect(selected.textContent).toContain('Your pilot');
    expect(document.activeElement).toBe(selected);
    expect(host.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
      selected.id,
    );
    act(() =>
      selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(host.querySelector('h1')?.textContent).toContain('One place.');
  });
  it('keeps measured tool scope and professional limits beside each actual app capture', () => {
    render();
    chapter(1);
    for (const tool of ECO_TOOLS) {
      click(button(tool.name));
      expect(host.querySelector('.eco-tool-copy')?.textContent).toContain(tool.takeoff);
      expect(host.querySelector('.eco-tool-copy')?.textContent).toContain(tool.limit);
      expect(host.querySelector('.eco-capture img')?.getAttribute('src')).toBe(
        `/pitch/eco-city/${tool.shot}.webp`,
      );
    }
  });
  it('propagates one rehearsal revision across all role stations without asserting cloud activation', () => {
    render();
    chapter(2);
    click(button('Rehearse a design change'));
    for (const role of ECO_ROLES) {
      click(button(role.title));
      expect(host.querySelector('.eco-role-station')?.textContent).toContain(role.action);
      expect(host.querySelector('.eco-role-station')?.textContent).toContain('Revision 2');
    }
    expect(host.querySelectorAll('.eco-role-orbit small')).toHaveLength(6);
    expect(
      [...host.querySelectorAll('.eco-role-orbit small')].every(
        (node) => node.textContent === 'Revision 2 to review',
      ),
    ).toBe(true);
    expect(host.textContent).toContain('need cloud activation');
    click(button('Reset example'));
    expect(host.querySelector('.eco-topology-hub')?.textContent).toContain('revision 1');
  });
  it('explains logistical dependencies, recipient planning and manual dispatch boundary', () => {
    render();
    chapter(3);
    for (const step of ECO_LOGISTICS) {
      click(
        [...host.querySelectorAll<HTMLButtonElement>('.eco-flow button')].find((node) =>
          node.textContent?.includes(step.title),
        )!,
      );
      expect(host.querySelector('.eco-logistics-detail')?.textContent).toContain(step.input);
      expect(host.querySelector('.eco-logistics-detail')?.textContent).toContain(step.gate);
    }
    expect(host.textContent).toContain('chosen recipient emails');
    expect(host.textContent).toContain('Orders, invoices and email dispatch are not automated');
  });
  it('demonstrates AI review locally and retains the eco-evidence limits', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    render();
    chapter(4);
    click(button('Show an example proposal'));
    expect(host.textContent).toContain('scripted presentation text');
    click(button('Review the example'));
    expect(host.textContent).toContain('No design, supplier order or approval was changed');
    click(button('Local / import'));
    expect(host.textContent).toContain('local manufacture is not assumed');
    click(button('Tropical climate'));
    expect(host.textContent).toContain('not a whole-building hygrothermal simulation');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses supplier references with dimensions, without prices or claims of manufacturer CAD', () => {
    render();
    chapter(5);
    expect(host.textContent).toContain('Courts Mammouth');
    expect(host.textContent).toContain('Espace Maison');
    expect(host.textContent).toContain('230 × 94 × 94 cm');
    expect(host.textContent).toContain('114 × 67 × 87 cm');
    expect(host.textContent).toContain('not manufacturer CAD');
    expect(host.querySelectorAll('.eco-product-cards a')).toHaveLength(2);
  });
  it('loads customization safely and shares only public presentation fields', () => {
    const config = {
      company: 'Île & Co',
      project: 'Coastal district',
      scenario: 'Mixed-use district',
      audience: 'Developer',
      theme: 'ocean',
    } as const;
    window.history.replaceState(
      {},
      '',
      ecoSharePath(config) + '&email=private%40example.test&token=secret',
    );
    render();
    expect(host.textContent).toContain('Île & Co');
    expect(host.textContent).toContain('Mixed-use district');
    click(button('Personalise'));
    expect(host.querySelector('[data-testid="eco-customization"]')).not.toBeNull();
    click(button('Done'));
    chapter(6);
    click(button('Share this version'));
    const value = host.querySelector<HTMLInputElement>('.eco-share input')!.value;
    expect(readEcoConfig(new URL(value).search)).toEqual(config);
    expect(value).not.toContain('email=');
    expect(value).not.toContain('token=');
    expect(value).not.toContain('secret');
    expect(
      readEcoConfig('?company=' + 'a'.repeat(500) + '&scenario=javascript:test').company,
    ).toHaveLength(80);
    expect(readEcoConfig('?scenario=javascript:test').scenario).toBe('Eco neighbourhood');
  });
});
