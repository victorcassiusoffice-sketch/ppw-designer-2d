/** Rebuild the four walk assets from Kenney Mini Characters 1.0.
 * Usage: node docs/world/characters/prepare.mjs <unpacked pack directory>
 * The source archive hash and licence are recorded in AUDIT.md.
 * Uses the repository's existing glTF Transform and Draco development tools.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, getBounds, prune, resample } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const input = process.argv[2];
if (!input) throw new Error('Pass the unpacked Kenney Mini Characters 1.0 directory.');
const output = path.join(repository, 'public/models/world-characters');
fs.mkdirSync(output, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const ids = ['female-a', 'female-b', 'male-a', 'male-b'];
const reports = [];
for (const id of ids) {
  const source = path.join(input, 'Models/GLB format', `character-${id}.glb`);
  const document = await io.read(source);
  const root = document.getRoot();
  const sourceClips = root.listAnimations().map((animation) => animation.getName());
  for (const name of ['idle', 'walk', 'sprint']) {
    if (!sourceClips.includes(name)) throw new Error(`${id}: missing ${name}`);
  }
  for (const animation of root.listAnimations()) {
    if (!['idle', 'walk', 'sprint'].includes(animation.getName())) animation.dispose();
  }
  // Keep source topology/skin intact; remove unused animation data and encode geometry.
  await document.transform(dedup(), resample(), prune(), draco({ method: 'edgebreaker' }));
  const destination = path.join(output, `kenney-${id}.glb`);
  await io.write(destination, document);
  const bytes = fs.readFileSync(destination);
  if (bytes.length >= 1_500_000) throw new Error(`${id}: exceeds the character budget`);
  // Read the encoded file back through Draco to verify the delivered document.
  const roundTrip = await io.read(destination);
  const restored = roundTrip.getRoot();
  const bounds = getBounds(restored.getDefaultScene());
  const clips = restored.listAnimations().map((animation) => ({
    name: animation.getName(),
    channels: animation.listChannels().length,
    duration: Math.max(
      ...animation.listSamplers().map((sampler) => {
        const values = sampler.getInput().getArray();
        return values[values.length - 1] - values[0];
      }),
    ),
  }));
  reports.push({
    id,
    sourceBytes: fs.statSync(source).size,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    clips,
    skins: restored.listSkins().length,
    textures: restored.listTextures().map((texture) => ({
      mimeType: texture.getMimeType(),
      bytes: texture.getImage().length,
    })),
    bounds,
    heightM: bounds.max[1] - bounds.min[1],
    triangles: restored
      .listMeshes()
      .reduce(
        (sum, mesh) =>
          sum +
          mesh
            .listPrimitives()
            .reduce(
              (subtotal, primitive) =>
                subtotal +
                (primitive.getIndices()?.getCount() ??
                  primitive.getAttribute('POSITION').getCount()) /
                  3,
              0,
            ),
        0,
      ),
  });
}
fs.writeFileSync(
  path.join(repository, 'docs/world/characters/assets.json'),
  `${JSON.stringify(reports, null, 2)}\n`,
);
console.log(JSON.stringify(reports, null, 2));
