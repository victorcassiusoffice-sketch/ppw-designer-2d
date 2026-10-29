# World decisions

The dated historical entries record Victor's Stage 2 choices and implementation decisions. The Fix 1 section below records the 28 October 2026 changes and supersedes earlier choices where stated. Measurements and all 30 scores are complete in the current reports; remaining gates are explicit. This ledger does not grant deployment or merge authority.

| Date | Choice | Reason | Cost to reverse |
|---|---|---|---|
| 2026-10-27 | Build Site and Walk on separate branches from `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`; Walk first, Site in parallel | Explicit Stage 2 GO; independent review/revert scope | Rebase/resolve integration if main changes; no merge authority added |
| 2026-10-27 | MapLibre 6.16.0 + OpenFreeMap Liberty, map only | User permits CC BY 4.0 and OFL; no key/account/card; keep visible map credit | Replace provider adapter/style and recheck licences/network/measurement independence |
| 2026-10-27 | No Google key, account, environment variable or dormant Google path | Explicit later-provider decision | Requires Victor's provider/account authorization and adapter implementation |
| 2026-10-27 | Satellite is “not available yet”; no anonymous Esri/NASA substitute | Explicit map-first scope; plot-scale usefulness and rights | Separately authorized provider and performance/licence pass |
| 2026-10-27 | Drawn boundary and manually typed surveyor-plan traverse both carry their required uncertainty labels | Mauritius open cadastral source not verified; user authorized both inputs | A verified cadastral adapter and its permissions; retain provenance |
| 2026-10-27 | Public terrain is regional context only; survey/typed what-if levels drive earthworks | Explicit separation of approximate public data from quantities | Product/model decision and new validation; do not silently widen |
| 2026-10-27 | Doors use E/tap in both views; collision never auto-opens; occupied close stays open | Explicit first-person door answer and no trapping | Interaction-policy change and door/collision regression checks |
| 2026-10-27 | Exactly four initial characters | Explicit count; minimize chooser/download work | Each extra must pass licence/size/animation and under-one-second chooser gate |
| 2026-10-27 | Keep production merge/deploy/main push/force-push out of agent scope | User's standing boundary; separate review hand-back | Only Victor can authorize the specified merge through the Commander |
| 2026-10-27 | Keep Three 0.186.0 and the existing runtime decoder for this feature round | Preserve the first-picture/rendering baseline; 0.186.1 and encoder 1.5.9 are recorded, not automatically installed | Dedicated patch-upgrade regression and paired performance comparison |
| 2026-10-27 | Use three-mesh-bvh 0.9.16; defer collision/controls/assets until Walk entry | Reuse the current Three scene with a small collision dependency and no early load | Controller replacement plus stairs/doors/camera/disposal/performance evidence |
| 2026-10-27 | Use Kenney Mini Characters 1.0 female a/b and male a/b fallback | Both author-linked Quaternius licence downloads returned quota errors; required in-pack audit could not pass. Kenney archive SHA-256 `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999`; Quaternius archive hashes unavailable | New source/licence audit, four conversions, manifest/thumbnails, animation/performance checks |
| 2026-10-27 | Embed textures, retain idle/walk/sprint only, Draco encode without topology simplification; run maps to sprint | Each file remains about 92 KB, self-contained and under 1.5 MB; unnecessary source clips removed | Re-run reproducible conversion script from the hashed archive |
| 2026-10-27 | Fit avatars to controller height, +Y up/+Z forward; capsule independent of stylized shape | Source heights differ and characters have stylized proportions; movement clearance must be consistent | Manifest/runtime fit change and doorway/camera checks |
| 2026-10-27 | Keep character PNG chooser requests inside deferred Walk UI | Small thumbnails still must not affect first 3D picture | Loading-boundary changes require network trace and first-picture comparison |
| 2026-10-27 | Admit terrain only from complete `srtm/`, `gmted/`, `uk_lidar/` source lists with copied licences | AWS tiles mix datasets; actual headers, not country assumptions, establish permitted sources | Add an exact source/licence/attribution record and tests for each new prefix |
| 2026-10-27 | Reject missing terrain source metadata and EUDEM/Copernicus; preserve exact filenames and archive dates | No unsupported licence or precision claims; Paris sample is EUDEM and unavailable | Requires a newly authorized dataset and provenance implementation |
| 2026-10-27 | Describe GMTED fallback as 250 m or coarser; UK AWS archive uses EA 2015 attribution | A 30 m label alone overstates mixed-source accuracy; current 2022 catalogue is a different release | Source-resolution metadata may refine precision after validation |
| 2026-10-27 | Use fixed-origin anonymous adapters for Photon, PVGIS 5.3, Overpass and terrain | No keys/new account/env; bounded pilot requests with cache and plain failure states | Provider replacement plus terms/rate/schema/provenance validation |
| 2026-10-27 | Treat current cache/rate controls as process-local pilot safeguards | No new durable quota infrastructure authorized; public services have no SLA | Existing authorized shared store or separately approved suitable provider/hosting |
| 2026-10-27 | Anchor first boundary corner to explicit plan origin, x east/y south; keep rooms fixed | Local ENU measurement separate from map display; existing designs must not move | Explicit transform migration and all persistence/round-trip checks |
| 2026-10-27 | Close typed traverse explicitly and retain raw residual; no silent Bowditch adjustment | Show transcription/closure error honestly instead of making the survey appear exact | Add opt-in adjustment method with raw data retained and survey validation |
| 2026-10-27 | Exact uniform setbacks on convex boundaries; withhold concave envelope | Half-plane clipping is not a valid general concave offset; no fake usable area | Robust offset/topology algorithm and independent concave fixtures |
| 2026-10-27 | Survey TIN uses constrained contours and boundary clipping; reject uncovered gaps | No invented elevations or extrapolation outside surveyed support | New interpolation policy with explicit labels and independent volume fixtures |
| 2026-10-27 | Re-run unchanged foundation estimator on a cloned model with explicit uniform datum shift | User requested rerun; common vertical shift changes no dimensions/volumes and DEM cannot supply foundation depth | Separate surveyed depth/soil design inputs; estimator changes need their own authorized scope |
| 2026-10-27 | Preserve no-site estimates and existing tests; demo uses local sample and stays price-free | Explicit regression/privacy/product constraints | No reversal in this round; feature changes must continue to respect them |
| 2026-10-27 | Record pending metrics as pending; keep all failed timing pairs | No passing score or physical-phone claim from unrun checks/desktop emulation | Replace placeholders only with reproducible recorded evidence |
| 2026-10-27 | Document the Commander/tester/Codex weekly and four-week cycle without scheduling agent auto-merges | User specifies three-seat operating workflow and a Stage 2 hand-back stop | Commander may issue later rounds; no standing merge/spend authority |

