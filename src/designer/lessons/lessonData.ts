/**
 * The lessons, one entry per tool or mode (part 2 of the One Live Build game
 * programme, 8 Nov 2026). Driven by data: the layer, the Lessons list, the
 * tooltips and the quest all read this file.
 *
 * Every list of tools in the code maps to a lesson here, and the maps are
 * typed `Record<...>`, so a tool added later (part 4) fails the typecheck
 * until it has one entry. That entry is the only thing it needs.
 */
import type { BuildTool } from '../../store/designerUIStore';
import type { DesignerMode } from '../useDesignerMode';
import type { BuildingControlsProps } from '../../components/BuildingControls';
import type { LessonTextKey } from '../../i18n/lessonMessages';

export const LESSON_IDS = [
  'walls',
  'room',
  'door',
  'stairs',
  'remove',
  'measure',
  'floor',
  'wallpaint',
  'cladding',
  'select',
  'item',
  'furnish',
  'eyedropper',
  'garden',
  'view3d',
  'walk',
] as const;
export type LessonId = (typeof LESSON_IDS)[number];

/** The 3D House tools (`BuildingControls`). */
export type HouseTool = BuildingControlsProps['tool'];

export type LessonGroup = 'build' | 'finish' | 'furnish' | 'look';

export interface LessonStep {
  /** Mouse (and keyboard) wording. */
  text: LessonTextKey;
  /** Touch wording, when it differs. */
  touch?: LessonTextKey;
}

/** How "Show me" puts the tool in the user's hand. */
export type LessonOpen =
  /** Press the tool's own button (the path a person takes); the store when it is not on screen. */
  | { kind: 'click'; selector: string; tool: BuildTool }
  /** A tool with no button (keyboard only). */
  | { kind: 'tool'; tool: BuildTool }
  /** The house guide's dispatcher in App (`olb:tutorial-action`). */
  | { kind: 'action'; action: 'walls' | 'openings' | 'finishes' | 'furnish' | 'garden' }
  | { kind: 'view3d' }
  /** Go to 3D and point at the Walk button; the user starts the walk. */
  | { kind: 'walk' }
  /** Nothing to open (the card explains a gesture or a key). */
  | { kind: 'none' };

export interface Lesson {
  id: LessonId;
  group: LessonGroup;
  name: LessonTextKey;
  line: LessonTextKey;
  steps: readonly LessonStep[];
  keys?: LessonTextKey;
  /** The key badge on the tooltip, when the tool has one key. */
  shortKey?: string;
  /**
   * Where the tool is picked, most specific first. The card sits near the
   * first visible one and never covers it. Selectors use test ids and stable
   * class names, never translated words.
   */
  anchors: readonly string[];
  /** The tool buttons that get a tooltip (a subset of `anchors`). */
  tooltipOn: readonly string[];
  /** Muted looping clip in `public/lessons/`, recorded from our own app. */
  clip?: string;
  /** Keyboard-only: no card on a touch screen. */
  keyboardOnly?: boolean;
  open: LessonOpen;
}

const clip = (id: LessonId) => `/lessons/${id}.webm`;

