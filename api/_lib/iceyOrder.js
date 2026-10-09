import { Client, Databases, ID, Query } from "node-appwrite";
import { factsFromVerifiedOrder, matchIceyDocument, paymentDecision } from "./paypalCapture.js";

function getDb() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_COLLECTION_ID;
  if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
    throw new Error("Order storage is not configured");
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { databases: new Databases(client), databaseId, collectionId };
}

function parseItems(raw) {
  try {
    return JSON.parse(raw || "");
  } catch {
    return null;
  }
}

export async function nextIceyNumber() {
  const { databases, databaseId, collectionId } = getDb();
  const page = await databases.listDocuments(databaseId, collectionId, [
    Query.limit(100),
    Query.orderDesc("$createdAt"),
  ]);
  let max = 10000;
  for (const doc of page.documents || []) {
    const stored = parseItems(doc.items);
    const fromLabel = Number(String(stored?.orderNumber || "").replace(/^ICEY-/i, ""));
    const fromId = Number(doc.orderId);
    for (const n of [fromLabel, fromId]) {
      if (n >= 10000 && n < 1000000 && n > max) max = n;
    }
  }
  const sequence = max + 1;
  return { sequence, orderNumber: `ICEY-${sequence}` };
}

function snapshotPayload({ orderNumber, imageFileId, lineItems }) {
  return JSON.stringify({
    orderNumber,
    imageFileId: imageFileId || "",
    lines: (lineItems || []).map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      imageFileId: line.imageFileId || "",
    })),
  });
}

function orderFields({
  sequence,
  orderNumber,
  imageFileId,
  lineItems,
  customerName,
  customerPhone,
  shippingAddress,
  amount,
  orderStatus,
  paypalStatus,
  paypalOrderId,
  paypalCaptureId,
  paidAt,
}) {
  return {
    orderId: sequence,
    orderDate: paidAt || new Date().toISOString(),
    billingAddress: shippingAddress || customerName || "PayPal checkout",
    shippingAddress: shippingAddress || "",
    shippingphone: customerPhone || "",
    shipping_full_name: customerName || "",
    amount,
    totalAmount: amount,
    currency: "USD",
    orderStatus,
    payment_method: "paypal",
    paypal_status: paypalStatus,
    paypal_order_id: paypalOrderId || "",
    paypal_capture_id: paypalCaptureId || "",
    customerId: sequence,
    items: snapshotPayload({ orderNumber, imageFileId, lineItems }),
  };
}

async function findOwnOrder(databases, databaseId, collectionId, sequence, orderNumber) {
  const page = await databases.listDocuments(databaseId, collectionId, [
    Query.limit(100),
    Query.orderDesc("$createdAt"),
  ]);
  return (page.documents || []).find((doc) => {
    const stored = parseItems(doc.items);
    return stored?.orderNumber === orderNumber || Number(doc.orderId) === sequence;
  });
}

export async function markIceyOrderPaid({
  paypalOrderId,
  orderNumber,
  captureId,
  amount,
  paidAt,
}) {
  const { databases, databaseId, collectionId } = getDb();
  const sequence = Number(String(orderNumber || "").replace(/^ICEY-/i, ""));
  const existing = await findOwnOrder(
    databases,
    databaseId,
    collectionId,
    sequence,
    orderNumber
  );
  if (!existing || Number(existing.orderId) > 1000000) {
    throw new Error("ICEY order record was not found");
  }
  const paidAmount = Number(amount);
  await databases.updateDocument(databaseId, collectionId, existing.$id, {
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    paypal_order_id: paypalOrderId || existing.paypal_order_id || "",
    paypal_capture_id: captureId || "",
    amount: Number.isFinite(paidAmount) ? paidAmount : existing.amount,
    totalAmount: Number.isFinite(paidAmount) ? paidAmount : existing.totalAmount,
    orderDate: paidAt || new Date().toISOString(),
  });
  return existing;
}