| 2026-10-27 | Use a private snapshot and separate deferred canvas for Walk; original editing view stays inert | Exact camera/design restoration and no editing transactions during movement | Consolidating renderers requires lifecycle/restore/performance regression work |
| 2026-10-27 | Hide roof coverings in Walk and disclose this in the chooser | Existing coverings have no stair aperture; connected roof terraces must remain accessible without walking through a visible roof | Add correctly cut covering geometry and roof access fixtures |
| 2026-10-27 | Prefer a ground entrance, otherwise select an open ground patch facing a clear route | Actual furnished demo has only interior doors; first-free-cell fallback faced a window | Author an exterior demo entrance only in a separately approved demo-data change |
| 2026-10-27 | Phone stick moves and turns with one thumb; free-screen drag looks | Meets one-hand access while retaining a second-touch look option | Add selectable strafe layout and user testing |
| 2026-10-27 | Import Three animation implementation through a deferred source entry | A normal AnimationMixer import grew the early vendor bundle | Revalidate bundle graph if Three packaging changes |
| 2026-10-27 | Guard earlier editor capture handlers while Walk owns focus; tag curved joinery leaves | Review reproduced Delete mutating a selected opening and an arched leaf staying visually closed | Retain read-only and arched-door regression fixtures on any modal/renderer change |

| 2026-10-28 | Recompute and validate canonical Site geometry on saved input; whitelist bounded nested metadata | Review found forged redundant polygons and malformed public-source values could survive import; 1 mm consistency checks and bounded fields reject them | A versioned input migration and independent malformed-payload regression checks |
| 2026-10-28 | Reject date-line wraps, spans above 500 m, self-touching boundaries and corner spacing below 1 cm before projection/querying | Prevent near-global Overpass boxes and ambiguous polygon measurements; supported limits are explicit | New geographic partitioning/topology support and independent fixtures |
| 2026-10-28 | Keep original provider acquisition/database/period metadata and show actual Overpass outages as unavailable | Cached results must not appear newly fetched; three real-location runs encountered capacity errors/timeouts | Provider replacement or new successful evidence; never substitute invented zero counts |
| 2026-10-28 | Bound streaming response bytes, pending provider work and total terrain deadline; retain Retry-After | Review found unbounded body reads and missing terrain throttle could exhaust prototype capacity | A separately designed distributed quota/cache service if wider demand requires it |

