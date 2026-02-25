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
 *   shippingphone*  – string
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

    const body = req.body || {};

    const couponId   = body._couponId   || "";
    const couponCode = body._couponCode || "";

    // PayPal reference info (logged for traceability, not stored in Appwrite schema)
    const paypalOrderId = body.paypalOrderId || "";
    const paypalTransactionId = body.paypalTransactionId || "";

    const safeStr = (v) => (v == null ? "" : String(v));
    const safeInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

    let parsedItems = [];
    try {
      parsedItems = typeof body.items === "string"
        ? JSON.parse(body.items)
        : Array.isArray(body.items) ? body.items : [];
    } catch {
      parsedItems = [];
    }
    const normalizedItems = parsedItems.map((it) => ({
      id:       safeStr(it.id ?? it.$id),
      name:     safeStr(it.name),
      price:    it.price ?? 0,
      quantity: it.quantity ?? 1,
      size:     safeStr(it.size || it.selectedSize),
      variation: safeStr(it.variation),
      sku:      safeStr(it.sku),
    }));

    const shippingPhone = safeStr(
      body.shippingphone || body.shipping_phone || body.Shippingphone
    );

    // Server-side validation of required fields
    const validationErrors = [];

    if (!shippingPhone.trim()) {
      validationErrors.push("Shipping phone is required");
    }
    if (!safeStr(body.billingAddress).trim()) {
      validationErrors.push("Billing address is required");
    }
    if (normalizedItems.length === 0) {
      validationErrors.push("Order must contain at least one item");
    }
    if (safeInt(body.amount) <= 0) {
      validationErrors.push("Order amount must be greater than zero");
    }

    if (validationErrors.length > 0) {
      console.error("[create-order] Validation failed:", validationErrors);
      return res.status(400).json({
        error: validationErrors.join(". "),
        validationErrors,
      });
    }

    const doc = {
      orderId:        Date.now(),
      orderDate:      new Date().toISOString(),
      billingAddress: safeStr(body.billingAddress),
      items:          JSON.stringify(normalizedItems),
      shippingphone:  shippingPhone,
      amount:         safeInt(body.amount),

      customerId:     Date.now() + Math.floor(Math.random() * 1000),
      totalAmount:    safeInt(body.totalAmount || body.amount),
      shippingAddress: safeStr(body.shippingAddress),
      orderStatus:    "pending",
    };

    console.log("[create-order] Incoming body:", {
      email: body.email,
      amount: body.amount,
      shippingphone: shippingPhone,
      itemsLength: doc.items.length,
      paypalOrderId,
      paypalTransactionId,
    });

    console.log("[create-order] Document to save:", {
      orderId: doc.orderId,
      amount: doc.amount,
      orderStatus: doc.orderStatus,
      fieldCount: Object.keys(doc).length,
    });

    const response = await db.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      doc
    );

    console.log("[create-order] Order saved:", response.$id, "| PayPal:", paypalOrderId);

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
        console.warn("[create-order] Coupon increment failed (non-fatal):", couponErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      orderId: response.$id,
    });
  } catch (error) {
    console.error("[create-order] Order creation failed:", {
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
