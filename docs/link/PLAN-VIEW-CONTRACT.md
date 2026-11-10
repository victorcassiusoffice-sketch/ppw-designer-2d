# One Live Build and Trade Folder link contract, version 1

Status: TO BUILD until released and proven live. Written 27 Oct 2026 by Claude (olb-tf-integration-architect) for Victor Cassius Bhatoolaul.
Authoritative files: PLAN-VIEW-CONTRACT.md, plan-view.schema.json and build-tokens.css. They are cut, byte for byte, from 06-Roadmap/_handoff/OLB-TRADEFOLDER-INTEGRATION-2026-10-27.md in the PPW Second Brain. Identical copies live in the vault inbox 06-Roadmap/agentix-os/inbox/olb-tradefolder-link-2026-10-27/, in ppw-designer-2d docs/link/ and in tradefolder docs/. Tests in both repos compare SHA-256 hashes.

## 1. What travels between the two apps
- The work travels as a Job Pack, version 1 (JOB-PACK-CONTRACT.md, unchanged). One Live Build sends request packs with from.app onelivebuild, site.kind build-site, house or lot, and requester.type developer or company. Trade Folder answers with quote, status and invoice packs, exactly as it answers Tenant Folder.
- The design travels as a Plan View, version 1 (type ppw-plan-view): a read-only extract of the plan for one work package. It never prices, orders or approves anything.
- One file can carry both: a Work Package, version 1 (type ppw-work-package), holds one request and its planView, or null.

## 2. References
- planRef is olb:<kind>:<id>. The kind is one of level, room, wall, opening, run, item, mat, fnd, city-road, city-net, city-asset. At most 120 characters.
- A request quantity may carry a planRef. Every highlights entry in a plan view names an element in the same file (level, room, wall, opening, run or item) or a planRef used by one of its quantities. The mat, fnd and city kinds appear only in quantities.
- project.id, site.id and package.id are opaque ids owned by One Live Build; phase is a label. Trade Folder stores them and groups jobs by them. It never edits them.

## 3. Rules for reading a plan view
1. File only in version 1: no link and no QR. The format key ppw/plan-view/v1 is reserved for a later carried form.
2. A plan view file is at most 300,000 UTF-8 bytes; a work-package file at most 400,000. Check the size before parsing. Above it, refuse: "This design file is too large. Ask for one level or one work package at a time."
3. Validate against plan-view.schema.json. Unknown fields and other versions are refused: "This design file uses a newer version. Ask for a new copy."
4. sha256 is the lowercase hex SHA-256 of the canonical JSON of the object without its top-level sha256, the Job Pack rule: object keys sorted recursively with the JavaScript default sort, arrays kept in order, JSON.stringify for every other value, UTF-8, no spaces. On a mismatch: "This design file has changed or is damaged. Ask for a new copy."
5. createdAt is a real UTC instant with milliseconds and is not later than the reader's now. The parser takes now as an argument; it never reads the clock, the screen or storage.
6. Ids are unique within each list. Every levelId, roomId and wallId points at an element in the file. Every highlight resolves as in section 2.
7. A plan view has no expiry. For the same package.id, the highest plan.revision is the current design; keep at most 3 older ones as history. The same id with the same hash is a no-op; the same id with a different hash is refused.
8. In a work-package file the request must pass the Job Pack parsePack(request, now) and come from onelivebuild. When planView is not null: planView.requestId equals request.id, planView.from equals request.from, and planView.quantities equals request.quantities, or an empty list when the request has none, in the same order.
9. Lengths are metres, areas square metres, volumes cubic metres. x and y are One Live Build plan coordinates: drawing x to the right and y downwards gives the plan as One Live Build shows it in 2D. z is the height of a run above its level. Readers draw what the file holds. They never recompute a quantity from it.

## 4. Who owns which field
- One Live Build writes: project, site, phase, package id, trade and title, quantities and their planRef, preferred dates, currency, the plan geometry and plan revision. Trade Folder only reads them. The trade's own measurements, tasks and materials stay in its own job.
- One Live Build keeps private: the planned amount (budget) and its people's notes. They are never sent.
- Trade Folder writes: quote, status and invoice (lines, hours, days, VAT, totals, dates, notes, photos). One Live Build only reads them.
- A named person in One Live Build decides: approve or decline a quote, accept an invoice, record a payment. Trade Folder learns a decision when that person tells the trade. Version 1 has no automatic message delivery.
- Trade Folder keeps private: rates, rate sets, tool hire, clients, bank details and the day plan.

## 5. How a change travels
- The plan changes in One Live Build: the package shows "Plan changed since sent", because its plan fingerprint differs from the one sent. A person sends an update: a new request (new id) with a plan view whose plan.revision is higher, for the same package.id. Trade Folder files it under the same package and asks the trade to price it again. An approved quote is never overwritten.
- Work moves in Trade Folder: the trade sends status and invoice packs, and One Live Build adds them to the package history. A report is not an approval. Only a named person accepts, and recording "paid" moves no money.

## 6. Status words
Same order and colour family in both apps (build-tokens.css): draft, sent, quote, booked, working, done, invoiced, paid, lost, changed. One Live Build shows booked as "Approved", working as "On site", done as "Done (reported)", lost as "Declined" and changed as "Plan changed".

## 7. Privacy and wording
- A plan view has no contact, address or bank field. Labels are typed by the sender. Show the sender and the whole content before saving.
- Every design view shows "Estimates from the plan. Check on site." and "Coordination only".
- Never say the link approves, certifies, orders or works automatically.

## 8. Versions
A breaking change is version 2 of this contract, released in both repos at once. Readers refuse versions they do not know. The Job Pack stays at version 1 here; a Job Pack change is its own version across Trade Folder, Tenant Folder UK, Tenant Folder Mauritius and One Live Build.
