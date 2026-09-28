import { listAbandonedCheckouts } from "../_lib/abandonedCheckoutStore.js";

function verifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === secret;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const checkouts = await listAbandonedCheckouts();
    return res.status(200).json({ checkouts });
  } catch (err) {
    if (err?.code === "NOT_CONFIGURED") {
      return res.status(503).json({ error: "Abandoned checkout is not configured" });
    }
    console.error("[admin/abandoned-checkouts]", err?.message || err);
    return res.status(500).json({ error: "Could not load abandoned checkouts" });
  }
}