Keep `CURRENT.md` and the scored `RUBRIC.md` consistent with the actual branch being reviewed. All failed final timing pairs remain evidence, not discarded warmups.


## Integration decisions — 28 October 2026

| Date | Choice | Reason | Cost to reverse |
|---|---|---|---|
| 2026-10-28 | Keep canonical Site persistence validation synchronous, disclose 4,350 gzip early bytes | Weakening validation or racing saved geometry is unsafe; literal zero-new-code gate remains unmet | Separate deferred validated Site hydration with migration and persistence regression work |
| 2026-10-28 | Export five existing Three symbols, keep new implementations deferred | Avoided AnimationMixer/BVH implementation entering early vendor; aliases cost 45 raw/12 gzip bytes | Re-audit module exports after renderer upgrades |
| 2026-10-28 | Use portrait FOV 95°, shoulder offset and hide actor when camera extremely close | Improves navigation framing while preserving swept camera collision; tight-room polish still needed | Camera tuning and physical-user regression checks |
| 2026-10-28 | Preserve every failed first-picture pair and label preview release gates unmet | Fresh-browser measurements are slower; no warmup deletion or threshold changes | Actual performance corrections and a new fully retained paired run |
| 2026-10-28 | Measure frame pacing again without screenshots, keep original data | Captures inside the movement interval can affect 1% lows | Use external capture hardware or equivalent non-interfering instrumentation |
| 2026-10-28 | Retain inherited Lighthouse failures as release blockers | Same 22 assertions already fail on merged PR51; unrelated PWA/CSP/plumbing changes exceed this feature build | A focused authorized repair with unchanged audit gates |
| 2026-10-28 | Correct a test-only fetch mock signature | CI API config includes tests and exposed a zero-argument tuple inference missed by the narrower local check | No reversal needed; run exact CI configuration in later rounds |


## Fix round 1 — 28 October 2026

These decisions supersede the Stage 2 synchronous-hydration choice, per-pair custom-domain gate, and treating inherited Lighthouse as this round's blocker. They do not waive the strict static gate.

| Choice | Reason / evidence | Cost to reverse |
|---|---|---|
| Count the existing 45 raw / 12 gzip Three export aliases as zero | Explicit Commander ruling Fix 1 §1/§2B; network has no separate Walk implementation request before first picture; early adapters remain counted | Re-audit implementations/exports on dependency changes |
| Keep opaque optional world data in the legacy store; defer canonical validation and figures | Removes previous 4,350 gzip canonical payload; preserves saved-world data through early writes, rejects malformed geometry before use | A storage-format/integration redesign with no-site/import/rehydration regressions |
| Report remaining early adapters as failing literal byte equality | Walk +1968/+744, Site +2570/+953 raw/gzip in controlled 28 JS closure; alias exception does not cover launch/lifecycle/persistence/plot code | A separate integration design or explicit Commander rule change; no invented exemption or size padding |
| Bundle exact licensed PNGs with post-picture launcher; import engine only after Start | All four visible; no GLB before Start; visible streamed progress | Revalidate real click and cold loading evidence |
| Retain initial chooser failures and repair the measured shader stall | Initial 7,386 / 1,363 ms failed; final whole action to decoded frame 117.0 / 237.0 ms passes. Matching AO beauty and thumbnail shaders warm asynchronously; original lighting and draw parameters remain | Revalidate target-specific shader programs, queue lifetime, visual output and real input after renderer changes |
| Retain an operated open door while visible/in reach | Fixes 2/3 lost-prompt regression; other aimed doors take precedence; occlusion/distance still apply | Interaction-policy regression work |
| Shorter 2.15 m swept follow with level compressed aim and safe low-ceiling fallback | Actual narrow office pair; no camera through world/actor | New camera tests and physical-device evidence |
| First Esc unlocks, second Esc exits using live DOM lock ownership | Five native cycles incl duplicate delayed pointerlockchange; first-use card and locked HUD explain | Browser event-order regression checks |
| Measure event→changed-position render submission via opt-in one-shot hook | All desktop samples <50 ms; no movement/controller tuning required; not an input-to-photon claim | External high-speed camera or compositor measurement |
| Preview live Site checks use only existing healthcheck env=preview | Real map/search/draw/visible credits at both sizes; simulated production/error remains offline; deferred waiting screen owns focus | Remove switch after tester no longer needs it, retaining production fail-closed tests |
| Same-host medians gate; custom-domain pairs informational; retain canvas marks too | Fix 1 §1 ruling; five fresh-browser pairs/device/branch at pinned 216.198.79.3; exact gaps/profiles retained | A Commander-defined protocol, not cherry-picked warmups |
| Leave Lighthouse untouched and list exact inherited 22 IDs | Both final code CI runs have identical error sets/values to tree-identical main; no new error | Separate authorized repair with unchanged thresholds |
| No rebase | Start-of-round fetch still 3eefbf7; PR #52 remains outside scope | Rebase and repeat full suites/measurements if explicitly required after main moves |


