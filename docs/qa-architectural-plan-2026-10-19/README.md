# Visual QA — architectural plan

Run on the local Vite application with Playwright and SwiftShader software WebGL. See report.json for the full capture list and checks. Ten screenshots cover 1280 × 900 desktop and 390 × 844 phone; no console/page errors, mutation requests or horizontal overflow. The saved property is unchanged after the plan zoom check.

Inspected: warm 2D mineral floor and wall caps; actual shaded overhead furniture after its queue completes; window/door gaps; exact dimension lines; small-room labels; phone framing and readable Ground floor control. Shared 3D bare-floor colour follows the same warm mineral tone. Display-only changes do not assign or order a floor product.

Known limit: the software-GPU main-home snapshot queue took 34.3 seconds desktop and 18.3 seconds phone on these runs. These are automated-software-renderer observations, not measured real-device timings. Existing silhouettes remain usable during that first generation, and cached snapshots are reused. Procedural furniture remains a planning approximation; reviewed merchant/OpenArt-derived models are integrated separately.

Re-run: node tools/architectural-plan-shot-2026-10-19.mjs http://127.0.0.1:5173
