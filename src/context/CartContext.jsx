import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

const clampQuantity = (q) => {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.floor(n));
};

const normalizeItem = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const id = raw.$id ?? raw.id ?? raw.sku ?? null;
  // prefer explicit price, fallback to pricing?.price, fallback to 0
  const rawPrice =
    raw.price ??
    (raw.pricing && (raw.pricing.price ?? raw.pricing?.amount)) ??
    raw.pricing?.price ??
    raw.pricing?.amount ??
    0;

  // convert to Number safely
  const price = (() => {
    const n = Number(String(rawPrice).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  })();

  const quantity = clampQuantity(raw.quantity ?? raw.qty ?? 1);

  // unify image fields people may use
  const image =
    raw.image ??
    (raw.processedMedia && raw.processedMedia[0]?.view) ??
    (raw.processedImages && raw.processedImages[0]) ??
    raw.thumbnail ??
    "/placeholder-product.jpg";

  return {
    // keep other fields too, but ensure these exist and are normalized
    ...raw,
    $id: raw.$id ?? id,
    id: raw.id ?? id,
    price,
    quantity,
    image,
  };
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem("cart");
      const parsed = stored ? JSON.parse(stored) : [];
      // normalize loaded items
      const normalized = Array.isArray(parsed)
        ? parsed
            .map(normalizeItem)
            .filter(Boolean)
            .map((item) => ({
              ...item,
              quantity: clampQuantity(item.quantity),
            }))
        : [];
      return normalized;
    } catch {
      return [];
    }
  });

  // persist
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // add or increment (normalize item before using)
  const addToCart = (rawItem) => {
    const item = normalizeItem(rawItem);
    if (!item) return;

    setCart((prev) => {
      const key = item.$id ?? item.id;
      const exists = prev.find((p) => (p.$id ?? p.id) === key);
      if (exists) {
        return prev.map((p) =>
          (p.$id ?? p.id) === key
            ? {
                ...p,
                // If new item provides price, prefer it (update price)
                price: Number.isFinite(Number(item.price))
                  ? item.price
                  : p.price,
                quantity: Math.max(1, (p.quantity || 1) + (item.quantity || 1)),
                // preserve other fields, but prefer new image if provided
                image: item.image || p.image,
                // keep rest of existing fields (variant etc.)
                ...p,
              }
            : p
        );
      } else {
        return [...prev, item];
      }
    });
  };

  // update quantity by delta (+1 / -1)
  const updateQuantity = (itemId, delta) => {
    setCart(
      (prev) =>
        prev.map((p) =>
          (p.$id ?? p.id) === itemId
            ? { ...p, quantity: Math.max(1, (p.quantity || 1) + Number(delta)) }
            : p
        )
      // no removal; if you want removal when quantity 0, filter below
    );
  };

  // set quantity absolute
  const setQuantity = (itemId, quantity) => {
    const q = clampQuantity(quantity);
    setCart((prev) =>
      prev.map((p) => ((p.$id ?? p.id) === itemId ? { ...p, quantity: q } : p))
    );
  };

  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((item) => (item.$id ?? item.id) !== id));

  const clearCart = () => setCart([]);

  // expose for potential admin/debug usage - always normalize array before setting
  const setCartItems = (items) => {
    if (!Array.isArray(items)) return;
    const normalized = items
      .map(normalizeItem)
      .filter(Boolean)
      .map((it) => ({ ...it, quantity: clampQuantity(it.quantity) }));
    setCart(normalized);
  };

  const getTotal = () =>
    cart.reduce((s, it) => {
      const unit = Number(it.price ?? 0);
      const qty = Number(it.quantity ?? 0);
      return (
        s +
        (Number.isFinite(unit) ? unit * (Number.isFinite(qty) ? qty : 0) : 0)
      );
    }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        setQuantity,
        removeFromCart,
        clearCart,
        setCartItems,
        getTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