## Finish round 0 — Wednesday, 28 October 2026 at 13:59:56 GMT+4

| Choice | Reason / evidence | Cost or condition to resume |
|---|---|---|
| Stop before the required rebase/publication; keep existing branch history intact | Finish §1A requires rebase onto open PR52, while §0.4 forbids force-push and merge. Published World tips diverge at3eefbf7; a true rebase is non-fast-forward. The explicit hard-stop rule takes precedence over inventing publication permission | A consistent authorized history/publication path, or PR52 merged externally followed by the same published-history check. A main merge alone does not make rewriting World history fast-forward |
| Do not substitute cherry-pick, bridge merge, new PR, or branch deletion/recreation | These either fail the required rebase/existing-PR result or bypass an explicit prohibition; proof in finish/base-publication-proof.md | An explicit instruction resolving the conflicting requirements; no question or permission request sent |
| Preserve prior passing fixes and failed evidence; do not count a blocked startup as three engineering attempts | No application code was changed and no post-PR52 measurement exists; performance and rubric passes cannot be invented | Resume from ROUNDS.md and retain every measured run |
| Record BVH0.9.17 and refreshed provider pages without changing dependencies | New collision-method correction is relevant, but upgrade requires full suites and paired runs after the authorized base integration | Focused collision regression plus full-suite and paired performance pass |
| Triage all22 Lighthouse assertions before editing settings or content | Four assertions target score-null informative audits; public source maps are intentionally forbidden. Other safe content fixes remain planned | Implement isolated robots/hero fixes after base integration, run new artifacts, retain remaining reasons; never weaken thresholds |

Status: **HARD STOP**, not budget exhaustion and not a merge-ready claim. One Finish startup entered; no completed Finish engineering round. No force-push, merge, main push, manual deployment, new account/key/environment variable, migration or estimate change.

## Finish round1 — amended rules,28October2026

| Choice | Reason / proof | Reversal cost |
|---|---|---|
| Merge52 normally into both publishedbranches; never rebase | Explicit18:22MU amendment supersedes the earlier integration conflict; ancestry and normal-push proof inROUNDS | No history rewrite; future fixes remain normal forward commits |
| Reclassify stopped startup as round0 | Commander's explicit ruling; no failed engineering attempt or budget charge | None |
| Compare against actual56d852d preview/build, permit only≤1024gzip lazy-seam growth | Same OLB shell removes prior production-shell confound; exact final emitted bytes and HTTP starts remain audited | Any other allowance requires a changed instruction |
| Test earlier delivery of existing App/ThreeStage dependencies through HTML hints | Measured waterfall starts those requests after main evaluation; no dynamic World chunk is included | Remove the isolated build plugin if paired, byte or request proof worsens |
| Retain human-comprehension and physical one-hand limitations | Browser scripts can prove control behavior and geometry, not invent a human study | Independent human evidence, without padding rubric scores |

Historical round0 HARDSTOP above is resolved; Finish round1 is active. Production/PR merging, manual deployment, force-push and main publication remain forbidden.

## Finish round1 result decisions

