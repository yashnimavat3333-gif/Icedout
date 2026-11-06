import { Client, Databases, Query } from "node-appwrite";
import { getPayPalOrder } from "../api/_lib/paypalServer.js";

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_URL;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY || process.env.VITE_APPWRITE_KEY;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const collectionId = process.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

function parseItems(raw) {
  try {
    return JSON.parse(raw || "");
  } catch {
    return null;
  }
}

const page = await databases.listDocuments(databaseId, collectionId, [
  Query.limit(12),
  Query.orderDesc("$createdAt"),
]);

const cutoff = Date.now() - 36 * 60 * 60 * 1000;
const rows = [];

for (const doc of page.documents || []) {
  const stored = parseItems(doc.items);
  const created = doc.$createdAt;
  const recent = new Date(created).getTime() >= cutoff;
  const lines = Array.isArray(stored?.lines)
    ? stored.lines.map((line) => ({
        name: line.name,
        variation: line.variationName || "",
        qty: line.quantity,
        unitPrice: line.unitPrice,
        gift: Boolean(line.promotionalGift || line.gift),
      }))
    : [];
  let paypal = null;
  if (recent && doc.paypal_order_id && !doc.paypal_capture_id) {
    try {
      const remote = await getPayPalOrder(doc.paypal_order_id);
      const purchase = remote?.purchase_units?.[0];
      paypal = {
        status: remote?.status || "",
        amount: purchase?.amount?.value || "",
        currency: purchase?.amount?.currency_code || "",
      };
    } catch (err) {
      paypal = { error: String(err.message || err).slice(0, 180) };
    }
  }
  rows.push({
    created,
    recent,
    orderNumber: stored?.orderNumber || "",
    orderId: doc.orderId,
    orderStatus: doc.orderStatus,
    paypalStatus: doc.paypal_status,
    amount: doc.totalAmount ?? doc.amount,
    hasPayPalOrder: Boolean(doc.paypal_order_id),
    hasCapture: Boolean(doc.paypal_capture_id),
    lines,
    paypal,
  });
}

console.log(JSON.stringify(rows, null, 2));
