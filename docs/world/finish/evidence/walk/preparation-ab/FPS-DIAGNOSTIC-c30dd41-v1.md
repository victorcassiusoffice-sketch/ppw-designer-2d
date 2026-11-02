# One bounded FPS diagnostic

Exact preview: `c30dd41ce5a282c2620f7164d9245f9519e8e2c3`, desktop third person. One fresh context, no retry, unchanged 3000ms formal warmup and 40000ms frame window. This run has CPU/trace overhead and is **diagnostic only**.

It recorded **2400 completed renders / 40 seconds = 60 fps**, zero paused time, 2400 independent rAF callbacks, and a longest completed-render interval of **33.199999928474426ms**. The former 131ms stall did not recur. The Round3 formal **2393 / 40 = 59.825 fps FAIL remains**; this diagnostic cannot substitute for the next normal formal run or establish a fix.

The CPU profile completed. Trace completion exceeded its bounded ten-second acknowledgement wait, so overall diagnostic completeness is **false**. All **1,312,564 received trace events** were saved again after context/browser closure to preserve late arrivals, explicitly as `fps-trace-partial.json` (367,886,535 bytes). No page, console, HTTP, write, or cleanup error was observed. Both health boundaries verified the exact preview head.

No app-attributable cause follows from non-recurrence. Collision/HUD optimization, quality changes, frame filtering, tolerance, and refresh-rate normalization are unsupported by this result. Detailed CPU/partial-trace attribution has not yet been processed; the compact proof retains navigation and user-timing clocks and the actual deployed runtime source for any later authorized inspection.

Raw evidence is under `results/r4-fps-diagnostic-v1/`; the companion JSON contains full-precision compact values and raw filenames. The release receipt confirms the browser closed, all six recorded owned OS processes were absent, and the shared lock was absent at **2026-10-29T20:03:54.4044353Z**. The exclusive lease was released to root immediately afterward.
