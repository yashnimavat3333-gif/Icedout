/**
 * Vercel Serverless Function: Create Order in Appwrite
 *
 * POST /api/create-order
 *
 * Receives order data from the client after PayPal capture,
 * maps it to the EXACT Appwrite "order" collection schema,
 * creates the document using a server-side API key.
 *
 * Appwrite schema (required fields marked *):
 *   orderId*        – integer
 *   orderDate*      – datetime (ISO string)
 *   billingAddress* – string
 *   items*          – string (JSON)
 *   Shippingphone*  – string
 *   amount*         – integer
 *   customerId      – integer
 *   totalAmount     – integer
 *   shippingAddress – string
 *   orderStatus     – string
 *
 * Required env vars (set in Vercel dashboard):
 *   APPWRITE_ENDPOINT
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY
 *   APPWRITE_DATABASE_ID
 *   APPWRITE_COLLECTION_ID
 *   APPWRITE_COUPONS_COLLECTION_ID (optional)
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

    // ── Parse incoming body ──
    const body = req.body || {};

    // Extract coupon metadata (not stored in the order document)
    const couponId   = body._couponId   || "";
    const couponCode = body._couponCode || "";

    // ── Build document matching EXACT Appwrite schema ──
    const safeStr = (v) => (v == null ? "" : String(v));
    const safeInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

    const doc = {
      // ── Required fields ──
      orderId:        Date.now(),
      orderDate:      new Date().toISOString(),
      billingAddress: safeStr(body.billingAddress),
      items:          typeof body.items === "string"
                        ? body.items
                        : JSON.stringify(body.items || []),
      Shippingphone:  safeStr(body.Shippingphone),
      amount:         safeInt(body.amount),

      // ── Optional fields ──
      customerId:     Date.now() + Math.floor(Math.random() * 1000),
      totalAmount:    safeInt(body.totalAmount || body.amount),
      shippingAddress: safeStr(body.shippingAddress),
      orderStatus:    "pending",
    };

    console.log("[create-order] Incoming body:", {
      email: body.email,
      amount: body.amount,
      Shippingphone: body.Shippingphone,
      itemsLength: doc.items.length,
    });

    console.log("[create-order] Document to save:", {
      orderId: doc.orderId,
      amount: doc.amount,
      orderStatus: doc.orderStatus,
      fieldCount: Object.keys(doc).length,
    });

    // ── Create order document ──
    const response = await db.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      doc
    );

    console.log("[create-order] ✅ Order saved:", response.$id);

    // ── Increment coupon usage (best-effort) ──
    if (couponId && couponsCollectionId) {
      try {
        const couponDoc = await db.getDocument(
          databaseId,
          couponsCollectionId,
          couponId
        );
        const currentUsage = Number(couponDoc.usage_count || 0);
        await db.updateDocument(
          databaseId,
          couponsCollectionId,
          couponId,
          { usage_count: currentUsage + 1 }
        );
        console.log("[create-order] Coupon usage incremented:", couponCode, currentUsage + 1);
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
