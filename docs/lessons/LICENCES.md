# Lessons: where every clip, sound, icon and word comes from

Part 2 of the One Live Build game programme (8 Nov 2026). Rule (plan section 4): our own words, icons, clips and sounds; no game files, art, sounds, music or tutorial text from any game.

| Asset | Source | Licence |
|---|---|---|
| 16 clips `public/lessons/<lesson>.webm` (VP9, 480 x 300, 15 fps, no sound track; sizes, lengths and hashes in `docs/lessons/clips-manifest.json`, 227 KB in all) | Recorded on 8 Nov 2026 from this repository's own Designer (local dev build of branch `claude/olb-game-2-lessons-2026-11-08`) by `tools/lessons/record-clips-2026-11-08.mjs`: Playwright drives the app, ffmpeg cuts, crops and encodes. The designer is opened the way `/demo` shows it (`?pitch=1` and the `/demo` name scrubber, `tools/lessons/demo-clean-2026-11-08.mjs`), so no clip shows a price, a currency or a shop name, and the recorder refuses a clip if one is on screen. The app's short pop-up messages are hidden while recording; nothing else is changed. Every non-GET request was blocked. | Ours (part of this repository, MIT) |
| 16 posters `public/lessons/<lesson>.webp` | The last frame of each clip, made by ffmpeg in the same script | Ours (MIT) |
| Sounds: place, snap, remove, paint, undo, tick, done | Made in code at run time with the Web Audio API (`src/designer/lessons/sound.ts`): sine and triangle tones and a fixed-seed noise burst through a band-pass filter. No sound file is downloaded or stored. | Ours (MIT) |
| Icons: bulb, speaker | Drawn in SVG in `LessonCard.tsx` and `SoundToggle.tsx` | Ours (MIT) |
| Words (cards, list, quest, tips) in English, French, Simplified Chinese, Spanish | Written for this repository: `src/i18n/lessonMessages.ts` and five lines in `src/i18n/messages.ts` | Ours (MIT) |
| Characters seen in the Walk clip | Kenney Mini Characters, already in the app's Walk mode (lane A) | CC0 (see `docs/world/LICENCES.md`) |

New runtime code: `src/designer/lessons/` and `src/i18n/lessonMessages.ts`, with small changes to `HelpOverlay.tsx`, `GamingLayer1Surfaces.tsx`, `SimsBottomToolbar.tsx`, `uxKit.tsx` and `messages.ts`. No package was added to `package.json`.