export function shouldPreservePaidOrder(existing) {
  return Boolean(
    existing &&
      Number(existing.orderId) <= 1000000 &&
      existing.orderStatus === "paid" &&
      existing.paypal_status === "COMPLETED"
  );
}

export async function saveIceyOrder(input) {
  const { databases, databaseId, collectionId } = getDb();
  const sequence = Number(String(input.orderNumber || "").replace(/^ICEY-/i, ""));
  const data = orderFields({ ...input, sequence });
  const existing = await findOwnOrder(
    databases,
    databaseId,
    collectionId,
    sequence,
    input.orderNumber
  );
  if (existing) {
    if (Number(existing.orderId) > 1000000) return existing;
    if (shouldPreservePaidOrder(existing)) return existing;
    await databases.updateDocument(databaseId, collectionId, existing.$id, data);
    return existing;
  }
  return databases.createDocument(databaseId, collectionId, ID.unique(), data);
}

async function findByPayPalField(databases, databaseId, collectionId, field, value, facts) {
  if (!value) return null;
  try {
    const page = await databases.listDocuments(databaseId, collectionId, [
      Query.equal(field, value),
      Query.limit(5),
    ]);
    return matchIceyDocument(page.documents, facts);
  } catch {
    return null;
  }
}

export async function persistVerifiedCapture(db, facts, paidAt) {
  const { databases, databaseId, collectionId } = db;
  const byCapture = await findByPayPalField(
    databases,
    databaseId,
    collectionId,
    "paypal_capture_id",
    facts.captureId,
    facts
  );
  const byOrder =
    byCapture ||
    (await findByPayPalField(
      databases,
      databaseId,
      collectionId,
      "paypal_order_id",
      facts.paypalOrderId,
      facts
    ));
  let existing = byOrder;
  if (!existing) {
    const page = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(100),
      Query.orderDesc("$createdAt"),
    ]);
    existing = matchIceyDocument(page.documents, facts);
  }

  const decision = paymentDecision(existing, facts);
  if (decision.action !== "markPaid") {
    return { action: decision.action, orderNumber: facts.orderNumber };
  }

  const when = paidAt || new Date().toISOString();
  await databases.updateDocument(databaseId, collectionId, existing.$id, {
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    paypal_order_id: facts.paypalOrderId || existing.paypal_order_id || "",
    paypal_capture_id: facts.captureId || "",
    amount: facts.amount,
    totalAmount: facts.amount,
    orderDate: when,
  });
  return { action: "updated", orderNumber: facts.orderNumber };
}

export async function applyVerifiedPayPalPayment(paypalOrder, options = {}) {
  const facts = factsFromVerifiedOrder(paypalOrder, options.captureId || "");
  if (!facts) {
    logOrderRecovery("capture-unusable", {
      paypalOrderId: paypalOrder?.id || "",
      message: "Verified PayPal order did not include an ICEY reference and completed USD capture",
    });
    return { action: "ignore" };
  }
  try {
    return await persistVerifiedCapture(getDb(), facts, options.paidAt);
  } catch (err) {
    logOrderRecovery("paid-save", {
      orderNumber: facts.orderNumber,
      paypalOrderId: facts.paypalOrderId,
      paypalCaptureId: facts.captureId,
      amount: facts.amount,
      message: err?.message || "save failed",
    });
    throw err;
  }
}

export async function findPaidOrderByNumber(orderNumber) {
  const wanted = String(orderNumber || "").trim();
  if (!wanted) return null;
  const { databases, databaseId, collectionId } = getDb();
  const page = await databases.listDocuments(databaseId, collectionId, [
    Query.limit(100),
    Query.orderDesc("$createdAt"),
  ]);
  return (
    (page.documents || []).find((doc) => {
      if (doc.orderStatus !== "paid" || doc.paypal_status !== "COMPLETED") return false;
      if (Number(doc.orderId) > 1000000) return false;
      const stored = parseItems(doc.items);
      return stored?.orderNumber === wanted;
    }) || null
  );
}

export function logOrderRecovery(reason, details) {
  console.error("[ICEY_ORDER_RECOVERY]", reason, JSON.stringify(details));
}
