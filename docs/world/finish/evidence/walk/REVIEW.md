# Round2 Walk interaction and frame evidence

Exact deployed head: `d78064f9f57ed6e060d9782036b4a8b7a7e95451`. All seven before/after health pairs matched. No source changes during the exclusive campaign or later diagnostic lease. The initial five checks released at06:52:28Z; the later two diagnostics released at07:06:35Z. All owned browsers/processes closed and the shared lock was absent at each release.

## Gate results

Chooser, original designer pause/restoration, all four strict FPS windows, and desktop functional checks PASS. Laptop input and phone door functional check FAIL; every failed sample remains in the evidence.

| Device/view | Completed frames /40s | Strict FPS |1% low FPS |Longest interval ms |Unfinished tail ms |Result |
|---|---:|---:|---:|---:|---:|---|
|desktop third|2400|60|47.47774479592525|31.399999976158142|2.100000023841858|PASS|
|desktop first|2400|60|48.51425102150114|34|13.699999928474426|PASS|
|phone third|2340|58.5|16.091183375016048|349.7999999523163|5.700000047683716|PASS|
|phone first|2374|59.35|26.49299040396077|215.89999997615814|15.599999904632568|PASS|

Every frame window has40000 active milliseconds and zero paused time. Every completed interval, armed partial interval and unfinished tail remains in raw evidence. The unchanged FPS protocol explicitly warms3s initially and1s after the view switch. Independent rAF and historical HUD values remain separate in JSON; neither replaces completed renders. No screenshot or interval deletion occurred.

## Zero-settle input v3

Round2 removes Round1's explicit1000ms post-ready and400ms view-switch waits. It retains native event timestamps and measures through the first changed-position render submission, not display photon latency. Five keyboard samples per view/device and five additional native-touch samples per phone view are preserved.

**desktop** chooser event→decoded frame 48.300000071525574ms; original call→visible 137ms; call→decoded 152ms. Entry Start→ready 2836.899999976158ms is separate.

- Keyboard third: `[13.5,9.200000047683716,9.5,8.399999976158142,383.39999997615814]`; median9.5, max383.39999997615814ms.
- Keyboard first: `[25.700000047683716,11,6.299999952316284,8.600000023841858,11.399999976158142]`; median11, max25.700000047683716ms.

**phone** chooser event→decoded frame 49.39999997615814ms; original call→visible 152ms; call→decoded 157ms. Entry Start→ready 2977.100000023842ms is separate.

- Keyboard third: `[18,7.299999952316284,7.399999976158142,11.299999952316284,10.100000023841858]`; median10.100000023841858, max18ms.
- Keyboard first: `[7.299999952316284,11.199999928474426,339.1999999284744,9.600000023841858,15.700000047683716]`; median11.199999928474426, max339.1999999284744ms.
- Native touch third: `[54.200000047683716,44.10000002384186,44.40000009536743,46.5,44.10000002384186]`; median44.40000009536743, max54.200000047683716ms.
- Native touch first: `[38.5,43.199999928474426,44.89999997615814,39.89999997615814,117.89999997615814]`; median43.199999928474426, max117.89999997615814ms.

Laptop third-person sample4 is383.39999997615814ms: event9789.700000047684, handler9789.899999976158, rendered10173.100000023842. Only0.19999992847442627ms is event dispatch;383.2000000476837ms follows the handler. The phone339.1999999284744ms keyboard stall is similarly post-handler. Conversely, phone native-touch117.89999997615814ms is103.19999992847443ms before its handler and14.700000047683716ms handler→render. These distinct mechanisms are not conflated. Phone timing is diagnostic; the hard<50ms requirement specifies laptop.

No resource request overlapped either formal keyboard stall. Last desktop completion was Draco WASM at8864.899999976158ms, before the late input. The separate profile below locates a GPU wait signature but cannot prove the exact operation behind either formal sample.

## Original designer ownership and functional behavior

On both viewports the original frame count is2 before chooser and remains2 during chooser,750ms later, after Start, at ready and after movement. After Exit it resumes to10 desktop /3 phone. Saved property is8821bytes with SHA25619b82b63d26dc508745434d94a4e8618c1d83eaa61a82d3818d423eee3aa5d4c; both editing/rendered camera strings restore exactly. Zero errors or attempted writes.

Desktop native movement/stop, actual door approach/open/close in both views, five pointer-lock Escape cycles and exact restoration all pass. Phone native touch movement/stop and Exit/restoration pass, but phone v1 fails at “Heading probe blocked” before reaching a door. The fixed140ms keyboard pulse and220ms status wait did not observe>.025m displacement; original probe coordinates were not persisted before the assertion. Screenshot shows a valid scene, with no page/console/HTTP error. Cause is unresolved. That failed check remains failed alongside the separate v2 below.

