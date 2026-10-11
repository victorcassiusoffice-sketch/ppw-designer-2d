/**
 * One Live Build theme generator (build-time tool, never shipped in the bundle).
 *
 * The pitch and sales stylesheets carry a few hundred hand-picked sage greens.
 * Instead of hand-editing each one, this maps every green-ish colour to the One
 * Live Build palette by lightness (the same rules as the browser preview Vic
 * approved on 12 Oct 2026) and writes override rules scoped to
 * :root[data-brand='olb'], which olb.html sets on onelivebuild.com. The
 * designer.ppwellness.co look is untouched.
 *
 * Regenerate after editing a source stylesheet:
 *   node tools/brand/gen-olb-theme.ts
 * src/brand/__tests__/olbTheme.test.ts fails while a generated file is stale.
 */
import postcss, { type AtRule, type ChildNode, type Container, type Declaration, type Rule } from 'postcss';

export const OLB_SCOPE = ":root[data-brand='olb']";

type Rgb = readonly [number, number, number];
type Rgba = { r: number; g: number; b: number; a: number };

/** The deck's palette. */
export const OLB = {
  paper: [243, 239, 230],
  tint: [238, 231, 217],
  sand: [231, 220, 200],
  line: [221, 214, 200],
  palm: [30, 61, 50],
  ink: [26, 24, 20],
  copper: [143, 78, 42],
} as const satisfies Record<string, Rgb>;

const COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^()]*\)/gi;

export function parseColor(token: string): Rgba | null {
  const t = token.trim().toLowerCase();
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const full = h.length <= 4 ? [...h].map((c) => c + c).join('') : h;
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(full)) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
  }
  const m = t.match(/^rgba?\(([^()]*)\)$/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = (v: string) => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v));
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  const [r, g, b] = parts.slice(0, 3).map(channel);
  if ([r, g, b, alpha].some((v) => !Number.isFinite(v))) return null;
  return { r, g, b, a: alpha };
}

const lightness = (c: Rgba) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
/** The sage family the designer uses (the preview's test, unchanged). Neutrals, ambers and reds are left alone. */
export const isGreenish = (c: Rgba) => c.g >= c.r + 4 && c.g >= c.b - 6;

function format(rgb: Rgb, alpha: number): string {
  if (alpha >= 1) return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `rgba(${rgb.join(', ')}, ${Math.round(alpha * 1000) / 1000})`;
}

export type Role = 'background' | 'text' | 'border';

/** null = keep the original colour. */
export function mapColor(token: string, role: Role): string | null {
  const c = parseColor(token);
  if (!c || !isGreenish(c)) return null;
  const l = lightness(c);
  if (role === 'background') return format(l < 0.45 ? OLB.palm : l < 0.86 ? OLB.sand : l < 0.93 ? OLB.tint : OLB.paper, c.a);
  if (role === 'border') return format(l < 0.45 ? OLB.palm : OLB.line, c.a);
  return format(l > 0.8 ? OLB.paper : OLB.palm, c.a);
}

const TEXT_PROPS = new Set(['color', 'fill', 'stroke', 'caret-color', 'outline-color', 'text-decoration-color', 'column-rule-color', '-webkit-text-fill-color', 'accent-color']);
const BORDER_PROPS = /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline)$/;

function replaceColors(value: string, role: Role): string {
  return value.replace(COLOR, (token) => mapColor(token, role) ?? token);
}

/**
 * The override declarations (prop, value) for one source declaration.
 * Every declaration of a colour-bearing property gets a twin (changed or not), so the
 * overrides win in exactly the order the originals did; other properties get none.
 */
export function overridesFor(decl: Pick<Declaration, 'prop' | 'value'>): [string, string][] {
  const prop = decl.prop.toLowerCase();
  const value = decl.value;
  if (prop.startsWith('--')) return [];
  // The deck is flat: no raised or inset shadows.
  if (prop === 'box-shadow') return [['box-shadow', 'none']];
  if (prop === 'background' || prop === 'background-image') {
    if (/url\(/i.test(value) || !/gradient\(/i.test(value)) return [[prop, replaceColors(value, 'background')]];
    if (prop === 'background-image') return [['background-image', 'none']];
    // Gradients go; a trailing plain colour layer ("…), #eeeee7") stays the background colour.
    const last = value.slice(value.lastIndexOf(')') + 1).match(COLOR)?.[0];
    return [['background', last ? (mapColor(last, 'background') ?? last) : 'none']];
  }
  if (prop === 'background-color') return [[prop, replaceColors(value, 'background')]];
  if (BORDER_PROPS.test(prop)) return [[prop, replaceColors(value, prop.startsWith('outline') ? 'text' : 'border')]];
  if (TEXT_PROPS.has(prop)) return [[prop, replaceColors(value, 'text')]];
  return [];
}

export function scopeSelector(selector: string): string {
  return selector
    .split(',')
    .map((part) => {
      const s = part.trim();
      if (/^:root\b/.test(s)) return s.replace(/^:root/, OLB_SCOPE);
      if (/^html\b/.test(s)) return s.replace(/^html/, "html[data-brand='olb']");
      return `${OLB_SCOPE} ${s}`;
    })
    .join(',\n');
}

function transform(source: Container, target: Container): void {
  source.each((node: ChildNode) => {
    if (node.type === 'rule') {
      const rule = node as Rule;
      const decls: { prop: string; value: string; important: boolean }[] = [];
      rule.each((child) => {
        if (child.type !== 'decl') return;
        for (const [prop, value] of overridesFor(child)) decls.push({ prop, value, important: child.important });
      });
      if (!decls.length) return;
      const out = postcss.rule({ selector: scopeSelector(rule.selector) });
      for (const d of decls) out.append(postcss.decl(d));
      target.append(out);
    } else if (node.type === 'atrule') {
      const at = node as AtRule;
      if (!['media', 'supports', 'container', 'layer'].includes(at.name) || !at.nodes) return;
      const out = postcss.atRule({ name: at.name, params: at.params });
      transform(at, out);
      if (out.nodes?.length) target.append(out);
    }
  });
}

/** Override stylesheet for the given sources (concatenated in order). */
export function generateOlbTheme(sources: { name: string; css: string }[]): string {
  const target = postcss.root();
  for (const { css } of sources) transform(postcss.parse(css), target);
  target.walk((node) => {
    node.raws.before = node.type === 'decl' ? '\n  ' : '\n';
    if (node.type !== 'decl') node.raws.after = '\n';
    if (node.type === 'rule' || node.type === 'atrule') node.raws.between = ' ';
    if (node.type === 'decl') node.raws.between = ': ';
  });
  const header = `/* GENERATED by tools/brand/gen-olb-theme.ts from ${sources.map((s) => s.name).join(' + ')}.\n   One Live Build colours for :root[data-brand='olb'] (onelivebuild.com). Do not edit by hand. */`;
  return `${header}\n${target.toString().trim()}\n`;
}
