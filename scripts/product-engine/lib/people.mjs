/**
 * Real-looking people for Walk mode: a made-up person drawn from words (never from a photo of
 * anyone), then rigged and animated by Meshy through fal, then one GLB with three clips named
 * idle / walk / run, textures to WebP, Draco, under the 1.5 MB character cap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { dedup, draco, mergeDocuments, prune, resample, textureCompress } from '@gltf-transform/functions';
import * as fal from './fal.mjs';
import { PERSON_TOOL, PICTURE_TOOL } from './prices.mjs';
import { CHARACTERS_DIR, RAW_PEOPLE_DIR } from './paths.mjs';
import { getIO, readBody } from './shape.mjs';

/** The cast: four made-up adults, two women and two men, real heights. Names are chooser labels, not identities. */
export const PEOPLE = [
  { id: 'nadia', label: 'Nadia', heightM: 1.68, look: 'a woman in her early thirties, medium-brown skin, black hair tied back in a low bun, a plain teal t-shirt, dark blue straight jeans and white trainers' },
  { id: 'kevin', label: 'Kevin', heightM: 1.78, look: 'a man in his late twenties, light-brown skin, short dark hair, a plain light-grey polo shirt, navy chinos and brown leather shoes' },
  { id: 'priya', label: 'Priya', heightM: 1.63, look: 'a woman in her forties, brown skin, shoulder-length dark hair, a plain cream linen blouse, olive trousers and flat tan sandals' },
  { id: 'ravi', label: 'Ravi', heightM: 1.75, look: 'a man in his fifties, dark-brown skin, short grey-flecked hair, a plain white short-sleeved shirt, dark trousers and black shoes' },
];

export const CHARACTER_BYTE_CAP = 1_500_000;

export function picturePrompt(person) {
  return `Full-body studio photograph of ${person.look}. A made-up person who does not exist. Standing straight in a relaxed A-pose, arms held slightly away from the body, legs slightly apart, facing the camera, neutral calm expression. The whole body is visible from the top of the head to the soles of the shoes, with clear empty space above the head and below the feet. Plain light-grey seamless studio background, soft even lighting, no shadow on the background, no props. Everyday clothes with no logos, no text, no patterns. Photorealistic, 85 mm lens, sharp focus.`;
}

export function personBill(people) {
  return people.map((p) => ({ id: p.id, label: p.label, picture: PICTURE_TOOL.price, body: PERSON_TOOL.price, total: PICTURE_TOOL.price + PERSON_TOOL.price }));
}

const stamp = () => new Date().toISOString();

/** Step 1: the picture. Saved raw and as a 384 px copy for the review sheet. */
export async function drawPicture(person, { seed, log = console.log } = {}) {
  fs.mkdirSync(RAW_PEOPLE_DIR, { recursive: true });
  const prompt = picturePrompt(person);
  log(`→ ${person.label}: drawing the picture (${PICTURE_TOOL.label})`);
  const t = await fal.run(PICTURE_TOOL.endpoint, PICTURE_TOOL.input(prompt, seed), { label: `picture ${person.id}`, onStatus: (s, q) => log(`   … ${s}${q !== null ? ` (queue ${q})` : ''}`) });
  const url = PICTURE_TOOL.imageUrl(t.out);
  if (!url) {
    fal.logSpend({ id: person.id, kind: 'picture', endpoint: PICTURE_TOOL.endpoint, price_usd: PICTURE_TOOL.price, seconds: t.seconds, request_id: t.request_id, ok: false, error: 'no image in the answer' });
    throw new Error(`no image in the answer: ${JSON.stringify(t.out).slice(0, 300)}`);
  }
  const bytes = await fal.download(url);
  const file = path.join(RAW_PEOPLE_DIR, `${person.id}-picture.png`);
  fs.writeFileSync(file, bytes);
  fal.logSpend({ id: person.id, kind: 'picture', endpoint: PICTURE_TOOL.endpoint, price_usd: PICTURE_TOOL.price, seconds: t.seconds, metrics: t.metrics, bytes: bytes.length, request_id: t.request_id, ok: true, prompt });
  const meta = await sharp(bytes).metadata();
  return { file, url, bytes: bytes.length, width: meta.width, height: meta.height, request_id: t.request_id, seconds: t.seconds, prompt, seed: t.out?.seed ?? seed ?? null };
}

