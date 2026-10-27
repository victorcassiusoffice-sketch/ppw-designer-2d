/** Static metadata only. Import this from the deferred Walk module, never the initial scene. */
export interface WalkCharacter {
  id: string;
  label: string;
  url: string;
  thumbnailUrl: string;
  clips: { idle: string; walk: string; run: string };
  /** Source bind-pose height; fit the loaded model to the controller's avatar height. */
  heightM: number;
  bytes: number;
  licence: 'CC0-1.0';
  source: string;
}

const common = {
  clips: { idle: 'idle', walk: 'walk', run: 'sprint' },
  licence: 'CC0-1.0' as const,
  source: 'https://kenney.nl/assets/mini-characters',
};

export const WALK_CHARACTERS: readonly WalkCharacter[] = [
  {
    ...common,
    id: 'female-a',
    label: 'Maya',
    url: '/models/world-characters/kenney-female-a.glb',
    thumbnailUrl: '/models/world-characters/kenney-female-a.png',
    heightM: 0.7755173593759537,
    bytes: 92780,
  },
  {
    ...common,
    id: 'female-b',
    label: 'Lea',
    url: '/models/world-characters/kenney-female-b.glb',
    thumbnailUrl: '/models/world-characters/kenney-female-b.png',
    heightM: 0.7233427911996841,
    bytes: 92116,
  },
  {
    ...common,
    id: 'male-a',
    label: 'Alex',
    url: '/models/world-characters/kenney-male-a.glb',
    thumbnailUrl: '/models/world-characters/kenney-male-a.png',
    heightM: 0.6713277250528336,
    bytes: 92204,
  },
  {
    ...common,
    id: 'male-b',
    label: 'Sam',
    url: '/models/world-characters/kenney-male-b.glb',
    thumbnailUrl: '/models/world-characters/kenney-male-b.png',
    heightM: 0.6613336950540543,
    bytes: 91804,
  },
];

export const DEFAULT_WALK_CHARACTER_ID = WALK_CHARACTERS[0].id;
