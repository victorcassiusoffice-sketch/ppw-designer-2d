import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
