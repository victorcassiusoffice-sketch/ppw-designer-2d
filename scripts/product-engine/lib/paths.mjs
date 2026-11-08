/** Where the engine reads and writes. One place, so no script guesses a path. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root: scripts/product-engine/lib → ../../.. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Generator output as delivered. Ignored by git, OUTSIDE public/ so no build copies 5–50 MB bodies. */
export const RAW_DIR = path.join(ROOT, 'models-raw');
export const RAW_PEOPLE_DIR = path.join(RAW_DIR, 'people');
/** Every fal submission is journaled before it is polled, so an interrupted run can be resumed by request id. */
export const JOURNAL = path.join(RAW_DIR, 'fal-journal.jsonl');

export const PUBLIC_DIR = path.join(ROOT, 'public');
export const MODELS_DIR = path.join(PUBLIC_DIR, 'models');
/** Test candidates (one body per tool) live here until Victor picks a tool; `adopt` promotes them. */
export const CANDIDATES_DIR = path.join(MODELS_DIR, 'candidates');
export const CHARACTERS_DIR = path.join(MODELS_DIR, 'world-characters');
export const TOPDOWN_DIR = path.join(PUBLIC_DIR, 'products', 'topdown');
export const CATALOG_MODELS_DIR = path.join(PUBLIC_DIR, 'products', 'catalog-models');

export const PRODUCTS_JSON = path.join(ROOT, 'src', 'data', 'products.json');
export const COURTS_JSON = path.join(ROOT, 'src', 'demo', 'courts', 'products.json');
export const MANIFEST = path.join(ROOT, 'src', 'data', 'productModels.json');
export const THUMBS_MANIFEST = path.join(ROOT, 'src', 'data', 'catalogModelThumbnails.json');
/** Generated people for the Walk chooser; `src/walk/characters.ts` spreads this list after the Kenney four. */
export const CHARACTERS_JSON = path.join(ROOT, 'src', 'walk', 'characters.generated.json');
export const WALK_THUMBS_DIR = path.join(ROOT, 'src', 'walk', 'thumbnails');

export const DOCS_DIR = path.join(ROOT, 'docs', 'product-engine');
export const RUNS_DIR = path.join(DOCS_DIR, 'runs');
export const SPEND_LOG = path.join(DOCS_DIR, 'fal-spend-log.json');
/** The September log sits beside this one; both are read by the README's spend table. */
export const SEPTEMBER_SPEND_LOG = path.join(ROOT, 'docs', 'designer-3d-mode-2026-09-17', 'fal-spend-log.json');

/** The Fal key: read at run time by the fal module only. Never opened, printed, copied or moved by anything else. */
export const KEY_FILE = process.env.PPW_FAL_KEY_FILE || 'C:\\Users\\Victor\\Documents\\junk files\\fal-ai-api-key.txt';

/** Catalogue photos are served from production; fal needs a public URL (or a data URI for a file that is not there yet). */
export const PHOTO_BASE = 'https://designer.ppwellness.co';

export function runDir(name) {
  return path.join(RUNS_DIR, name);
}
