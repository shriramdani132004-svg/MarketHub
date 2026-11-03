'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { Cart } from './types';

export const EMPTY_CART: Cart = {
  id: null,
  items: [],
  itemCount: 0,
  subtotal: '0.00',
  shippingEstimate: '0.00',
  grandTotal: '0.00',
  hasIssues: false,
};

interface CartContextValue {
  cart: Cart;
  loading: boolean;
  addItem: (productId: string, quantity?: number) => Promise<Cart>;
  updateItem: (itemId: string, quantity: number) => Promise<Cart>;
  removeItem: (itemId: string) => Promise<Cart>;
  clear: () => Promise<Cart>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'CUSTOMER') {
      setCart(EMPTY_CART);
      return;
    }
    setLoading(true);
    try {
      const result = await api<Cart>('/cart');
      setCart(result);
    } catch {
      setCart(EMPTY_CART);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      const result = await api<Cart>('/cart/items', {
        method: 'POST',
        body: { productId, quantity },
      });
      setCart(result);
      return result;
    },
    [],
  );

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    const result = await api<Cart>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: { quantity },
    });
    setCart(result);
    return result;
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const result = await api<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' });
    setCart(result);
    return result;
  }, []);

  const clear = useCallback(async () => {
    const result = await api<Cart>('/cart', { method: 'DELETE' });
    setCart(result);
    return result;
  }, []);

  const value = useMemo(
    () => ({ cart, loading, addItem, updateItem, removeItem, clear, refresh }),
    [cart, loading, addItem, updateItem, removeItem, clear, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