| Choice | Reason / evidence | Next action |
|---|---|---|
| Keep both original wall and canvas timing gates | Site phone wall fails+11.407% while canvas passes+7.817%; do not silently choose the better definition | Improve real loading and retain every paired row |
| Add FCP as necessary loading-paint proof without replacing DOM timestamps | All current FCPs exceed1second; DOM visibility alone is not paint | Remove parser/render-blocking startup dependencies and check actual frames |
| Preserve background renderer quality and pause it only while covered | Diagnostic82 AO callbacks overlap Walk input stalls; no need to lower quality | Reuse existing beginWalk/release lifecycle and prove restoration |
| Lower print/banner scores when page2 lacks the disclaimer | All6 pages were inspected; first/last banner is insufficient | Repeat footer in a reserved named-page margin |
| Keep9 inherited Lighthouse failures visible |13 safe fixes shipped, no new failures;4 assertions are informative-null and1 public-source-map fix conflicts with policy; safe FX/LCP/CSS work remains | Isolate plumbing without changing primary output or settings; reject if graph/timing regresses |
| No item is yet exempt under the3-round rule | Round0 was a startup conflict; Round1 is the first genuine measured round | Continue Round2, no handback yet |

## Finish round 2 result decisions

| Choice | Reason / proof | Next action / reversal cost |
|---|---|---|
| Restore upstream early natural shading exactly | A numeric gzip pass hid 1,217 rendered bytes of non-seam shader warm-up; Round1 semantic pass was withdrawn | Keep actual feature work deferred; name remaining bootstrap adapters explicitly |
| Use atomic drawing-buffer sizing without quality changes | Real browser proof removes two redundant 450×225 allocations while preserving DPR, logical/physical size, CSS and viewport behavior | Same renderer/XR assumptions remain tested; no power/antialias/shadow reduction |
| Paint the static loader while preserving original primary assets; isolate plumbing entry | Film shows actual loader pixels before React; primary non-HTML hashes preserved; 40 formal rows have the same early paths | Preserve every slow row; do not confuse the remaining network/paint gaps with a pass |
| Keep native margin-box disclaimer and scoped contrast repair | All eight print pages and 96 contrast checks pass on exact source | No user-controlled CSS injection; retain canonical string and screen banners |
| Keep strict FPS and failed zero-settle input separate | Desktop windows reach exactly 60; one keyboard sample still takes 383.4 ms | Profile the reproduced 444.9 ms diagnostic stall; never hide it behind the median |
| Preserve unresolved native phone Open tap | Better one-touch harness reaches the door but does not see Close; source cause not yet proved | Inspect actual hit targets/events/state; fix in Round3 if a product failure is established |
| Retain seven inherited Lighthouse failures with exact causes | Fifteen fixed, no new IDs; four informative-null assertions and private maps conflict with unchanged policy; two CSS cases need separate ownership reasoning | Try isolated pitch base CSS; do not purge reachable Designer styles from initial-view coverage |
| Continue Round3 without questions or premature final handoff | B, D, F and phone interaction remain failed/unproven after two real rounds | Apply the stated three-consecutive-round rule only when genuinely reached |

## Finish round3 decisions —29 October2026

Measurements closed29 October2026 at23:25 MU. Evidence publication is recorded separately in [ROUNDS](ROUNDS.md). Application heads: Walk `52fa4088e99eafaaaea33e5ad8feb0cbc617fd9e`; Site `7a73b25a2a32556d9d5cf5381d72e7c7bf611447`. These decisions append to the prior history; failed attempts and diagnostic context remain identified in the [source manifest](finish/evidence/SOURCE-MANIFEST.json).

Current decision evidence: [report](finish/evidence/REPORT.md), [timings](finish/evidence/timings-and-static.json), [requests](finish/evidence/network-summary.json), [bytes](finish/evidence/build-attribution.json), [source review](finish/evidence/semantic-gate-final.json), [Walk samples](finish/evidence/walk/compact.json), [preparation decision](finish/evidence/walk/REVIEW.md), [Site automated](finish/evidence/site/preview-smoke.json), [Site visual](finish/evidence/site/visual-review.json), [plan behavior](finish/evidence/site/plan-projection.json), [plan visual](finish/evidence/site/plan-visual-review.json), [print](finish/evidence/site/print/visual-review.json), [CI](finish/evidence/ci-status.json) and [Lighthouse exceptions](finish/evidence/lighthouse-classification.json).

