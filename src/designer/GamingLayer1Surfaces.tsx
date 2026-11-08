/**
 * Sims-Parity Gaming Layer 1 — additive surfaces wrapper.
 *
 * Mounts the DOM-overlay polish surfaces (HelpLauncherIcon top-right,
 * HelpOverlay modal, EngineToggle) on top of the existing designer canvas
 * WITHOUT touching the Konva render-core (stable-lock 26c144c).
 *
 * Returns null when the flag is off so the classic UI renders alone.
 *
 * 2026-06-01 — the bottom ModeStrip (MOVE · WALL · FLOOR · PAINT · INSPECT
 * · BUY · CLEAR) was removed: it was a redundant global mode-switcher
 * floating under the canvas. Its only two functional modes — WALL (arms
 * the wall-draw FSM) and CLEAR (full room reset) — were folded into the
 * TopBar's existing control cluster so nothing was silently dropped. The
 * other five modes were cosmetic local-state with no downstream consumer.
 *
 * 2026-11-08 — lessons (game programme part 2): `LessonsBoot` loads the
 * lessons layer after the first picture (tool cards, the first-build quest,
 * tooltips, build feedback, loading tips); the `?` panel opens on its
 * Lessons tab, and `olb:open-lessons` opens it from anywhere.
 */

import { useEffect, useState } from 'react';
import { HelpLauncherIcon, HelpOverlay, type HelpTab } from './HelpOverlay';
import { isGamingV1Active } from './gamingV1Flag';
import { LessonsBoot } from './lessons/LessonsBoot';

export function GamingLayer1Surfaces(): JSX.Element | null {
  // Always call hooks unconditionally; gate the render at the bottom.
  const active = isGamingV1Active();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>('lessons');

  // M1.4: clear any stale `gaming_v1='0'` localStorage left over from
  // pre-flip dev sessions. V4 is permanently default-on per Vic 2026-05-19,
  // so this is the only piece of the (now-removed) V4Banner worth keeping.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (localStorage.getItem('gaming_v1') === '0') {
        localStorage.removeItem('gaming_v1');
      }
    } catch {
      // ignore
    }
  }, []);

  // The quest's last card (and anything else) can open the Lessons list.
  useEffect(() => {
    const open = () => {
      setHelpTab('lessons');
      setHelpOpen(true);
    };
    window.addEventListener('olb:open-lessons', open);
    return () => window.removeEventListener('olb:open-lessons', open);
  }, []);

  if (!active) return null;

  return (
    <>
      <HelpLauncherIcon
        onOpen={() => {
          setHelpTab('lessons');
          setHelpOpen(true);
        }}
      />
      <HelpOverlay open={helpOpen} tab={helpTab} onTab={setHelpTab} onClose={() => setHelpOpen(false)} />
      <LessonsBoot />
    </>
  );
}
