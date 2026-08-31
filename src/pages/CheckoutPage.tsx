/**
 * CheckoutPage - Week 3, extended Week 4a, Hotfix 2 (Week 4b),
 * floor-plan rendering rebuilt as vectors in Hotfix 5 (Week 4b).
 *
 * Collects customer info, validates, then either:
 *   - if Stripe is configured: hits the Vercel function at
 *     /api/create-checkout-session and redirects to Stripe Checkout.
 *   - otherwise: saves the order locally and routes to /order/pending,
 *     which surfaces a mailto: prefill so Vic can finalise manually.
 *
 * Week 4a addition: BEFORE redirecting we capture a per-room snapshot
 * (polygon + placed-item geometry) into localStorage so the
 * post-redirect /order/success page can build the plan PDF.
 *
 * Form state is persisted in sessionStorage by `checkoutStore`.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartPageHeader } from '../components/CartPageHeader';
import { useCart } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { usePropertyStore } from '../store/propertyStore';
import {
  useCheckoutStore,
  validateCheckoutForm,
  hasErrors,
  type CheckoutFormValues,
  type ValidationErrors,
} from '../store/checkoutStore';
import { useOrdersStore, type Order, type OrderLine } from '../store/ordersStore';
import {
  buildCheckoutPayload,
  isStripeConfigured,
  isStripeTestMode,
  makeOrderId,
  startStripeCheckout,
} from '../lib/stripe';
import {
  buildPaypalCheckoutPayload,
  isPaypalEnabled,
  startPaypalCheckout,
} from '../lib/paypal';
import { formatCurrency } from '../lib/currency';
import { COUNTRY_OPTIONS } from '../lib/region';
import { CATEGORY_LABELS, getProductById } from '../data/products';
import { roomFloorOrders } from '../designer/floorTiles';
import { findFloorMaterialById } from '../data/floorMaterials';
import {
  saveLastOrderSnapshot,
  type LastOrderSnapshot,
  type RoomSnapshot,
  type SnapshotPlacedItem,
} from '../lib/orderSnapshot';

interface FieldProps {
  label: string;
  name: keyof CheckoutFormValues;
  form: CheckoutFormValues;
  setField: <K extends keyof CheckoutFormValues>(field: K, value: CheckoutFormValues[K]) => void;
  errors: ValidationErrors;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}

function Field({
  label,
  name,
  form,
  setField,
  errors,
  type = 'text',
  autoComplete,
  placeholder,
  required = true,
}: FieldProps) {
  const id = `field-${name}`;
  const errMsg = errors[name as keyof ValidationErrors];
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wide text-ppw-slate">
        {label} {required && <span className="text-ppw-coral">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={form[name]}
        onChange={(e) => setField(name, e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-sm focus:outline-none ${
          errMsg ? 'border-ppw-coral focus:border-ppw-coral' : 'border-ppw-stone focus:border-ppw-teal'
        }`}
      />
      {errMsg && <p className="mt-1 text-[11px] text-ppw-coral">{errMsg}</p>}
    </div>
  );
}

export default function CheckoutPage() {
  const cart = useCart();
  const property = usePropertyStore((s) => s.property);
  const currency = useCurrencyStore((s) => s.currency);
  const form = useCheckoutStore((s) => s.form);
  const setField = useCheckoutStore((s) => s.setField);
  const selectedRail = useCheckoutStore((s) => s.selectedRail);
  const setSelectedRail = useCheckoutStore((s) => s.setSelectedRail);
  const saveOrder = useOrdersStore((s) => s.saveOrder);
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const errors: ValidationErrors = useMemo(
    () => (submitted ? validateCheckoutForm(form) : {}),
    [form, submitted],
  );

  if (cart.totalItemCount === 0 && cart.floorLines.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
        <CartPageHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-xl font-semibold">Your cart is empty.</p>
          <Link
            to="/"
            className="mt-4 rounded-md bg-ppw-teal px-4 py-2 text-sm font-semibold text-white hover:bg-ppw-teal/90"
          >
            Back to designer
          </Link>
        </main>
      </div>
    );
  }

  function captureOrderSnapshot(order: Order): void {
    // Hotfix 5: the floor plan is rendered as pure vectors at PDF time
    // (see src/lib/planPdf.ts). We stash polygon + placedItem geometry
    // here so the success page can hand it straight to jsPDF without
    // any canvas / raster step.
    const rooms: RoomSnapshot[] = property.rooms.map((r) => {
      const counts = new Map<string, number>();
      for (const item of r.placedItems) {
        counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
      }
      const products = Array.from(counts.entries())
        .map(([productId, count]) => {
          const p = getProductById(productId);
          if (!p) return null;
          const line = cart.lines.find((l) => l.productId === productId);
          const unitPriceDisplay = line?.unitPriceDisplay ?? p.price.value;
          return {
            sku: p.sku,
            name: p.name,
            quantity: count,
            dimensions: `${p.dimensions_cm.length} x ${p.dimensions_cm.width} x ${p.dimensions_cm.height} cm`,
            supplier: p.supplier,
            unitPriceDisplay,
            lineTotalDisplay: unitPriceDisplay * count,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Floors laid with the Floor tool are billed by the whole unit (tile/roll/pack/mat)
      // with an offcut allowance, so they belong on the order + plan PDF
      // as room product rows next to the furniture.
      const floorRows = roomFloorOrders(r).map(({ materialId, order }) => {
        const m = findFloorMaterialById(materialId);
        const priced = cart.floorLines.find((f) => f.materialId === materialId);
        const unitPriceDisplay = priced?.unitPriceDisplay ?? m?.price_per_unit_mur ?? 0;
        const unitLabel = m?.unit ?? 'unit';
        const dims =
          m?.tile_w_m && m?.tile_h_m
            ? `${m.tile_w_m} x ${m.tile_h_m} m ${unitLabel}`
            : unitLabel;
        return {
          sku: m?.sku ?? materialId,
          name: `${m?.name ?? materialId} (flooring)`,
          quantity: order.unitsToOrder,
          dimensions: dims,
          supplier: 'Flooring',
          unitPriceDisplay,
          lineTotalDisplay: unitPriceDisplay * order.unitsToOrder,
        };
      });

      const placedItems: SnapshotPlacedItem[] = r.placedItems.map((it) => {
        const p = getProductById(it.productId);
        const lengthCm = p?.dimensions_cm.length ?? 50;
        const widthCm = p?.dimensions_cm.width ?? 50;
        return {
          productId: it.productId,
          productName: p?.name ?? it.productId,
          category: p?.category,
          sku: p?.sku ?? it.productId,
          dimensionsLabel: `${Math.round(lengthCm)} x ${Math.round(widthCm)} cm`,
          xM: it.x,
          yM: it.y,
          lengthM: lengthCm / 100,
          widthM: widthCm / 100,
          rotation: it.rotation,
        };
      });

      return {
        id: r.id,
        name: r.name,
        polygon: r.polygon.map((v) => ({ x: v.x, y: v.y })),
        placedItems,
        products: [...products, ...floorRows],
      };
    });

    const addressParts = [
      order.customer.addressLine1,
      order.customer.addressLine2,
      order.customer.city,
      order.customer.postcode,
      order.customer.country,
    ]
      .map((s) => (s ?? '').trim())
      .filter(Boolean);

    const snap: LastOrderSnapshot = {
      orderId: order.id,
      date: order.timestamp,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerAddress: addressParts.join(', '),
      currency: order.currency,
      total: order.total,
      propertyName: property.name,
      rooms,
    };
    saveLastOrderSnapshot(snap);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const v = validateCheckoutForm(form);
    if (hasErrors(v)) {
      const firstKey = Object.keys(v)[0];
      const el = document.getElementById(`field-${firstKey}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    setServerMessage(null);

    const orderId = makeOrderId();
    const productLines: OrderLine[] = cart.lines.map((l) => ({
      productId: l.productId,
      name: l.product.name,
      category: CATEGORY_LABELS[l.product.category],
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      unitCurrency: l.unitCurrency,
      unitPriceDisplay: l.unitPriceDisplay,
      lineTotalDisplay: l.lineTotalDisplay,
    }));
    // Floor-tool order lines: billed by the whole unit; the name carries
    // the surplus so the invoice reads "…, incl. N spare tiles".
    const floorOrderLines: OrderLine[] = cart.floorLines.map((f) => ({
      productId: f.lineId,
      name:
        f.surplusUnits > 0
          ? `${f.materialName} — ${f.unitsToOrder} ${f.unit}${f.unitsToOrder > 1 ? 's' : ''} (incl. ${f.surplusUnits} spare for cut edges)`
          : `${f.materialName} — ${f.unitsToOrder} ${f.unit}${f.unitsToOrder > 1 ? 's' : ''}`,
      category: 'Flooring',
      quantity: f.unitsToOrder,
      unitPrice: f.unitPriceMur,
      unitCurrency: f.unitCurrency,
      unitPriceDisplay: f.unitPriceDisplay,
      lineTotalDisplay: f.lineTotalDisplay,
    }));
    const lines: OrderLine[] = [...productLines, ...floorOrderLines];
    const order: Order = {
      id: orderId,
      timestamp: Date.now(),
      status: 'pending',
      customer: form,
      currency,
      total: cart.subtotal,
      lines,
      property,
    };
    saveOrder(order);

    captureOrderSnapshot(order);

    const propertySnap = {
      id: property.id,
      name: property.name,
      rooms: property.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        itemCount: r.placedItems.length,
      })),
    };

    if (selectedRail === 'paypal') {
      if (!isPaypalEnabled()) {
        navigate(`/order/pending?id=${encodeURIComponent(orderId)}`);
        return;
      }
      const paypalPayload = buildPaypalCheckoutPayload({
        cart,
        customer: form,
        origin: window.location.origin,
        orderId,
        property: propertySnap,
      });
      const paypalResult = await startPaypalCheckout(paypalPayload);
      setSubmitting(false);
      if (paypalResult.status === 'redirected') return;
      if (paypalResult.status === 'pending') {
        navigate(`/order/pending?id=${encodeURIComponent(orderId)}`);
        return;
      }
      setServerMessage(paypalResult.message ?? 'Checkout failed. Please try again.');
      return;
    }

    if (!isStripeConfigured()) {
      navigate(`/order/pending?id=${encodeURIComponent(orderId)}`);
      return;
    }

    const payload = buildCheckoutPayload({
      cart,
      customer: form,
      origin: window.location.origin,
      orderId,
      property: propertySnap,
    });
    const result = await startStripeCheckout(payload);
    setSubmitting(false);
    if (result.status === 'redirected') return;
    if (result.status === 'pending') {
      navigate(`/order/pending?id=${encodeURIComponent(orderId)}`);
      return;
    }
    setServerMessage(result.message ?? 'Checkout failed. Please try again.');
  }

  return (
    <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
      <CartPageHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-6">
        <form onSubmit={handleSubmit} noValidate className="flex-1 space-y-5">
          <header>
            <h1 className="text-xl font-bold">Checkout</h1>
            <p className="text-xs text-ppw-slate">
              You will not be charged until our install team has confirmed availability and
              shipping for your region.
            </p>
          </header>

          <section className="rounded-lg border border-ppw-stone bg-white p-4">
            <p className="text-sm font-bold">Contact</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field form={form} setField={setField} errors={errors} label="Full name" name="name" autoComplete="name" />
              <Field form={form} setField={setField} errors={errors} label="Email" name="email" type="email" autoComplete="email" />
              <Field form={form} setField={setField} errors={errors} label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="+230 5 123 4567" />
            </div>
          </section>

          <section className="rounded-lg border border-ppw-stone bg-white p-4">
            <p className="text-sm font-bold">Delivery address</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field form={form} setField={setField} errors={errors} label="Address line 1" name="addressLine1" autoComplete="address-line1" />
              </div>
              <div className="md:col-span-2">
                <Field
                  form={form}
                  setField={setField}
                  errors={errors}
                  label="Address line 2 (optional)"
                  name="addressLine2"
                  autoComplete="address-line2"
                  required={false}
                />
              </div>
              <Field form={form} setField={setField} errors={errors} label="City" name="city" autoComplete="address-level2" />
              <Field form={form} setField={setField} errors={errors} label="Postcode" name="postcode" autoComplete="postal-code" />
              <div>
                <label
                  htmlFor="field-country"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-ppw-slate"
                >
                  Country <span className="text-ppw-coral">*</span>
                </label>
                <select
                  id="field-country"
                  value={form.country}
                  onChange={(e) => setField('country', e.target.value)}
                  className={`mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-sm focus:outline-none ${
                    errors.country ? 'border-ppw-coral' : 'border-ppw-stone focus:border-ppw-teal'
                  }`}
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <p className="mt-1 text-[11px] text-ppw-coral">{errors.country}</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-ppw-stone bg-white p-4">
            <p className="text-sm font-bold">Notes for the install team</p>
            <textarea
              id="field-notes"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={4}
              placeholder="Access codes, lift hours, preferred install times, anything else we should know."
              className="mt-2 w-full rounded-md border border-ppw-stone bg-white px-2.5 py-2 text-sm focus:border-ppw-teal focus:outline-none"
            />
          </section>

          <section className="rounded-lg border border-ppw-stone bg-white p-4">
            <p className="text-sm font-bold">Payment method</p>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-ppw-stone p-2.5 text-sm hover:border-ppw-teal">
                <input
                  type="radio"
                  name="payment-rail"
                  value="stripe"
                  checked={selectedRail === 'stripe'}
                  onChange={() => setSelectedRail('stripe')}
                  className="h-4 w-4 accent-ppw-teal"
                />
                <span>Pay by card (Stripe)</span>
              </label>
              {isPaypalEnabled() && (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-ppw-stone p-2.5 text-sm hover:border-ppw-teal">
                  <input
                    type="radio"
                    name="payment-rail"
                    value="paypal"
                    checked={selectedRail === 'paypal'}
                    onChange={() => setSelectedRail('paypal')}
                    className="h-4 w-4 accent-ppw-teal"
                  />
                  <span>Pay with PayPal</span>
                </label>
              )}
            </div>
          </section>

          {serverMessage && (
            <p className="rounded-md border border-ppw-coral bg-ppw-coral/10 p-2.5 text-xs text-ppw-coral">
              {serverMessage}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
            <Link
              to="/cart"
              className="text-xs font-medium text-ppw-slate hover:text-ppw-teal"
            >
              Back to cart
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-ppw-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-ppw-teal/90 disabled:opacity-60"
            >
              {submitting ? 'Placing order...' : `Place order - ${formatCurrency(cart.subtotal, currency)}`}
            </button>
          </div>
        </form>

        <aside className="md:w-80 md:shrink-0">
          <div className="sticky top-4 rounded-lg border border-ppw-stone bg-white p-4 shadow-sm">
            <p className="text-sm font-bold">Order summary</p>
            <ul className="mt-3 space-y-1.5 text-xs">
              {cart.lines.map((l) => (
                <li key={l.productId} className="flex justify-between gap-2">
                  <span className="truncate text-ppw-slate">
                    {l.product.name} <span className="text-[10px]">x {l.quantity}</span>
                  </span>
                  <span className="shrink-0 text-ppw-ink">
                    {formatCurrency(l.lineTotalDisplay, currency)}
                  </span>
                </li>
              ))}
              {cart.floorLines.map((f) => (
                <li key={f.lineId} className="flex justify-between gap-2" data-testid="checkout-floor-line">
                  <span className="truncate text-ppw-slate">
                    {f.materialName}{' '}
                    <span className="text-[10px]">
                      x {f.unitsToOrder} {f.unit}
                      {f.unitsToOrder > 1 ? 's' : ''}
                      {f.surplusUnits > 0 ? ` (incl. ${f.surplusUnits} spare)` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-ppw-ink">
                    {formatCurrency(f.lineTotalDisplay, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-ppw-stone pt-3 text-xs">
              <span className="text-ppw-slate">Subtotal</span>
              <span className="text-ppw-ink">{formatCurrency(cart.subtotal, currency)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-ppw-slate">
              <span>Shipping</span>
              <span className="italic">Calculated at checkout</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-ppw-slate">
              <span>Tax</span>
              <span className="italic">May apply</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-ppw-stone pt-3">
              <span className="text-sm font-bold">Total (est.)</span>
              <span className="text-lg font-bold">
                {formatCurrency(cart.subtotal, currency)}
              </span>
            </div>
            {isStripeTestMode() && (
              <p className="mt-3 rounded-md border border-ppw-teal/40 bg-ppw-teal/10 p-2 text-[10px] leading-snug text-ppw-ink">
                <b>Stripe Test Mode</b> - this is a test order, no real money
                will be charged. Use card <b>4242 4242 4242 4242</b>, any future
                expiry date, and any 3-digit CVC.
              </p>
            )}
            {!isStripeConfigured() && (
              <p className="mt-3 rounded-md bg-ppw-sand p-2 text-[10px] leading-snug text-ppw-slate">
                <b>Manual handover:</b> your order will be recorded and Vic
                will contact you within 24 hours to confirm details and
                arrange payment + installation.
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
