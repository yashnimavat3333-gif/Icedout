import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import productService from "../appwrite/config";
import { setStoredCoupon } from "../lib/offerStorage";

export default function RestoreCart() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setCartItems } = useCart();
  const [message, setMessage] = useState("Restoring your cart...");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/restore?token=${encodeURIComponent(token || "")}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.items) || data.items.length === 0) {
          if (!cancel) setMessage("This link is not valid.");
          return;
        }
        const items = data.items.map((line) => ({
          $id: line.productId,
          id: line.productId,
          name: line.name || "Item",
          quantity: line.quantity || 1,
          price: Number(line.unitPrice) || 0,
          image: line.imageFileId ? productService.getFileView(line.imageFileId) : "",
          selectedVariation: line.variationName ? { name: line.variationName } : null,
        }));
        setCartItems(items);
        if (data.couponCode) setStoredCoupon(data.couponCode);
        if (!cancel) navigate("/cart", { replace: true });
      } catch {
        if (!cancel) setMessage("This link is not valid.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token, navigate, setCartItems]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-gray-700">
      {message}
    </div>
  );
}
