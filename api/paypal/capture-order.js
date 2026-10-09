import { capturePayPalOrder, getPayPalOrder } from "../_lib/paypalServer.js";
import { applyVerifiedPayPalPayment, logOrderRecovery } from "../_lib/iceyOrder.js";
import { loadCompletedCapture } from "../_lib/paypalCapture.js";
import { captureCustomerResult } from "../_lib/checkoutPaymentState.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderID = req.body?.orderID || req.body?.orderId;
  if (!orderID) {
    return res.status(400).json({ error: "Missing orderID" });
  }

  try {

    const completed = await loadCompletedCapture({
      orderId: orderID,
      captureOrder: capturePayPalOrder,
      getOrder: getPayPalOrder,
    });
    let persistResult = null;
    let persistError = null;
    if (!completed.lookupFailed && completed.order) {
      try {
        const firstCapture = completed.order?.purchase_units?.[0]?.payments?.captures?.[0];
        persistResult = await applyVerifiedPayPalPayment(completed.order, {
          captureId: firstCapture?.status === "COMPLETED" ? firstCapture.id || "" : "",
        });
      } catch (err) {
        persistError = err;
        const purchase = completed.order?.purchase_units?.[0] || {};
        const payment = purchase?.payments?.captures?.[0] || {};
        logOrderRecovery("paid-save", {
          orderNumber: purchase.custom_id || "",
          paypalOrderId: orderID,
          paypalCaptureId: payment.id || "",
          amount: Number(payment.amount?.value),
          message: err?.message || "save failed",
        });
      }
    } else {
      logOrderRecovery("capture-lookup", {
        paypalOrderId: orderID,
        message: "PayPal capture details could not be confirmed.",
      });
    }

    const result = captureCustomerResult({
      lookupFailed: completed.lookupFailed || !completed.order,
      paypalOrder: completed.order,
      persistResult,
      persistError,
      requestedOrderId: orderID,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[paypal/capture-order]", err?.message || err);
    const result = captureCustomerResult({
      lookupFailed: true,
      requestedOrderId: orderID,
    });
    return res.status(result.status).json(result.body);
  }
}
