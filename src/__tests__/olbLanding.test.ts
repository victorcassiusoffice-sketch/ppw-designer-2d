import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware from '../../middleware';
import { isLandingSite, LANDING_HOSTS } from '../../server/olbSite';
import { OLB_AUDIENCES, OLB_DECKS } from '../../server/olbDecks';
import { CODE_ENTRY_HREF, landingPage } from '../../server/olbPages';

afterEach(() => { vi.unstubAllEnvs(); });

const visibleText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ');

describe('onelivebuild.com landing: which addresses get it', () => {
  it('answers on onelivebuild.com and www only in production', () => {
    expect([...LANDING_HOSTS].sort()).toEqual(['onelivebuild.com', 'www.onelivebuild.com']);
    expect(isLandingSite(new URL('https://onelivebuild.com/'), 'production')).toBe(true);
    expect(isLandingSite(new URL('https://www.onelivebuild.com/'), 'production')).toBe(true);
    expect(isLandingSite(new URL('https://OneLiveBuild.com/'), 'production')).toBe(true);
    for (const host of ['designer.ppwellness.co', 'shopbuild.onelivebuild.com', 'ppw-designer-2d.vercel.app', 'onelivebuild.com.evil.example', 'localhost']) {
      expect(isLandingSite(new URL(`https://${host}/`), 'production')).toBe(false);
      expect(isLandingSite(new URL(`https://${host}/`), 'development')).toBe(false);
    }
  });
  it('mirrors onelivebuild.com on a Vercel preview, with ?brand=ppw for the old behaviour', () => {
    expect(isLandingSite(new URL('https://ppw-designer-2d-abc-victor-ppw.vercel.app/'), 'preview')).toBe(true);
    expect(isLandingSite(new URL('https://ppw-designer-2d-abc-victor-ppw.vercel.app/?brand=ppw'), 'preview')).toBe(false);
  });
  it('serves the landing at onelivebuild.com/ without the studio code', async () => {
    for (const url of ['https://onelivebuild.com/', 'https://www.onelivebuild.com/', 'https://onelivebuild.com/?utm=letter']) {
      const response = await middleware(new Request(url));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Who are you?');
      expect(html).not.toContain('Passcode');
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });
  it('leaves designer.ppwellness.co, the shop address and the production alias exactly as before', async () => {
    const ppw = await middleware(new Request('https://designer.ppwellness.co/'));
    expect(await ppw.text()).toContain('Studio access code');
    const shop = await middleware(new Request('https://shopbuild.onelivebuild.com/'));
    const shopHtml = await shop.text();
    expect(shopHtml).toContain('Passcode');
    expect(shopHtml).not.toContain('Who are you?');
    const alias = await middleware(new Request('https://ppw-designer-2d.vercel.app/'));
    expect(await alias.text()).toContain('Studio access code');
    for (const url of ['https://designer.ppwellness.co/admin', 'https://designer.ppwellness.co/decks/developers/', 'https://shopbuild.onelivebuild.com/admin']) {
      const html = await (await middleware(new Request(url))).text();
      expect(html).not.toContain('Who are you?');
      expect(html).not.toContain('name="password"');
    }
  });
  it('serves the landing on a preview, and the old passcode page there with ?brand=ppw', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const preview = await middleware(new Request('https://ppw-designer-2d-abc-victor-ppw.vercel.app/'));
    expect(await preview.text()).toContain('Who are you?');
    const old = await middleware(new Request('https://ppw-designer-2d-abc-victor-ppw.vercel.app/?brand=ppw'));
    expect(await old.text()).toContain('Studio access code');
  });
});

