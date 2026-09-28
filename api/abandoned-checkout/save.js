import { saveAbandonedCheckout } from "../_lib/abandonedCheckoutStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await saveAbandonedCheckout(req.body || {});
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err?.code === "NOT_CONFIGURED") {
      return res.status(503).json({ error: "Abandoned checkout is not configured" });
    }
    const msg = err?.message || "Could not save checkout";
    const status = msg.includes("required") || msg.includes("Invalid") || msg.includes("empty") ? 400 : 500;
    console.error("[abandoned-checkout/save]", msg);
    return res.status(status).json({ error: status === 400 ? msg : "Could not save checkout" });
  }
}
