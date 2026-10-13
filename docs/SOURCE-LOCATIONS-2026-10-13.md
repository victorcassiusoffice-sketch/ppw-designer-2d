# Room Designer / One Live Build — repositories and full file locations

Inventory checked on 13 October 2026. Publication handoff for City Build.

**LIVE-ON-PREVIEW — 13 October 2026.** The public demo and pitch routes return HTTP 200; live City and pitch desktop/390px phone checks are recorded in the release report. Protected Studio/Designer routes return the intended access screen. No orders, invoices or emails were sent. Main and production remain unchanged.

## Continue in this workspace

- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer>) - Room Designer / One Live Build: CURRENT City Build source for developers, civil contractors, utilities and infrastructure suppliers.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d) - Room Designer / One Live Build: product Git repository.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/tree/gpt/designer-2026-10-13](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/tree/gpt/designer-2026-10-13) - Room Designer City Build: published feature branch.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/47](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/47) - Room Designer City Build: review and integration pull request.
- [https://ppw-designer-2d-21ijghs0m-victor-ppw.vercel.app/demo?view=2d&panel=city&pitch=1](https://ppw-designer-2d-21ijghs0m-victor-ppw.vercel.app/demo?view=2d&panel=city&pitch=1) - City Build: public, non-ordering district demonstration; live preview verified.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\HANDOFF.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/HANDOFF.md>) - Room Designer City Build: authoritative delivery status and next actions in the single vault handoff folder.

Branch at inventory: `gpt/designer-2026-10-13`. Source HEAD at inventory: `3f046cc655ab6e79803444038c8567dbe88dd445`. A later documentation commit can advance the branch. Check the PR and local Git status before continuing. Preserve all uncommitted work. This directory, the brand sites, Designer, Shop, pitches and embeds share one application repository and build.

## Existing Git worktrees

Verified using `git worktree list --porcelain` and filesystem existence checks. All 14 directories below existed at inventory time. These are linked Git checkouts, not 14 independent products or deployment instructions. The current City checkout is explicitly identified; secondary checkouts must not be used as the latest City source or overwritten.

- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d>) - Room Designer: Primary Git checkout, historical Sims/paint branch; not the current City release. Branch: `feat/designer-3d-sims-paint-2026-09-17`; HEAD: `5343407`.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer>) - Room Designer: CURRENT CITY RELEASE WORKSPACE; continue here after confirming branch/status. Branch: `gpt/designer-2026-10-13`; HEAD: `3f046cc`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\agent-a35b4989c6dd3a47a](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/agent-a35b4989c6dd3a47a>) - Room Designer: Secondary agent checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-agent-a35b4989c6dd3a47a`; HEAD: `afd063c`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\astra-finish](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/astra-finish>) - Room Designer: Historical Studio/pitch finishing branch; not the current City release. Branch: `feat/studio-pitch-finish-2026-09-26`; HEAD: `3bed2f7`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\busy-torvalds-cedde6](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/busy-torvalds-cedde6>) - Room Designer: Secondary detached checkout; not the current City release. Branch: `detached HEAD`; HEAD: `045fecb`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_67fd73a5-357-1](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_67fd73a5-357-1>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_67fd73a5-357-1`; HEAD: `c5cf982`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_67fd73a5-357-2](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_67fd73a5-357-2>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_67fd73a5-357-2`; HEAD: `38608cb`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_67fd73a5-357-3](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_67fd73a5-357-3>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_67fd73a5-357-3`; HEAD: `a1cfa45`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_768601a3-fa3-1](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_768601a3-fa3-1>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_768601a3-fa3-1`; HEAD: `f0fde12`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_768601a3-fa3-2](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_768601a3-fa3-2>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_768601a3-fa3-2`; HEAD: `6d96d4e`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_768601a3-fa3-3](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_768601a3-fa3-3>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_768601a3-fa3-3`; HEAD: `b19173d`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_768601a3-fa3-4](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_768601a3-fa3-4>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_768601a3-fa3-4`; HEAD: `bcc7264`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_768601a3-fa3-5](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_768601a3-fa3-5>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_768601a3-fa3-5`; HEAD: `eeea34e`.
- [C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\wf_768601a3-fa3-6](<C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/.claude/worktrees/wf_768601a3-fa3-6>) - Room Designer: Secondary workflow checkout; not the current City release. Specific task ownership was not audited. Branch: `worktree-wf_768601a3-fa3-6`; HEAD: `18e0048`.

The following Git registration is stale and its directory does **not** exist; it is not a usable build:

- [C:\Users\Victor\AppData\Local\Temp\claude\C--Users-Victor-Documents-PPW-Code-ppw-designer-2d\1b4fd532-e2fa-4df5-bbdb-754fc1225370\scratchpad\audit\electrics-verify\wt](<C:/Users/Victor/AppData/Local/Temp/claude/C--Users-Victor-Documents-PPW-Code-ppw-designer-2d/1b4fd532-e2fa-4df5-bbdb-754fc1225370/scratchpad/audit/electrics-verify/wt>) - Room Designer: former electrical audit checkout; detached HEAD 3f8ee2f; Git marks registration prunable. No cleanup was performed.

## Source map

The following full paths are inside the CURRENT City workspace.

### Shared app and calculation source

- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\main.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/main.tsx>) - Room Designer / One Live Build: route registry for every audience.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\App.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/App.tsx>) - Room Designer: shared editing application for clients, designers and merchant teams.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components>) - Room Designer: interface and shared editing components.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\RoomCanvas.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/RoomCanvas.tsx>) - Room Designer 2D: measured plan canvas.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\HouseWorkspace.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/HouseWorkspace.tsx>) - Room Designer: building and floor controls.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\three](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/three>) - Room Designer Premium 3D: building rendering.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\styles\designerStudio.css](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/styles/designerStudio.css>) - Room Designer: studio theme and responsive layout.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer>) - Room Designer: geometry, estimation, import, foundations, services and City algorithms.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\store](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/store>) - Room Designer: persisted project and editor state.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\types](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/types>) - Room Designer: shared data contracts.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\data](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/data>) - Room Designer: catalogue and supplier reference data.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\lib\merchants\catalogImport.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/lib/merchants/catalogImport.ts>) - Room Designer: catalogue import validation for merchant onboarding.

### Pitches, employee training, Studio and demo scenes

- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\DeveloperPitchPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/DeveloperPitchPage.tsx>) - Room Designer: property developers and off-plan housing; Cap Tamarin client overlay.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\MerchantPitchPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/MerchantPitchPage.tsx>) - Room Designer: retail/supplier pitch; Spa Concept client overlay.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\ConstructionPitchPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/ConstructionPitchPage.tsx>) - Room Designer: construction and building-material suppliers.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\PitchShell.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/PitchShell.tsx>) - Room Designer: shared interactive pitch layout.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\PitchEnquiryForm.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/PitchEnquiryForm.tsx>) - Room Designer: meeting requests and prospect feedback.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\PitchConnectChapter.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/PitchConnectChapter.tsx>) - Room Designer: AI and merchant-connection explanation.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\workflowModel.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/workflowModel.ts>) - Room Designer: pitch workflow and meeting link.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\constructionWorkflow.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch/constructionWorkflow.ts>) - Room Designer: construction presentation workflow.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\sales\PlumbingPitchPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/sales/PlumbingPitchPage.tsx>) - Room Designer: plumbing suppliers, installers and bathroom showrooms.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\sales\EmployeeStarterPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/sales/EmployeeStarterPage.tsx>) - Room Designer: employee starter-pack interface.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\sales\salesPack.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/sales/salesPack.ts>) - Room Designer: shared market list, exercises, outreach templates and demo links.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\sales\SalesShell.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/sales/SalesShell.tsx>) - Room Designer: employee/plumbing presentation layout.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\studio\StudioPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/studio/StudioPage.tsx>) - Room Designer Studio: standalone hub, Designer wrapper, Shop frame and merchant entry.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\studio\MerchantConnectPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/studio/MerchantConnectPage.tsx>) - Room Designer: merchant catalogue preparation and authorized publication.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\DemoDesignerPage.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/DemoDesignerPage.tsx>) - Room Designer: public Demo and embedded Designer entry.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\EmbeddedDesigner.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/EmbeddedDesigner.tsx>) - Room Designer: reusable embedded Designer for pitches and Studio.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\demoRoute.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/demoRoute.ts>) - Room Designer: public home, paint and Cap Tamarin scenes.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\index.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/index.ts>) - Room Designer: registers available merchant/neutral demos.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\courts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/courts>) - Room Designer: Courts furniture and showroom scene.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\tintex](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/tintex>) - Room Designer: TintEX paint scene.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\sofap](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/sofap>) - Room Designer: Sofap paint scene.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\captamarin](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/captamarin>) - Room Designer: Cap Tamarin apartment scene.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\generic.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/generic.ts>) - Room Designer: neutral demo scene definitions.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\homeInterior.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/homeInterior.ts>) - Room Designer: shared home interior scene.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\useDemoMode.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/useDemoMode.ts>) - Room Designer: demo selection and scene lifecycle.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\demoScrub.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/demoScrub.ts>) - Room Designer: public neutral-demo presentation filtering.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\pitchEmbed.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/pitchEmbed.ts>) - Room Designer: public demo and pitch display policy.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\tools\export-sales-pack.mjs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/tools/export-sales-pack.mjs>) - Room Designer: generates seven portable employee documents from the web starter-pack source.

### City Build implementation

- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\CityWorkspace.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/CityWorkspace.tsx>) - City Build: plan, infrastructure, data centre, ordering drafts and overview interface.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\CityPlanView.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/CityPlanView.tsx>) - City Build: measured 2D plan.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\CityThreeView.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/CityThreeView.tsx>) - City Build: measured 3D planning envelopes and camera.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\CityOrdersPanel.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/CityOrdersPanel.tsx>) - City Build: dated supplier packages and timeline drafts.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\city.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/city.ts>) - City Build: geometry and quantity/energy estimation.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\cityContract.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/cityContract.ts>) - City Build: validation and persistence contract.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\cityProcurement.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/cityProcurement.ts>) - City Build: supplier draft structures and validation.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\data\citySuppliers.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/data/citySuppliers.ts>) - City Build: sourced Mauritius supplier references, not live stock.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\store\cityProcurementStore.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/store/cityProcurementStore.ts>) - City Build: local supplier draft state.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\lib\cityProcurementClient.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/lib/cityProcurementClient.ts>) - City Build: private merchant draft-storage client.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\cityProcurement.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_lib/cityProcurement.ts>) - City Build: authenticated supplier-draft endpoint logic.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db\cityProcurementStore.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/cityProcurementStore.ts>) - City Build: private draft persistence.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db\migrations\0031_city_procurement_plans.sql](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/migrations/0031_city_procurement_plans.sql>) - City Build: required backend database migration; application and deployed validation are separate steps.

### Assets, backend, access and deployment

- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\models](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/public/models>) - Room Designer: 3D model assets for designers and merchants.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\products](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/public/products>) - Room Designer: product imagery.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\showcase](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/public/showcase>) - Room Designer: pitch screenshots and concept imagery.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\pitch\construction](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/public/pitch/construction>) - Room Designer: construction pitch imagery and captures.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\brand](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/public/brand>) - One Live Build / Room Designer: brand assets.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\olb](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/olb>) - One Live Build: brand landing page.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\brand](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/brand>) - One Live Build / Room Designer: shared brand components and theme.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\server\brand.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/server/brand.ts>) - One Live Build / Room Designer: hostname and preview-brand routing.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api>) - Room Designer: backend endpoints.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_lib>) - Room Designer: backend business logic.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db>) - Room Designer: data stores and database schema.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db\migrations](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/migrations>) - Room Designer: tracked database changes.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\middleware.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/middleware.ts>) - Room Designer: access enforcement and brand entry.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\server\accessGate.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/server/accessGate.ts>) - Room Designer: public versus studio-code access rules.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\lib\showcaseSafety.ts](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/lib/showcaseSafety.ts>) - Room Designer: demo/Studio commerce restrictions.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\RequireMerchant.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/RequireMerchant.tsx>) - Room Designer: merchant email-session access.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\admin\RequireAdmin.tsx](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/admin/RequireAdmin.tsx>) - Room Designer: authorized staff sign-in.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\vercel.json](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/vercel.json>) - Room Designer: API routing, deployment and embed headers.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\scripts\gen-3d-models.mjs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/scripts/gen-3d-models.mjs>) - Room Designer: procedural model generation.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\scripts\import-sketchup-model.mjs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/scripts/import-sketchup-model.mjs>) - Room Designer: approved model import workflow.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\scripts\optimize-models.mjs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/scripts/optimize-models.mjs>) - Room Designer: model optimization.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\dist](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/dist>) - Room Designer: generated frontend deploy output; rebuild it from source, do not hand-edit.

### Continuation, evidence and current build directory

- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\CURRENT-WORK-LINKS.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/CURRENT-WORK-LINKS.md>) - Room Designer: current branch, deployment and continuation index.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\BUILD-LINKS.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/BUILD-LINKS.md>) - Room Designer: build-link directory.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\PITCH-STUDIO.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/PITCH-STUDIO.md>) - Room Designer: pitch and Studio implementation documentation.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\SALES-STARTER-PACK-2026-10-07.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SALES-STARTER-PACK-2026-10-07.md>) - Room Designer: historical employee-pack implementation record.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\CITY-BUILD-USER-GUIDE-2026-10-13.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-BUILD-USER-GUIDE-2026-10-13.md>) - City Build: demonstration steps and limitations.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\CITY-BUILD-WORKFLOW-2026-10-13.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-BUILD-WORKFLOW-2026-10-13.md>) - City Build: implementation workflow and engineering boundaries.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\CITY-BUILD-RESEARCH-2026-10-13.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-BUILD-RESEARCH-2026-10-13.md>) - City Build: supplier and primary technical evidence.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\CITY-PROCUREMENT-BACKEND-2026-10-13.md](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-PROCUREMENT-BACKEND-2026-10-13.md>) - City Build: private draft-backend integration requirements.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-city-2026-10-13](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-city-2026-10-13>) - City Build: automated desktop/phone screenshots and QA evidence.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\tools\city-shot-2026-10-13.mjs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/tools/city-shot-2026-10-13.mjs>) - City Build: headless desktop/phone visual verification.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\tools\city-orders-shot-2026-10-13.mjs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/tools/city-orders-shot-2026-10-13.mjs>) - City Build: headless ordering-draft verification.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\tools](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/tools>) - Room Designer: QA and delivery utilities.
- [C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs](<C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs>) - Room Designer: implementation history, research, handoffs and QA.

## Portable employee files in this handoff

- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\START-HERE.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/START-HERE.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\EMPLOYEE-HANDBOOK.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/EMPLOYEE-HANDBOOK.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\LINKS.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/LINKS.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\LINKS-TO-EMAIL.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/LINKS-TO-EMAIL.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\PLUMBING-PITCH.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/PLUMBING-PITCH.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\OUTREACH-TEMPLATES.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/OUTREACH-TEMPLATES.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\PRODUCT-ONBOARDING.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/PRODUCT-ONBOARDING.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.
- [C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-13-city-build\DISCOVERY-TEMPLATE.md](<C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/DISCOVERY-TEMPLATE.md>) - Room Designer: employee sales, design practice and merchant onboarding reference.

## How to add or update another company demo

1. Start from the current feature workspace and inspect its Git status. Read the handoff and current link index before making changes.
2. Keep company scenes in the demo registry and neutral/public routing separate. The existing company demo folders are listed above. The public scene parser accepts home, paint and captamarin; a new public scene must be registered and supported deliberately.
3. Product data needs permission, stable identifiers and verified physical dimensions. Preserve shared measurements between 2D and 3D. Catalogue validation is not proof of manufacturer-exact geometry or installation suitability.
4. Store source code and assets in the product repository. Keep this vault folder for handoff, employee documents and screenshots only.
5. Build and check desktop and phone, including console errors, scale, shared views and the actual public/demo access policy. Publish a feature branch/PR and verify the unique deployment before replacing the handoff URLs. Do not infer authority to merge main from this file.

## Brand and access boundaries

The source recognizes onelivebuild.com, www.onelivebuild.com and shopbuild.onelivebuild.com for One Live Build branding. designer.ppwellness.co retains PPW branding. This inventory does not verify DNS or deployment parity for these domains. One Live Build's root is its brand front page except on the shop hostname; PPW Designer's root and the shop hostname open the catalogue. The path routes otherwise share the application.

Public paths are Demo, pitch pages and Designer embeds. Studio, employee sales, the main Designer and catalogue index use the studio access gate. Merchant workspaces also require an authorized merchant email session; administration also requires authorized sign-in. Do not include access codes in prospect documents. See LINKS-TO-EMAIL.md for safe demo links.

## City Build claim boundary

City Build supports measured 2D/3D planning envelopes, road/utility quantity studies, supplier references, data-centre energy/water scenarios and dated equipment drafts. Existing house design tools are retained. A city building envelope is a refreshable snapshot, not a second live editable house model. Supplier references do not establish a partnership, live stock, equipment compatibility or current quotations. Draft order/invoice dates and recipient fields do not send orders, issue invoices or send email. Private merchant draft storage needs its database migration and deployed validation. Civil, structural and utility compliance remain professional review tasks. There is no separate City pitch route in this build.