describe('the landing page', () => {
  it('asks one question with every One Live Build type deck in the dropdown, in order', () => {
    const html = landingPage();
    expect(html).toContain('<h1><label for="who">Who are you?</label></h1>');
    expect(html).toMatch(/<form class="ask card" action="\/decks\/" method="get">/);
    expect(html).toContain('<select id="who" name="for" required');
    const options = [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
    expect(options[0]).toEqual(['', 'Choose one']);
    expect(options.slice(1)).toEqual(OLB_AUDIENCES.map((a) => [a.id, a.label]));
    expect(OLB_AUDIENCES.map((a) => a.label)).toEqual(['Developer', 'Off-plan developer', 'Office developer', 'Builder or contractor', 'MEP or services firm', 'Materials or finish supplier', 'Another build company']);
  });
  it('links the existing code entry and the admin sign-in, in the One Live Build look with no PPW mark', () => {
    const html = landingPage();
    expect(CODE_ENTRY_HREF).toBe('/access?next=%2Fhome');
    expect(html).toContain(`href="${CODE_ENTRY_HREF}">I have a code</a>`);
    expect(html).toContain('href="/admin">Sign in</a>');
    expect(html).toContain('/brand/olb/olb-lockup.svg');
    expect(html).toContain('/fonts/fraunces-600-latin.woff2');
    expect(html).toContain('/fonts/outfit-latin.woff2');
    expect(html).toContain('One Live Build · owned by Peak Performance Wellness Ltd, Curepipe, Mauritius');
    expect(html).not.toMatch(/ppw-mark|ppw-favicon|brand\/ppw/);
    expect(visibleText(html).match(/Peak Performance Wellness/g)).toHaveLength(1);
  });
  it('is light: no script, no 3D, one small picture, tap targets of 48 px or more', () => {
    const html = landingPage();
    expect(html).not.toMatch(/<script|<iframe|three|\.glb|\/assets\//i);
    expect(html.match(/<img /g)).toHaveLength(2); // the logo and the picture
    expect(Buffer.byteLength(html)).toBeLessThan(12_000);
    expect(html).toContain('min-height:56px'); // select and button
    expect(html).toMatch(/\.top a\{[^}]*min-height:48px/);
    expect(html).toMatch(/\.foot a\{[^}]*min-height:48px/);
    expect(html).toMatch(/\.code \.button\{[^}]*min-height:48px/);
  });
  it('carries no prices, no phone number, no WhatsApp and no em-dash', () => {
    const html = landingPage();
    const text = visibleText(html);
    expect(text).not.toMatch(/(?:Rs\.?|MUR|EUR|USD|GBP|€|\$|£)\s?\d/i);
    expect(html).not.toMatch(/whats\s?app|wa\.me|tel:|\+230|5456\s?0?035/i);
    expect(text).not.toMatch(/\+\d[\d\s-]{6,}\d/);
    expect(html).not.toContain('—');
  });
  it('answers GET and HEAD only, with a strict policy and no shared-cache surprises', async () => {
    const response = await middleware(new Request('https://onelivebuild.com/'));
    const csp = response.headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('script-src');
    expect(csp).toContain("frame-ancestors 'self'");
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('content-type')).toContain('text/html');
    const head = await middleware(new Request('https://onelivebuild.com/', { method: 'HEAD' }));
    expect(head.status).toBe(200);
    const post = await middleware(new Request('https://onelivebuild.com/', { method: 'POST' }));
    expect(post.status).toBe(405);
  });
});

describe('the dropdown opens a deck served from onelivebuild.com', () => {
  it('sends each choice to its deck, and anything else back to the landing', async () => {
    for (const audience of OLB_AUDIENCES) {
      const response = await middleware(new Request(`https://onelivebuild.com/decks/?for=${audience.id}`));
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(`/decks/${audience.deck}/`);
    }
    for (const url of ['https://onelivebuild.com/decks/?for=nope', 'https://onelivebuild.com/decks/', 'https://onelivebuild.com/decks']) {
      const response = await middleware(new Request(url));
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/');
    }
  });
  it('serves every deck page at its slash address and its files as they are, without the code', async () => {
    for (const deck of OLB_DECKS) {
      const page = await middleware(new Request(`https://onelivebuild.com/decks/${deck.slug}/`));
      expect(page.headers.get('x-middleware-rewrite')).toBe(`https://onelivebuild.com/decks/${deck.slug}/index.html`);
      const bare = await middleware(new Request(`https://onelivebuild.com/decks/${deck.slug}?x=1`));
      expect(bare.status).toBe(308);
      expect(bare.headers.get('location')).toBe(`/decks/${deck.slug}/?x=1`);
      for (const file of ['assets/cover.jpg', 'assets/fonts/outfit-latin.woff2', 'index.html']) {
        const response = await middleware(new Request(`https://onelivebuild.com/decks/${deck.slug}/${file}`));
        expect(response.headers.get('x-middleware-next')).toBe('1');
        expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      }
    }
  });
  it('answers an unknown deck or a page-like path inside a deck with a small 404', async () => {
    for (const url of ['https://onelivebuild.com/decks/stretchtek/', 'https://onelivebuild.com/decks/developers-d015f6/', 'https://onelivebuild.com/decks/developers/more', 'https://onelivebuild.com/decks/Developers/', 'https://onelivebuild.com/decks/..%2Fadmin/']) {
      const response = await middleware(new Request(url));
      expect(response.status).toBe(404);
      expect(await response.text()).toContain('Choose your deck');
    }
  });
});

describe('the existing code entry keeps working on onelivebuild.com', () => {
  it('still gates the software and opens the same public pages', async () => {
    for (const path of ['/designer', '/home', '/studio', '/studio/sales', '/admin/merchants', '/checkout']) {
      const response = await middleware(new Request(`https://onelivebuild.com${path}`));
      const html = await response.text();
      expect(html).toContain('<label for="code">Passcode</label>');
      expect(html).toContain(`action="/access?next=${encodeURIComponent(path).replace(/%2F/g, '%2F')}"`);
    }
    for (const path of ['/demo', '/pitch/developers', '/embed/designer']) {
      const response = await middleware(new Request(`https://onelivebuild.com${path}`));
      expect(response.headers.get('x-middleware-rewrite')).toBe('https://onelivebuild.com/olb.html');
    }
    const entry = await middleware(new Request(`https://onelivebuild.com${CODE_ENTRY_HREF}`));
    const html = await entry.text();
    expect(html).toContain('<label for="code">Passcode</label>');
    expect(html).toContain('action="/access?next=%2Fhome"');
  });
});
