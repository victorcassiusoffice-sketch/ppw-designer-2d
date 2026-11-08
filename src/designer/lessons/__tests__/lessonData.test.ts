/**
 * Every tool and mode in the code has a lesson; every lesson's words exist in
 * all four languages; the words stay our own (no game names, no prices).
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DESIGNER_MODES } from '../../useDesignerMode';
import {
  HOUSE_TOOL_LESSON,
  KEYBOARD_TIPS,
  LESSON_IDS,
  LESSONS,
  LOADING_TIPS,
  loadingTipsFor,
  MODE_LESSON,
  TOOL_LESSON,
  TOUCH_TIPS,
  tooltipTargets,
} from '../lessonData';
import { QUEST_STEP_INFO, QUEST_STEPS } from '../quest';
import { lessonRows, lessonText, type LessonTextKey } from '../../../i18n/lessonMessages';
import { LOCALES } from '../../../i18n/messages';

const ALL_BUILD_TOOLS = ['hand', 'eyedropper', 'sledgehammer', 'door', 'measure', 'floor', 'wallpaint', 'cladding'] as const;
const ALL_HOUSE_TOOLS = ['select', 'wall', 'room', 'stair', 'window', 'door'] as const;

function keysOf(id: (typeof LESSON_IDS)[number]): LessonTextKey[] {
  const lesson = LESSONS[id];
  return [lesson.name, lesson.line, ...(lesson.keys ? [lesson.keys] : []), ...lesson.steps.flatMap((s) => (s.touch ? [s.text, s.touch] : [s.text]))];
}

describe('every tool and mode has a lesson', () => {
  it('every BuildTool', () => {
    expect(Object.keys(TOOL_LESSON).sort()).toEqual([...ALL_BUILD_TOOLS].sort());
    for (const tool of ALL_BUILD_TOOLS) expect(LESSON_IDS).toContain(TOOL_LESSON[tool]);
  });

  it('every designer mode', () => {
    for (const mode of DESIGNER_MODES) expect(LESSON_IDS).toContain(MODE_LESSON[mode]);
  });

  it('every 3D House tool', () => {
    expect(Object.keys(HOUSE_TOOL_LESSON).sort()).toEqual([...ALL_HOUSE_TOOLS].sort());
    for (const tool of ALL_HOUSE_TOOLS) expect(LESSON_IDS).toContain(HOUSE_TOOL_LESSON[tool]);
  });

  it('each lesson has a name, one line and two or three steps', () => {
    for (const id of LESSON_IDS) {
      const lesson = LESSONS[id];
      expect(lesson.id).toBe(id);
      expect(lesson.steps.length).toBeGreaterThanOrEqual(2);
      expect(lesson.steps.length).toBeLessThanOrEqual(3);
    }
  });

  it('each quest step opens a lesson', () => {
    for (const step of QUEST_STEPS) expect(LESSON_IDS).toContain(QUEST_STEP_INFO[step].lesson);
  });

  it('tooltips point at lessons', () => {
    const targets = tooltipTargets();
    expect(targets.length).toBeGreaterThanOrEqual(12);
    for (const t of targets) expect(LESSON_IDS).toContain(t.id);
  });
});

describe('the words', () => {
  const used = new Set<LessonTextKey>([
    ...LESSON_IDS.flatMap(keysOf),
    ...QUEST_STEPS.map((s) => QUEST_STEP_INFO[s].label),
    ...LOADING_TIPS,
  ]);

  it('every word used exists in all four languages', () => {
    for (const key of used) {
      const row = lessonRows[key];
      expect(row, key).toBeDefined();
      expect(row.length).toBe(LOCALES.length);
      for (const text of row) expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('every row is used or is chrome the components ask for', () => {
    const chrome = (key: string) => /^lesson\.(ui|list|quest|group)\./.test(key);
    for (const key of Object.keys(lessonRows) as LessonTextKey[]) {
      expect(used.has(key) || chrome(key), key).toBe(true);
    }
  });

  it('our own words: no game names, no prices', () => {
    for (const row of Object.values(lessonRows)) {
      for (const text of row) {
        expect(text).not.toMatch(/sims/i);
        expect(text).not.toMatch(/(Rs|MUR|€|£|\$)\s?\d/);
      }
    }
  });

  it('fills placeholders and falls back to English', () => {
    expect(lessonText('fr', 'lesson.quest.progress', { done: 2, total: 7 })).toBe('2 sur 7');
    expect(lessonText('en', 'lesson.walls.name')).toBe('Walls');
  });
});

describe('the clips', () => {
  it('every lesson clip and poster is in public/lessons', () => {
    const root = path.resolve(__dirname, '../../../../public');
    for (const id of LESSON_IDS) {
      const clip = LESSONS[id].clip;
      if (!clip) continue;
      expect(existsSync(path.join(root, clip)), clip).toBe(true);
      expect(existsSync(path.join(root, clip.replace(/\.webm$/, '.webp'))), `${clip} poster`).toBe(true);
    }
  });
});

describe('loading tips', () => {
  it('a phone never gets a keyboard tip, a laptop never a touch tip, and both get some', () => {
    const phone = loadingTipsFor(true);
    const laptop = loadingTipsFor(false);
    expect(phone.length).toBeGreaterThan(1);
    expect(laptop.length).toBeGreaterThan(1);
    for (const key of phone) expect(KEYBOARD_TIPS.has(key), key).toBe(false);
    for (const key of laptop) expect(TOUCH_TIPS.has(key), key).toBe(false);
    for (const key of LOADING_TIPS) expect(phone.includes(key) || laptop.includes(key), key).toBe(true);
  });
});
