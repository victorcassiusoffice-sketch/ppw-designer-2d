import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../vercel.json';
import { deckForAudience, OLB_AUDIENCES, OLB_DECKS } from '../../server/olbDecks';
import { adminPage, deckNotFoundPage, landingPage } from '../../server/olbPages';

// Shared with tools/sync-olb-decks.mjs so the copy and the check read a deck the same way.
const refsPath = '../../tools/olb-deck-refs.mjs';
const { deckAssetRefs, deckBrokenRefs } = await import(refsPath);

const repo = fileURLToPath(new URL('../..', import.meta.url));
const decksRoot = join(repo, 'public', 'decks');
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function filesUnder(root: string, folder = root): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesUnder(root, path) : [relative(root, path).replace(/\\/g, '/')];
  });
}
const visibleText = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
const PRICE = /(?:Rs\.?|MUR|EUR|USD|GBP|€|\$|£)\s?\d|\d\s?(?:€|£)|\b\d[\d,.]*\s?(?:Rs|MUR|EUR|USD|GBP)\b/i;
const PHONE = /\+\d[\d\s().-]{6,}\d|\b\d{3,4}[\s-]\d{4}\b/;
const MESSAGING = /whats\s?app|wa\.me|tel:|sms:|\+230|5456\s?0?035/i;

describe('the dropdown and the decks', () => {
  it('covers every kind of company Victor named, plus a deck for any other build company', () => {
    const labels = OLB_AUDIENCES.map((audience) => audience.label);
    for (const label of ['Developer', 'Builder or contractor', 'Materials or finish supplier', 'MEP or services firm', 'Office developer', 'Off-plan developer']) expect(labels).toContain(label);
    expect(new Set(OLB_AUDIENCES.map((audience) => audience.id)).size).toBe(OLB_AUDIENCES.length);
    expect(deckForAudience('off-plan-developer')!.slug).toBe('developers');
    expect(deckForAudience('office-developer')!.slug).toBe('developers');
    expect(deckForAudience('builder')!.slug).toBe('builders');
    expect(deckForAudience('mep')!.slug).toBe('mep');
    expect(deckForAudience('materials')!.slug).toBe('materials');
    expect(deckForAudience('other')!.slug).toBe('one-live-build');
    expect(deckForAudience(null)).toBeUndefined();
    expect(deckForAudience('constructor')).toBeUndefined();
  });
  it('uses only the generic One Live Build type decks: no company deck, no other product', () => {
    expect(OLB_DECKS.map((deck) => [deck.slug, deck.source])).toEqual([
      ['developers', 'developers-d015f6'],
      ['builders', 'builders-13a28f'],
      ['mep', 'mep-5cca8c'],
      ['materials', 'materials-c91b72'],
      ['one-live-build', 'one-live-build'],
    ]);
    for (const deck of OLB_DECKS) expect(OLB_AUDIENCES.some((audience) => audience.deck === deck.slug)).toBe(true);
    expect(readdirSync(decksRoot).sort()).toEqual(OLB_DECKS.map((deck) => deck.slug).sort());
  });
});

describe.each(OLB_DECKS)('deck copy /decks/$slug/', (deck) => {
  const folder = join(decksRoot, deck.slug);
  const html = readFileSync(join(folder, 'index.html'), 'utf8');
  it('is the approved page, byte for byte', () => {
    expect(sha256(join(folder, 'index.html'))).toBe(deck.sha256);
  });
  it('has every file it loads and nothing else', () => {
    const refs: string[] = deckAssetRefs(html);
    expect(refs.length).toBeGreaterThan(5);
    for (const ref of refs) expect(existsSync(join(folder, ref)), ref).toBe(true);
    expect(filesUnder(folder).sort()).toEqual(['index.html', ...refs].sort());
    expect(deckBrokenRefs(html)).toEqual([]);
  });
  it('stays out of search, in the One Live Build brand, with no price, phone number or WhatsApp', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, ?nofollow">/);
    expect(html).not.toMatch(/ppw-mark/);
    expect(visibleText(html)).not.toMatch(PRICE);
    expect(visibleText(html)).not.toMatch(PHONE);
    expect(html).not.toMatch(MESSAGING);
    // Wednesday visits are closed; the one booking link is the one-hour online meeting.
    expect(html).not.toMatch(/wednesday/i);
    const links = [...html.matchAll(/href="(https:[^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(['https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour']);
  });
});

describe('the server-rendered pages', () => {
  it('carry no price, phone number, WhatsApp or em-dash', () => {
    const pages = [landingPage(), deckNotFoundPage(), adminPage({ state: 'sign-in', next: '/home' }), adminPage({ state: 'not-set-up' }), adminPage({ state: 'signed-in', email: 'a@example.com', next: '/home' })];
    for (const page of pages) {
      expect(visibleText(page)).not.toMatch(PRICE);
      expect(visibleText(page)).not.toMatch(PHONE);
      expect(page).not.toMatch(MESSAGING);
      expect(page).not.toContain('—');
      expect(page).not.toContain('<script');
    }
  });
});

describe('Vercel configuration', () => {
  it('keeps the decks out of search on every host', () => {
    const rule = config.headers.find((entry) => entry.source === '/decks/(.*)');
    expect(rule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });
  it('adds no function: still the same 12 files under api/', () => {
    const functions = filesUnder(join(repo, 'api'))
      .filter((file) => /\.(ts|js)$/.test(file) && !file.split('/').some((part) => part.startsWith('_')) && !file.includes('__tests__') && !/\.test\./.test(file))
      .map((file) => `api/${file}`)
      .sort();
    expect(functions).toEqual(Object.keys(config.functions).sort());
    expect(functions).toHaveLength(12);
  });
});
