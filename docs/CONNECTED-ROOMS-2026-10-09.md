# Connected wall rooms — 9 October 2026

Both the plan wall pen and direct 3D wall tool use the same `propertyStore.addFreeWalls` operation. A floor's existing room edges and free walls form a planar graph. Endpoint joins use a 1 mm tolerance; proper intersections and T junctions split graph edges. Bounded graph faces become rooms, including triangles, L shapes and concave U shapes. Existing shared edges are reused rather than redrawn.

The 2D pen checks the released/tapped run and commits as soon as a new face forms. Its magnets include free walls and only the current floor. The 3D tool performs the same operation per released segment. Room conversion and roof synchronization are part of the wall commit, so undo restores the pre-closure walls and room state together.

Partitions replace the parent room only when the resulting faces conserve its area and every opening survives. The largest face keeps the original room id/name. Items keep their world coordinates; children of a surface remain with the parent. Wall finishes and openings are projected onto surviving world edges, floor tiles retain their lattice and are clipped to each new room, and unclosed wall tails keep their metadata. Shared masonry lengths remain counted once by the existing physical-wall estimator.

Concave-room overlap testing now requires verified interior probes. A vertex-average outside its own U-shaped polygon no longer falsely triggers overlap or causes the legacy unstack operation to move valid attached rooms.

## Limits

- An isolated nested loop requires a floor hole, which the current room model cannot represent. The enclosing cycle remains walls instead of creating an overlapping room.
- A partition that bisects an existing opening remains a free wall; it does not discard the opening or generate incomplete rooms.
- Automatic inference is bounded at 2,048 input segments and 16,000 split records. Excessively complex imported graphs retain their walls without automatic room conversion.
- Existing 2D/3D room-wall thickness conventions remain unchanged: plan/free-wall placement uses 0.10 m by default, while the existing room-cap renderer uses 0.14 m. This work preserves world centreline geometry and shared length/area measurement, not a new structural wall-thickness model.

## Verification

125 focused tests passed across connected-room geometry, wall gesture validation, 3D commit/undo, room overlap, edge resizing, and the existing plan wall layer/HUD tests. The property store's 103 existing tests also passed after store integration. New regressions cover adjacent triangles, partial shared edges, L/U shapes, diagonal and crossing partitions, floor isolation/heights, snapped joints, nonclosure, duplicate prevention, tails, finish-face counts, opening preservation and undo/redo.
