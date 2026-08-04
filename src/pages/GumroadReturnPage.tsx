/**
 * /order/gumroad-return — Gumroad post-purchase landing (2026-08-04).
 *
 * The Gumroad "Designer Order" product's redirect-after-purchase URL
 * points HERE (it is static per product — Gumroad cannot template our
 * per-order ref into it). We resolve the orderRef from the `order_ref`
 * query param if Gumroad echoed it, else from the localStorage pending
 * ref written just before the checkout redirect, and forward to
 * /order/track/:ref?rail=gumroad where the order polls pending → captured.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resolveGumroadReturnRef } from '../lib/gumroadCheckout';

export default function GumroadReturnPage(): JSX.Element {
  const navigate = useNavigate();
  const [noRef, setNoRef] = useState(false);

  useEffect(() => {
    const ref = resolveGumroadReturnRef(window.location.search);
    if (ref) {
      navigate(`/order/track/${encodeURIComponent(ref)}?rail=gumroad`, { replace: true });
    } else {
      setNoRef(true);
    }
  }, [navigate]);

  if (!noRef) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <p>Finishing your order…</p>
      </div>
    );
  }
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
      <h1>Thanks — payment received</h1>
      <p style={{ color: '#6b7280' }}>
        We could not match this browser to an order automatically (this can happen
        if you paid on a different device). Your Gumroad receipt email contains the
        confirmation; our order confirmation email includes your tracking link.
      </p>
      <p style={{ marginTop: 12 }}>
        <Link to="/orders">View my orders</Link>
      </p>
    </div>
  );
}
