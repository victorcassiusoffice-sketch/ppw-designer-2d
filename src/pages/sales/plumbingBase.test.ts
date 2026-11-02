import { readFileSync } from 'node:fs';
import postcss, { type ChildNode, type Root } from 'postcss';
import tailwindcss, { type Config } from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { beforeAll, describe, expect, it } from 'vitest';

// Compare generated behavior with the existing global base. Keep content
// derived from real HTML: fixtures in src are also scanned by the real build.
const configPath = '../../../tailwind.config.js';
const config = (await import(configPath)).default as Config;
const shells = ['index.html', 'olb.html'].map(path => readFileSync(path, 'utf8'));
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
function semantics(nodes: readonly ChildNode[] = []): unknown[] {
  return nodes.filter(node => node.type !== 'comment').map(node => {
    if (node.type === 'decl') return { property: node.prop, value: clean(node.value), important: !!node.important };
    if (node.type === 'rule') return { selector: clean(node.selector), children: semantics(node.nodes) };
    if (node.type === 'atrule') return { name: node.name, params: clean(node.params), children: semantics(node.nodes) };
    throw new Error('Unexpected CSS node');
  });
}
function matchingRules(root: Root, selector: string): unknown[] {
  const matches: unknown[] = [];
  root.walkRules(rule => { if (clean(rule.selector) === clean(selector)) matches.push(...semantics([rule])); });
  return matches;
}
async function compile(css: string): Promise<Root> {
  return (await postcss([
    tailwindcss({ ...config, content: shells.map(raw => ({ raw, extension: 'html' })) }),
    autoprefixer(),
  ]).process(css, { from: undefined })).root;
}
let original: Root, isolated: Root, preflight: Root;
beforeAll(async () => {
  original = await compile(readFileSync('src/index.css', 'utf8'));
  isolated = await compile(readFileSync('src/pages/sales/plumbingBase.css', 'utf8'));
  preflight = await compile('@tailwind base;');
});

describe('standalone plumbing browser base compatibility', () => {
  it('retains the complete existing preflight, including native forms and media defaults', () => {
    const expected = semantics(preflight.nodes);
    expect(expected.length).toBeGreaterThan(20);
    expect(semantics(original.nodes).slice(0, expected.length)).toEqual(expected);
    expect(semantics(isolated.nodes).slice(0, expected.length)).toEqual(expected);
  });

  it('keeps every local font descriptor and range identical to the global entry', () => {
    const faces = (root: Root) => semantics(root.nodes.filter(node => node.type === 'atrule' && node.name === 'font-face'));
    const expected = faces(original);
    expect(expected).toHaveLength(3);
    expect(faces(isolated)).toEqual(expected);
  });

  it('keeps typography, empty-icon normalization and document sizing identical', () => {
    for (const selector of [':root', 'i:empty', 'html, body, #root']) {
      const expected = matchingRules(original, selector);
      expect(expected.length).toBeGreaterThan(0);
      expect(matchingRules(isolated, selector)).toEqual(expected);
    }
  });

  it('preserves all actual shell body utilities with their opacity-variable semantics', () => {
    const classes = new Set(shells.flatMap(html => {
      const value = html.match(/<body\b[^>]*\bclass=["']([^"']+)["']/)?.[1];
      expect(value).toBeTruthy();
      return value!.split(/\s+/).filter(Boolean);
    }));
    expect(classes.size).toBeGreaterThan(0);
    for (const name of classes) {
      const expected = matchingRules(original, `.${name}`);
      expect(expected.length).toBeGreaterThan(0);
      expect(matchingRules(isolated, `.${name}`)).toEqual(expected);
    }
  });

  it('leaves designer-only behavior in its original owner', () => {
    for (const selector of ['.konva-stage, .konva-stage canvas', '.ppw-no-callout, .ppw-no-callout img', '.scroll-pane::-webkit-scrollbar']) {
      expect(matchingRules(original, selector).length).toBeGreaterThan(0);
      expect(matchingRules(isolated, selector)).toEqual([]);
    }
    expect(original.toString()).toContain('@keyframes ppw-details-in');
    expect(isolated.toString()).not.toContain('@keyframes ppw-details-in');
  });
});
