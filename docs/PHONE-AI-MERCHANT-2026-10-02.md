# Phone navigation, AI design, merchant onboarding and pitches — 2 October 2026

## Final local checks

The completed regression run passed **292 files / 3,226 tests**. Production build and client/API typechecks passed. A final five-test Clear suite also confirms modal keyboard isolation. Changed TypeScript files pass ESLint; `git diff --check` passes. Vite retains its existing large-chunk advisory.

Actual browser checks at 390 × 844 and desktop: visible AI/Clear controls in both views, two-storey guided draft creation and application as a new page, old plan retained, full Clear followed by one Undo, twelve paired 3D zoom cycles with unchanged framing, merchant example validation without publication, phone/desktop AI pitch, real embedded AI workspace, and the physical-meeting form/Calendly link. Multi-touch drift is covered by synthetic pointer-event regression tests; a physical handset pinch check remains useful. No real enquiries, catalogue writes, orders, payments, calendar bookings or emails were submitted.

Actual app capture saved at `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\showcase\designer-ai.png` and used by all three AI pitch chapters. The frontend checks server readiness before lazily loading Clerk sign-in. Hosted paid inference still needs a real signed-in session on the deployed build.

## Release state — implementation and local verification; deployment pending

This checkpoint describes the current local implementation. **It has not yet been confirmed on a new Vercel deployment. Do not use the older production URLs as evidence that these October changes are live.** Root will add the application commit, unique preview URL, deployment IDs, health response and browser verification after release.

- Active source: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
- Active branch: `cursor/feat-3d-flooring-hud-bc95`.
- Checkout base when this checkpoint was written: `0a93ac7d91b9edb207bbce2d54cdbf3ee1179810`; the implementation described here is still in the working changes.
- Earlier verified production release: the 30 September Materials release recorded in `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\BUILD-LINKS.md`. Preserve that evidence until replaced by a verified newer release.
- Original checkout: `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d`. Do not overwrite its source to synchronize this work.
- Preserve recovery stash `649569db5766b86c5880321f6cfea782f356da1f`, including its untracked-file snapshot `^3`. Do not pop or drop it wholesale.
- Historical PR #36 was merged externally; do not treat its old status as a current deployment or release instruction.

## Requested behavior and implementation

### Phone view control and Clear

Repeated pinch gestures now resolve against a stable gesture-start camera/viewport instead of integrating temporary one-finger movement at changing scales. Plan keeps the initial world point under the fingers' midpoint; 3D applies the combined midpoint translation and distance ratio against the initial camera. This addresses cumulative drift after zooming in and back out. Zoom buttons and keyboard use an explicit anchor. The remaining finger after a pinch must lift before an ordinary drag resumes, avoiding a jump from the pre-pinch drag origin. Two-finger navigation cancels tool previews rather than committing a door, wall or floor stroke on release.

The camera controls expose view manipulation and explicit Fit/zoom recovery, while opening tools and selecting items retain the user's view. Regression tests cover pinch reversibility and view preservation; actual device feel remains part of final browser/phone verification.

**Clear** is restored as a named toolbar action in Plan and 3D. Its confirmation explains the scope: all rooms/floors/roof/garden/products on the current page, while other saved pages remain. The alternative clears only the active room's products. Clear is a single undoable action, cancels active tools/placements, and returns to a blank page. Confirmation supports Cancel, Escape, outside click, focus management and a keyboard focus loop. Shortcuts remain Shift+X and Shift+P and are ignored while typing.

### Measured proposals, AI and MCP

The app now has an AI workbench with four distinct methods:

1. **Guided layout:** local deterministic generation from plot dimensions, bedrooms, storeys and wall height. It produces connected rooms, entrance/room doors, windows, stairs, a roof and lawn/path. It does not interpret prose or consume model credit.
2. **AI brief:** signed-in users request a proposal from the existing server-side OpenRouter connection. The brief is sent only on explicit generation; the existing plan is not sent. Missing configuration, expired sign-in, unavailable quotas or invalid provider output produces a real error, not a pretend AI result.
3. **Import a draft:** paste or open versioned JSON, validate it and review the measured floor preview. File changes invalidate an old preview, and stale asynchronous file reads are ignored.
4. **Connect AI:** expose the MCP server address and a downloadable connection example for compatible clients.

