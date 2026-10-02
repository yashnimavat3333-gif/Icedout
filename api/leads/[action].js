import { allowLeadWrite, captureLead, listLeads, markLeadPurchased, quoteCart, restoreLeadCart, syncLead } from "../_lib/customerLeads.js";

function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"] || "";
  return String(forwarded).split(",")[0].trim() || "unknown";
}

function verifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers?.["authorization"] || req.headers?.["Authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === secret;
}

async function capture(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!allowLeadWrite(clientIp(req))) {
    return res.status(429).json({ error: "Please wait a moment and try again." });
  }
  const body = req.body || {};
  const result = await captureLead({
    contact: body.contact,
    marketingConsent: Boolean(body.marketingConsent),
    items: body.items,
    leadId: body.leadId,
    applyGet10: body.applyGet10 !== false,
  });
  return res.status(200).json(result);
}

async function quote(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const priced = await quoteCart(body.items, body.couponCode || null);
  return res.status(200).json(priced);
}

async function sync(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const result = await syncLead({
    leadId: body.leadId,
    items: body.items,
    checkoutStarted: Boolean(body.checkoutStarted),
  });
  return res.status(200).json(result);
}

async function purchased(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const result = await markLeadPurchased({
    leadId: body.leadId,
    orderNumber: body.orderNumber,
  });
  return res.status(200).json(result);
}

async function restore(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const url = new URL(req.url || "", "http://local");
  const token = req.body?.token || req.query?.token || url.searchParams.get("token") || "";
  const cart = await restoreLeadCart(token);
  if (!cart) return res.status(404).json({ error: "This link is not valid." });
  return res.status(200).json(cart);
}

async function admin(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!verifyAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const leads = await listLeads();
  return res.status(200).json({ leads });
}

const actions = { capture, quote, sync, purchased, restore, admin };

export default async function handler(req, res) {
  const action = String(req.query?.action || "");
  const run = actions[action];
  if (!run) return res.status(404).json({ error: "Not found" });
  try {
    return await run(req, res);
  } catch (err) {
    if (action === "capture") {
      const status = err?.status || 400;
      return res.status(status).json({ error: err?.message || "Could not save your details." });
    }
    if (action === "quote") {
      const status = err?.status || (String(err?.message || "").includes("Invalid") ? 400 : 500);
      const safe = status === 400 ? err.message : "Could not price cart";
      return res.status(status).json({ ok: false, error: safe });
    }
    if (action === "restore") {
      return res.status(404).json({ error: "This link is not valid." });
    }
    if (action === "admin") {
      const missing = err?.code === "NOT_CONFIGURED";
      return res.status(missing ? 503 : 500).json({
        error: missing ? "Lead storage is not configured" : "Could not load leads",
      });
    }
    const status = err?.code === "NOT_CONFIGURED" ? 503 : err?.status || 500;
    return res.status(status).json({ ok: false });
  }
}
