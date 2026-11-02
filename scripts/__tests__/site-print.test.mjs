import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPageWords } from '../qa/site-print-pdf.mjs';

const banner = 'Estimates from public data for planning a conversation, not a survey and not an approval.';
const wordsAt = (text, top) => text.split(' ').map((word, index) => ({ text: word, top, bottom: top + 9, x0: 40 + index * 20, x1: 57 + index * 20 }));
const page = () => ({ width: 595.28, height: 841.89, words: [...wordsAt('Boundary and orientation', 100), ...wordsAt(banner, 790)] });

test('accepts every A4 page only when its complete disclaimer is separated from content', () => {
  const result = inspectPageWords([page(), page(), page()], banner);
  assert.equal(result.passed, true);
  assert.equal(result.pages.length, 3);
  assert.ok(result.pages.every(row => row.footerCount === 1 && row.gapMm > 3));
});

test('rejects the observed regression: top/end banners leave a middle page without a disclaimer', () => {
  const middle = page(); middle.words = wordsAt('Platform scenario and input levels', 100);
  const result = inspectPageWords([page(), middle, page()], banner);
  assert.equal(result.passed, false);
  assert.equal(result.pages[1].footerCount, 0);
});

test('a banner in normal page content does not satisfy a repeating reserved footer', () => {
  const first = page(); first.words = wordsAt(banner, 50);
  const result = inspectPageWords([first], banner);
  assert.equal(result.passed, false);
  assert.equal(result.pages[0].completeBannerCount, 1);
  assert.equal(result.pages[0].footerCount, 0);
});

test('rejects body text in the reserved footer margin even when the full banner exists', () => {
  const collision = page(); collision.words.unshift(...wordsAt('Survey point 99', 784));
  const result = inspectPageWords([collision], banner);
  assert.equal(result.passed, false);
  assert.ok(result.pages[0].errors.some(error => error.includes('Body text enters')));
});

test('rejects an incomplete or off-page footer and a non-A4 page', () => {
  const incomplete = page(); incomplete.words.pop();
  const clipped = page(); clipped.words.at(-1).bottom = 850;
  const letter = page(); letter.width = 612; letter.height = 792;
  for (const candidate of [incomplete, clipped, letter]) assert.equal(inspectPageWords([candidate], banner).passed, false);
});

test('an empty document cannot pass', () => {
  assert.equal(inspectPageWords([], banner).passed, false);
});
