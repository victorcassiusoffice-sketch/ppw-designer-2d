import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateOlbTheme, isGreenish, mapColor, overridesFor, parseColor, scopeSelector } from '../olbTheme';
import { OLB_THEME_OUTPUTS } from '../olbThemeOutputs';

describe('One Live Build colour map', () => {
  it('parses hex and rgb colours', () => {
    expect(parseColor('#315e4d')).toEqual({ r: 49, g: 94, b: 77, a: 1 });
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#25382920')!.a).toBeCloseTo(32 / 255);
    expect(parseColor('rgba(30, 61, 50, .5)')).toEqual({ r: 30, g: 61, b: 50, a: 0.5 });
    expect(parseColor('currentColor')).toBeNull();
  });
  it('maps the sage greens by lightness and leaves neutrals, ambers and reds alone', () => {
    expect(isGreenish(parseColor('#315e4d')!)).toBe(true);
    expect(mapColor('#315e4d', 'background')).toBe('#1E3D32'); // dark button -> palm
    expect(mapColor('#a9c4ac', 'background')).toBe('#E7DCC8'); // mid sage -> sand
    expect(mapColor('#d4e7d8', 'background')).toBe('#EEE7D9'); // pale selected tab -> tint
    expect(mapColor('#e8f4ea', 'background')).toBe('#F3EFE6'); // green-white -> paper
    expect(mapColor('#244b37', 'text')).toBe('#1E3D32'); // dark text -> palm
    expect(mapColor('#e3f4ea', 'text')).toBe('#F3EFE6'); // light text -> paper
    expect(mapColor('#bac9b9', 'border')).toBe('#DDD6C8'); // pale border -> line
    for (const keep of ['#eeeee7', '#ffffff', '#725021', '#8c302b', '#f2e7cf']) expect(mapColor(keep, 'background')).toBeNull();
  });
  it('flattens shadows and gradients and keeps every colour-bearing declaration in cascade order', () => {
    expect(overridesFor({ prop: 'box-shadow', value: '3px 3px 9px #475b4012' })).toEqual([['box-shadow', 'none']]);
    expect(overridesFor({ prop: 'background', value: 'linear-gradient(145deg,#e5ece1,#dce6d9)' })).toEqual([['background', 'none']]);
    expect(overridesFor({ prop: 'background', value: 'radial-gradient(ellipse at 90% 0%, #dbe7dc 0, transparent 48%), #eeeee7' })).toEqual([['background', '#eeeee7']]);
    expect(overridesFor({ prop: 'background', value: 'url(/showcase/a.webp) center/cover' })).toEqual([['background', 'url(/showcase/a.webp) center/cover']]);
    expect(overridesFor({ prop: 'border', value: '0' })).toEqual([['border', '0']]);
    expect(overridesFor({ prop: 'color', value: '#fff' })).toEqual([['color', '#fff']]);
    expect(overridesFor({ prop: 'padding', value: '4px' })).toEqual([]);
    expect(overridesFor({ prop: '--pitch-ink', value: '#273c35' })).toEqual([]);
  });
  it('scopes every selector to the One Live Build shell', () => {
    expect(scopeSelector('.a, .b .c')).toBe(":root[data-brand='olb'] .a,\n:root[data-brand='olb'] .b .c");
    expect(scopeSelector(':root .x')).toBe(":root[data-brand='olb'] .x");
  });
  it('keeps !important and media queries', () => {
    const css = generateOlbTheme([{ name: 't.css', css: '.e{color:#50735e!important}@media (max-width:760px){.f{background:#315e4d;margin:0}}' }]);
    expect(css).toContain(":root[data-brand='olb'] .e {\n  color: #1E3D32 !important\n}");
    expect(css).toMatch(/@media \(max-width:760px\) \{\n:root\[data-brand='olb'\] \.f \{\n {2}background: #1E3D32\n\}/);
    expect(css).not.toContain('margin');
  });
  it.each(OLB_THEME_OUTPUTS.map((o) => [o.output, o] as const))('%s is up to date (run node tools/brand/gen-olb-theme.ts)', (_name, { output, sources }) => {
    const expected = generateOlbTheme(sources.map((name) => ({ name, css: readFileSync(name, 'utf8') })));
    expect(readFileSync(output, 'utf8').replace(/\r\n/g, '\n')).toBe(expected.replace(/\r\n/g, '\n'));
  });
});
