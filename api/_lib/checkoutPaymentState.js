export const ORDER_NOT_STORED = {
  status: 503,
  body: {
    ok: false,
    paypalOpened: false,
    paymentCaptured: false,
    saved: false,
    code: "order-not-stored",
    error:
      "We could not save your order, so PayPal was not opened. Nothing was charged. Please try again, or message us on WhatsApp.",
  },
};

export async function savePendingWithRetry(save, attempts = 2) {
  let lastError = null;
  const tries = Math.max(1, attempts);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      await save();
      return { ok: true, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, attempts: tries, error: lastError };
}

export function clientCheckoutEvent(type) {
  if (type === "cancel" || type === "popup-closed") {
    return {
      level: "notice",
      message:
        "PayPal checkout was closed before payment finished. You have not been charged. You can try PayPal again, or message us on WhatsApp.",
    };
  }
  if (type === "start-timeout") {
    return {
      level: "error",
      message:
        "PayPal did not open in time. Nothing was charged. Please try again, or message us on WhatsApp.",
    };
  }
  return null;
}

export function captureCustomerResult({
  lookupFailed = false,
  paypalOrder = null,
  persistResult = null,
  persistError = null,
  requestedOrderId = "",
} = {}) {
  const orderID = String(requestedOrderId || paypalOrder?.id || "");
  if (lookupFailed || !paypalOrder) {
    return {
      status: 503,
      body: {
        ok: false,
        paymentCaptured: false,
        saved: false,
        orderID,
        code: "capture-unconfirmed",
        error:
          "We could not confirm this PayPal payment. If you already approved it, do not pay again. Message us on WhatsApp with your PayPal reference.",
      },
    };
  }

  const purchase = paypalOrder.purchase_units?.[0] || {};
  const captures = Array.isArray(purchase.payments?.captures) ? purchase.payments.captures : [];
  const capture = captures.find((item) => item?.status === "COMPLETED") || null;
  const orderNumber = String(purchase.custom_id || purchase.invoice_id || "");
  const base = {
    orderID,
    orderNumber: persistResult?.orderNumber || orderNumber,
    captureId: capture?.id || "",
    status: String(paypalOrder.status || ""),
  };
  const paymentCaptured = paypalOrder.status === "COMPLETED" && Boolean(capture?.id);

  if (persistError) {
    return {
      status: 503,
      body: {
        ...base,
        ok: false,
        paymentCaptured,
        saved: false,
        code: "order-save-failed",
        error:
          "PayPal confirmed this payment, but the order record could not be saved. Do not pay again. Check this payment again, or message us on WhatsApp with your order reference.",
      },
    };
  }

  if (!paymentCaptured) {
    return {
      status: 400,
      body: {
        ...base,
        ok: false,
        paymentCaptured: false,
        saved: false,
        code: "unpaid",
        error: "PayPal has not completed this payment. Nothing further was charged. You can try PayPal again.",
      },
    };
  }

  const action = persistResult?.action;
  if (action === "updated" || action === "duplicate") {
    return {
      status: 200,
      body: {
        ...base,
        ok: true,
        paymentCaptured: true,
        saved: true,
        code: action,
      },
    };
  }

  return {
    status: 409,
    body: {
      ...base,
      ok: false,
      paymentCaptured,
      saved: false,
      code: action === "missing" ? "order-not-linked" : "payment-not-matched",
      error:
        action === "missing"
          ? "PayPal confirmed a payment, but no saved order matches it. Do not pay again. Message us on WhatsApp with your order reference."
          : "PayPal confirmed a payment, but the amount or order reference does not match the saved order. Do not pay again. Message us on WhatsApp.",
    },
  };
}
