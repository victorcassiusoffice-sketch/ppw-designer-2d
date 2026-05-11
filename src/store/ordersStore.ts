/**
 * ordersStore — Week 3.
 *
 * Local-only order history. Saves a snapshot of the cart + customer
 * info + property each time the user places an order. Lives in
 * localStorage under `wrd_orders` (per spec). Until Phase 2 wires a
 * real backend, this is the only place a user's order history exists.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CheckoutFormValues } from './checkoutStore';
import type { Property } from './propertyStore';
import type { Currency } from '../data/products.schema';

export type OrderStatus = 'pending' | 'paid' | 'cancelled';

export interface OrderLine {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  unitCurrency: Currency;
  unitPriceDisplay: number;
  lineTotalDisplay: number;
}

export interface Order {
  id: string;
  timestamp: number;
  status: OrderStatus;
  customer: CheckoutFormValues;
  /** Display currency at order time. */
  currency: Currency;
  total: number;
  lines: OrderLine[];
  property: Property;
}

interface OrdersState {
  orders: Order[];
  saveOrder: (order: Order) => void;
  updateStatus: (id: string, status: OrderStatus) => void;
  getOrder: (id: string) => Order | undefined;
  clearOrders: () => void;
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      saveOrder: (order) =>
        set((s) => ({
          // Newest first; cap at 50 to keep localStorage bounded.
          orders: [order, ...s.orders.filter((o) => o.id !== order.id)].slice(0, 50),
        })),
      updateStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),
      getOrder: (id) => get().orders.find((o) => o.id === id),
      clearOrders: () => set({ orders: [] }),
    }),
    {
      name: 'wrd_orders',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