/** Step 2: the rigged body with its clips, from the picture's fal URL. */
export async function makeBody(person, pictureUrl, { log = console.log } = {}) {
  log(`→ ${person.label}: body + rig + clips (${PERSON_TOOL.label})`);
  const t = await fal.run(PERSON_TOOL.endpoint, PERSON_TOOL.input(pictureUrl, person.heightM), { label: `person ${person.id}`, onStatus: (s, q) => log(`   … ${s}${q !== null ? ` (queue ${q})` : ''}`) });
  const out = t.out ?? {};
  const files = {
    rigged: out.rigged_character_glb?.url ?? null,
    walk: out.basic_animations?.walking_glb?.url ?? null,
    run: out.basic_animations?.running_glb?.url ?? null,
    idle: out.animation_glb?.url ?? null,
    model: out.model_glb?.url ?? null,
  };
  const missing = ['rigged', 'walk', 'run', 'idle'].filter((k) => !files[k]);
  if (missing.length) {
    fal.logSpend({ id: person.id, kind: 'person', endpoint: PERSON_TOOL.endpoint, price_usd: PERSON_TOOL.price, seconds: t.seconds, metrics: t.metrics, request_id: t.request_id, ok: false, error: `answer missing ${missing.join(', ')}`, keys: Object.keys(out) });
    throw new Error(`Meshy's answer is missing ${missing.join(', ')} (keys: ${Object.keys(out).join(', ')})`);
  }
  const saved = {};
  let total = 0;
  for (const [k, url] of Object.entries(files)) {
    if (!url) continue;
    const bytes = await fal.download(url);
    const file = path.join(RAW_PEOPLE_DIR, `${person.id}-${k}.glb`);
    fs.writeFileSync(file, bytes);
    saved[k] = file;
    total += bytes.length;
  }
  fal.logSpend({ id: person.id, kind: 'person', endpoint: PERSON_TOOL.endpoint, price_usd: PERSON_TOOL.price, seconds: t.seconds, metrics: t.metrics, bytes: total, request_id: t.request_id, ok: true, rig_task_id: out.rig_task_id ?? null, seed: out.seed ?? null });
  return { files: saved, request_id: t.request_id, seconds: t.seconds, rawBytes: total, rigTaskId: out.rig_task_id ?? null };
}

/**
 * Step 3: one GLB, three clips. The rigged body is the base; each clip file's animation is merged
 * in and its channels re-pointed at the base's bones by name; the merged duplicate body is removed.
 */
export async function mergeClips(baseFile, clips, outFile) {
  const io = await getIO();
  const target = await io.read(baseFile);
  for (const a of target.getRoot().listAnimations()) a.dispose();
  const baseNodes = new Map(target.getRoot().listNodes().map((n) => [n.getName(), n]));
  const report = [];
  for (const { name, file } of clips) {
    const source = await io.read(file);
    const animations = source.getRoot().listAnimations();
    if (!animations.length) throw new Error(`${path.basename(file)} holds no animation`);
    const before = new Set(target.getRoot().listNodes());
    const map = mergeDocuments(target, source);
    const copied = map.get(animations[0]);
    copied.setName(name);
    let retargeted = 0;
    for (const ch of copied.listChannels()) {
      const node = ch.getTargetNode();
      const match = node ? baseNodes.get(node.getName()) : null;
      if (!match) throw new Error(`clip ${name}: the base body has no bone named ${node?.getName() ?? '(none)'}`);
      ch.setTargetNode(match);
      retargeted++;
    }
    for (const extra of map.values()) {
      if (extra.propertyType === 'Animation') continue;
      if (extra.propertyType === 'Node' && before.has(extra)) continue;
      if (['Node', 'Scene', 'Mesh', 'Skin', 'Material', 'Texture', 'Camera', 'Light'].includes(extra.propertyType)) extra.dispose();
    }
    report.push({ name, channels: retargeted, duration: Math.max(...copied.listSamplers().map((s) => { const v = s.getInput().getArray(); return v[v.length - 1] - v[0]; })) });
  }
  await target.transform(dedup(), resample(), prune());
  await io.write(outFile, target);
  return report;
}

/** Step 4: the served copy: WebP textures, Draco, the topology as Meshy made it (skinned meshes are not simplified). */
export async function optimiseCharacter(inFile, outFile) {
  const io = await getIO();
  const doc = await io.read(inFile);
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage();
    if (img && img[0] === 0xff && img[1] === 0xd8 && tex.getMimeType() !== 'image/jpeg') tex.setMimeType('image/jpeg');
    if (img && img[0] === 0x89 && img[1] === 0x50 && tex.getMimeType() !== 'image/png') tex.setMimeType('image/png');
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /baseColor/i, quality: 84 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], slots: /metallicRoughness|normal|occlusion|emissive/i, quality: 70 }),
    dedup(),
    prune(),
    draco({ method: 'edgebreaker' }),
  );
  await io.write(outFile, doc);
  const body = await readBody(outFile);
  const bytes = fs.statSync(outFile).size;
  return { bytes, triangles: body.triangles, textures: body.textures, animations: body.animations, skins: body.skins, extents: body.extents, sha256: createHash('sha256').update(fs.readFileSync(outFile)).digest('hex') };
}

export function characterPaths(person) {
  fs.mkdirSync(CHARACTERS_DIR, { recursive: true });
  return { glb: path.join(CHARACTERS_DIR, `${person.id}.glb`), png: path.join(CHARACTERS_DIR, `${person.id}.png`), url: `/models/world-characters/${person.id}.glb`, thumbnailUrl: `/models/world-characters/${person.id}.png` };
}

export const PERSON_LICENCE = 'Generated 2026-11: FLUX.1 [dev] picture + Meshy 7.1 body, rig and clips through fal.ai (model pages: Commercial use). A made-up person; no photo of anyone was used.';

export { stamp };