Every path requires proposal review before **Add as a new plan**. The current page is preserved, a new page is created, the ordinary property model is applied, and the user continues in 2D/3D. Draft export is available. Geometry checks cover finite bounded measurements, unique/reserved identifiers, room overlap and plot bounds, openings, entrances and connected circulation, adjacent floors, stair fit/run, and known product footprints. Draft products use centre coordinates; the converter subtracts the rotated catalogue half-dimensions to create the editor's top-left item coordinates. A single canonical opening is projected onto both sides of a shared wall by the existing rendering pipeline.

Hosted inference uses `google/gemini-2.5-flash`, confirmed in the provider's public model directory on 2 October. The existing merchant-chat `:free` model ID was absent from that directory; the new design route uses a narrowly typed internal model override and leaves legacy merchant chat untouched. It requires Clerk authentication plus working distributed rate/cost controls. Prompt size is capped, the input reservation uses a conservative UTF-8 byte ceiling, output is capped at 6,000 tokens, timeout is 24 seconds, and no unreserved fallback call occurs. No paid inference was triggered during implementation.

MCP supports stateless Streamable HTTP with JSON responses and protocol negotiation. Its public tools inspect the contract, search the bundled public catalogue, generate guided concepts and validate supplied drafts. They do not read other people's projects, save cloud designs, modify merchants, send messages or place orders. Browser Origins are checked against exact production/deployment origins. MCP does not require an admin token and does not implement OAuth account linking in this release.

### Merchant onboarding and catalogue integration

The new **Prepare → Review → Connect** wizard accepts JSON or CSV, provides a template, validates up to 50 products per batch, and presents a review table before publication. Dimensions are millimetres; prices are integer minor currency units. Validation covers stable SKUs, duplicates, categories, finite dimensions, HTTPS images, prices/currency and optional electrical/solar ratings. Quoted CSV fields and embedded newlines are supported. The download pack includes reviewed products, endpoint addresses and embed code.

The public Studio/preview wizard is preparation-only. Publishing is available in the existing protected merchant workspace, using the existing merchant-session Bearer token and product-create API. The server still authorizes every request against that merchant. Creation is sequential and explicitly confirmed; existing records are not overwritten. The browser records confirmed receipts and unknown outcomes per SKU in the current tab. It stops on the first error and does not automatically retry uncertain outcomes or duplicate already confirmed products. No bulk importer side-channel or invented ERP API was added.

Catalogue adapter corrections preserve useful import categories: cardio maps to fitness, eco to solar, outdoor keeps outdoor behavior, and recovery is available as its own product category. Energy fields still depend on the existing backend schema flag/migration. Supplier-account onboarding remains the existing application and approval flow.

### Concise pitches, screenshots and contact

Developer, merchant and construction presentations share a new **AI & connect** chapter with three compact sections: try the designer, connect the business, and feedback/meetings. It uses actual application captures and an optional working embedded designer, with 2D/Premium 3D controls and a full-screen link. The chapter distinguishes guided drafts, hosted AI and external MCP, and explains which procurement automation requires agreed integrations.

The shared enquiry form supports project discussions, feedback and physical meeting requests. In-person requests collect location and optional availability; they do not confirm a booking. Explicit contact consent and bounded fields are required. The server writes to the existing leads table and returns a saved receipt only after a successful database insert. Failure retains the user's entries and offers a downloadable copy or Calendly. A downloaded copy is clearly marked not submitted. The endpoint does not send email, create orders or book appointments. Honeypot validation and rate limiting protect the public form, including a bounded instance-local fallback when Redis is unavailable.

The existing one-hour meeting link remains:
`https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour?month=2026-09`.

## Routes and endpoint map — new implementation, awaiting deployment verification