1. **Withdraw the prior blanket early semantic PASS.** Round1/2 numerical and measured request/timing facts remain evidence, but their semantic conclusion was incomplete: early Walk view/light/fog/door behavior and Site polygon/label/arrow behavior were found later. Round3 moves that implementation behind deferred entry/projection. Independent current source review and controlled build pass with 28 early files, +428 gzip Walk and +1,014 Site against Base52. Only minimal transport/ownership/presence seams plus separately identified repairs to existing startup/accessibility behavior remain. Current independent request proof also passes: all20 pairs retain the same36 paths, no additions/removals or early feature requests, exact stable health and zero errors/writes across40 loads. All branch/device relative wall/canvas median comparisons pass; individual slower pairs remain evidence. Site has only10 gzip bytes of the1,024-byte allowance left.

2. **Retain the current laptop input PASS without deleting prior failures or claiming preparation compliance.** All10 zero-settle current laptop samples are<50 ms; maximum36.399999976 ms. R1 max110.9 ms and R2 max383.4 ms /separate444.9 ms diagnostic remain archived; the current pass ends that streak. Normal entry worsens from2,836.899999976→5,990.399999976 ms laptop and2,977.100000024→3,736.700000048 ms phone. Native phone touch maxima also worsen: third54.200000048→385.300000072 ms and first117.899999976→187.100000024 ms. The final Walk aggregation provisionally retains preparation for R3, with causal attribution and Finish step5 compliance explicitly **unproven**. Delivery differences confound entry; a source-injected await228.800000072/362.099999905 ms is not net additive cost, pure GPU time or proof of compilation's benefit. R4 requires a predeclared eight-context matched-delivery current/omit-preparation A/B covering entry, every input sample including phone and errors. Strict FPS remains a separate normal40-second campaign. An attributable worsening must be reverted; improved laptop input grants no tradeoff exemption.

3. **Continue native phone door diagnosis in R4.** R2 first exposed the actual one-pointer Open→Close failure. Current formal v6 again stops at `click-not-observed` after one Open attempt. Desktop/native movement/run/view/Controls/Exit and restoration pass; those do not waive the door failure. Old-source intermediate passes and later protocol diagnostics remain separate observations, not replacements for formal current evidence. Two actual failed Finish rounds are not three. No collision diagnosis or pointer-up activation workaround is justified without event evidence.

4. **Treat strict laptop FPS as a new failure.** Current third-person window is exactly 59.825 completed renders/s, below60; first-person is60. Phone both views are60 against30. Preserve all intervals, pauses (zero), tails and 1% lows; do not round59.825 to60. R2 passed60/60, so current streak=1, not three.

5. **Split automated Site function/print from failed actual plan pixels.** Seven UI cases, four corrected native plan/hydration rows and both dedicated PDF devices pass; all16 actual PDF pages across two campaigns were inspected. The original plan-v1 timeout is a retained harness failure: the correct capacity text was inside the native closed Show plan tools disclosure; v2 opens it using the real control and keeps the same semantic assertions. Actual phone plan source label clips and north arrow is hidden under open HUD; close/reopen also produces white-on-cream toggle text. These persistent visual defects are first observed this round and require R4 repair. Do not label Site G or whole-Site visual quality PASS just because7/7 automated cases pass.

6. **Keep attribution uncertainty explicit.** Original exact-head phone live-map screenshot shows a blank credit strip although the earlier DOM query found three visible links. Five bounded later captures show painted credits, including a native scroll into the original region, with no source change. Cause remains unresolved; no fixed paint race or CSS defect is asserted. Retain original and all later captures; report automated/visual/combined gates independently. No hidden credit on the offline map is introduced.

7. **OPEN: human first-use comprehension.** R1 review had controls but no timed first-time human evidence; R2 still lacked it and identified unmeasured ten-second/keyboard-only copy; R3 removes the claim and gives device-appropriate instructions but still has no human study. Score remains1 after three genuine evidence reviews. Next idea: a separately authorized timed first-use observation with unfamiliar people; automation cannot supply it. This records three evidence reviews, not three invented studies.

8. **OPEN: physical one-hand ergonomics.** R1 had emulated control proof, R2 added native single-contact evidence but no physical comfort/reach observation, and R3 repeats one-contact control evidence without a physical-device human session. Score remains1 after three genuine evidence reviews. Next idea: separately authorized physical390×844-device thumb-reach and fatigue observation. Keep actual phone door delivery outside this human limitation; it remains an active product/interaction failure after only two rounds.

