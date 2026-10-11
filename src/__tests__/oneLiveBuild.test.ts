import { describe, expect, it, vi } from 'vitest';
import { handleAccess, opensWithoutStudioCode, type AccessDependencies } from '../../server/accessGate';
import { brandFor, isAppShellPath } from '../../server/brand';
import middleware from '../../middleware';

function deps(namespace = 'production'): AccessDependencies {
  return { command: vi.fn(async () => null), now: () => 1_700_000_000_000, clientIp: 'test-ip', namespace };
}

describe('One Live Build look by address', () => {
  it('gives onelivebuild.com (and previews) the One Live Build look, every other host the PPW look', () => {
    expect(brandFor(new URL('https://onelivebuild.com/'), 'production')).toBe('olb');
    expect(brandFor(new URL('https://www.onelivebuild.com/pitch/developers'), 'production')).toBe('olb');
    expect(brandFor(new URL('https://shopbuild.onelivebuild.com/'), 'production')).toBe('olb');
    expect(brandFor(new URL('https://designer.ppwellness.co/'), 'production')).toBe('ppw');
    expect(brandFor(new URL('https://ppw-designer-2d.vercel.app/'), 'production')).toBe('ppw');
    expect(brandFor(new URL('https://ppw-designer-2d-abc-victor-ppw.vercel.app/'), 'preview')).toBe('olb');
    expect(brandFor(new URL('https://ppw-designer-2d-abc-victor-ppw.vercel.app/?brand=ppw'), 'preview')).toBe('ppw');
  });
  it('treats app routes as pages and files as files', () => {
    for (const path of ['/', '/designer', '/pitch/developers', '/studio/sales', '/index.html']) expect(isAppShellPath(path)).toBe(true);
    for (const path of ['/assets/app-1.js', '/brand/olb/favicon.svg', '/fonts/outfit-latin.woff2', '/olb.html', '/favicon.ico']) expect(isAppShellPath(path)).toBe(false);
  });
  it('opens logos, icons, the card and the fonts without the code (the passcode page and /demo draw them)', async () => {
    for (const path of ['/brand/olb/olb-lockup.svg', '/brand/olb/hero-1200x630.jpg', '/brand/olb/site.webmanifest', '/brand/ppw-mark-512.png', '/fonts/fraunces-600-latin.woff2', '/fonts/outfit-latin.woff2']) {
      expect(opensWithoutStudioCode(path)).toBe(true);
      expect(await handleAccess(new Request(`https://onelivebuild.com${path}`), deps())).toBeNull();
    }
    expect(opensWithoutStudioCode('/brandnew')).toBe(false);
    expect(opensWithoutStudioCode('/olb.html')).toBe(false);
  });
  it('shows the One Live Build passcode page on onelivebuild.com: logo, picture and fonts allowed, still no script', async () => {
    const response = (await handleAccess(new Request('https://onelivebuild.com/designer'), deps()))!;
    const html = await response.text();
    expect(html).toContain('One Live Build');
    expect(html).toContain('<label for="code">Passcode</label>');
    expect(html).toContain('/brand/olb/olb-lockup.svg');
    expect(html).toContain('Peak Performance Wellness Ltd');
    expect(html).toContain('action="/access?next=%2Fdesigner"');
    expect(html).not.toContain('<script');
    const csp = response.headers.get('content-security-policy')!;
    expect(csp).toContain("img-src 'self'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('script-src');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });
  it('keeps the PPW passcode page on designer.ppwellness.co, and on a preview asked for ?brand=ppw', async () => {
    const ppw = await (await handleAccess(new Request('https://designer.ppwellness.co/studio'), deps()))!.text();
    expect(ppw).toContain('Studio access code');
    expect(ppw).not.toContain('One Live Build');
    const preview = await (await handleAccess(new Request('https://ppw-designer-2d-abc-victor-ppw.vercel.app/studio?brand=ppw'), deps('preview')))!.text();
    expect(preview).toContain('Studio access code');
    const olbPreview = await (await handleAccess(new Request('https://ppw-designer-2d-abc-victor-ppw.vercel.app/studio'), deps('preview')))!.text();
    expect(olbPreview).toContain('Passcode');
  });
  it('shows a wrong-code message on the One Live Build page too', async () => {
    const request = new Request('https://onelivebuild.com/access?next=%2Fdesigner', {
      method: 'POST', headers: { origin: 'https://onelivebuild.com', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: '0000' }),
    });
    const command = vi.fn(async (args: (string | number)[]) => (args[0] === 'INCR' ? 1 : 1));
    const response = (await handleAccess(request, { ...deps(), command, codeHash: 'f'.repeat(64) }))!;
    expect(response.status).toBe(401);
    const html = await response.text();
    expect(html).toContain('That code does not match');
    expect(html).toContain('Passcode');
  });
});

describe('middleware shell by address', () => {
  it('serves olb.html for pages on onelivebuild.com', async () => {
    const response = await middleware(new Request('https://onelivebuild.com/pitch/developers?client=x'));
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://onelivebuild.com/olb.html');
  });
  it('leaves files and designer.ppwellness.co alone', async () => {
    for (const url of ['https://onelivebuild.com/assets/app-1.js', 'https://onelivebuild.com/brand/olb/favicon.svg', 'https://designer.ppwellness.co/pitch/developers']) {
      const response = await middleware(new Request(url));
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });
});