The original phone door harness still used keyboard movement/E, so that campaign does not prove a fully one-pointer route. Human10-second comprehension and physical one-hand comfort remain unmeasured. Original frame stability also does not prove asynchronous detail/shader work stopped.

## Separate retained phone correction and bounded profile

A later exclusive diagnostic lease ran native-touch phone v2 and a15-second desktop CPU/trace profile. Both processes/browsers closed; lock absent and no matching processes at07:06:35Z. Formal timings and FPS above are unchanged.

Phone v2 uses at most one active native touch and zero keyboard events. It passes movement/stop/restoration, run toggle and animation, view switching, Controls and Exit. The bounded movement probe logs every position/event before assertions, and this attempt successfully reaches an Open door prompt. Native tap at(195,607) produces pointerdown/up and touchstart/end, but Close door does not appear within30seconds; the screenshot still shows Open door. No errors or writes occurred. Click-event delivery and immediate post-tap status were not recorded, so the cause is unresolved. Both phone failures remain in the compact JSON; neither is turned into a pass.

Source review shows that a delivered click may reject an unsafe door swing and display Step away for2seconds. v2 did not observe this transient status, so its timeout does not distinguish click delivery, changed reach, or a correct safety rejection. A later bounded diagnostic must capture button bounds/hit target, click and status changes, without bypassing collision safety.

The separate profile reproduces444.89999997615814ms input delay at event18030.900000095367→handler18031.200000047684→moved-render18475.800000071526. Renderer-main sampled idle is438.413ms. No renderer-main task>=50ms overlaps it; the resumed private Walk tick is6.253ms. Current deployed snippets map runtime-CPxmO2GM.js:column68413 to the Walk tick and ThreeStage-Xk2UXML6.js:column79420 to the existing beginWalk.render method, rather than assuming old minified symbols.

A CrGpuMain task lasts495.856ms, with nested WebGL/CommandBuffer flush495.814/495.812ms and only about1.2ms thread CPU. It spans17972.717→18468.529ms; Walk resumes at18469.847ms. Trace/navigation mark agreement is0.018999952317244606ms. This supports a GPU/driver wait or scheduling stall rather than a long collision/HUD JavaScript task. The trace does not expose the underlying GL command or establish shader compilation as its cause. Original frames remain3 and paused in chooser/ready/window-end snapshots. All CPU samples, trace events, source snippets and clock evidence are retained.

The long PutChanged batch identifies handler .WebGL-0x3224048cbc00, on current GL context0x5, with put_offset22799. The earlier three same-handler batches end at offsets7369,13640,20269. Its start17972.719ms precedes the failing input by58.18100009536743ms and overlaps the preceding Walk tick17969.399–17972.900ms, so it processes earlier client commands. Offsets do not disclose GL opcodes.

- Handler `.WebGL-0x322401136c00`: 287 batches, first9435.561ms, last14336.486ms; 280 before chooser and 0 after ready; current context(s) 0x4.
- Handler `.WebGL-0x3224048cbc00`: 4523 batches, first12934.972ms, last32908.413ms; 0 before chooser and 4269 after ready; current context(s) 0x5.

Exactly two WebGL handlers appear. The earlier original-designer handler has zero batches after ready. The later handler begins after private stage creation and continues throughout the private Walk visit; this supports private Walk context ownership by lifecycle inference. The trace contains no direct canvas-to-handler or route-id binding and does not identify the driver operation, shader or texture responsible. Deferred compileAsync on the selected avatar/private scene is only a reversible Round3 hypothesis; it has not been implemented or measured.

## Proof paths

- background: `results/r2-walk-background-v1/background-ownership.json`
- input: `results/r2-walk-input-v3/walk-performance-walk.json`
- frames: `results/r2-walk-frames-v2/walk-framerate-walk.json`
- desktop: `results/r2-walk-functional-desktop-v2/walk-functional-walk.json`
- phone: `results/r2-walk-functional-phone-v1/walk-functional-walk.json`
- phoneCorrected: `results/r2-walk-functional-phone-touch-v2/walk-functional-walk.json`
- profile: `results/r2-walk-input-stall-profile-v2/input-stall-profile-summary.json`

The compact JSON preserves the Round1 top-level input/frames/functional schema and adds explicit protocol, background ownership, tails, diagnostic limitations and release evidence. All raw keyboard/touch values and failed functional evidence remain intact.
