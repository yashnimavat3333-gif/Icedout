import { quoteCart } from "../_lib/customerLeads.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = req.body || {};
    const quote = await quoteCart(body.items, body.couponCode || null);
    return res.status(200).json(quote);
  } catch (err) {
    const status = err?.status || (String(err?.message || "").includes("Invalid") ? 400 : 500);
    const safe = status === 400 ? err.message : "Could not price cart";
    return res.status(status).json({ ok: false, error: safe });
  }
}