| Route | Behavior |
| --- | --- |
| `/designer` | Main shared editor; toolbar Clear and AI entry points |
| `/demo?view=3d&panel=ai` | Demonstration with AI workbench open; no order submission |
| `/embed/designer?view=3d&panel=ai` | Shared embedded demo; partner filtering/branding/domain policy still require configuration |
| `/studio/merchants/connect` | Public preparation/review/download workflow |
| `/merchant/:slug/connect` | Existing merchant-auth guard plus confirmed product publication |
| `/pitch/developers` | Developer presentation with AI/connect/contact chapter |
| `/pitch/merchants` | Merchant presentation with AI/connect/contact chapter |
| `/pitch/construction` | Construction supplier example with AI/Materials/connect/contact chapter |
| `GET /api/design-assistant` | Readiness booleans, sign-in requirement, model and MCP path |
| `POST /api/design-assistant` | `guided`, authenticated `ai`, or supplied-draft `validate` mode; routed through `api/agent-chat.ts` |
| `POST /api/mcp` | Proposal-only MCP tools/resources; routed through `api/agent-chat.ts` |
| `POST /api/pitch-enquiry` | Validated business enquiry/feedback/meeting request; routed through `api/orders.ts` |
| `GET /api/merchants/:slug/products` | Existing public catalogue contract |
| `POST /api/merchants/:slug/products` | Existing server-authorized merchant product creation |

These are route definitions, not assertions that October endpoints are live. Root must append deployment evidence before circulating them as the new build.

## Full source locations for another chat or AI

| Concern | Absolute file location |
| --- | --- |
| 2D viewport math | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\lib\zoom.ts` |
| 3D camera math | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\cameraMotion.ts` |
| Plan gesture/tool integration | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\RoomCanvas.tsx` |
| 3D gesture/tool integration | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\RoomView3D.tsx` |
| Camera controls | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\RoomViewControls.tsx` |
| Clear UI and confirmation | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\ClearControls.tsx` |
| Existing undoable Clear operations | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\lib\clearActions.ts` |
| AI workbench and review | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\AiDesignWorkspace.tsx` |
| Scoped hosted-AI sign-in | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\AiProviderDraft.tsx` |
| AI workbench styles | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\aiDesign.css` |
| Shared proposal contract/validator/generator | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\aiDesignContract.ts` |
| Validated proposal → property conversion | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\aiDesignProperty.ts` |
| AI auth/quota/provider handler | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\designAssistant.ts` |
| MCP transport and tools | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\designMcp.ts` |
| Existing provider client | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\agent\openrouter.ts` |
| Existing function reused for AI/MCP | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\agent-chat.ts` |
| Merchant preparation/publication UI | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\studio\MerchantConnectPage.tsx` |
| Merchant import contract and parser | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\lib\merchants\catalogImport.ts` |
| Merchant setup styles | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\studio\merchantConnect.css` |
| Live catalogue adapter | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\data\apiCatalogAdapter.ts` |
| Existing merchant product backend | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\products.ts` |
| Shared AI/connect/contact pitch chapter | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\PitchConnectChapter.tsx` |
| Enquiry and meeting form | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\PitchEnquiryForm.tsx` |
| Lead persistence handler | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\pitchEnquiry.ts` |
| Existing function reused for enquiries | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\orders.ts` |
| Shared pitch layout and navigation | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\PitchShell.tsx` |
| Construction pitch | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\ConstructionPitchPage.tsx` |
| Developer pitch | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\DeveloperPitchPage.tsx` |
| Merchant pitch | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\pitch\MerchantPitchPage.tsx` |
| Actual screenshot assets | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\showcase` |
| React routes | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\main.tsx` |
| Vercel aliases/function configuration | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\vercel.json` |
| Detailed AI/MCP integration instructions | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\AI-DESIGN-MCP.md` |
| This continuation checkpoint | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\PHONE-AI-MERCHANT-2026-10-02.md` |
| Cumulative workflow log | `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\DESIGNER-WORKFLOW-LOG.md` |

## Validation recorded at this checkpoint

