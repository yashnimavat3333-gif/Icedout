import { restoreLeadCart } from "../_lib/customerLeads.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const url = new URL(req.url || "", "http://local");
    const token = req.body?.token || url.searchParams.get("token") || "";
    const cart = await restoreLeadCart(token);
    if (!cart) return res.status(404).json({ error: "This link is not valid." });
    return res.status(200).json(cart);
  } catch {
    return res.status(404).json({ error: "This link is not valid." });
  }
}
