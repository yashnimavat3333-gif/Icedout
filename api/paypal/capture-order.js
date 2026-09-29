import { capturePayPalOrder } from "../_lib/paypalServer.js";
import { markIceyOrderPaid, logOrderRecovery } from "../_lib/iceyOrder.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const orderID = req.body?.orderID || req.body?.orderId;
    if (!orderID) {
      return res.status(400).json({ error: "Missing orderID" });
    }

    const capture = await capturePayPalOrder(orderID);
    const purchase = capture?.purchase_units?.[0] || {};
    const payment = purchase?.payments?.captures?.[0] || {};
    const captureId = payment.id || null;
    const paidValue = Number(payment.amount?.value);
    const orderNumber = purchase.custom_id || "";

    try {
      await markIceyOrderPaid({
        paypalOrderId: orderID,
        orderNumber,
        captureId: captureId || "",
        amount: paidValue,
        paidAt: new Date().toISOString(),
      });
    } catch (err) {
      logOrderRecovery("paid-save", {
        orderNumber,
        paypalOrderId: orderID,
        paypalCaptureId: captureId,
        amount: paidValue,
        description: purchase.description || "",
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
