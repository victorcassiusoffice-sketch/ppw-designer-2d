// Writes docs/lessons/CARDS.md from the lesson words (English column), so the
// review copy can never drift from the code.
// Usage: node tools/lessons/cards-doc-2026-11-08.mjs
import fs from 'node:fs';

const src = fs.readFileSync('src/i18n/lessonMessages.ts', 'utf8');
const data = fs.readFileSync('src/designer/lessons/lessonData.ts', 'utf8');
const en = {};
for (const m of src.matchAll(/'(lesson\.[a-z0-9.]+)':\s*\['((?:[^'\\]|\\.)*)'/gi)) en[m[1]] = m[2];
const ids = [...data.matchAll(/^ {2}([a-z0-9]+): \{\r?\n {4}id: '\1',/gm)].map((m) => m[1]);

let out = '# Lessons: the card for every tool and mode (English)\n\n';
out += 'Generated from `src/i18n/lessonMessages.ts` by `tools/lessons/cards-doc-2026-11-08.mjs`. French, Simplified Chinese and Spanish are in the same file. On a touch screen a step shows its touch wording when it differs.\n\n';
for (const id of ids) {
  const k = (s) => en[`lesson.${id}.${s}`];
  out += `## ${k('name')}\n\n${k('line')}\n\n`;
  for (const n of [1, 2, 3]) {
    if (!k(`s${n}`)) continue;
    out += `- ${k(`s${n}`)}${k(`s${n}t`) ? `  \n  Touch: ${k(`s${n}t`)}` : ''}\n`;
  }
  if (k('keys')) out += `\nKeys: ${k('keys')}\n`;
  out += '\n';
}
out += '## The first-build quest\n\n';
out += ['room', 'openings', 'paint', 'floor', 'products', 'view3d', 'walk'].map((s) => `- ${en[`lesson.quest.${s}`]}`).join('\n');
out += `\n\nOffer: ${en['lesson.quest.offer']}\n\nEnd: ${en['lesson.quest.allDone']} ${en['lesson.quest.allDoneLine']}\n\n`;
out += '## Loading tips\n\n';
out += Object.keys(en)
  .filter((key) => key.startsWith('lesson.tip.'))
  .map((key) => `- ${en[key]}`)
  .join('\n');
out += '\n';
fs.writeFileSync('docs/lessons/CARDS.md', out.replace(/\\'/g, "'"));
console.log(`${ids.length} lessons written`);
