import { Client, Databases } from "node-appwrite";
import { getPayPalOrder } from "../_lib/paypalServer.js";
import { factsFromVerifiedOrder, paymentDecision, recoveryEligibility } from "../_lib/paypalCapture.js";
import { logOrderRecovery } from "../_lib/iceyOrder.js";

let client = null;
let databases = null;

function getClient() {
  if (client && databases) return { client, databases };

  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing Appwrite env vars. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY."
    );
  }

  client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  databases = new Databases(client);
  return { client, databases };
}

const VALID_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

function verifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const auth = req.headers["authorization"] || req.headers["Authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === secret;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_COLLECTION_ID;

  if (!databaseId || !collectionId) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { documentId, status, action } = req.body || {};

  if (action === "reconcile") {
    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ error: "Missing or invalid documentId" });
    }
    try {
      const { databases: db } = getClient();
      const doc = await db.getDocument(databaseId, collectionId, documentId);
      if (recoveryEligibility(doc) !== "eligible") {
        return res.status(400).json({ error: "This pending order cannot be checked with PayPal" });
      }
      const paypalOrder = await getPayPalOrder(doc.paypal_order_id);
      const facts = factsFromVerifiedOrder(paypalOrder);
      const decision = facts ? paymentDecision(doc, facts) : { action: "unpaid" };
      if (decision.action !== "markPaid") {
        return res.status(200).json({ success: true, action: decision.action });
      }
      const updated = await db.updateDocument(databaseId, collectionId, documentId, {
        orderStatus: "paid",
        paypal_status: "COMPLETED",
        paypal_order_id: facts.paypalOrderId,
        paypal_capture_id: facts.captureId,
        amount: facts.amount,
        totalAmount: facts.amount,
        orderDate: new Date().toISOString(),
      });
      return res.status(200).json({ success: true, action: "updated", order: updated });
    } catch (error) {
      logOrderRecovery("admin-reconcile", {
        message: error?.message || "PayPal check failed",
      });
      return res.status(502).json({ error: "PayPal could not be checked" });
    }
  }

  if (!documentId || typeof documentId !== "string") {
    return res.status(400).json({ error: "Missing or invalid documentId" });
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    const { databases: db } = getClient();

    const updated = await db.updateDocument(
      databaseId,
      collectionId,
      documentId,
      { orderStatus: status }
    );

    return res.status(200).json({
      success: true,
      order: updated,
    });
  } catch (error) {
    console.error("[admin/update-order-status] Error:", error?.message);
    return res.status(500).json({
      error: error?.message || "Failed to update order status",
    });
  }
}
