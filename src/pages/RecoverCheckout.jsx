import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function RecoverCheckout() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setCartItems } = useCart();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/abandoned-checkout/recover?token=${encodeURIComponent(token || "")}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "This recovery link is not valid.");
        if (data.status === "completed") {
          if (!cancelled) setError("This order was already completed.");
          return;
        }
        if (typeof setCartItems === "function" && Array.isArray(data.cartItems)) {
          setCartItems(data.cartItems);
        }
        if (!cancelled) {
          navigate("/checkout", {
            replace: true,
            state: {
              checkoutRecovery: true,
              recoveryToken: data.recoveryToken || token,
              prefill: data.contact || {},
            },
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not restore this checkout.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate, setCartItems]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <p className="text-gray-800 font-medium mb-2">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm underline text-gray-600"
            >
              Back to shop
            </button>
          </>
        ) : (
          <p className="text-gray-600">Restoring your checkout…</p>
        )}
      </div>
    </div>
  );
}
