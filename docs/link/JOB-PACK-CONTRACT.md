# Job Pack contract — version 1

Status: TO BUILD until released and proven live. Saved 23 October 2026.
Authoritative pair: JOB-PACK-CONTRACT.md and job-pack.schema.json in this inbox.
Every repository carries identical copies in docs/. Keep those copies, the runtime schema and shared lib/jobPack code in step. Prompt 3 can implement this contract without a server.

## One carried-link format

Reuse lib/links/carry.ts and signed.ts byte for byte from the live worker portal.
The fragment is #w=<flag><base64url bytes>.<seal>. Flag z means deflate-raw JSON; j means UTF-8 JSON. The seal is base64url SHA-256 of the public format key, a dot, and the flag plus bytes. A Job Pack uses key ppw/job-pack/v1. Existing worker v2 messages retain key tenantfolder-mu/worker/v2. A format key prevents one message family being mistaken for another. It is not a secret or proof of the sender.

New routes are /pro/job-pack in Trade Folder and /job-pack in Tenant Folder. Existing /trade#w and /work#w routes and worker_update, worker_done, worker_invoice and paid notices stay unchanged. The destination chooses the message reader; there is no second link codec. A phone camera can open the QR as a link. The import screen also accepts the full link or a JSON file or pasted JSON.

A request is one worker-portal repair job, enriched for an outside tradesperson:

| Portal job | Job Pack request |
|---|---|
| jobKind = repair | request kind; repairs only in this slice |
| jobId | local mapping to random requestId; do not expose the repair id |
| title, detail | title, description |
| propertyName, address | site.label and optional site.note, reviewed before sharing |
| urgency 1–5 | urgency 1–5 |
| dueDate | preferredDates |
| agencyName | from.label and requester.label |

Quantities add item, qty, unit and optional planRef. Common-part requests may name a syndic or committee in Mauritius. Choosing an agency's existing worker retains the worker portal path. Job Packs have no portal pass and cannot impersonate a worker-portal report.

## Envelopes and validation

The JSON schema is normative for structure and bounds. Reject unknown fields and versions. All four Job Packs require id, requestId, createdAt, expiresAt, from and sha256. Dates are real calendar dates; instants use UTC ISO with milliseconds. id and requestId are opaque ASCII identifiers. A request's id equals requestId. Replies use fresh ids and retain requestId. Only Trade Folder originates quote, status and invoice in this slice; request senders are the other three named apps.

Expiry is mandatory (the brief's optional expiresAt is tightened). Creation must not be in the future; expiry must follow creation. All readers take an explicit current time. Suggested sender lifetimes: request 30 days, quote 30 days (approval also checks validUntil), status 30 days, invoice 90 days. Expiry is for transport; it does not erase accepted records. An expired unopened pack is refused.

sha256 is lowercase hex SHA-256 over UTF-8 canonical JSON: recursively sort object keys with JavaScript lexicographic sort; preserve array order; JSON.stringify primitive values; omit only the top-level sha256 property. No whitespace, no Unicode normalization. Finite JSON numbers only. Check the whole file size before parsing, validate the schema, then verify the hash and dates. The link seal and inner hash must both match. The hash detects damage, not authorship or confidentiality. Show the claimed sender and full contents for human review before any save.

Limits: a JSON file is at most 96,000 UTF-8 bytes. A carried token is at most 16,000 characters and inflates to at most 96,000 bytes, matching the portal. For reliable sharing, a full Job Pack link/QR is limited to 1,800 characters; above that export the same JSON as a file instead. Imported links above 1,800 characters are refused with “This link is too large. Ask for the JSON file.” Files beyond 96,000 bytes are refused with “This file is too large. Remove photos or split the job.” No partial import. Oversize text is bounded before decoding and compressed input is bounded during inflation.

Photos are optional inline PNG/JPEG/WebP data references, selected deliberately; no remote fetches, tracking URLs or local file paths. Each declares its decoded byte size. Total pack limits still apply. No contact or bank fields are copied automatically. Site and work descriptions can contain personal data only when the sender deliberately types it. Bank/payment details are an optional invoice field, initially excluded in the UI. This minimises personal data for the requested Mauritius Data Protection Act 2017 and UK GDPR privacy requirements; it is not a claim of legal certification.

## Money and decisions

Amounts use two decimals in the stated three-letter currency; rates can have more decimals. Each amount equals qty × rate rounded to the nearest cent. subtotal equals the sum of line amounts. VAT rate is a percentage chosen by the tradesperson. If included is false, total is subtotal plus rounded VAT; if true, total equals subtotal. Invoice adds subtotal and vat to the skeleton so the total is reproducible. Quote and invoice lines must all be priced: missing values stay null in the working draft and cannot be exported as zero. Zero is allowed only when the person explicitly enters zero.

The request currency binds replies. No exchange-rate conversion. A RateCard is settings data with type ppw-rate-card, v 1; optional rates mean unpriced. It has no Job Pack expiry or hash (it is not an actionable reply). Missing rate and explicit zero remain distinct. The card offers hourlyRate or dayRate; if both are present hourlyRate wins. Hours are rounded up to 15 minutes; dayRate is divided by hoursPerDay for the hourly calculation. workersPerCrew affects duration only; rate and task hours are per person. Markup applies to material unit rates. Overrides refer to the existing TASK_LIBRARY. A task must be selected by the tradesperson; never guess a template from prose. estimateTask and its published/estimated labour notes remain the source of quantities and time. AI suggestions never constitute approval or an invented price.

Quote decisions are local records: pending, approved or declined, with a person's name, role and time. Approved quotes cannot be silently overwritten. Status and invoice have an additional mandatory quoteId, tying them to the exact quote. A status says what the tradesperson reports; accepted is not agency approval. The existing repair is marked done only on a human decision. Imported invoices start pending. Acceptance records the cost and marks the repair done through existing updateRepair → autoExpense. Marking paid records the date, method, reference and person; it does not transfer money. The existing Mauritius own-worker accept/paid flow is retained; outside replies use the same decision sequence and repair expense capture. The UK main branch has no worker-invoice portal, so the same local accept/paid sequence is added without importing Mauritius law or tax wording.

The same id plus same hash is a no-op. Same id with different contents is refused. Unknown requestId, wrong currency, wrong quoteId, expired quote approval, a second accepted invoice for one request, and replies to another repair are refused. Old status reports are retained as history but do not replace newer progress. An invoice cannot approve a quote or mark itself paid. Only a person may take either action. There is no automatic reply transport: the person shares the link/file and tells the tradesperson their decision.

## Pure handlers and storage boundary

parsePack(object, now) validates and returns a checked pack without reading storage, the screen or the clock. applyQuote(record, pack), applyStatus(record, pack), applyInvoice(record, pack) return new records without mutating inputs or reading browser state. Decisions have separate named human actions. Transport decoding, id creation and browser storage live in adapters. A later database row can use the same handlers.

## Compatibility and proof

The existing worker-link codec and existing test files are not edited. Run the existing Trade Folder suite; Mauritius nine prebuild gates and suite; the UK existing clause gate suite; new shared validation and lifecycle tests; builds and both-country browser flows. Record exact command results and screenshots in REPORT.md. A feature-branch preview is not a release. Never merge without Victor writing merge followed by the app name.
