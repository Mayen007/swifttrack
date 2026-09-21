// client/src/context/CartContext.jsx
import React, { createContext, useContext, useState, useMemo } from 'react';
import { sound } from '../services/sound.js';
import { api } from '../services/api.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [heldCarts, setHeldCarts] = useState([]);

  const addItem = (product, qty = 1) => {
    sound.playScan();
    const normalizedProduct = {
      ...product,
      price: Number(product.price ?? product.selling_price ?? 0),
      selling_price: Number(product.selling_price ?? product.price ?? 0),
    };
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === normalizedProduct.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === normalizedProduct.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product: normalizedProduct, quantity: qty }];
    });
  };

  const updateQty = (productId, qty) => {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeItem = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPercent(0);
  };

  const holdCart = () => {
    if (items.length === 0) return;
    const cartSnapshot = {
      id: Date.now(),
      items: [...items],
      customerName,
      customerPhone,
      discountPercent,
      heldAt: new Date().toLocaleTimeString('en-KE'),
    };
    setHeldCarts((prev) => [cartSnapshot, ...prev]);
    clearCart();
    api.toast('Cart held on reserve', 'info');
  };

  const recallCart = (cartId) => {
    const target = heldCarts.find((c) => c.id === cartId);
    if (!target) return;
    setItems(target.items);
    setCustomerName(target.customerName);
    setCustomerPhone(target.customerPhone);
    setDiscountPercent(target.discountPercent);
    setHeldCarts((prev) => prev.filter((c) => c.id !== cartId));
    api.toast('Held cart recalled', 'success');
  };

  const discardHeldCart = (cartId) => {
    setHeldCarts((prev) => prev.filter((c) => c.id !== cartId));
    api.toast('Held cart discarded', 'info');
  };

  const totals = useMemo(() => {
    const rawSubtotal = items.reduce(
      (sum, item) => sum + Number(item.product.price ?? item.product.selling_price ?? 0) * item.quantity,
      0
    );
    const discountAmount = (rawSubtotal * (discountPercent || 0)) / 100;
    const netTaxable = rawSubtotal - discountAmount;
    // 16% Kenya VAT
    const vatAmount = netTaxable * 0.16;
    const grandTotal = netTaxable + vatAmount;

    return {
      rawSubtotal,
      discountAmount,
      netTaxable,
      vatAmount,
      grandTotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [items, discountPercent]);

  return (
    <CartContext.Provider
      value={{
        items,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        discountPercent,
        setDiscountPercent,
        heldCarts,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        holdCart,
        recallCart,
        discardHeldCart,
        totals,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
