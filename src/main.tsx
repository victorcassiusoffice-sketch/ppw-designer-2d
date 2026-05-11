import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderCancelledPage from './pages/OrderCancelledPage';
import OrderPendingPage from './pages/OrderPendingPage';
import OrdersPage from './pages/OrdersPage';
import { bootstrapFx } from './store/currencyStore';
import './index.css';

// Fire-and-forget FX bootstrap - refreshes the live rate snapshot if
// the cached one is stale.
bootstrapFx();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/designer" element={<App />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/order/success" element={<OrderSuccessPage />} />
        <Route path="/order/cancelled" element={<OrderCancelledPage />} />
        <Route path="/order/pending" element={<OrderPendingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
