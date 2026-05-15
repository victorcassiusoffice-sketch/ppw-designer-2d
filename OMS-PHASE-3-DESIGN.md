# OMS Phase 3 — Product catalog + suppliers — Design

**Branch:** `feat/oms-phase-3-catalog`
**Drafted:** 2026-05-15 (OMS Driver tick 5)
**Source:** OMS-MASTER-PLAN Phase 3 spec + goal-tick-5 scope adjustments + locked oms_sequence_pivot constraints.

---

## Scope

Phase 3 ships the merchant product catalog: a normalised `products` + `suppliers` + `supplier_products` schema, REST endpoints to read/write that data, an admin CRUD UI, and a public `/products` listing page.

**EXPLICITLY OUT OF SCOPE THIS PHASE** (deferred to Phase 8 per `oms_sequence_pivot.md`):
- Wiring the Designer canvas Catalog component to read from the new `products` table. The hard-coded 6-product demo catalog (`src/data/products.ts` or wherever) stays as-is. Phase 3 ships a NEW public `/products` route that reads from the DB; Designer Catalog migration is queued for Phase 8 along with the 3D toggle and image-mapped boxes.

**Why the deferral:** the locked OMS sequence pivot states: "Any OMS Driver tick from now on: skip Designer code changes unless explicitly directed by Vic. All Designer code work is queued for Phase 8." The OMS-GOAL.md's "integrate Designer Catalog" line conflicts with this lock; per the goal's "A locked decision conflicts with the work — flag, don't override" rule, I'm honoring the lock and surfacing the conflict here.

---

## Schema (migration `0004_product_catalog.sql`)

Three new tables + two enums. All idempotent (CREATE … IF NOT EXISTS, DO $$ EXCEPTION blocks for enums).

```sql
-- enums
CREATE TYPE product_status AS ENUM ('draft','active','archived','out_of_stock');
CREATE TYPE supplier_status AS ENUM ('pending','active','suspended');

-- suppliers (separate from merchants — a supplier is "a fulfilment-side entity that ships goods on behalf of a merchant"; for Phase 3 it's 1:1 with merchants but the model lets later phases support drop-ship suppliers + multi-supplier merchants)
CREATE TABLE suppliers (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  contact_email VARCHAR(320) NOT NULL,
  contact_phone VARCHAR(40),
  country VARCHAR(2) NOT NULL,
  status supplier_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, name)
);

-- products (catalog records, owned by merchants)
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT,
  -- physical dimensions for designer placement (Phase 8 will use these)
  width_mm INTEGER,
  depth_mm INTEGER,
  height_mm INTEGER,
  weight_g INTEGER,
  -- pricing in minor units, multi-currency stored separately
  price_minor INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  image_url VARCHAR(500),
  status product_status NOT NULL DEFAULT 'draft',
  region VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, sku)
);
CREATE INDEX products_merchant_idx ON products(merchant_id, status);
CREATE INDEX products_category_idx ON products(category, status);

-- supplier_products (which supplier fulfils which product — many-to-many)
CREATE TABLE supplier_products (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_sku VARCHAR(80),
  cost_minor INTEGER NOT NULL,
  cost_currency VARCHAR(3) NOT NULL,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  primary_supplier BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, product_id)
);
CREATE INDEX supplier_products_product_idx ON supplier_products(product_id);
```

Drizzle definitions go in `api/db/schema.ts` next to existing tables.

---

## API surface

All endpoints use existing `getDb()` + Zod validation patterns from Phases 1-2. Admin-gated endpoints use the `RequireAdmin` Bearer-token check from Phase 2 (`api/lib/adminAuth.ts`).

**Public:**
- `GET /api/products` — paginated list of `status='active'` products. Query params: `?category=&region=&limit=&offset=`. Response: `{ products: [...], total: number }`. Joins on suppliers for primary supplier display.
- `GET /api/products/:id` — single product detail (active only).

**Admin (Bearer + email allowlist):**
- `GET /api/admin/products` — list ALL products including draft/archived. Filters: status, merchant_id.
- `POST /api/admin/products` — create product.
- `PATCH /api/admin/products/:id` — update.
- `DELETE /api/admin/products/:id` — soft delete (status=archived).
- `GET /api/admin/suppliers` — list suppliers.
- `POST /api/admin/suppliers` — create supplier.
- `PATCH /api/admin/suppliers/:id` — update.
- `POST /api/admin/products/:id/suppliers` — link supplier to product (creates `supplier_products` row).

