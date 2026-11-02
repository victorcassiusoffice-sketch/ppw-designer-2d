# Prepared Round4 diagnostic — not executed

This is a bounded comparison of the one-time Walk preparation call. It is not a replacement for normal-source first-picture, input, FPS, or paired-preview gates. No application source changes are authorized by this protocol. Root must open Round4, fetch/read the round records, and grant an exclusive browser/CPU lease before execution.

## Decision and retained evidence

Finish §2 step5 says: “If a fix made anything worse, undo it before moving on, and write the lesson.” There is no tradeoff exemption. Round3 provisionally retains preparation because its net effect remains unattributed, not because a slower entry would be acceptable in exchange for input improvement.

Current laptop input has 10 passing samples versus one prior 383.4ms sample; that observation does not establish preparation caused the improvement. The strict 59.825fps sample with one131ms interval32.55s into the run remains a separate genuine failure. There is no trace linking that late interval to a promise settled during entry.

Phone native-touch outcomes worsened: third-person maximum54.2→385.3ms, first-person117.9→187.1ms. Dispatch delay dominates some samples. The comparison must retain every native pointer timestamp, handler time and first changed-position render submission; laptop-only summaries would conceal a relevant worsening. These observations do not assign a cause.

Keep Round3 v1's two no-injection failures and v2's two successful injected cases. V2 measured the original await at228.8ms desktop/362.1ms phone, with first rendered-status observation34.0/481.1ms later. These are modified-delivery diagnostic values, not additive net cost or pure GPU compile time. Preparation not explaining the whole entry increase does not exclude a smaller attributable regression.

## Binding and exact change

There is no execution default for the head, URL or body hash. The harness requires `--binding=<retained preflight JSON>` and a matching explicit `--expected=<full head>`. Round3's head52fa4088e99eafaaaea33e5ad8feb0cbc617fd9e and `/assets/runtime-DH-0TOIs.js` response, SHA256 `30b23e3c026f10b81a5f94b70b89777f52b2c070d00e7a85a7d3753fe26d36d2`, are historical source-review context only. Documentation publication can change health identity and generated dependency filenames even when application source stays unchanged. Never reuse that binding blindly.

Before execution, retrieve the new exact deployed response via pinned read-only GET, retain its bytes/headers/exact health boundaries, inspect the complete expression and preparation implementation, and create a fresh binding and explicit review. Do not update only a filename or relax byte equality. The actual route matcher uses the one full bound URL, never a generic runtime wildcard. The reviewed complete expression and preparation method must still match exact source; minification/semantic changes require review of the guarded code before changing those guards.

The preflight identity JSON requires `schemaVersion:1`, `expectedHead`, `runtimeUrl`, `originalSha256`, `originalBytes`, `originalResponseFile`, `reviewFile`, `harnessSha256`, `pinnedIp:"216.198.79.3"`, `capturedAt`, and actual `healthBefore`/`healthAfter` objects. Both health objects must have status200 and body `{commit:<expectedHead>,env:"preview"}`. File paths resolve against the identity JSON directory. Retain original response headers and pinned GET output beside it. The executing harness must also match its reviewed hash; changes after preflight require review and a new binding.

The explicit review JSON requires `expectedHead`, `originalSha256`, `reviewedAt`, `reviewer`, `approvedForDiagnostic:true`, `poseAndReadinessPreserved:true`, `cancellationSemanticsReviewed:true`, `noQualityChanges:true`, `inspectedLoadExpression` and `inspectedPrepareSceneImplementation`. The last two fields contain the exact fully inspected expression/method, not an abbreviated snippet. The harness verifies them against its reviewed full guards and the retained bytes. These fields represent a real source review, not a template to set automatically to true. The entire identity, review, original response and executing harness/protocol are copied into each run's evidence.

Both variants fetch and buffer the same complete original response through `route.fetch`, with retries0, redirects0 and a30s request limit. Both require HTTP200, exact URL/origin, exact original bytes/hash and exactly one reviewed full expression. Both preserve the same response-header changes, recording code, original body snapshots, transformed snapshots and syntax guard. Transformed body lengths are identical.

- **Current:** unchanged `await this.prepareScene()`, surrounded by guarded synchronous timing records. A rejected/throwing call rethrows the identical error object; no promise wrapping or extra await is introduced.
- **Omit:** replace only that expression with `void 0`, padded with ASCII spaces to the same length. The method remains defined but is not called. No replacement warmup, hidden render or quality adjustment is introduced. Omitting its await intentionally removes its scheduling point as well as its call.

Both retain idle/mixer setup, actor position, camera/follow initialization and history restoration, world-matrix update, progress call, the immediate disposed/abort guard, entry bookkeeping, the first scheduled actual render and the existing first-status readiness logic. Existing input guards remain unchanged. Error/cancellation behavior of the deliberately omitted preparation function cannot be claimed preserved in that counterfactual; all other loading/deadline/cleanup code stays unchanged. No shader, renderer, antialiasing, DPR, quality, camera, viewport or dependency settings are changed.

## Eight fixed contexts

Each case gets a separate fresh Chromium process and browser context. Existing D3D11, pinned host, viewport, phone settings, read-only routing and coach preference are reused. Shared performance lock is mandatory.

