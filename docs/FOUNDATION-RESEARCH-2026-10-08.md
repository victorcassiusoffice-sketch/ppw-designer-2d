# Foundation and utility coordination research — 8 October 2026

## What this build measures

One saved foundation model owns the plan footprint, 3D envelope and concrete volume. Slab/raft, strip and pad rectangles have explicit length, width, depth and top elevation relative to the ground-floor datum. These names describe geometry; they do not select a safe structural design. The model must replace the older Materials ground-base allowance when enabled. Adding both would duplicate concrete.

Concrete volume uses the three-dimensional union of the entered prisms, so a crossing strip and pad are not counted twice. Ready-mix orders use wet volume with one allowance. Site-mix uses the same editable loose-volume assumptions as Materials. A ratio is not a strength class, and wet concrete volume is not added to its ingredient quantities as another cost.

Reinforcement is opt-in and counts only an entered straight, orthogonal mesh schedule. Each cut receives whole stock lengths and entered lap allowance; no reuse of offcuts is assumed. Overlapping reinforced elements withhold steel totals until their schedules are separated. Links, starters, hooks, anchorage, chairs, punching shear, strength and soil-bearing design are outside this quantity model. The 3D envelope does not invent visible bars or hidden reinforcement.

## Primary supplier evidence

- [Kolos construction guide](https://www.koloscement.com/media/lpolxoii/bat-sima_-guide-de-la-construction.pdf), PDF page 9: mix selection depends on intended use and required performance; trials and competent approval are required. It identifies local rocksand/macadam use. Loose-volume estimator factors remain assumptions, not supplier-certified yield.
- [Joonas Steel](https://www.joonasco.com/steel-mauritius/): publishes mild round steel 6–25 mm, high-tensile 8–32 mm and cut-and-bend service. This page does not establish exact current stock lengths, mill certificates or a project-specific grade. Do not label the starting 6 m stock assumption as verified Joonas stock.
- [Kosto material information](https://www.kosto.mu/material-info/): publishes reinforcement scheduling references and local A142, A252 and A393 mesh ranges. Its page cites historical BS 8666:2005 and BS 4483:1985 editions; this is supplier information, not evidence that those are the currently applicable national code editions. Mesh sheets, fabricated bars and straight stock must remain distinct product units.

## Utility coordination boundaries

- [CEB frequently asked questions](https://ceb.mu/customer-corner/frequently-asked-questions): the supply workflow includes a technical site visit, work by a qualified electrician, mandatory residual-current protection and a later compliance visit. A drawn conduit is not an electrical design, protection selection or authorisation to connect to the public network.
- [WMA BLUP guidelines, December 2016](https://www.wmamauritius.mu/wp-content/uploads/2019/10/Guidelines-for-obtaining-a-BLUP-Clearance-from-the-WMA-Dec-2016.pdf): WMA evaluates sewer connection feasibility and advises the connection point. The source is an older document currently linked by WMA; reconfirm project requirements. The app should record an external connection/invert only when supplied for the project, not auto-approve an invented sewer endpoint.
- [CWA supply regulation PDF, government-hosted historical copy](https://publicutilities.govmu.org/Documents/2020/Legislation/Water/Central%20Water%20Authority/Regulation/cwa111.pdf): search indexing exposes provisions concerning approved pipework, inspection before covering and direct pump connections. Direct PDF retrieval was unavailable during this research. It is not a sufficient basis for enforcing current numeric rules automatically. Confirm current CWA requirements and approvals for the actual supply scheme.

Fixture ports and cross-floor routes should refer to saved fixture identities and floor elevations. Do not infer connectivity from a visually intersecting pipe. Mains supply, water storage, public sewer and an electrical board are different network roles. Below-ground pipe/conduit selections require verified application/pressure/temperature/load suitability, surveyed coordinates and utility review; a catalogue outside diameter is not a bore or cable capacity.

## Implemented services coordination

The services plan now has explicit start/end links to compatible generic fixture ports. A saved link follows fixture movement, rotation and edited port elevations. Deleting its fixture retains the route's last coordinates and unresolved reference, so a visible warning survives save/reload; the user reconnects or selects Free endpoint. Coloured schematic ports can be clicked while drawing, or selected in the route inspector. Mere crossings do not connect routes.

Links are currently restricted to the same floor and service system. A vertical riser can still be drawn using the existing measured start/end elevations, but the app does not claim an automatically connected cross-floor network. Generic port offsets need manufacturer/site confirmation. A drainage-connection marker requires a user-entered surveyed invert before it accepts a link. Mains and board markers do not authorise connection to public infrastructure.

Foundation footprints are shown behind ground-floor services for coordination; pipe clashes, sleeves and structural penetrations are not automatically engineered. Existing constant-gradient route lengths include vertical changes. Fittings and hydraulic/electrical performance are still separate from centre-line quantities.

## Acceptance checks

1. Change a saved foundation dimension: the 2D footprint, 3D envelope and net quantity change together.
2. Overlap two concrete solids: their shared volume is counted once; stacked solids with no vertical overlap remain additive.
3. Enable foundation mode: the legacy ground-base estimate is superseded, never summed again.
4. Switch ready-mix/site-mix: one concrete allowance, mutually exclusive order bases.
5. Enable impossible mesh cover/layers or malformed dimensions: preserve previous valid model and explain the rejection.
6. Edit, switch tools or change dimensions: preserve camera position until Fit or explicit zoom is used.
7. Disable or remove foundation: remove its rendered geometry and quantities together; Undo restores both.

No claim is made that the foundation is structurally approved or that the tool replaces geotechnical investigation, utility clearance or professional design.
