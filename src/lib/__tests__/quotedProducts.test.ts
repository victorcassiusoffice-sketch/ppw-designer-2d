import { describe, expect, it } from 'vitest';
import { deriveCart } from '../../store/cartStore';
import { FALLBACK_RATES_USD } from '../fx';
import { buildCheckoutPayload } from '../stripe';
import { buildPaypalCheckoutPayload } from '../paypal';
import { hasQuotedProducts } from '../quotedProducts';

const customer = { name: 'Test', email: 'test@example.com', phone: '', addressLine1: '', addressLine2: '', city: '', postcode: '', country: 'MU', notes: '' };
function cartWith(productIds: string[]) {
  return deriveCart({ id: 'p', name: 'Test', activeRoomId: 'r', rooms: [{ id: 'r', name: 'Garden', polygon: [],
    placedItems: productIds.map((productId, index) => ({ instanceId: `${index}`, productId, x: index * 2, y: 0, rotation: 0 })) }] },
  { qtyOverrides: {}, removedProductIds: [] }, { fetchedAt: 0, rates: FALLBACK_RATES_USD, fallback: true }, 'MUR');
}

describe('supplier quoted products', () => {
  for (const build of [buildCheckoutPayload, buildPaypalCheckoutPayload]) {
    it(`${build.name} rejects a quote-only product even alongside a priced solar panel`, () => {
      const cart = cartWith(['emcar-jinko-475', 'duraco-water-tank-1000']);
      // Exercise a future supplier-quoted catalog entry without changing the
      // Duraco record, whose verified retail price remains Rs 11,500.
      cart.lines[1] = { ...cart.lines[1], product: { ...cart.lines[1].product, id: 'quote-only-fixture', price_on_request: true } };
      expect(hasQuotedProducts(cart)).toBe(true);
      expect(() => build({ cart, customer, origin: 'https://example.com', orderId: 'test' })).toThrow(/Confirm their price with the supplier/);
    });
    it(`${build.name} retains the verified Duraco price and ordinary priced panel checkout`, () => {
      const cart = cartWith(['emcar-jinko-475', 'duraco-water-tank-1000']);
      expect(hasQuotedProducts(cart)).toBe(false);
      const payload = build({ cart, customer, origin: 'https://example.com', orderId: 'test' });
      expect(payload.cart).toHaveLength(2);
      expect(payload.cart.find(line => line.productId === 'duraco-water-tank-1000')?.unitAmount).toBe(1150000);
    });
  }
});
