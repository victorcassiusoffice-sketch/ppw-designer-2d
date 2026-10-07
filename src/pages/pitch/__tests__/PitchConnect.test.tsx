/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeveloperPitchPage from '../DeveloperPitchPage';
import MerchantPitchPage from '../MerchantPitchPage';
import { PitchEnquiryForm } from '../PitchEnquiryForm';
import { MEETING_URL } from '../workflowModel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function button(text: string) {
  const match = [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.includes(text));
  if (!match) throw new Error(`Missing button ${text}`);
  return match;
}
const click = (text: string) => act(() => button(text).click());
function fill() {
  for (const [name, value] of Object.entries({ name: 'Jane Smith', email: 'jane@example.com', message: 'We want to connect our product catalogue.', location: 'Office in Ebene', availability: 'Monday after 10am' })) {
    const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (input) input.value = value;
  }
  host.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
}
const submit = () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

describe('AI and business presentation', () => {
  it.each([DeveloperPitchPage, MerchantPitchPage])('offers actual screenshots, the working AI demo, merchant setup and meeting/feedback routes', (Page) => {
    act(() => root.render(<Page />)); click('Explore AI automation');
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/showcase/designer-ai.png');
    expect(host.querySelector('h2')?.textContent).toBe('Less repetition. More considered decisions.');
    click('2D plan');
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/showcase/designer-plan.webp');
    click('Premium 3D');
    expect(host.textContent).toContain('Guided drafts work locally');
    expect(host.textContent).toContain('AI drafting needs sign-in and a configured provider');
    click('Try the AI workspace');
    const frame = host.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d&panel=ai');
    click('2D plan'); expect(host.querySelector('iframe')).toBe(frame);
    click('2 · Connect');
    expect(host.textContent).toContain('Tools that connect');
    expect(host.textContent).not.toContain('Automation, with clear boundaries');
    expect(host.querySelector('a[href="/studio/merchants/connect"]')).not.toBeNull();
    expect(host.textContent).toContain('MCP tool access');
    expect(host.textContent).toContain('Import the JSON, review it, then apply it');
    expect(host.textContent).toContain('require agreed supplier integrations');
    click('Feedback & meetings');
    expect(host.querySelector('form')).not.toBeNull();
    expect(host.querySelector(`a[href="${MEETING_URL}"]`)).not.toBeNull();
    click('Meet in person');
    expect(host.querySelector<HTMLInputElement>('[name="location"]')?.required).toBe(true);
    expect(host.querySelector('input[type="file"]')).toBeNull();
  });
});

describe('pitch form persistence', () => {
  it('submits an in-person request with explicit consent and only confirms a server receipt', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ receipt: 'PPW-42', status: 'received' }) }); vi.stubGlobal('fetch', fetcher);
    act(() => root.render(<PitchEnquiryForm audience="merchants" />)); click('Meet in person'); fill(); await submit();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('/api/pitch-enquiry');
    expect(JSON.parse(options.body)).toMatchObject({ audience: 'merchants', purpose: 'physical-meeting', consent: true, location: 'Office in Ebene', email: 'jane@example.com' });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Request saved · PPW-42');
    expect(host.textContent).toContain('only confirmed when a time and place have been agreed');
    expect(button('Request saved').disabled).toBe(true);
  });
  it.each([{ ok: false, json: async () => ({ error: 'Your request could not be saved.' }) }, { ok: true, json: async () => ({ status: 'ok' }) }])('retains entries and offers a download after an unconfirmed submission', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    act(() => root.render(<PitchEnquiryForm audience="developers" />)); fill(); await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Your entries are still here');
    expect(host.querySelector<HTMLInputElement>('[name="email"]')?.value).toBe('jane@example.com');
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(button('Download a copy')).not.toBeNull();
    expect(button('Send project enquiry').disabled).toBe(false);
  });
});
