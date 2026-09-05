# Courts Mammouth — director push: plan, workflow and live status

Started 2026-09-05 on `feat/sims-world-2026-08-29` (preview-only — Vic merges).
Vic's brief: "we need to penetrate courts mammoth in Mauritius, someone may be
blocking trying to create their own, we need to ensure this gets to the
director, we should user test and present a real demo as well as the video,
make it ultra appealing."

## Ground truth at start (read this run, 2026-09-05)

| Fact | Proof |
|---|---|
| Vic already emailed TEN Courts Mammouth addresses: 7 on 2026-08-30 (A. Cohen, N. Narrainen for A. Cohen, G. Kaye, S. Moollan, Y. Hassain, A. Sunnarain, M. Mautbur) and 2 on 2026-09-02 (Y. Ayacanou, F. Toorabally) | Gmail SENT threads `1a0518…`, `1a0626f…` (search `courtsmammouth` this run) |
| No reply from any `@courtsmammouth.mu` address | Gmail search `from:courtsmammouth.mu in:anywhere newer_than:180d` → empty |
| A 60-second demo page already exists: `ppw-room-designer-demo.vercel.app` (Vercel project `prj_Bq8bcikqHqn8qMbtbexkXok6kb6f`, CLI deploy 2026-09-02, no git link; 583 KB MP4 of a gym fit-out) | Vercel API + `curl -I` this run |
| CEO = **Andrew Cohen** (confirmed from two primary press pages); chair = Alexander Winston Lynford (CARE Ratings PDF, Aug 2023); legal entity **Mammouth Trading Co. Ltd** t/a Courts Mammouth; parent Mammouth (Mauritius) Ltd; 24 stores; HQ Brabant Street, Bell Village, Port Louis | research workflow `wf_d06f1759-ec5`, adversarially verified |
| No room planner / 3D / AR found for Courts (the May-2026 vault note about an "M Space AR gallery" is NOT supported by any source read) | same workflow, digital lane |
| `courtsmammouth.mu` sits behind Cloudflare Turnstile ("Verify you are human") — scripted fetches get 403, and the browser shows an interactive check I do not complete | curl 403 with a browser UA; Chrome tab screenshot |

## Workflow (the plan) and status

| # | Step | Status |
|---|---|---|
| 1 | Research — leadership, catalog, digital posture, build-vs-buy, route-to-director (5 lanes, each adversarially verified) | 4/5 lanes DONE; catalog lane running |
| 2 | Designer: merchant DEMO mode — `/designer?demo=<slug>` swaps the merchant's real range into the catalog and loads a pre-built show home as its own page (customer's work promoted to a tab first) | DONE — `src/demo/*`, 12 unit tests, typecheck + lint clean |
| 3 | Courts range: real products (name, price, dimensions, photo) + top-down art, registered as the `courts` demo | BLOCKED on catalog data (Cloudflare gate — Vic clicks "Verify you are human" in the open Chrome tab, or the research lane finds mirror sources) |
| 4 | Courts show home: living room + home gym / wellness corner + home office, painted, floored, to scale, with basket total | pending 3 |
| 5 | User test the demo (three profiles: Courts CEO, e-commerce lead, shopper) → fix P0/P1 | pending 4 |
| 6 | Demo video — $0 Playwright screen recording of the Courts-fitted demo, captions burned with ffmpeg; draft in the vault, Vic approves | pending 4 |
| 7 | Director pack — formal letter to the CEO, LinkedIn note, follow-ups to the two 2 Sep contacts, one-page pitch; ALL drafts, nothing sent | pending 1 |
| 8 | Log: this file, `02-HANDOFF.md`, vault `_handoff/COURTS-MAMMOUTH-DIRECTOR-PUSH-2026-09-05.md`, memory | rolling |

## Decisions taken without asking (reversible, on the preview branch)

- Demo products live in `src/demo/<slug>/`, never in `products.json`, and are merged only while the demo is active — Courts' range cannot leak into the public catalog before Courts is a merchant.
- A demo product resolves by id in every tab once registered, so a saved show-home page never renders "Unknown product" after the demo tab is closed.
- Real merchant photos are used in the DEMO (as the Emcar round did) because the demo is shown to the merchant themselves; if Vic prefers placeholder boxes until Courts grants image permission, swap `photo_image_url` for the grey placeholder — one field.

## HARD STOPs held
Nothing sent, nothing published, nothing spent, nothing merged to main. The
Cloudflare check is not completed by me.
