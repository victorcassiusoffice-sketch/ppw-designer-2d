/**
 * The first-build quest, read from the real design (never a click count).
 *
 * Seven steps: build a room, add a door and a window, paint a wall, lay a
 * floor, place three products, look at it in 3D, walk through it. The first
 * five are read from `Property`; 3D and Walk are read from what the app is
 * showing (the 3D picture drawn, a walk started).
 */
import type { Property } from '../../store/propertyStore';
import { isDrawnPolygon } from '../roomLayout';
import { isOutdoorRoom, isRoofRoom } from '../levels';
import type { LessonTextKey } from '../../i18n/lessonMessages';
import type { LessonId } from './lessonData';

export const QUEST_STEPS = ['room', 'openings', 'paint', 'floor', 'products', 'view3d', 'walk'] as const;
export type QuestStepId = (typeof QUEST_STEPS)[number];

export interface QuestFacts {
  rooms: number;
  doors: number;
  windows: number;
  paintedWalls: number;
  floors: number;
  products: number;
}

export interface QuestViewFacts {
  saw3d: boolean;
  walked: boolean;
}

export const PRODUCTS_TARGET = 3;

export interface QuestStepInfo {
  id: QuestStepId;
  label: LessonTextKey;
  /** The lesson "Show me" opens for this step. */
  lesson: LessonId;
}

export const QUEST_STEP_INFO: Readonly<Record<QuestStepId, QuestStepInfo>> = {
  room: { id: 'room', label: 'lesson.quest.room', lesson: 'walls' },
  openings: { id: 'openings', label: 'lesson.quest.openings', lesson: 'door' },
  paint: { id: 'paint', label: 'lesson.quest.paint', lesson: 'wallpaint' },
  floor: { id: 'floor', label: 'lesson.quest.floor', lesson: 'floor' },
  products: { id: 'products', label: 'lesson.quest.products', lesson: 'furnish' },
  view3d: { id: 'view3d', label: 'lesson.quest.view3d', lesson: 'view3d' },
  walk: { id: 'walk', label: 'lesson.quest.walk', lesson: 'walk' },
};

function isIndoor(room: Property['rooms'][number]): boolean {
  return !isOutdoorRoom(room) && !isRoofRoom(room);
}

/** Counts read straight from the design. */
export function questFacts(property: Property): QuestFacts {
  let rooms = 0;
  let doors = 0;
  let windows = 0;
  let paintedWalls = 0;
  let floors = 0;
  let products = 0;
  for (const room of property.rooms) {
    products += room.placedItems?.length ?? 0;
    if (!isIndoor(room) || !isDrawnPolygon(room.polygon)) continue;
    rooms += 1;
    for (const opening of room.openings ?? []) {
      if (opening.kind === 'window') windows += 1;
      else if (opening.kind === 'door' || opening.kind === 'doorway') doors += 1;
    }
    paintedWalls += (room.wallPaint ?? []).filter((edge) => !!edge.paintId).length;
    const tiled = (room.floorTiles ?? []).some((zone) => zone.runs.length > 0);
    if (tiled || !!room.floorFinish?.materialId) floors += 1;
  }
  for (const wall of property.walls ?? []) {
    if (wall.paintId || wall.exteriorPaint?.paintId) paintedWalls += 1;
  }
  return { rooms, doors, windows, paintedWalls, floors, products };
}

/** Is this step done, from the facts? */
export function questStepDone(step: QuestStepId, facts: QuestFacts, view: QuestViewFacts): boolean {
  switch (step) {
    case 'room':
      return facts.rooms > 0;
    case 'openings':
      return facts.doors > 0 && facts.windows > 0;
    case 'paint':
      return facts.paintedWalls > 0;
    case 'floor':
      return facts.floors > 0;
    case 'products':
      return facts.products >= PRODUCTS_TARGET;
    case 'view3d':
      return view.saw3d && facts.rooms > 0;
    case 'walk':
      return view.walked && facts.rooms > 0;
  }
}

/** Every step done right now. */
export function doneQuestSteps(facts: QuestFacts, view: QuestViewFacts): QuestStepId[] {
  return QUEST_STEPS.filter((step) => questStepDone(step, facts, view));
}

/** Part-way progress for the two steps that count something. */
export function questStepProgress(step: QuestStepId, facts: QuestFacts): { count: number; target: number } | null {
  if (step === 'products') return { count: Math.min(facts.products, PRODUCTS_TARGET), target: PRODUCTS_TARGET };
  if (step === 'openings') return { count: (facts.doors > 0 ? 1 : 0) + (facts.windows > 0 ? 1 : 0), target: 2 };
  return null;
}

/** An empty plan: nothing drawn, nothing placed. The quest is offered here. */
export function isEmptyPlan(property: Property): boolean {
  const facts = questFacts(property);
  return facts.rooms === 0 && facts.products === 0 && (property.walls?.length ?? 0) === 0;
}
