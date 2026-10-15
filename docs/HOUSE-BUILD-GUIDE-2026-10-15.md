# House build guide — 15 October 2026

One Live Build helps a customer, designer and specialist coordinate the same measured project. This guide explains the tools that are implemented. It is a design-review sequence, not site construction instructions, a structural design service or regulatory approval.

## Open the working tools

The release owner replaces `<PREVIEW>` with the verified deployment origin before handover.

- `<PREVIEW>/demo?view=2d&pitch=1` - One Live Build Designer: customers, interior designers and house-building teams; open **Guide** (accessible name **House build guide**) in the plan toolbar.
- `<PREVIEW>/demo?view=3d&pitch=1` - One Live Build Designer: spatial building and product review.
- `<PREVIEW>/demo?view=2d&panel=foundation&pitch=1` - One Live Build Foundation: designers and engineers coordinating measured excavation, concrete and entered reinforcement quantities.
- `<PREVIEW>/demo?view=2d&panel=services&pitch=1` - One Live Build Building services: plumbing, electrical, HVAC, fire and security teams; choose **3D edit** inside the workspace to edit routes spatially.
- `<PREVIEW>/demo?panel=project&pitch=1` - One Live Build Project hub: project assumptions, discipline review and handover.
- `<PREVIEW>/pitch/plumbing` - One Live Build plumbing pitch: suppliers, installers and bathroom showrooms.

Choose a guide step, read its review note and select **Open this tool**. The guide collapses so the drawing stays usable. Use its resume control to return. **Minimise**, **Close**, Escape or clicking outside dismisses the guide without trapping the canvas. A tick records your own review, not a completed installation or approval. Progress is saved locally per project in this browser; it is not a shared cloud approval record. English, French, Spanish and Simplified Chinese guide copy is available through the app language preference.

## The 19 review steps

1. **Project brief.** Open the project hub. Record the site, intended use and assumptions; identify the information still needed.
2. **Plan and scale.** Import a supported plan or draw measured geometry. Check working units and a known dimension. An image alone does not prove scale.
3. **Excavation.** Open Foundation. Choose **Dig rectangular hole** or **Circular hole**, enter depth and, for a circle, diameter. Place the hole and check its centre, top and bottom elevations. Request ground and support review.
4. **Foundation concrete and steel.** Select a rectangular footing, enter the approved thickness and engineer's reinforcement schedule, then **Add concrete**. Review supply and allowance. Circular holes do not infer piles, concrete fill or steel.
5. **Walls and rooms.** Draw connected walls that close rooms. Check shared edges, dimensions, wall height, thickness, materials and openings.
6. **Doors and windows.** Place openings on their walls. Check sizes, swing and usable circulation in plan and 3D.
7. **Floors and stairs.** Add or choose a storey in the floor selector. Review elevations, floor heights, stairs and openings between levels.
8. **Plumbing and drainage.** Choose the floor and service type. Place mains and fixtures, then connect measured routes. Have a specialist check underground elevations, pipe sizes, maintenance access and hydraulic/drainage design.
9. **Electrical and data routes.** Coordinate mains, distribution points and measured conduit/data paths. Keep systems separate. Electrical protection, loads and cable sizing require the responsible designer.
10. **Ventilation and cooling.** Position equipment and HVAC routes. Review access, condensate and clashes. Airflow and cooling capacity require specialist calculations.
11. **Fire systems coordination.** Position agreed components and routes. This is coordination geometry; evacuation, fire coverage and approval remain professional responsibilities.
12. **Security and connected devices.** Coordinate device locations, power and data. Review privacy, maintenance and coverage with the supplier.
13. **Roof and solar.** Choose the roof level, shape and measured build-up. Place solar equipment; review orientation, shade, support and energy-estimate limits separately.
14. **Paint and surfaces.** Choose wall faces and flooring. Enter paint coats and coverage. Check openings deducted from areas and the supplier's product specification.
15. **Furniture and equipment.** Place catalogue objects to scale. Compare plan and 3D, check dimensions and leave space for use, doors and maintenance.
16. **Landscape and ecology.** Coordinate outdoor surfaces, paths and planting. Review levels, drainage, access and protection of retained trees before assigning materials.
17. **Quantities and assumptions.** Open Materials. Review units, net quantities, allowances, mix inputs and missing specifications. Do not double-count foundation and ground-base allowances.
18. **Professional review.** Inspect plan, elevations and 3D. Review project findings, clashes and missing information with the responsible designers before export or procurement.
19. **Supplier schedule and handover.** Review equipment packages, recipient emails and proposed order, invoice and delivery dates. These are drafts: they do not send orders or invoices. Confirm backend capability and supplier approval separately.

