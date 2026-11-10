# Designer canvas checks

Open the 2D or 3D Designer and select **Preferences → Colour theme**. **Match colour theme** is the default build backdrop. Glacier blue, Deep ocean and Slate change the workspace outside the property. Gallery, Blueprint and timed sunlight keep their own presentation. Grass, paint, flooring and measured geometry retain their scene data.

An unfurnished room and a blank project both leave the centre available for drawing. Open **First build** or a tool tip when you want instruction. Wall drawing keeps its controls at the edge. Placement has one instruction and Cancel. City Build shows placement guidance while a drawing tool is active; its navigation instructions are under **Your site → View controls**.

The ten PNGs show the built application at 1280 × 800 and 390 × 844. `browser-results.json` contains actual WebGL pixel samples, centre hit tests and browser diagnostics. The script checks each theme at both sizes, preserved framing, the public demo, private unfurnished and blank plans, and the City plan and 3D views.

Run `npm run build`, `npm run preview -- --host 127.0.0.1 --port 5173 --strictPort`, then `node tools/qa-canvas-usability.mjs`. The browser checks seed a local project, stub API reads and block network writes.
