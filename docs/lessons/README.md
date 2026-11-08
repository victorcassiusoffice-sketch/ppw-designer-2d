# Lessons: how every tool teaches itself

Part 2 of the One Live Build game programme (8 Nov 2026, plan `06-Roadmap/_handoff/OLB-GAME-GRADE-PLAN-2026-11-08.md` in the vault). One lessons system, driven by data, on top of the existing Designer. Nothing in the render core, `App.tsx`, `src/components/three/` or `src/walk/` changed.

## What a person sees

| Surface | When | Where |
|---|---|---|
| Tool card | The first time each tool or mode is picked (16 lessons) | Next to the tool, in the free part of the plan; it never covers the tool row, the tool's own bar or card, a docked panel or the bottom bar, and keeps its buttons off the room |
| Folded card | A press on the plan (the press goes to the plan) | A small chip where the card was; one tap opens it again |
| Lessons list | The `?` button, Lessons tab (Keys is the second tab) | Every lesson ticked when done, "Show me" on each, the first-build quest, the house build guide, tips and sounds switches |
| First-build quest | Offered on an empty plan; any time from the Lessons list | Seven steps ticked from the real design: a room, a door and a window, a painted wall, a floor, three products, the 3D view, a walk; a small celebration per step |
| Tooltip | Hover or keyboard focus on a tool button; a long press on a phone | Name, key, one line |
| Build feedback | Sounds on: place, snap, remove, paint, undo (off until the speaker button switches them on, remembered on the device); a landing ring and a snap pulse | Where the object lands or the corner drops |
| Loading tip | Each loading screen after the first picture (3D, Walk, City) | Beside the loading panel |

## How it is built

| File | Job |
|---|---|
| `src/designer/lessons/lessonData.ts` | The 16 lessons (words, keys, where each is picked, its clip, how "Show me" opens it) and the typed maps `TOOL_LESSON` (`BuildTool`), `MODE_LESSON` (`DesignerMode`), `HOUSE_TOOL_LESSON` (3D House tools) |
| `lessonsStore.ts` | Seen, done, tips off, sounds on, the quest, the card on screen; one localStorage key `olb.lessons.v1`, every read and write in try/catch |
| `quest.ts` | The quest read from `Property` (pure) |
| `LessonsBoot.tsx` | The only lessons code on the first-picture path: waits for the first picture and an idle moment, then loads the layer behind an error guard (a lessons fault can never take the Designer down) |
| `LessonsLayer.tsx` | Watches the stores (tool, pen, view, selection, garden) and the page (3D House tools, the Room box, the catalogue, Walk) for picks; press-through, Esc, close when the tool is put away, the polite live region |
| `placement.ts`, `dom.ts`, `usePlacement.ts` | Where a card may sit, measured on the page every 400 ms |
| `LessonCard.tsx`, `QuestHost.tsx`, `ToolTips.tsx`, `BuildFeedback.tsx`, `LoadingTips.tsx`, `LessonsList.tsx`, `SoundToggle.tsx`, `sound.ts` | The surfaces |
| `src/i18n/lessonMessages.ts` | The words in English, French, Simplified Chinese and Spanish (same four columns as `messages.ts`; a separate file so the first download does not carry them) |
| `public/lessons/` | 16 clips + posters, recorded from our own app (`tools/lessons/record-clips-2026-11-08.mjs`) |

## Adding a tool (part 4)

1. Add the tool to its list in the code (for example a new `BuildTool`). The typecheck now fails on `TOOL_LESSON` until it has a lesson.
2. Add one entry to `LESSONS` in `lessonData.ts` and its words in `lessonMessages.ts` (four columns).
3. Record its clip: add a function to `CLIPS` in the recorder and run `node tools/lessons/record-clips-2026-11-08.mjs <devBase> <id>`.

Nothing else: the card, the list, the tooltip and the tests pick it up (`lessonData.test.ts` checks every tool, every word in four languages and every clip).

## Tests

- Unit (`npm test`): `src/designer/lessons/__tests__/` — a first pick shows once, "No more tips" hides all, blocked storage, every quest step from the real design, placement, the words, the clips.
- End to end (dev server, it needs the DEV-only geometry bridge): `PPW_E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/lessons-quest.spec.ts`.

## Known limits

- The very first loading screen of a visit has no tip: the lessons load after the first picture, so the first picture is never slower.
- The Walk lesson does not open by itself when Walk starts: Walk teaches itself on its own chooser (lane A); its card comes from "Show me" and the quest, pointing at the Walk button.
- Tooltips cover the tool buttons in `lessonData.ts` (`tooltipOn`); the product catalogue keeps its own hover card.
- Sounds need one click on a speaker button first (browsers allow sound only after a click).