## Find and measure a circular hole

In the floor selector choose **Foundation · excavate & concrete**. The **Hole dimensions** card is open initially; **Details** shows or hides it. Set **New hole depth m** and **New circular hole diameter m**, choose **Circular hole** or **Place circular hole**, then tap the centre on the plan. Select the placed circle to edit **Hole diameter m**, **Hole depth m**, **Hole top elevation m**, **Hole centre X m** and **Hole centre Y m**.

Use **3D foundation** to inspect the open hole. Return through the floor selector. The 2D circle, 3D soil cylinder and saved dimensions use the same metre-based geometry. The individual excavation volume is `π × (diameter / 2)² × depth`; visual mesh faceting does not determine the quantity.

This is a measured excavation cylinder, not an automatically designed concrete pile. No concrete or reinforcement is generated from the circle. If a circle intersects another excavation or concrete body at overlapping elevations, the combined excavation total is withheld as **Review overlaps**; do not sum the individual gross volumes. For rectangular concrete, use the separate footing geometry and entered reinforcement workflow. An enabled excavation-only foundation model replaces the legacy base allowance and has zero concrete until concrete geometry is included.

## Draw and review connected services

In the floor selector choose **Plumbing & Electric**, opening **Building services**. The floor selector remains available for return to a building level. Choose a system from **Route system** and equipment from **Place equipment**. Switch between **2D plan** and **3D edit** inside this workspace. **3D** in its header instead returns to the whole-house view.

Draw a route and explicitly attach compatible fixture ports or route nodes; **Finish** saves the run. Crossing lines alone are not a connection. Move connected fixtures to carry their linked endpoints with them. Select a route and drag its nodes, or edit measured node elevations. Review measured lengths, available supply-length assumptions and incomplete connection findings.

Use **Layers** in the house view to isolate plumbing, electrical/lighting, HVAC, fire, security/data or other disciplines without deleting saved geometry or changing quantities. **Show all** restores visibility. Ports and product models are dimensional illustrations; sizing, flow, pressure, drainage falls, clearances, fire coverage and compliance remain specialist checks. A route on another floor needs its own measured coordination; connectivity is not an automatic hydraulic network solution.

## Files for the next employee or AI

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer` - One Live Build product repository: all design and supplier workflow markets.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\HOUSE-BUILD-GUIDE-2026-10-15.md` - One Live Build employee/customer guide: house-design review from brief to supplier schedule.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\FOUNDATION-TUTORIAL-WORKFLOW-2026-10-15.md` - One Live Build developer handover: foundation quantities, persistence and tutorial event contracts.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\houseBuildTutorial.ts` - One Live Build source of truth: the 19 guide steps, action IDs and four-language copy.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\HouseBuildTutorial.tsx` - One Live Build guided UI: dismissible steps and project-local review progress.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\FoundationWorkspace.tsx` - One Live Build excavation and rectangular foundation editor: engineering coordination.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\ServicesWorkspace.tsx` - One Live Build measured services workspace: plumbing, electrical, HVAC, fire and security teams.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\sales\PlumbingPitchPage.tsx` - One Live Build interactive pitch: plumbing suppliers, installers and bathroom showrooms.

## What changed for pitches

The plumbing pitch now demonstrates connected route editing in 2D and 3D, editable elevations and discipline layers.
Foundation links now explain circular diameter/depth and honest overlap limits; the 19-step guide connects the existing tools.
Supplier references, dimensional illustrations and draft schedules remain distinct from stock confirmation, manufacturer CAD, engineering approval and sent orders.
