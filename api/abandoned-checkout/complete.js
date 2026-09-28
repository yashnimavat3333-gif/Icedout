import { completeAbandonedCheckout } from "../_lib/abandonedCheckoutStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await completeAbandonedCheckout(req.body?.recoveryToken);
    return res.status(200).json(result);
  } catch (err) {
    if (err?.code === "NOT_CONFIGURED") {
      return res.status(200).json({ ok: false });
    }
    console.error("[abandoned-checkout/complete]", err?.message || err);
    return res.status(200).json({ ok: false });
  }
}
