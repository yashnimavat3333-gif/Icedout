import { computeCheckoutTotal } from "../_lib/computeCheckoutTotal.js";
import { createPayPalOrder } from "../_lib/paypalServer.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const items = body.items;
    const couponCode = body.couponCode || null;

    const totals = await computeCheckoutTotal({ items, couponCode });
    if (!(totals.totalUsd > 0)) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    const order = await createPayPalOrder({ amountUsd: totals.totalUsd });
    return res.status(200).json({ id: order.id });
  } catch (err) {
    console.error("[paypal/create-order]", err?.message || err);
    const msg = err?.message || "";
    if (
      msg.includes("Invalid coupon") ||
      msg.includes("Cart is empty") ||
      msg.includes("Invalid cart")
    ) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes("Missing Appwrite")) {
      return res.status(500).json({ error: "Server configuration error" });
    }
    return res.status(500).json({ error: "Could not create PayPal order" });
  }
}
