import React, { useMemo, useRef, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { clientCheckoutEvent } from "../../api/_lib/checkoutPaymentState.js";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export default function CheckoutPayPalButtons({
  buildCartPayload,
  validateShipping,
  onPaid,
  onError,
  onNotice,
  onHold,
  blocked = false,
}) {
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(null);
  const flowLock = useRef(false);

  const options = useMemo(
    () => ({
      clientId,
      currency: "USD",
      intent: "capture",
    }),
    []
  );

  const unlock = () => {
    flowLock.current = false;
    setBusy(false);
  };

  const reportHold = (data, orderID) => {
    onHold?.({
      code: data.code || "order-save-failed",
      orderID: data.orderID || orderID || "",
      orderNumber: data.orderNumber || pendingRef.current || "",
      captureId: data.captureId || "",
      message: data.error || "PayPal confirmed this payment, but the order record could not be saved. Do not pay again.",
    });
  };

  if (!clientId) {
    return (
      <p className="mt-4 text-sm text-amber-700 text-center">
        PayPal is not configured (missing client ID).
      </p>
    );
  }

  return (
    <PayPalScriptProvider options={options}>
      <div className="mt-2">
        <p className="text-base font-semibold text-gray-800 mb-3">Pay with PayPal</p>
        <PayPalButtons
          style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
          disabled={busy || blocked}
          createOrder={async () => {
            if (blocked) {
              throw new Error("Check the current PayPal payment before starting another one.");
            }
            if (flowLock.current) {
              throw new Error("Payment is already in progress.");
            }
            const shippingErr = validateShipping();
            if (shippingErr) {
              onError?.(shippingErr);
              throw new Error(shippingErr);
            }
            flowLock.current = true;
            setBusy(true);
            try {
              const payload = buildCartPayload();
              const { res, data } = await postJson("/api/paypal/create-order", payload);
              if (!res.ok || !data.id) {
                const msg = data.error || "Could not start PayPal checkout";
                onError?.(msg);
                unlock();
                throw new Error(msg);
              }
              pendingRef.current = data.orderNumber || "";
              return data.id;
            } catch (err) {
              unlock();
              if (err?.name === "TimeoutError" || err?.name === "AbortError") {
                const notice = clientCheckoutEvent("start-timeout");
                onError?.(notice.message);
                throw new Error(notice.message);
              }
              throw err;
            }
          }}
          onApprove={async (data) => {
            setBusy(true);
            try {
              const { res, data: body } = await postJson("/api/paypal/capture-order", {
                orderID: data.orderID,
              });
              if (res.ok && body.ok && body.saved) {
                await onPaid?.({
                  orderID: data.orderID,
                  captureId: body.captureId,
                  orderNumber: body.orderNumber || pendingRef.current || "",
                });
                return;
              }
              if (body.paymentCaptured || body.code === "capture-unconfirmed" || body.code === "order-save-failed") {
                reportHold(body, data.orderID);
                return;
              }
              onError?.(body.error || "Payment was not completed. You can try PayPal again, or message us on WhatsApp.");
              return;
            } catch {
              reportHold(
                {
                  code: "capture-unconfirmed",
                  error:
                    "We could not confirm this PayPal payment. If you already approved it, do not pay again. Check this payment again, or message us on WhatsApp.",
                },
                data.orderID
              );
            } finally {
              unlock();
            }
          }}
          onCancel={() => {
            unlock();
            onNotice?.(clientCheckoutEvent("cancel").message);
          }}
          onError={(err) => {
            unlock();
            const raw = String(err?.message || "");
            if (/window closed|popup close|detected popup/i.test(raw)) {
              onNotice?.(clientCheckoutEvent("popup-closed").message);
              return;
            }
            if (raw && raw !== "PayPal checkout error") {
              onError?.(raw);
              return;
            }
            onError?.("PayPal checkout error");
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}