| Sequence | Device | Pair | Variant |
|---|---|---|---|
|1|Desktop1280×800|1|Current|
|2|Desktop1280×800|1|Omit|
|3|Phone390×844|1|Omit|
|4|Phone390×844|1|Current|
|5|Desktop1280×800|2|Omit|
|6|Desktop1280×800|2|Current|
|7|Phone390×844|2|Current|
|8|Phone390×844|2|Omit|

There are no sample retries or replacement contexts. Wrong/unavailable health before or after a case stops subsequent cases and leaves incomplete evidence. Ordinary case failures are retained and the remaining predeclared cases continue. Browser-case deadline is180s; input result limit3s; initial rendered-status predicate limit60s. Any source guard, missing injection, runtime error, timeout or missing sample stays visible.

## Measurements and input sequence

Health is read outside the browser before and after every case and must report the exact preview head. Only GET/HEAD/OPTIONS may leave the browser; blocked writes are listed. Every browser error and HTTP error is retained.

Use the existing initial Designer first-picture predicate, open the chooser, wait only for its four real images to decode, and select the default Maya through Start. Record the DOM click timestamp, changing loading progress, preparation start/end/result and first actual rendered status through a page-local observer. That callback records only status/time; resource entries are retrieved after input sampling and reconstructed using positive `responseEnd <= firstStatus.observedAt`, explicitly labelled as a reconstructed boundary. Do not serialize resources before the first input.

As soon as the rendered-status predicate resolves, arm the existing canvas `world-walk-measure-input` / `world-walk-input-result` measurement and send the first W input. Do not insert a screenshot, resource retrieval, ready-state snapshot, arbitrary sleep or frame-settling delay first. Record first-input event time relative to the observed first status so transport/automation delay is visible.

Retain five alternating W/S keyboard samples per third/first-person mode, with the same first-changed-position render-submission oracle. On phone, each view's five keyboard samples are followed by the same five native CDP touch-pad samples as formal input-v3, with independent pointer event times. The150ms release gaps between repeated samples are inherited from the existing harness; they are not added before the first sample or after a view switch. Switch view with the same First person locator click as formal input-v3; add no mode-state predicate,100ms native-contact experiment or post-switch wait. Install the pointer observer and CDP session before Start so their setup does not delay the first measured input. No timing threshold is weakened or used to manufacture a passing result. These remain diagnostic samples.

Retain all resource timing entries after inputs and the reconstructed first-status subset, original/transformed runtime bytes and hashes, exact replacement/call counts, response headers and transformation timestamps, progress events, input events/results and all partial observations. Each attempted sample is recorded before arming/sending, including its view, index, action and failure/release outcome if it times out. Native down/start and keyboard down are inside release-protected try/finally blocks. Resource delivery includes interceptor overhead and must remain labelled accordingly.

Pair eligibility is derived only after each row's final health and browser closure. It requires unique complete finite nonnegative samples, `inputAt <= handlerAt <= firstMovedRenderedAt` and exact component consistency (within1e-6ms floating arithmetic tolerance), a captured Start event, ordered finite preparation/ready timings, exact identity before/after, successful browser closure, no fatal/deadline or measurement/release error, and no blocked write/page/console/HTTP contamination. Native pointer time must precede input/handler times as well. All contaminated rows stay visible, but their pair delta is null with reasons; no null-to-zero subtraction is allowed. A complete diagnostic is a completeness/identity statement, not a performance pass.

## Interpretation and next action

Report every row and each predeclared pair, including the first input independently of later samples. Compare click→first rendered status, current await interval, last relevant runtime/GLB/Draco response→first status, and first/later inputs. Report both phone views' complete five native-touch samples and maxima, including pointer→handler and handler→render components; maxima of separate components need not belong to the same sample. Do not subtract network or await intervals and label the remainder “pure CPU/GPU”. Compare raw resource durations and progress phases before attributing a difference.

Two pairs per device are a bounded screening experiment. Consistent current-variant disadvantage beyond observed delivery variation would justify investigating a narrow normal-source removal with the existing preparation/first-render/input/cancellation tests adapted to actual semantics, followed by normal publication and required checks. A consistent input disadvantage after omission would support a possible preparation benefit but would still need normal-source confirmation. Ambiguity remains OPEN and does not become a step5/no-regression PASS. Do not claim formal gate completion from any outcome here.

This experiment cannot diagnose or clear the separate late FPS stall. Do not tune per-frame work based on it. Root owns that investigation.

## Command and release

Only after explicit Round4 lease and binding review:

```powershell
node work/world-finish/round4/harness/walk-prepare-ab.mjs --round4-lease-granted --expected=FULL_40_CHARACTER_ROUND4_HEAD --binding=work/world-finish/round4/preflight/binding.json --label=r4-prepare-ab-v1
```

Evidence is written under `work/world-finish/round4/preparation-ab/<label>/`; existing directories are never reused. The shared Round4 harness also creates its unused label directory under Round4 results; no Round3 records are changed. After process exit, verify both browser closure and shared-lock/process absence, write an explicit release receipt, and notify root before any formal work begins. Preserve the source/protocol snapshot and all unsuccessful runs.
