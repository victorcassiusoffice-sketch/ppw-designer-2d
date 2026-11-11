import mayaThumbnail from './thumbnails/kenney-female-a.png?inline';
import leaThumbnail from './thumbnails/kenney-female-b.png?inline';
import alexThumbnail from './thumbnails/kenney-male-a.png?inline';
import samThumbnail from './thumbnails/kenney-male-b.png?inline';
import generated from './characters.generated.json';

/** Metadata and tiny PNGs arrive together in the deferred chooser, never the initial scene. */
export interface WalkCharacter {
  id: string;
  label: string;
  url: string;
  thumbnailUrl: string;
  /** Exact in-pack PNG, inlined so the visible chooser never waits for another request. */
  thumbnailDataUrl: string;
  clips: { idle: string; walk: string; run: string };
  /** Source bind-pose height; fit the loaded model to the controller's avatar height. */
  heightM: number;
  bytes: number;
  /** 'CC0-1.0' for the Kenney four; the generated people carry the generator's licence note. */
  licence: string;
  source: string;
  /** A generated person's real height, metres (the walk still scales every body to its own height). */
  realHeightM?: number;
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
    thumbnailDataUrl: mayaThumbnail,
    heightM: 0.7755173593759537,
    bytes: 92780,
  },
  {
    ...common,
    id: 'female-b',
    label: 'Lea',
    url: '/models/world-characters/kenney-female-b.glb',
    thumbnailUrl: '/models/world-characters/kenney-female-b.png',
    thumbnailDataUrl: leaThumbnail,
    heightM: 0.7233427911996841,
    bytes: 92116,
  },
  {
    ...common,
    id: 'male-a',
    label: 'Alex',
    url: '/models/world-characters/kenney-male-a.glb',
    thumbnailUrl: '/models/world-characters/kenney-male-a.png',
    thumbnailDataUrl: alexThumbnail,
    heightM: 0.6713277250528336,
    bytes: 92204,
  },
  {
    ...common,
    id: 'male-b',
    label: 'Sam',
    url: '/models/world-characters/kenney-male-b.glb',
    thumbnailUrl: '/models/world-characters/kenney-male-b.png',
    thumbnailDataUrl: samThumbnail,
    heightM: 0.6613336950540543,
    bytes: 91804,
  },
  // Real-looking people made by the product engine (scripts/product-engine, 2026-11): made-up
  // adults, rigged and animated through fal. The Kenney four stay as the fallback.
  ...(generated as WalkCharacter[]),
];

export const DEFAULT_WALK_CHARACTER_ID = WALK_CHARACTERS[0].id;
