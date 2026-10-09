import { Client, Databases, ID, Query } from "node-appwrite";
import { getPayPalCapture, getPayPalOrder } from "../_lib/paypalServer.js";
import {
  buildMissingPaymentRecord,
  publicRecoveryError,
  factsFromVerifiedOrder,
  loadVerifiedMissingPayment,
  missingPaymentDecision,
  paymentDecision,
  recoveryEligibility,
  storedMoney,
} from "../_lib/paypalCapture.js";
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

  if (action === "recover-missing") {
    const paypalId = String(req.body?.paypalId || req.body?.paypalOrderId || req.body?.captureId || "").trim();
    try {
      const verified = await loadVerifiedMissingPayment({
        paypalId,
        getOrder: getPayPalOrder,
        getCapture: getPayPalCapture,
      });
      if (verified.action !== "verified") {
        const errors = {
          unpaid: "PayPal has not completed this payment",
          "wrong-amount": "PayPal amount does not match $595.57",
          invalid: "Enter the PayPal order ID or capture ID for ICEY-989107",
        };
        return res.status(400).json({ error: errors[verified.action] || errors.invalid });
      }
      const { databases: db } = getClient();
      const found = [];
      for (const [field, value] of [
        ["paypal_capture_id", verified.facts.captureId],
        ["paypal_order_id", verified.facts.paypalOrderId],
      ]) {
        try {
          const page = await db.listDocuments(databaseId, collectionId, [
            Query.equal(field, value),
            Query.limit(5),
          ]);
          found.push(...(page.documents || []));
        } catch {
          // The collection may not have this index. The recent-order scan still runs.
        }
      }
      const recent = await db.listDocuments(databaseId, collectionId, [
        Query.limit(100),
        Query.orderDesc("$createdAt"),
      ]);
      const decision = missingPaymentDecision(
        [...found, ...(recent.documents || [])],
        verified.facts
      );
      if (decision.action === "duplicate") {
        return res.status(200).json({ success: true, action: "duplicate", order: decision.existing });
      }
      if (decision.action !== "create") {
        return res.status(400).json({ error: "This payment cannot be recorded" });
      }
      const order = await db.createDocument(
        databaseId,
        collectionId,
        ID.unique(),
        buildMissingPaymentRecord(verified.facts)
      );
      return res.status(200).json({ success: true, action: "created", order });
    } catch (error) {
      const safe = publicRecoveryError(error);
      logOrderRecovery("missing-payment", { message: safe });
      return res.status(502).json({ error: safe });
    }
  }

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
      const money = storedMoney(facts.amount);
      const updated = await db.updateDocument(databaseId, collectionId, documentId, {
        orderStatus: "paid",
        paypal_status: "COMPLETED",
        paypal_order_id: facts.paypalOrderId,
        paypal_capture_id: facts.captureId,
        amount: money.amount,
        totalAmount: money.totalAmount,
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