export const LESSONS: Readonly<Record<LessonId, Lesson>> = {
  walls: {
    id: 'walls',
    group: 'build',
    name: 'lesson.walls.name',
    line: 'lesson.walls.line',
    steps: [
      { text: 'lesson.walls.s1', touch: 'lesson.walls.s1t' },
      { text: 'lesson.walls.s2' },
      { text: 'lesson.walls.s3', touch: 'lesson.walls.s3t' },
    ],
    keys: 'lesson.walls.keys',
    anchors: [
      '[data-testid="wall-tool-toggle"]',
      '[data-testid="room-draw-toggle"]',
      '[data-testid="wall-tool-toggle-mobile"]',
      '[data-testid="house-draw-walls"]',
    ],
    tooltipOn: ['[data-testid="wall-tool-toggle"]', '[data-testid="room-draw-toggle"]', '[data-testid="house-draw-walls"]'],
    clip: clip('walls'),
    open: { kind: 'action', action: 'walls' },
  },
  room: {
    id: 'room',
    group: 'build',
    name: 'lesson.room.name',
    line: 'lesson.room.line',
    steps: [{ text: 'lesson.room.s1' }, { text: 'lesson.room.s2' }, { text: 'lesson.room.s3' }],
    anchors: ['[aria-controls="ppw-pop-size"]', '[data-testid="house-draw-room"]', '[data-testid="start-quick-rectangle"]'],
    tooltipOn: ['[aria-controls="ppw-pop-size"]', '[data-testid="house-draw-room"]'],
    clip: clip('room'),
    open: { kind: 'action', action: 'walls' },
  },
  door: {
    id: 'door',
    group: 'build',
    name: 'lesson.door.name',
    line: 'lesson.door.line',
    steps: [
      { text: 'lesson.door.s1' },
      { text: 'lesson.door.s2', touch: 'lesson.door.s2t' },
      { text: 'lesson.door.s3', touch: 'lesson.door.s3t' },
    ],
    keys: 'lesson.door.keys',
    anchors: ['[data-testid="door-tool-toggle"]', '[data-testid="door-toggle-mobile"]', '.house-opening-tools'],
    tooltipOn: ['[data-testid="door-tool-toggle"]'],
    clip: clip('door'),
    open: { kind: 'action', action: 'openings' },
  },
  stairs: {
    id: 'stairs',
    group: 'build',
    name: 'lesson.stairs.name',
    line: 'lesson.stairs.line',
    steps: [{ text: 'lesson.stairs.s1' }, { text: 'lesson.stairs.s2', touch: 'lesson.stairs.s2t' }, { text: 'lesson.stairs.s3' }],
    anchors: ['.house-opening-tools'],
    tooltipOn: [],
    clip: clip('stairs'),
    open: { kind: 'view3d' },
  },
  remove: {
    id: 'remove',
    group: 'build',
    name: 'lesson.remove.name',
    line: 'lesson.remove.line',
    steps: [
      { text: 'lesson.remove.s1', touch: 'lesson.remove.s1t' },
      { text: 'lesson.remove.s2', touch: 'lesson.remove.s2t' },
      { text: 'lesson.remove.s3' },
    ],
    keys: 'lesson.remove.keys',
    shortKey: 'J',
    anchors: ['[data-testid="remove-tool-toggle"]', '[data-testid="remove-tool-toggle-mobile"]', '[data-testid="remove-tool-3d"]'],
    tooltipOn: ['[data-testid="remove-tool-toggle"]', '[data-testid="remove-tool-3d"]'],
    clip: clip('remove'),
    open: { kind: 'click', selector: '[data-testid="remove-tool-toggle"]', tool: 'sledgehammer' },
  },
  measure: {
    id: 'measure',
    group: 'build',
    name: 'lesson.measure.name',
    line: 'lesson.measure.line',
    steps: [{ text: 'lesson.measure.s1', touch: 'lesson.measure.s1t' }, { text: 'lesson.measure.s2' }, { text: 'lesson.measure.s3' }],
    keys: 'lesson.measure.keys',
    shortKey: 'M',
    anchors: ['[data-testid="measure-tool-toggle"]'],
    tooltipOn: ['[data-testid="measure-tool-toggle"]'],
    clip: clip('measure'),
    open: { kind: 'click', selector: '[data-testid="measure-tool-toggle"]', tool: 'measure' },
  },
  floor: {
    id: 'floor',
    group: 'finish',
    name: 'lesson.floor.name',
    line: 'lesson.floor.line',
    steps: [
      { text: 'lesson.floor.s1' },
      { text: 'lesson.floor.s2', touch: 'lesson.floor.s2t' },
      { text: 'lesson.floor.s3', touch: 'lesson.floor.s3t' },
    ],
    keys: 'lesson.floor.keys',
    anchors: ['[data-testid="floor-paint-toggle"]', '[data-testid="floor-paint-toggle-mobile"]'],
    tooltipOn: ['[data-testid="floor-paint-toggle"]'],
    clip: clip('floor'),
    open: { kind: 'click', selector: '[data-testid="floor-paint-toggle"]', tool: 'floor' },
  },
  wallpaint: {
    id: 'wallpaint',
    group: 'finish',
    name: 'lesson.wallpaint.name',
    line: 'lesson.wallpaint.line',
    steps: [
      { text: 'lesson.wallpaint.s1' },
      { text: 'lesson.wallpaint.s2', touch: 'lesson.wallpaint.s2t' },
      { text: 'lesson.wallpaint.s3' },
    ],
    anchors: ['[data-testid="wallpaint-tool-toggle"]', '[data-testid="wallpaint-toggle-mobile"]'],
    tooltipOn: ['[data-testid="wallpaint-tool-toggle"]'],
    clip: clip('wallpaint'),
    open: { kind: 'action', action: 'finishes' },
  },
  cladding: {
    id: 'cladding',
    group: 'finish',
    name: 'lesson.cladding.name',
    line: 'lesson.cladding.line',
    steps: [
      { text: 'lesson.cladding.s1' },
      { text: 'lesson.cladding.s2', touch: 'lesson.cladding.s2t' },
      { text: 'lesson.cladding.s3' },
    ],
    anchors: ['[data-testid="cladding-tool-toggle"]', '[data-testid="cladding-toggle-mobile"]'],
    tooltipOn: ['[data-testid="cladding-tool-toggle"]'],
    clip: clip('cladding'),
    open: { kind: 'click', selector: '[data-testid="cladding-tool-toggle"]', tool: 'cladding' },
  },
  select: {
    id: 'select',
    group: 'furnish',
    name: 'lesson.select.name',
    line: 'lesson.select.line',
    steps: [
      { text: 'lesson.select.s1', touch: 'lesson.select.s1t' },
      { text: 'lesson.select.s2' },
      { text: 'lesson.select.s3' },
    ],
    keys: 'lesson.select.keys',
    shortKey: 'H',
    anchors: [
      '[data-testid="select-tool-toggle"]',
      '[data-testid="select-tool-toggle-phone"]',
      '[data-testid="select-tool-toggle-mobile"]',
      '.house-quick-tools',
    ],
    tooltipOn: ['[data-testid="select-tool-toggle"]'],
    clip: clip('select'),
    open: { kind: 'click', selector: '[data-testid="select-tool-toggle"]', tool: 'hand' },
  },
  item: {
    id: 'item',
    group: 'furnish',
    name: 'lesson.item.name',
    line: 'lesson.item.line',
    steps: [
      { text: 'lesson.item.s1', touch: 'lesson.item.s1t' },
      { text: 'lesson.item.s2', touch: 'lesson.item.s2t' },
      { text: 'lesson.item.s3', touch: 'lesson.item.s3t' },
    ],
    keys: 'lesson.item.keys',
    anchors: ['[aria-label="Selected item controls"]', '[data-testid="house-selection-strip"]'],
    tooltipOn: [],
    clip: clip('item'),
    open: { kind: 'none' },
  },
  furnish: {
    id: 'furnish',
    group: 'furnish',
    name: 'lesson.furnish.name',
    line: 'lesson.furnish.line',
    steps: [{ text: 'lesson.furnish.s1' }, { text: 'lesson.furnish.s2', touch: 'lesson.furnish.s2t' }, { text: 'lesson.furnish.s3' }],
    anchors: ['[data-testid="dock-catalog-open"]', '[data-testid="sims-catalog-open"]', '[data-testid="sims-dock"]', '[data-testid="sims-bottom-toolbar"]'],
    tooltipOn: ['[data-testid="dock-catalog-open"]'],
    clip: clip('furnish'),
    open: { kind: 'action', action: 'furnish' },
  },
  eyedropper: {
    id: 'eyedropper',
    group: 'furnish',
    name: 'lesson.eyedropper.name',
    line: 'lesson.eyedropper.line',
    steps: [{ text: 'lesson.eyedropper.s1' }, { text: 'lesson.eyedropper.s2' }, { text: 'lesson.eyedropper.s3' }],
    keys: 'lesson.eyedropper.keys',
    shortKey: 'E',
    anchors: [],
    tooltipOn: [],
    clip: clip('eyedropper'),
    keyboardOnly: true,
    open: { kind: 'tool', tool: 'eyedropper' },
  },
  garden: {
    id: 'garden',
    group: 'furnish',
    name: 'lesson.garden.name',
    line: 'lesson.garden.line',
    steps: [{ text: 'lesson.garden.s1' }, { text: 'lesson.garden.s2' }, { text: 'lesson.garden.s3' }],
    anchors: ['[data-testid="plan-garden-toggle"]', '[data-testid="building-garden-toggle"]'],
    tooltipOn: ['[data-testid="plan-garden-toggle"]', '[data-testid="building-garden-toggle"]'],
    clip: clip('garden'),
    open: { kind: 'action', action: 'garden' },
  },
  view3d: {
    id: 'view3d',
    group: 'look',
    name: 'lesson.view3d.name',
    line: 'lesson.view3d.line',
    steps: [
      { text: 'lesson.view3d.s1', touch: 'lesson.view3d.s1t' },
      { text: 'lesson.view3d.s2', touch: 'lesson.view3d.s2t' },
      { text: 'lesson.view3d.s3' },
    ],
    anchors: ['.house-view-switch', '.studio-view-switch'],
    tooltipOn: ['.studio-view-switch > button:last-child'],
    clip: clip('view3d'),
    open: { kind: 'view3d' },
  },
  walk: {
    id: 'walk',
    group: 'look',
    name: 'lesson.walk.name',
    line: 'lesson.walk.line',
    steps: [{ text: 'lesson.walk.s1' }, { text: 'lesson.walk.s2', touch: 'lesson.walk.s2t' }, { text: 'lesson.walk.s3', touch: 'lesson.walk.s3t' }],
    keys: 'lesson.walk.keys',
    anchors: ['.world-walk-launch'],
    tooltipOn: ['.world-walk-launch'],
    clip: clip('walk'),
    open: { kind: 'walk' },
  },
};

