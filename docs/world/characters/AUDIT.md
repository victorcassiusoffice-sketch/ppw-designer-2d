# Walk character audit — 27 October 2026

The four shipped characters are the explicitly authorized Kenney fallback. The requested conventionally proportioned Quaternius characters could not pass the source audit on this date: the official men's and women's download locations were reachable anonymously, but both required `License.txt` downloads returned Google's **Quota exceeded** page. No account, login, bypass, paid asset or AI-generated asset was used. The Quaternius pack pages describe CC0 and 24 animations, but that is not a substitute for inspecting the required licence and model files inside the actual download. Therefore their archive hashes, animation playback and converted sizes are **unavailable**, not guessed.

Official sources checked on 2026-10-27:

- Men: https://quaternius.com/packs/ultimatemodularcharacters.html → https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX
- Women: https://quaternius.com/packs/ultimatemodularwomen.html → https://drive.google.com/drive/folders/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf
- Licence file IDs returned by those author-linked folders: men `1TTvylHa1CsiJuHFWWiv6PFGhLM-aAH5z`; women `1lIFL16xEpoPbr0j_HUATgmcEnAmYoIK2`. Anonymous public download attempts both returned the quota error. An HTML error page was not treated as a licence or asset archive.

## Shipped source and permissions

- Pack: **Kenney Mini Characters 1.0**, author creation date **17 July 2024**.
- Author page: https://kenney.nl/assets/mini-characters
- Download inspected 2026-10-27: https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip
- Archive: `kenney_mini-characters.zip`, **2,403,059 bytes**.
- Archive SHA-256: `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999`.
- Licence found in the archive: `License.txt`, **CC0**. Its full text is preserved in `Kenney-Mini-Characters-LICENSE.txt`; full CC0 legal code is in `CC0-1.0-legalcode.txt` and must also be copied into the common `docs/world/LICENCES.md` before shipping.
- Source model paths: `Models/GLB format/character-{female-a,female-b,male-a,male-b}.glb`; source texture `Models/GLB format/Textures/colormap.png`, 8,706 bytes, 512 × 512 PNG. The small chooser images are the author's matching PNG previews, redistributed under the same pack licence.
- These are visibly stylized, clothed people, not realistic GTA-like proportions. Source accessories remain unchanged. Display names are local chooser labels, not identities of real people.

## Conversion and budgets

Run `node docs/world/characters/prepare.mjs <unpacked-pack-directory>` with the repository's glTF Transform 4.5.0 and Draco encoder 1.5.7. The reproducible script retains only `idle`, `walk`, `sprint`; removes unused animation data; deduplicates; resamples; and Draco-encodes geometry. It does not simplify or change the source topology. The GLB writer embeds the source PNG. Each encoded GLB was read back successfully through the Draco decoder. Each has two skinned render meshes sharing the deduplicated skin, exactly three clips, and no external image or buffer URI.

| App label / source | GLB bytes, including texture and clips | Triangles | SHA-256 |
|---|---:|---:|---|
| Maya / female-a | 92,780 | 876 | `f7cb20396703778fe8f5c2b3d2b46c9c1c89d11f103e92b7522b74102b05c9b3` |
| Lea / female-b | 92,116 | 742 | `3c1e619550ca2417021b03df1d09ff3d55c33151c676ed1b3efb6368578bf757` |
| Alex / male-a | 92,204 | 723 | `9d3e439ecfb571f6235feac4a0d3e85c7e98244c04b0445fc48210e787f50a8d` |
| Sam / male-b | 91,804 | 690 | `a15a654b41c0e3b0334fae432b1056819f458cb1303fc466780d0b4350285936` |

All four pass the **less than 1,500,000 bytes per character** cap. Four models total **368,904 bytes**; only the chosen model should load, with other models fetched on selection after Walk opens. Chooser PNGs total 7,231 bytes and must also wait for the deferred Walk UI. `src/walk/characters.ts` is static metadata; it must not be imported by the initial 3D picture path.

## Runtime mapping and render check

- `idle` → `idle` (1.3333 s); `walk` → `walk` (0.6667 s); `run` → `sprint` (0.5 s).
- Y is up, **+Z is forward**. Feet are at y ≈ 0. Fit the loaded `Box3` height to the avatar/controller's target height and move its minimum Y to the floor. At 1.7 m, scale factors are 2.1921 / 2.3502 / 2.5323 / 2.5706 in table order. Keep the collision capsule dimensions independent of the stylized body shape.
- Existing runtime decoder path: `/draco/`. `public/draco/draco_decoder.wasm` SHA-256 is `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac`; it exactly matches the glTF-targeted decoder bundled with installed Three r186. Its semantic version is not recorded in the served file; do not label it the same version as the 1.5.7 build encoder.
- Checked all four delivered GLBs with Three r186 `GLTFLoader`, the existing runtime `DRACOLoader`, `AnimationMixer`, and Playwright Chromium/WebGL SwiftShader. Each character rendered with its texture. Each clip was sampled at 0.12 s and 0.30 s (24 character/clip/sample checks). Every sample changed bone components, all transforms were finite, and no page errors occurred. Idle, walk and sprint rendered frames were visually inspected; front/back views confirmed +Z forward. `render-validation.json` preserves the check, with three canvas renders beside it.
- This isolated asset check is not a claim that in-app blending, movement, chooser timing or phone frame rates have passed; those belong to the Walk integration evidence.

## Decision to copy into common DECISIONS.md

2026-10-27 — Use the four verified Kenney Mini Characters 1.0 instead of Quaternius: official Quaternius downloads quota-blocked the required in-pack licence audit; explicit fallback is lawful, animated and 92 KB per character. Reversing costs a new source/licence audit, four GLB conversions, thumbnails and manifest updates, followed by animation/performance checks; no measurement or controller change is needed.
