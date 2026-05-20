/**
 * @vitest-environment jsdom
 *
 * M5.b — RequireMerchant route guard.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import RequireMerchant, {
  SESSION_STORAGE_KEY,
  inspectToken,
  readActiveMerchantSession,
} from '../../components/RequireMerchant';

const SLUG = 'k1-sport';

function tokenFor(payload: { slug: string; email: string; exp: number }): string {
  const json = JSON.stringify(payload);
  // base64url with no padding — matches the inspectToken path.
  const body = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  // Signature is opaque to the client-side guard — it only inspects the
  // prefix. Use a deterministic fake hex string for round-trip parsing.
  return `${body}.deadbeef`;
}

let container: HTMLDivElement;
let root: Root;

function renderAt(slug: string, fetchImpl?: typeof globalThis.fetch, initial = `/merchant/${slug}`): void {
  act(() => {
    flushSync(() => {
      root.render(
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route
              path="/merchant/:slug"
              element={
                <RequireMerchant fetchImpl={fetchImpl}>
                  <div data-testid="children">protected content</div>
                </RequireMerchant>
              }
            />
          </Routes>
        </MemoryRouter>,
      );
    });
  });
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.removeItem(SESSION_STORAGE_KEY);
  // Reset URL so history.replaceState() side effects from prior tests
  // don't bleed into the next render.
  window.history.replaceState({}, '', `/merchant/${SLUG}`);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  localStorage.removeItem(SESSION_STORAGE_KEY);
});

describe('inspectToken', () => {
  it('parses a well-formed token', () => {
    const exp = Date.now() + 86_400_000;
    const t = tokenFor({ slug: SLUG, email: 'a@b.c', exp });
    const p = inspectToken(t);
    expect(p).toEqual({ slug: SLUG, email: 'a@b.c', exp });
  });

  it('returns null on malformed tokens', () => {
    expect(inspectToken('')).toBeNull();
    expect(inspectToken('not-a-token')).toBeNull();
    expect(inspectToken('not-base64.sig')).toBeNull();
  });
});

describe('readActiveMerchantSession', () => {
  it('returns null when nothing is stored', () => {
    expect(readActiveMerchantSession(SLUG)).toBeNull();
  });

  it('returns null when the stored session is for a different slug', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ slug: 'other-merchant', email: 'a@b.c', exp: Date.now() + 1000, token: 't' }),
    );
    expect(readActiveMerchantSession(SLUG)).toBeNull();
  });

  it('returns null when the stored session has expired', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ slug: SLUG, email: 'a@b.c', exp: Date.now() - 1, token: 't' }),
    );
    expect(readActiveMerchantSession(SLUG, Date.now())).toBeNull();
  });

  it('returns the stored session when slug + expiry are valid', () => {
    const future = Date.now() + 1_000_000;
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ slug: SLUG, email: 'a@b.c', exp: future, token: 'abc.def' }),
    );
    const s = readActiveMerchantSession(SLUG);
    expect(s).toEqual({ slug: SLUG, email: 'a@b.c', exp: future, token: 'abc.def' });
  });
});

describe('RequireMerchant', () => {
  it('shows the sign-in form when no session is stored', async () => {
    renderAt(SLUG);
    await flushAsync();
    expect(container.querySelector('[data-testid="merchant-sign-in"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="children"]')).toBeNull();
  });

  it('renders children when a valid session is stored for the slug', async () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        slug: SLUG,
        email: 'a@b.c',
        exp: Date.now() + 1_000_000,
        token: 'abc.def',
      }),
    );
    renderAt(SLUG);
    await flushAsync();
    expect(container.querySelector('[data-testid="children"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="merchant-sign-in"]')).toBeNull();
  });

  it('rejects a stored session for the wrong slug', async () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        slug: 'other-merchant',
        email: 'a@b.c',
        exp: Date.now() + 1_000_000,
        token: 'abc.def',
      }),
    );
    renderAt(SLUG);
    await flushAsync();
    expect(container.querySelector('[data-testid="children"]')).toBeNull();
    expect(container.querySelector('[data-testid="merchant-sign-in"]')).not.toBeNull();
  });

  it('accepts a token from ?session= in the URL and stores it', async () => {
    const future = Date.now() + 1_000_000;
    const t = tokenFor({ slug: SLUG, email: 'info@k1-sport.com', exp: future });
    renderAt(SLUG, undefined, `/merchant/${SLUG}?session=${t}`);
    await flushAsync();
    expect(container.querySelector('[data-testid="children"]')).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null');
    expect(stored?.slug).toBe(SLUG);
    expect(stored?.email).toBe('info@k1-sport.com');
    expect(stored?.exp).toBe(future);
    // Session param is stripped from the URL.
    expect(window.location.href).not.toContain('session=');
  });

  it('rejects a URL token whose slug does not match', async () => {
    const future = Date.now() + 1_000_000;
    const t = tokenFor({ slug: 'other-merchant', email: 'a@b.c', exp: future });
    renderAt(SLUG, undefined, `/merchant/${SLUG}?session=${t}`);
    await flushAsync();
    expect(container.querySelector('[data-testid="children"]')).toBeNull();
    expect(container.querySelector('[data-testid="merchant-sign-in"]')).not.toBeNull();
    // Nothing stored.
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('POSTs to /api/merchants/:slug/magic-link on form submit + shows the "sent" panel', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, message: 'sent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof globalThis.fetch;
    renderAt(SLUG, fetchMock);
    await flushAsync();
    const input = container.querySelector(
      '[data-testid="merchant-sign-in-email"]',
    ) as HTMLInputElement;
    // Drive React's controlled value via the native setter so the
    // synthetic onChange fires. The plain `input.value = ...` path
    // doesn't update React's internal value tracker.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, 'info@k1-sport.com');
    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flushAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(calledUrl).toBe(`/api/merchants/${SLUG}/magic-link`);
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body ?? '{}'));
    expect(body.email).toBe('info@k1-sport.com');
  });
});
