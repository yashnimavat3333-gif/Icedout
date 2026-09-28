import { recoverAbandonedCheckout } from "../_lib/abandonedCheckoutStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const fromQuery = req.query?.token;
    const url = new URL(req.url || "/", "http://local");
    const token = String(fromQuery || url.searchParams.get("token") || "");
    const result = await recoverAbandonedCheckout(token);
    if (!result) return res.status(404).json({ error: "Checkout not found" });
    return res.status(200).json(result);
  } catch (err) {
    if (err?.code === "NOT_CONFIGURED") {
      return res.status(503).json({ error: "Abandoned checkout is not configured" });
    }
    console.error("[abandoned-checkout/recover]", err?.message || err);
    return res.status(400).json({ error: "Invalid recovery link" });
  }
}
