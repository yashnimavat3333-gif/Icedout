import { capturePayPalOrder, getPayPalOrder } from "../_lib/paypalServer.js";
import { applyVerifiedPayPalPayment, logOrderRecovery } from "../_lib/iceyOrder.js";
import { loadCompletedCapture } from "../_lib/paypalCapture.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const orderID = req.body?.orderID || req.body?.orderId;
    if (!orderID) {
      return res.status(400).json({ error: "Missing orderID" });
    }

    const completed = await loadCompletedCapture({
      orderId: orderID,
      captureOrder: capturePayPalOrder,
      getOrder: getPayPalOrder,
    });
    if (completed.lookupFailed || !completed.order) {
      logOrderRecovery("capture-lookup", {
        paypalOrderId: orderID,
        message: "PayPal already captured this order. The capture details could not be reloaded.",
      });
      return res.status(200).json({ ok: true, orderID, status: "COMPLETED" });
    }
    const capture = completed.order;
    const purchase = capture?.purchase_units?.[0] || {};
    const payment = purchase?.payments?.captures?.[0] || {};
    const captureId = payment.id || null;
    const orderNumber = purchase.custom_id || "";

    try {
      await applyVerifiedPayPalPayment(capture, { captureId: captureId || "" });
    } catch (err) {
      logOrderRecovery("paid-save", {
        orderNumber,
        paypalOrderId: orderID,
        paypalCaptureId: captureId,
        amount: Number(payment.amount?.value),
        message: err?.message || "save failed",
      });
    }

    return res.status(200).json({
      ok: true,
      orderID,
      captureId,
      orderNumber,
      status: capture.status,
    });
  } catch (err) {
    console.error("[paypal/capture-order]", err?.message || err);
    return res.status(500).json({ error: "Payment capture failed" });
  }
}
