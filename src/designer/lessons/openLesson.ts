/**
 * "Show me": put a lesson's tool in the user's hand and show its card, even
 * when the card was seen before. Used by the Lessons list and the quest.
 */
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useDrawProgressStore } from '../../store/drawProgressStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';
import { LESSONS, type LessonId } from './lessonData';
import { useLessonsStore } from './lessonsStore';
import { coarsePointer } from './dom';

/** Is the lesson's tool or view in the user's hand right now? */
export function lessonActive(id: LessonId): boolean {
  const ui = useDesignerUIStore.getState();
  const pen = useDrawProgressStore.getState().enabled;
  const q = (selector: string) => typeof document !== 'undefined' && !!document.querySelector(selector);
  switch (id) {
    case 'walls':
      return pen || q('[data-testid="house-draw-walls"][aria-pressed="true"]');
    case 'room':
      return pen || q('[aria-controls="ppw-pop-size"][aria-expanded="true"]') || q('[data-testid="house-draw-room"][aria-pressed="true"]');
    case 'door':
      return ui.tool === 'door' || q('.house-opening-tools[data-active-tool="door"], .house-opening-tools[data-active-tool="window"]');
    case 'stairs':
      return q('.house-opening-tools[data-active-tool="stair"]');
    case 'remove':
      return ui.tool === 'sledgehammer' || q('[data-testid="remove-tool-3d"][aria-pressed="true"]');
    case 'measure':
      return ui.tool === 'measure';
    case 'floor':
      return ui.tool === 'floor';
    case 'wallpaint':
      return ui.tool === 'wallpaint';
    case 'cladding':
      return ui.tool === 'cladding';
    case 'eyedropper':
      return ui.tool === 'eyedropper';
    case 'select':
      return ui.tool === 'hand' && !pen;
    case 'item':
      return usePropertyStore.getState().selectedInstanceId !== null;
    case 'furnish':
      return q('[data-testid="sims-dock"][data-catalog-open="true"], [data-testid="sims-bottom-toolbar"][data-catalog-open="true"]');
    case 'garden':
      return useGardenEditorStore.getState().panelOpen;
    case 'view3d':
      return ui.viewMode === '3d';
    case 'place-person':
      return q('[data-testid="place-walker"][aria-pressed="true"]');
    case 'walk-cutaway':
      return q('[data-testid="walk-cutaway"][aria-pressed="true"]');
    case 'walk-overview':
      return q('[data-testid="walk-overview"][aria-pressed="true"]');
    case 'walk-level':
    case 'walk-to':
    case 'walk':
      return q('[data-testid="world-walk"]');
  }
}

function pressButton(selector: string): boolean {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

export function openLesson(id: LessonId): void {
  const lesson = LESSONS[id];
  const ui = useDesignerUIStore.getState();
  const open = lesson.open;
  if (!lessonActive(id)) {
    switch (open.kind) {
      case 'click':
        if (!pressButton(open.selector)) ui.setTool(open.tool);
        break;
      case 'tool':
        ui.setTool(open.tool);
        break;
      case 'action':
        window.dispatchEvent(new CustomEvent('olb:tutorial-action', { detail: { action: open.action } }));
        break;
      case 'view3d':
      case 'walk':
        ui.setViewMode('3d');
        break;
      case 'none':
        break;
    }
  }
  useLessonsStore.getState().pick(id, { force: true, touch: coarsePointer() });
}
