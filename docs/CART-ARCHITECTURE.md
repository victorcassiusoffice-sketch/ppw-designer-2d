# Cart architecture — the two carts are intentional, not duplicates (P1-2)

The audit flagged "two cart systems" as a consolidation candidate. After tracing
usage, they are **two different flows with two different data models**, both live.
This documents the intended split so the duplication doesn't read as accidental,
and records what a future merge would require (a Vic-gated product decision — it
touches the checkout/money path, so it is NOT an autonomous refactor).

## The two carts

| | Designer cart | Marketplace cart |
|---|---|---|
| Store | `src/store/cartStore.ts` | `src/store/marketplaceCartStore.ts` |
| Source of lines | Derived from `propertyStore` placed items against the bundled `products.json` catalog | Explicit add-to-cart of numeric `productId`s from the Neon `products` table |
| Entry surface | The Designer canvas (place items → cart) | `PublicProductsPage` (`/products`) + marketplace pages |
| Cart page | `CartPage` / `CartDrawer` / `MiniCartPill` | `MarketplaceCartPage` (`/marketplace/cart`) |
| Checkout | `CheckoutPage` | `MarketplaceCheckoutPage` (`/marketplace/checkout`) |
| Quote/pricing | Client-side from catalog + live FX | Server `POST /api/cart-quote` → per-merchant split |
| Identity of a line | `productId` string (catalog id) + room context | numeric DB `productId` + `sku` |

## Why they are separate

The Designer cart answers *"what did I place in my room design, and what would it
cost?"* — it is a projection of the canvas, and removing a line removes placed
instances. The Marketplace cart answers *"what catalog SKUs am I buying right
now?"* — a conventional e-commerce cart keyed on DB product ids, which is what the
per-merchant split + Stripe/PayPal checkout consume.

Collapsing them into one store would mean the canvas projection and the
e-commerce cart share mutable state, which is exactly the coupling that makes a
"remove from cart" on the marketplace side ambiguous against placed items.

## Future merge (Vic-gated)

A genuine merge is viable only after the Designer catalog reads from
`/api/products` (the long-noted "Phase 8 Designer→API wiring", see
`oms_sequence_pivot`). At that point both carts key on the same numeric DB
`productId` and a single store with an optional `roomContext` per line could back
both surfaces. Until then, keep them separate.

**Do NOT delete either store** — both back live checkout routes. Any merge is a
payment-touching change → Vic quick-check per the operating protocol.
