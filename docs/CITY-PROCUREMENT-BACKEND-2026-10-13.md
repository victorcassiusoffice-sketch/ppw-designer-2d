# City Build procurement backend — 13 October 2026

Status: implemented locally; migration not applied; no orders, invoices or messages sent.

## Available integration

City Build prepares equipment packages per project, with order, invoice-target and delivery dates in Indian/Mauritius civil time. The user chooses order and invoice recipient email addresses. Drafts allow incomplete scheduling; marking a package reviewed requires dates, recipients and equipment. An invoice target can precede ordering for proforma workflows. This is a planning status, not a claim that an invoice was generated or dispatched.

The local `ppw_city_procurement_v1` store is separate from Property. This prevents recipient details entering public design exports and the existing email-keyed cloud-design endpoints. CSV excludes email addresses by default; a deliberate export can include them. CSV cells are protected against formula injection. A user can remove a local plan from the store.

`src/components/CityOrdersPanel.tsx` exposes Packages, Timeline and Connection views. Quantity and recipient edits remain in a temporary editor until Save package; incomplete addresses do not corrupt saved drafts. Switching packages or exporting while dirty requires saving or discarding changes. The public `/demo` uses a separate project namespace and neutral supplier/equipment labels, preventing private merchant-project schedules from appearing in a public demo. Explicit secure save/load uses the existing merchant sign-in; no token is typed into the form. An uncertain save retains its request key for a safe retry. Loading a cloud revision requires explicit replacement acknowledgement.

`GET` / `PUT /api/merchants/:slug/city-procurement/:id` use the existing merchant bearer session. Every read and write is scoped by the authenticated merchant's database ID, with current approval and contact-email ownership checked. The new table requires migration `api/_db/migrations/0031_city_procurement_plans.sql`; it has not been applied. `PUT` accepts `{ expectedRevision, requestId, plan }`. First save uses revision zero. Atomic compare-and-save rejects stale revisions; exact latest-request retries are idempotent. Reuse of a request key with different content is rejected. A saved plan cannot be reassigned to another project.

Successful API responses contain `{ plan, revision, updatedAt, execution: "manual-review-required" }`. Preview and DEMO_ONLY deployments reject writes before auth/body/storage. No provider transport is invoked. Unknown or unavailable storage fails with a non-sensitive error, preserving the browser draft.

## Existing backend hooks to use when execution is commissioned

- `api/_db/schema.ts`: approved merchants, suppliers, metric products, supplier-product cost and lead-time records; marketplace orders and supplier line items already exist.
- `api/products.ts`: merchant catalogue requests are session guarded. A public product reference alone is not a verified payable supplier SKU.
- `api/orders.ts`: signed merchant fulfilment webhooks exist. Existing design save/load routes are not an appropriate authorization boundary for private procurement recipients.
- `api/_lib/email/send.ts`: Resend email transport, rate budget, deduplication and audit exist, but a missing key can return a log-only result and must never be treated as delivered.
- `api/_lib/email/dispatch.ts` and `api/_lib/email/templates.ts` retain a legacy assumption that MUR minor amounts are whole rupees; the current `api/_lib/orderTypes.ts` contract says all currencies use minor units. Reconcile that mismatch and its legacy tests before reusing the order-confirmation templates for automated invoice amounts. City drafts carry no prices and do not call those templates.
- `api/cron-router.ts`: protected cron routing exists. No City procurement job is registered.

## Required before automatic execution

Bind each equipment line to an approved merchant/supplier product and an accepted current quotation; resolve prices server-side in minor currency units. Add project member/role authorization for client versus contractor approvals. Generate invoices through the chosen lawful invoice provider, storing immutable invoice identifiers and approval snapshots. Add an outbox with unique action keys, atomic claim/lease, status reconciliation, retry policy and cancellation before the agreed deadline. Use a reviewed supplier connector or the existing Resend transport only after explicit sender, recipient and dispatch authorization. Confirm delivery against provider receipts rather than returning success for a dry run. Keep budgets, revisions and supplier approval visible in the dashboard.

The Mauritius Revenue Authority describes phased e-invoicing and fiscalisation requirements at https://www.mra.mu/index.php/e-invoicing. Before issuing a covered invoice, the deployed invoice connector must implement the current applicable fiscalisation workflow and preserve its acknowledgement. A saved invoice target date is not a fiscal invoice or fiscalisation approval.

No automatic supplier ordering, legal invoicing, stock reservation, live synchronization or structural approval is claimed by this implementation.
