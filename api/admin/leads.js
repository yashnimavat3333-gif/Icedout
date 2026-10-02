import { listLeads } from "../_lib/customerLeads.js";

function verifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers?.["authorization"] || req.headers?.["Authorization"] || "";
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
    const leads = await listLeads();
    return res.status(200).json({ leads });
  } catch (err) {
    const missing = err?.code === "NOT_CONFIGURED";
    return res.status(missing ? 503 : 500).json({
      error: missing ? "Lead storage is not configured" : "Could not load leads",
    });
  }
}
