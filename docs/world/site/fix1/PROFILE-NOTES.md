# First-picture and chooser gap investigation

Initial measured code: Walk `ad7893027f7ea4add871a70698f3db4405398cb6`, Site `017e16d30e20262c37073bc47506e8431673973a`. Final measured code: Walk `554fb61eb161a020d3ba5087a14066307aabdc2b`, Site `2c6743a1a00fea395556358d011fa323b81b0018`. Baseline: `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. Diagnostic runs supplement the five formal pairs; they do not replace a failed pair.

## The required addresses serve different inherited shells

The specified production `vercel.app` address serves the PPW `index.html` shell. Preview environments and `onelivebuild.com` serve the OLB `olb.html` shell. This is existing behavior in `server/brand.ts` and `middleware.ts`; those files and both HTML sources are unchanged from the base on both branches.

The OLB shell preloads `/fonts/fraunces-600-latin.woff2` and `/fonts/outfit-latin.woff2`. They are the only additional pre-picture request paths against the specified production deployment. There are no additional request paths against `onelivebuild.com`, and no Walk engine, character, Site hydration, map or worker requests before the picture. The two fonts are already in the base repository. This explains the request-count difference (45 against 47), but does not establish how much of the timing gap they cause.

The required timing URLs were kept unchanged. The custom-domain timings remain informational. Do not describe the production-deployment comparison as a byte-identical HTML/brand comparison, or use the branding difference to waive the gate. Actual navigation sizes and request timings are retained in every row of `first-picture-pairs.json`.

## Initial main-thread comparison before the first picture

Chrome tracing covered navigation through the actual canvas picture mark for base and each candidate, on both viewport sizes. Initial traces are retained in the working evidence; `profile-walk.json` and `profile-site.json` in the delivered evidence contain the final-head repeats described below. Tracing adds overhead; categories can nest and must not be summed as wall time.

The initial eight traces show similar module-evaluation work: roughly 27–32 ms. The existing large construction/render callbacks dominate, at about 1.95–2.22 seconds in `FunctionCall` totals. There is no extra one-second callback before the picture in these initial samples. The final repeats have more CPU variation, so this observation must not be generalized to them.

One concrete retained formal pair (Walk, desktop, run 3) illustrates the delivery gap:

| Milestone | Base ms | Walk ms |
|---|---:|---:|
| HTML response complete | 418.7 | 769.8 |
| App request starts | 806.6 | 1,444.7 |
| App response complete | 1,359.6 | 2,138.8 |
| App CSS response complete | 1,412.1 | 2,198.1 |
| First rendered picture | 3,773.3 | 4,675.1 |
| Sum of long tasks starting before picture | 2,011 | 2,006 |

Phone run 3 has 1,871 ms of such long tasks on base and 1,880 ms on Walk; App completion moves from 1,902.2 to 2,299.0 ms and the picture from 3,908.6 to 4,317.8 ms. These observations point to later delivery/start of critical assets rather than comparable new CPU work as the main source of these particular gaps. This is an inference from these samples, not proof that every failed median is host noise. The literal bundle differences and failed formal medians still stand.

## Chooser: a separate post-picture problem

The original non-forced automation-call timing is 7,386 ms desktop and 1,363 ms phone. DOM click dispatch to the first frame containing all four decoded thumbnails is 114.6 and 233.1 ms. Both are retained. Native mouse-click diagnostic repeats also wait 4,439 ms on desktop and 1,316 ms on phone, so the delay cannot be dismissed as locator actionability overhead.

The diagnostic contains a roughly 3.25-second post-picture task on desktop, plus shorter repeated tasks on phone. A subsequent CPU profile identifies the desktop task as the first ambient-occlusion beauty render: `EffectComposer → RenderPass → WebGLRenderer.render → WebGLProgram` first-use/uniform setup. The existing warm-up prepared normal/AO shaders but did not prepare the beauty scene for the composer's half-float render target. This is separate from the measured first-picture gap. Follow-up repair and measurements must be reported alongside these original failures, never substituted silently.

The final repair also warms the two offscreen thumbnail/shadow programs before drawing. Temporary beauty materials isolate asynchronous readiness checks from concurrent direct-canvas rendering; program references are retained until the real beauty draw. Queued thumbnail jobs clear an old idle-disposal timer when each job starts. The focused regressions cover both races. Lighting, resolution, camera and geometry parameters remain unchanged; this is not a pixel-equivalence claim. Final deployed whole-action→decoded-frame results are **117 ms desktop / 237 ms phone**, versus the retained initial **7,386 / 1,363 ms**. Entry pause is separate at **5.682 / 3.001 s**.

## Final-head main-thread repeat

| Pair / target | HTML complete ms | App complete ms | Picture ms | FunctionCall total ms | Largest React callback ms | First ThreeStage frame ms |
|---|---:|---:|---:|---:|---:|---:|
| Walk desktop base | 430.5 | 1,374.6 | 4,104.6 | 2,195.5 | 643.3 | 1,106.6 |
| Walk desktop preview | 673.4 | 2,531.2 | 5,930.5 | 3,269.4 | 1,629.0 | 1,086.0 |
| Walk phone base | 594.0 | 2,093.4 | 4,948.5 | 2,813.1 | 1,316.1 | 1,086.8 |
| Walk phone preview | 668.8 | 2,038.9 | 5,105.2 | 2,905.6 | 1,367.2 | 1,115.2 |
| Site desktop base | 395.1 | 1,540.4 | 4,257.0 | 2,679.1 | 1,157.8 | 1,088.3 |
| Site desktop preview | 654.7 | 2,097.8 | 5,221.0 | 3,041.9 | 1,498.8 | 1,107.3 |
| Site phone base | 407.9 | 1,347.3 | 3,734.0 | 1,965.3 | 513.6 | 1,048.1 |
| Site phone preview | 662.5 | 2,201.0 | 5,369.7 | 3,101.8 | 1,473.4 | 1,109.8 |

Module evaluation remains about 29–31 ms, and the first ThreeStage render callback is comparable within each pair. The large React scheduler callback varies substantially: the preview is nearly one second slower in two of these diagnostic pairs. Later delivery is therefore only part of the final observed gap. It would be incorrect to dismiss the final failures as host noise alone. No separate World implementation chunk is requested before the picture; the remaining early adapters are still counted in the failed static gate. All failed formal medians remain binding.

## Paired CPU attribution of the mount callback

An additional diagnostic CPU pair on the phone viewport locates the difference inside the existing WebGL context creation path. Both base and Site load the identical `vendor-three-CjQotlrx.js` implementation. Sampled React scheduler inclusive time is 2,142.9 ms on base and 2,516.7 ms on Site (+373.8 ms); `WebGLRenderer → canvas.getContext` alone is 718.8 versus 1,091.4 ms (+372.6 ms). The renderer-construction effect differs by 370.9 ms, while the first-draw callback differs by only 8.0 ms and sampled shader first-use self time by 20.4 ms. The stack is React scheduler → passive effects → ThreeStage → WebGLRenderer → canvas.getContext.

This is sampled main-thread occupancy, including native driver waits, not pure JavaScript CPU time. It identifies a concrete source of variation in inherited graphics initialization. It does not explain every earlier 960 ms mount difference or prove that the full formal median gap is host-only or a source regression. No new feature implementation is on this stack. The raw CPU files stay in scratch to respect the evidence cap; compact stacks, sampling limits and source checks are in `mount-cpu-site-phone-attribution.json`, with its harness. No broad initial-render redesign or PR #52 change was made.
