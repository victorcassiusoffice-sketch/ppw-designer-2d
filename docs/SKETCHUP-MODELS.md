# SketchUp models in Room Designer

Research and implementation: 29 September 2026.

The Designer can render detailed product components exported from SketchUp as self-contained GLB files. The importer connects those assets to the existing product catalog and Three.js renderer. It preserves the product's measured catalog dimensions, placement, rotation and estimates. It does not embed SketchUp's editing engine or convert a whole building into editable room walls.

## Supported workflow

1. Obtain the supplier's own component and permission to publish it. Export only the product, without unrelated geometry, animation or rigging.
2. In a supported SketchUp desktop edition, use **File → Export → 3D Model → GLTF Binary File (.glb)**, embedding textures. See the [official GLB export instructions](https://help.sketchup.com/en/sketchup/working-gltf-files). SketchUp lists GLB support under Pro/Studio in its [format compatibility guide](https://help.sketchup.com/en/sketchup/using-sketchup-data-other-modeling-programs-or-tools).
3. Match an existing catalog product ID and check its length, width and height in centimetres. The importer currently reads the main seed catalog and the Courts demo catalog. New products must first be added to those catalog sources with measured dimensions.
4. From the active repository, validate the file without changing the catalog:

```powershell
npm run models:import-sketchup -- --in "C:\Models\sofa.glb" --product courts-marco-sofa-corner --source "Supplier component reference" --licence "Supplier permission reference" --dry-run
```

5. Remove `--dry-run` to import. Use `--replace` only when intentionally replacing an existing model mapping. `--front +z|-z|+x|-x` and `--length-axis auto|x|z` control orientation. glTF's Y-up axis is used.
6. Inspect the result in the local 3D designer. Compare dimensions, facing, textures and phone performance with the real item. The asset is fitted per axis to the catalog box; a wrong source component or wrong dimensions can distort the model. The footprint and cost remain based on the catalog, not mesh appearance.
7. Commit the new `public/models/<product>-sketchup-<hash>.glb` and `src/data/productModels.json` mapping, then publish only the authorized feature preview branch. Do not deploy production.

The importer validates binary glTF 2, embedded resources, non-empty 3D geometry and product dimensions. It records source/licence/SKU, preserves previous model assets, and refuses an accidental overwrite. Existing optimization reduces texture size and targets20,000 triangles using Draco, already supported by the renderer. Raw assets are retained in ignored `models-raw/`; they are not published. Reviewed imports can replace procedural solar/tank previews. Remote catalog rows sharing the recorded SKU can use the same model.

## What is not integrated

- Direct `.skp` parsing or SketchUp authoring inside the browser. SketchUp's [Desktop SDK](https://developer.sketchup.com/) and [C API](https://extensions.sketchup.com/developers/sketchup_c_api/sketchup/index.html) expose native model access. A native/server conversion service would be a separate integration with its own SDK access and deployment requirements.
- Automatic 3D Warehouse downloads or permission to redistribute arbitrary models.
- Merchant self-service GLB uploads or automatic conversion of imported building meshes into editable rooms, doors and quantity take-offs.

No supplier SketchUp asset was provided in this pass. The importer is tested with original fixture geometry; existing real product assets remain in place. A newly imported appearance must not be described as manufacturer CAD unless its provenance supports that claim.
