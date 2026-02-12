/**
 * Vercel Serverless Function: Create Order in Appwrite
 *
 * POST /api/create-order
 *
 * Receives the order payload from the client after PayPal capture,
 * creates the document in Appwrite using a server-side API key (never exposed
 * to the browser), and optionally increments coupon usage.
 *
 * Required env vars (set in Vercel dashboard):
 *   APPWRITE_ENDPOINT          – e.g. https://cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID        – project id
 *   APPWRITE_API_KEY            – server API key with documents.write scope
 *   APPWRITE_DATABASE_ID       – database id
 *   APPWRITE_COLLECTION_ID     – orders collection id
 *   APPWRITE_COUPONS_COLLECTION_ID – (optional) coupons collection id
 */

import { Client, Databases, ID } from "node-appwrite";

// ── Initialise Appwrite server client (cold-start cached) ──
let client = null;
let databases = null;

function getClient() {
  if (client && databases) return { client, databases };

  const endpoint  = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey    = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing Appwrite env vars. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY in Vercel."
    );
  }

  client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  databases = new Databases(client);
  return { client, databases };
}

export default async function handler(req, res) {
  // ── Only accept POST ──
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const databaseId          = process.env.APPWRITE_DATABASE_ID;
  const collectionId        = process.env.APPWRITE_COLLECTION_ID;
  const couponsCollectionId = process.env.APPWRITE_COUPONS_COLLECTION_ID || "";

  if (!databaseId || !collectionId) {
    console.error("[create-order] Missing APPWRITE_DATABASE_ID or APPWRITE_COLLECTION_ID");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { databases: db } = getClient();

    // ── Parse body ──
    const body = req.body || {};
    const {
      // Separate coupon metadata (not stored as a document field)
      _couponId,
      _couponCode,
      // Everything else goes into the Appwrite document
      ...payload
    } = body;

    console.log("[create-order] Incoming payload:", {
      email: payload.email,
      paypal_order_id: payload.paypal_order_id,
      amount: payload.amount,
      fieldCount: Object.keys(payload).length,
    });

    // ── Create order document ──
    const response = await db.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      payload
    );

    console.log("[create-order] ✅ Order saved:", response.$id);

    // ── Increment coupon usage (best-effort) ──
    if (_couponId && couponsCollectionId) {
      try {
        const couponDoc = await db.getDocument(
          databaseId,
          couponsCollectionId,
          _couponId
        );
        const currentUsage = Number(couponDoc.usage_count || 0);
        await db.updateDocument(
          databaseId,
          couponsCollectionId,
          _couponId,
          { usage_count: currentUsage + 1 }
        );
        console.log("[create-order] Coupon usage incremented:", _couponCode, currentUsage + 1);
      } catch (couponErr) {
        // Non-fatal: order is already saved
        console.warn("[create-order] Coupon increment failed (non-fatal):", couponErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      orderId: response.$id,
    });
  } catch (error) {
    console.error("[create-order] ❌ Order creation failed:", {
      message: error?.message,
      code: error?.code,
      type: error?.type,
    });

    return res.status(500).json({
      error: error?.message || "Unknown server error",
      code: error?.code,
    });
  }
}
