/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { scrubDemoText, startDemoScrub } from '../demoScrub';
import { isPriceFreeDemoPath } from '../pitchEmbed';

const FORBIDDEN = /\bRs\b|\bMUR\b|\bUSD\b|\bEUR\b|\bGBP\b|€|£|\$\s?\d|\bSofap\b|sofaponlinestore|\bTintEX\b|\bPermoglaze\b|Spa Concept|\bCourts\b|Cap Tamarin|\bK1\b|\bVAT\b/i;

describe('price-free /demo path', () => {
  it('is /demo only', () => {
    expect(isPriceFreeDemoPath('/demo')).toBe(true);
    expect(isPriceFreeDemoPath('/demo/')).toBe(true);
    expect(isPriceFreeDemoPath('/designer')).toBe(false);
    expect(isPriceFreeDemoPath('/embed/designer')).toBe(false);
    expect(isPriceFreeDemoPath('/studio')).toBe(false);
    expect(isPriceFreeDemoPath('/demo-x')).toBe(false);
  });
});

describe('scrubDemoText', () => {
  it.each([
    ['Rs 535,402', ''],
    ['Estimate Rs 535,402 Open', 'Estimate Open'],
    ['Product estimate Rs 535,402. Open products and cost', 'Product estimate. Open products and cost'],
    ['12.4 m² · 3.1 L · Rs 4,778', '12.4 m² · 3.1 L'],
    ['$11,897.81', ''],
    ['1,250 MUR per piece · VAT included', ''],
    ['Rs 12.5k', ''],
    ['Permoglaze Matt Emulsion', 'Matt Emulsion'],
    ['Wall paint — click a wall to paint it with a Sofap colour', 'Wall paint — click a wall to paint it with a Paint range A colour'],
    ['TintEX VIP Satin', 'Paint range B VIP Satin'],
    ['Permoglaze (Sofap) · Mauritius', 'Paint range A · Mauritius'],
    ['Sample boards. Not a real Spa Concept product.', 'Sample boards. Not a real product.'],
    ['Supplied by K1 Sport', 'Supplied by a local supplier'],
    ['HPL Mauritius · STR Marketing Mauritius · CMH Mauritius', 'a local supplier · a local supplier · a local supplier'],
    ['Premix Mauritius · Metalite Mauritius · Reneworld Mauritius · Solarex Mauritius', 'a local supplier · a local supplier · a local supplier · a local supplier'],
    ['Sofo Soler Moris / Duraco · QBM Mauritius / Duraco', 'a local supplier / a local supplier · a local supplier / a local supplier'],
    ['Medine Garden Center · Endemika Mauritius · Legrand Mauritius · Paving Mauritius', 'a local supplier · a local supplier · a local supplier · a local supplier'],
    ['sofaponlinestore.mu/shop', ''],
    ['IP68 junction box (Emcar listing). Rs 12,075 on emcar.mu 2026-09-04 (VAT not stated; out of stock that day). Lays on the roof.', 'IP68 junction box (a local supplier listing). Lays on the roof.'],
    ['Prices excl. VAT', ''],
  ])('%s', (input, expected) => {
    const out = scrubDemoText(input);
    expect(out).toBe(expected);
    expect(out).not.toMatch(FORBIDDEN);
  });

  it('leaves clean copy alone and is idempotent', () => {
    for (const s of ['Wall paint', '3 coats · 12.4 m²', 'Products in this design', 'Room 1 · 4.2 × 3.0 m', 'Courtyard']) {
      expect(scrubDemoText(s)).toBe(s);
    }
    const once = scrubDemoText('Rs 1,234 · Sofap Bronze');
    expect(scrubDemoText(once)).toBe(once);
  });
});

describe('startDemoScrub', () => {
  let stop: (() => void) | null = null;
  afterEach(() => { stop?.(); stop = null; document.body.innerHTML = ''; });

  it('rewrites text and labels now and as React writes them later', async () => {
    document.body.innerHTML = '<button title="paint it with a Sofap colour" aria-label="Open cart — Rs 9">Rs 9</button><select><option>MUR</option></select>';
    stop = startDemoScrub(document.body);
    expect(document.body.innerHTML).not.toMatch(FORBIDDEN);
    const p = document.createElement('p');
    p.textContent = 'TintEX Mastertop · Rs 2,999';
    document.body.appendChild(p);
    document.querySelector('button')!.setAttribute('title', 'Spa Concept');
    document.querySelector('button')!.firstChild!.nodeValue = 'Rs 10';
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.innerHTML).not.toMatch(FORBIDDEN);
    expect(p.textContent).toBe('Paint range B Mastertop');
  });
});

describe('every supplier and brand name in the bundled data is scrubbed', () => {
  // Manufacturer brands on a product (Samsung, NordicTrack, …) are product
  // names, not the retailer; only the selling/supplying party is hidden.
  const NOT_A_RETAILER = /^(?:PPW.*|Demo|Supplier|Source|Verified source|Flooring|Test .*|Acme.*|IceCo|GreenLeaf|PodWorks)$/;
  const MANUFACTURER = /^(?:Samsung|Hisense|Horizon|Stellar|JDM Sports|Homedics|NordicTrack|Vision Fitness|Matrix Fitness|Schwinn|ProForm|Bowflex)$/;

  it('covers src/data, src/demo and public/data', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === '__tests__' ? [] : walk(p);
      return /\.(ts|json)$/.test(f) ? [p] : [];
    });
    const files = ['src/data', 'src/demo', 'public/data'].flatMap((d) => { try { return walk(d); } catch { return []; } });
    const names = new Set<string>();
    const field = /["']?(?:supplier|merchant|seller|retailer)["']?\s*:\s*["']([^"'\n]{2,80})["']/g;
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(field)) names.add(m[1]);
    }
    expect(names.size).toBeGreaterThan(10);
    const leaks: string[] = [];
    for (const raw of names) {
      if (NOT_A_RETAILER.test(raw)) continue;
      // "K1-Sport (NordicTrack — Mauritius distributor)": the brand in brackets may stay.
      const out = scrubDemoText(raw).replace(/\(([^)]*)\)/g, (all, inner: string) => (inner.split(/[—–,]/).every((p) => MANUFACTURER.test(p.trim()) || /distributor|retailers?/i.test(p)) ? '' : all));
      if (out.includes(raw) || /[A-Z][a-z]+ [A-Z][a-z]+/.test(out.replace(/a local supplier|a client|Paint range [A-D]/g, ''))) leaks.push(`${raw} -> ${out}`);
    }
    expect(leaks).toEqual([]);
  });
});

describe('every bundled string a demo visitor could read comes out clean', () => {
  it('scrubs every quoted string in src/data, src/demo and public/data', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === '__tests__' ? [] : walk(p);
      return /\.(ts|json)$/.test(f) ? [p] : [];
    });
    const files = ['src/data', 'src/demo', 'public/data'].flatMap((d) => { try { return walk(d); } catch { return []; } })
      .filter((f) => !/demoScrub\.ts$/.test(f));
    // Identifiers, URLs and ids are not shown as text; prose is.
    const quoted = /(["'`])((?:(?!\1)[^\\\r\n]){6,400})\1/g;
    const leaks: string[] = [];
    let checked = 0;
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(quoted)) {
        const s = m[2];
        if (!FORBIDDEN.test(s) || /^https?:\/\//.test(s) || !/\s/.test(s) || /\$\{/.test(s)) continue;
        checked += 1;
        const out = scrubDemoText(s);
        if (FORBIDDEN.test(out)) leaks.push(`${f}: ${out.slice(0, 120)}`);
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(leaks.join('\n')).toBe('');
  });
});