Every admin write writes to `audit_log` (Phase 2's table) with action like `products.create` / `products.update.price` / `suppliers.suspend`.

---

## UI surface

**Admin** (gated behind Phase 2's `RequireAdmin`):
- `/admin/products` — table view: SKU, name, category, status, merchant, price. Filter + search. "New Product" button → modal form.
- `/admin/products/:id` — detail page: edit fields, attach image (Vercel Blob upload), manage supplier links.
- `/admin/suppliers` — table view: name, email, country, status, # of products. "New Supplier" button.
- `/admin/suppliers/:id` — detail + edit + product list.

Routes added to `src/main.tsx` router under existing admin tree.

**Public:**
- `/products` — paginated grid: image, name, price, supplier badge. Filter by category + region (URL params for shareable links).
- `/products/:id` — detail page: image gallery (just `image_url` for Phase 3, gallery is Phase 4+), description, price, "Add to cart" (cart wiring lands in Phase 4).

NEW components only — no edits to `src/components/Catalog.tsx`, `src/components/RoomCanvas.tsx`, or any `src/designer/*` file.

---

## Tests (parity goal: keep total ≥387, add ~50)

- `api/db/__tests__/products.schema.test.ts` — Drizzle insert/select roundtrip.
- `api/products.test.ts` — public list endpoint, filters, pagination.
- `api/admin/products/__tests__/crud.test.ts` — create/update/delete, audit log written.
- `api/admin/suppliers/__tests__/crud.test.ts` — same.
- `src/pages/admin/__tests__/ProductsListPage.test.tsx` — renders table from mock data, filter UI works.
- `src/pages/__tests__/PublicProductsPage.test.tsx` — renders grid, pagination controls work.

---

## Build order (per loop rules)

1. Add Drizzle types + migration `0004_product_catalog.sql` to repo.
2. Run vitest locally — should still be green (additions only).
3. Build API endpoints (public list first, then admin CRUD).
4. Add tests for each endpoint as it lands.
5. Build admin pages.
6. Build public `/products` page.
7. `npm test` — all green.
8. `npx tsc --noEmit` — clean.
9. `vite build` — clean.
10. Commit on `feat/oms-phase-3-catalog` (branch off `main` ONCE PR #1+#2 are merged so branch base is current).
11. Push (NEEDS PAT contents:write).
12. Open PR via REST.
13. Wait for Vercel preview READY.
14. Apply migration `0004_product_catalog.sql` via Neon MCP `run_sql_transaction`.
15. Smoke preview: GET /products renders, GET /api/products returns array, admin endpoints 401 without auth.
16. Merge PR via REST (NEEDS PAT contents:write).
17. Production auto-deploys via main → target=production.
18. Final prod smoke.
19. Update OMS-PROGRESS-LOG with Phase 3 close-out.
20. Move to Phase 4.

---

## Risks + open questions

- **Designer Catalog NOT integrated** — flagged above. If Vic explicitly says "integrate now", scope changes and Phase 8 designer redesign will need to factor that already-done work in.
- **Image upload via Vercel Blob** — Phase 1 set up `BLOB_READ_WRITE_TOKEN` env var; this is the first feature using it. Will validate end-to-end during smoke.
- **Currency model** — Phase 3 stores price in single currency per product row. If a merchant wants the same product available in MUR + USD, Phase 4 marketplace cart will need to handle currency conversion or store multi-currency price columns. Flagged for Phase 4 design.
- **Supplier vs Merchant model overlap** — In Phase 3, `suppliers` is 1:N below `merchants`. Doesn't yet support the marketplace dropship pattern (one supplier serves N merchants). Phase 4 design must decide: keep 1:N (current) or move to N:M (separate supplier registry).

---

## Acceptance criteria (Phase 3 done when)

- [ ] Migration `0004_product_catalog.sql` applied to prod Neon, all 3 tables + 2 enums + 4 indexes verified.
- [ ] PR opened and merged into main.
- [ ] Production deploy READY at the merged commit, target=production.
- [ ] `GET https://designer.ppwellness.co/api/products` returns 200 with `{products:[]}`.
- [ ] `https://designer.ppwellness.co/products` renders the grid (empty initially).
- [ ] `https://designer.ppwellness.co/admin/products` requires Clerk auth.
- [ ] Admin can create a product through the UI; row appears in Neon; audit_log row written.
- [ ] Admin can attach a supplier to a product; supplier_products row created.
- [ ] All Phase 1/1B/1.5/2 smoke checks still pass on prod.
- [ ] Test suite ≥430 tests, all green.