/** Every plan tool (`BuildTool`) has its lesson. */
export const TOOL_LESSON: Readonly<Record<BuildTool, LessonId>> = {
  hand: 'select',
  eyedropper: 'eyedropper',
  sledgehammer: 'remove',
  door: 'door',
  measure: 'measure',
  floor: 'floor',
  wallpaint: 'wallpaint',
  cladding: 'cladding',
};

/** Every designer mode (`DesignerMode`) has its lesson. */
export const MODE_LESSON: Readonly<Record<DesignerMode, LessonId>> = {
  move: 'select',
  wall: 'walls',
  floor: 'floor',
  paint: 'wallpaint',
  inspect: 'item',
  buy: 'furnish',
};

/** Every 3D House tool has its lesson. */
export const HOUSE_TOOL_LESSON: Readonly<Record<HouseTool, LessonId>> = {
  select: 'select',
  wall: 'walls',
  room: 'room',
  stair: 'stairs',
  window: 'door',
  door: 'door',
};

/** Loading-screen tips, in the order they rotate. */
export const LOADING_TIPS: readonly LessonTextKey[] = [
  'lesson.tip.esc',
  'lesson.tip.floorShift',
  'lesson.tip.undo',
  'lesson.tip.rotate',
  'lesson.tip.measure',
  'lesson.tip.paintRoom',
  'lesson.tip.walkDoors',
  'lesson.tip.lessons',
  'lesson.tip.hold',
];

/** Every button that gets a tooltip, with its lesson. */
export function tooltipTargets(): Array<{ selector: string; id: LessonId }> {
  return LESSON_IDS.flatMap((id) => LESSONS[id].tooltipOn.map((selector) => ({ selector, id })));
}
