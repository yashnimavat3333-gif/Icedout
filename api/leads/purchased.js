import { markLeadPurchased } from "../_lib/customerLeads.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = req.body || {};
    const result = await markLeadPurchased({
      leadId: body.leadId,
      orderNumber: body.orderNumber,
    });
    return res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 500;
    return res.status(status).json({ ok: false });
  }
}
