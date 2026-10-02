import { syncLead } from "../_lib/customerLeads.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = req.body || {};
    const result = await syncLead({
      leadId: body.leadId,
      items: body.items,
      checkoutStarted: Boolean(body.checkoutStarted),
    });
    return res.status(200).json(result);
  } catch (err) {
    const status = err?.code === "NOT_CONFIGURED" ? 503 : err?.status || 500;
    return res.status(status).json({ ok: false });
  }
}
