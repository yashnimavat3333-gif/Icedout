import React, { useMemo, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

export default function CheckoutPayPalButtons({
  buildCartPayload,
  validateShipping,
  onPaid,
  onError,
}) {
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => ({
      clientId,
      currency: "USD",
      intent: "capture",
    }),
    []
  );

  if (!clientId) {
    return (
      <p className="mt-4 text-sm text-amber-700 text-center">
        PayPal is not configured (missing client ID).
      </p>
    );
  }

  return (
    <PayPalScriptProvider options={options}>
      <div className="mt-6 border-t pt-6">
        <p className="text-base font-semibold text-gray-800 mb-3">Pay with PayPal</p>
        <PayPalButtons
          style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
          disabled={busy}
          createOrder={async () => {
            const shippingErr = validateShipping();
            if (shippingErr) {
              onError?.(shippingErr);
              throw new Error(shippingErr);
            }
            setBusy(true);
            try {
              const payload = buildCartPayload();
              const res = await fetch("/api/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                const msg = data.error || "Could not start PayPal checkout";
                onError?.(msg);
                throw new Error(msg);
              }
              return data.id;
            } finally {
              setBusy(false);
            }
          }}
          onApprove={async (data) => {
            setBusy(true);
            try {
              const res = await fetch("/api/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderID: data.orderID }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok || !body.ok) {
                const msg = body.error || "Payment capture failed";
                onError?.(msg);
                throw new Error(msg);
              }
              await onPaid?.({
                orderID: data.orderID,
                captureId: body.captureId,
              });
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => {
            setBusy(false);
          }}
          onError={(err) => {
            setBusy(false);
            const msg =
              err?.message && !String(err.message).includes("Window closed")
                ? err.message
                : "PayPal checkout error";
            onError?.(msg);
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}
