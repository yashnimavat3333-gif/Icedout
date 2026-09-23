import { computeCheckoutTotal } from "../_lib/computeCheckoutTotal.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await computeCheckoutTotal(req.body || {}, process.env);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[compute-total]", err?.message || err);
    return res.status(500).json({
      error: err?.message || "Failed to compute checkout total",
    });
  }
}
