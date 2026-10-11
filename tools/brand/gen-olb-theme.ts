// Writes the One Live Build override stylesheets next to their sources.
// Run from the repo root on Node 22.18+ (TypeScript types are stripped): node tools/brand/gen-olb-theme.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { generateOlbTheme } from '../../src/brand/olbTheme.ts';
import { OLB_THEME_OUTPUTS } from '../../src/brand/olbThemeOutputs.ts';

for (const { output, sources } of OLB_THEME_OUTPUTS) {
  const css = generateOlbTheme(sources.map((name) => ({ name, css: readFileSync(name, 'utf8') })));
  writeFileSync(output, css);
  console.log(`${output}: ${css.split('\n').length} lines from ${sources.join(' + ')}`);
}
