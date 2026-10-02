import { allowLeadWrite, captureLead } from "../_lib/customerLeads.js";

function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"] || "";
  return String(forwarded).split(",")[0].trim() || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!allowLeadWrite(clientIp(req))) {
    return res.status(429).json({ error: "Please wait a moment and try again." });
  }
  try {
    const body = req.body || {};
    const result = await captureLead({
      contact: body.contact,
      marketingConsent: Boolean(body.marketingConsent),
      items: body.items,
      leadId: body.leadId,
      applyGet10: body.applyGet10 !== false,
    });
    return res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 400;
    return res.status(status).json({ error: err?.message || "Could not save your details." });
  }
}