9. **OPEN: absolute laptop startup and every-run loading paint.** Current formal results establish the third consecutive failed Finish round. Keep this distinct from current relative and absolute-phone PASS. [All current pairs](finish/evidence/timings-and-static.json) preserve the complete measurements; [SOURCE-MANIFEST](finish/evidence/SOURCE-MANIFEST.json) identifies prior and diagnostic evidence.

| Item | Finish1 failed evidence | Finish2 failed evidence | Finish3 failed evidence | Next idea after OPEN |
|---|---|---|---|---|
| Walk laptop<3s | Wall5,700 /canvas5,183.5 ms | 4,299 /4,165.9 ms | 3,536 /3,398.4 ms | Separately authorized startup-stage attribution from retained delivery/decode/render evidence, without lowering image quality or changing thresholds. |
| Site laptop<3s | Wall5,262 /canvas5,184.2 ms | 4,838 /4,718.8 ms | 3,418 /3,282.8 ms | Same bounded stage attribution, with the correct branch/base comparison; do not assume World download overhead where no early feature request exists. |
| Every-run loading paint≤1s | 0/20 candidate FCP prerequisites pass | 9/20 pass | 17/20 pass: Walk laptop4/5, Walk phone4/5, Site laptop4/5, Site phone5/5 | A separately authorized visible-frame capture can establish which content paints; FCP/DOM alone cannot. Retain network/paint intervals without guessing compositor/GPU causality. |

All40 loads have stable exact health and zero recorded errors/writes. Current base laptop wall/canvas3,870/3,831.8 ms; base phone3,433/3,295.6. Walk phone3,266/3,124.9 and Site phone3,050/2,931.9 pass<5s. Both branches/devices pass relative wall/canvas medians. Preserve every individual pair, including slower runs. All20 response starts are≤1s; two response ends exceed1s. Three failed FCP prerequisites establish failure of the every-run paint gate, while17 passing FCPs do not independently prove loader pixels. R2's relative Site phone PASS resets its earlier failure; current relative result passes again.

10. **Keep six specific Lighthouse exceptions, not a blanket inherited waiver.** Current both-head checks repair16/22 inherited assertions; no new error IDs and thresholds/settings unchanged. Remaining: `csp-xss` and `total-byte-weight` on each of two routes (four informative/null-score assertions cannot become scored passes via application changes); Designer `valid-source-maps` (existing private Sentry/no-public-map policy); Designer `unused-css-rules` (one initial coverage snapshot cannot safely remove styles needed by deferred tools/routes/conditional states). Isolated plumbing unused CSS is repaired. Jobs remain failed; current warnings remain15 Walk/14 Site, with no newly added warning IDs. No provider/dependency review is repeated or upgrade implied.

## Next three focused Round4 concerns (after normal round-start checks)

1. Diagnose native phone door click delivery from preserved formal/native event records and a bounded predeclared comparison, then repair only a reproduced cause. Preserve desktop interaction, collision safety, single contact and no-write/restoration behavior; do not manufacture a pass by changing the oracle.
2. Repair the confirmed phone Site plan presentation: move complete geographic text/arrow rendering into the deferred projection callback, bound/wrap it within the visible canvas/HUD space, and pair the existing toggle hover foreground with its theme background. Preserve exact legacy rectangle behavior, inert pending world, canonical64m² concave geometry and constraints. Test native disclosure open/close/reopen and keyboard/hover/focus across themes; inspect actual pixels. Re-audit the ≤1,024-byte seam and request path. Keep the attribution capture discrepancy under bounded evidence review; do not claim an unobserved fix.
3. Run the eight-context matched-delivery preparation A/B for entry/all input/errors, then diagnose the newly failed laptop third-person FPS window in the separate normal40-second campaign without reducing image quality, hidden settling, removing intervals or changing thresholds. Retain every entry/input observation, including worsened native phone touch maxima; revert attributable regressions under Finish step5. R2's FPS pass means the strict current failure has only one failed round. Do not claim that compilation caused either the input improvement or the later frame stall.

Final [visible rules](finish/evidence/rules-visible.json) pass all8 screens with stable exact health and zero recorded errors/writes. The fresh [353-file static audit](finish/evidence/rules-static.json) passes both branches, including unchanged protected estimators/tests/settings/dependencies and no unpublished commits at measurement closure. Evidence publication and the next round's startup checks are recorded in [ROUNDS](ROUNDS.md). No production merge, manual deploy or contract waiver is implied.