Root reports **292 test files / 3,214 tests passed**, followed by **42 targeted tests** after review corrections. API typecheck and changed-file lint passed. The production build is running again after the client TypeScript correction; do not mark that final rebuild passed until its completion is recorded. The AI/MCP agent additionally verified 68 focused tests covering proposal geometry, provider request shape/timeout, alias routing, auth before model calls, quota failures, protocol rules and existing merchant-chat authorization. The converter correction has dedicated product-coordinate regressions.

Later placement-host hardening: **58 tests across four files passed** (23 contract, 6 converter, 21 API/MCP and 8 workbench tests). API typecheck and changed-file lint passed again. This verifies rejection of unsupported hosted products while floor placement and the ordinary review/import flow remain usable; it does not replace the earlier full-suite record with a newly claimed full run.

Existing public production `/api/agent-chat` reported OpenRouter configured during a read-only check. That confirms only the existing key configuration. It does not prove the new endpoints, current Clerk/KV readiness, hosted inference, current preview deployment or form persistence. No merchant products, customer orders or genuine enquiry records were created by this checkpoint-writing step.

Remaining release work: finish the rebuild; complete UI verification and actual screenshot refresh; push the authorized feature branch; verify the unique deployment's health commit and required routes; exercise safe MCP/readiness requests; record any unavailable hosted inference/form/merchant verification precisely; then update BUILD-LINKS, handoff and output copies with the actual deployment evidence.

## Boundaries and extension guidance

- Generated plans are conceptual, not professionally approved construction documents. Structural support, MEP routing, local permissions, cyclone engineering, setbacks, openings/headroom and real site conditions are not inferred. Materials and energy remain separately reviewable estimates.
- Proposal version 1 supports rectangular rooms, up to three storeys, known cardinal product orientations and bounded arrays. Catalogue placement metadata is carried through server and browser validation: room proposals reject roof, wall, surface and ceiling products because no host is defined; the property converter enforces the same boundary and hosted model prompts contain only floor products. Add hosted products with the existing editor tools after applying a concept. Freeform room geometry, hosted placement in generated proposals and complete furnishing/access-clearance optimization need explicit contract and renderer extensions; do not advertise them as already generated automatically.
- MCP catalogue search is a bundled public reference snapshot. New live merchant uploads appear through the existing catalogue backend but are not automatically included in MCP search. A later integration must hydrate public active/non-retired product IDs and dimensions through the same client cache before drafts using them can be applied.
- MCP has no customer cloud-design access and no OAuth account-linking workflow. Extend authenticated capabilities through explicit owner checks, never a caller-supplied email or design ID. Do not add ordering or messaging to the public tool list.
- Keep dimensions and validation in `aiDesignContract.ts`, conversion in `aiDesignProperty.ts`, provider/transport in server modules, and UI review in the workbench. Changes to the contract must update imports, source-of-truth schemas and tests; introduce a new version for incompatible persisted JSON.
- Preserve the centre-versus-top-left coordinate boundary and metre/millimetre conversions. Add a rotation/footprint regression whenever adding a placement type. Never substitute nominal visuals for verified supplier dimensions silently.
- All generated plans must remain ordinary `Property` data so existing floors, roof, solar, garden, Materials, local autosave, pages and history continue to work together.
- Catalogue publication reuses the existing merchant auth and product contract. A connection pack is not an automatic ERP/feed integration. Scheduled stock updates, supplier deadlines, contractor bookings, finance and automatic orders remain separately configured integrations.
- Keep camera math pure and gesture baselines stable. Pointer/multitouch cancellation must cancel transient edits without reverting saved data. A UI change that resizes the drawing area must preserve scale unless the user explicitly chooses Fit or opens another project.
- The AI workbench uses `ppw:open-ai-design`; clear uses `ppw:before-design-clear`. New tools should close or disarm conflicting transient interactions and offer Done/Escape, not stack unescapable panels over the scene.
- Extend the shared pitch chapter rather than copy-diverging all three presentations. Use actual screenshots from the current app and accurate availability labels. The contact form must return success only after persistence; downloads and meeting requests must never imply confirmed submission or booking.

<!-- deployment-evidence:pending — root will replace with verified release evidence -->
