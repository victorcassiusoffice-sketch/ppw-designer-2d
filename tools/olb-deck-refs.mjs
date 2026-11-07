// Which files a One Live Build deck page loads by relative path: src / href / poster
// attributes, srcset entries and CSS url() that start with "assets/". Used by
// tools/sync-olb-decks.mjs (what to copy) and src/__tests__/olbDecks.test.ts (nothing missing,
// nothing extra), so both read a deck the same way.

/** @param {string} html @returns {string[]} sorted, unique, relative to the deck folder */
export function deckAssetRefs(html) {
  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href|poster)="(assets\/[^"#?]+)"/g)) refs.add(match[1]);
  for (const match of html.matchAll(/url\(\s*["']?(assets\/[^)"'?#]+)/g)) refs.add(match[1]);
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of match[1].split(',')) {
      const path = part.trim().split(/\s+/)[0];
      if (path.startsWith('assets/')) refs.add(path);
    }
  }
  return [...refs].sort();
}

/** Root-relative or parent-folder references would break once the deck sits at /decks/<slug>/. */
export function deckBrokenRefs(html) {
  const broken = [];
  for (const match of html.matchAll(/(?:src|href|poster|action)="([^"]*)"/g)) {
    const value = match[1];
    if (/^(https:|mailto:|#)/.test(value) || value.startsWith('assets/')) continue;
    broken.push(value);
  }
  for (const match of html.matchAll(/url\(\s*["']?([^)"']+)/g)) {
    if (!match[1].startsWith('assets/') && !match[1].startsWith('data:')) broken.push(match[1]);
  }
  return broken;
}
