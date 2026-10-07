# Plumbing pitch and employee sales starter pack

App: Room Designer. Date: 7 October 2026 (Mauritius).

Branch: `gpt/designer-2026-10-07`. PR: https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/43

Application commit: `24dc3b8f1c67bc68cc5f2097e9c2bb593f30ebac`. Started from current main `6f31305` after PR #40 had already merged. Main and production were not changed by this task.

## What exists

- `/pitch/plumbing`: six customer-facing chapters, actual services screenshot, on-demand live services planner, catalogue references, 2D/3D/combined installation options, collaboration boundaries, one-hour booking and existing private enquiry form.
- `/studio/sales`: employee hub with six exercises, 17 market categories, five delivery scopes, product-onboarding checklist, five outreach templates, local-only discovery worksheet and full deployment-aware link directory.
- Existing Studio home links to the employee hub. Studio retains its existing access gate. Pitches, Demo and embeds use the already-established public/read-only policy.
- `tools/export-sales-pack.mjs` creates seven portable Markdown documents from the shared hub content. Pass the verified HTTPS origin and the required handoff folder explicitly. It does not publish products or contact prospects.

## Claim boundaries

No company partnership, universal stock feed, automatic procurement, simultaneous multi-company editing, professional certification, exact manufacturer models or guaranteed savings are claimed. Catalogue rights, data verification, access and integration acceptance remain explicit. Employee templates contain no prices or credentials. Technical calculations and scale are unchanged.

## Verification

Client, middleware and API typechecks passed. New-page lint and production build passed. Relevant tests: 47 passed. GitHub full Vitest run: 313 test files passed. Desktop and 390px phone inspected; all new chapters/sections have no horizontal document overflow. Real services iframe opens and the physical-meeting form shows location/availability without submitting an enquiry.

Lighthouse CI audits production `https://designer.ppwellness.co/designer`, not the new preview. It fails existing PWA, crawlability, metadata and payload assertions. Do not weaken the checks to conceal this.

First deployment: Vercel `FQHNrJDKGe83oizn7HZQGdsy2bQQ`, GitHub deployment `6911105646`. Reported successful at `https://ppw-designer-2d-9nglriobi-victor-ppw.vercel.app`, but browser/HTTP requests timed out during verification. This is not evidence of a verified live app. Check the final handoff and CURRENT-WORK-LINKS for the recovered preview status.

## Required handover location

`C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-07-sales-starter-pack`

Include HANDOFF.md in the vault's exact template, seven employee documents and actual captures in shots/. Code stays in the product repository. No outreach, merchant publication, enquiry submission, payment or production release was performed.
