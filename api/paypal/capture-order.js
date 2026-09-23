import { capturePayPalOrder } from "../_lib/paypalServer.js";

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
    const captureId =
      capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;

    return res.status(200).json({
      ok: true,
      orderID,
      captureId,
      status: capture.status,
    });
  } catch (err) {
    console.error("[paypal/capture-order]", err?.message || err);
    return res.status(500).json({ error: "Payment capture failed" });
  }
}
