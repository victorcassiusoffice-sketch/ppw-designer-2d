import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { opensWithoutStudioCode } from '../../../server/accessGate';
import { isAppShellPath } from '../../../server/brand';

describe('public crawler response', () => {
  it('serves a real robots document instead of the HTML SPA fallback', () => {
    const source = readFileSync(new URL('../../../public/robots.txt', import.meta.url), 'utf8');
    const directives = source.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    expect(source).not.toMatch(/<\/?(?:html|head|body|!doctype)/i);
    expect(directives.every(line => /^(?:User-agent|Allow|Disallow|Sitemap):/i.test(line))).toBe(true);
    expect(directives).toContain('User-agent: *');
    // The former absent file meant unrestricted crawling. Do not silently
    // block the public demo or pitch while repairing the malformed response.
    expect(directives.filter(line => /^Disallow:/i.test(line))).toEqual(['Disallow:']);
  });

  it('makes only the crawler file public without opening studio pages or path lookalikes', () => {
    expect(opensWithoutStudioCode('/robots.txt')).toBe(true);
    expect(isAppShellPath('/robots.txt')).toBe(false);
    for (const path of ['/designer', '/studio', '/robots.txt/private', '/robots.txt.bak']) {
      expect(opensWithoutStudioCode(path)).toBe(false);
    }
  });
});
