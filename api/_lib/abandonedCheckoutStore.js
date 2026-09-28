import { Client, Databases, ID, Query } from "node-appwrite";

const ABANDON_AFTER_MS = 30 * 60 * 1000;

function getDb() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_ABANDONED_CHECKOUTS_COLLECTION_ID;

  if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
    const err = new Error("Abandoned checkout is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { databases: new Databases(client), databaseId, collectionId };
}

export function isValidRecoveryToken(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(token || "")
  );
}

function parseJson(raw, fallback) {
  if (raw && typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function roundMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function snapshotItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 30).map((it) => ({
    $id: it?.$id ?? it?.id ?? null,
    id: it?.id ?? it?.$id ?? null,
    name: String(it?.name || "Item").slice(0, 200),
    quantity: Math.max(1, Math.floor(Number(it?.quantity) || 1)),
    price: roundMoney(it?.price),
    image: it?.image ? String(it.image).slice(0, 500) : null,
    selectedSize: it?.selectedSize ? String(it.selectedSize).slice(0, 80) : null,
    selectedVariation: it?.selectedVariation
      ? {
          name: String(it.selectedVariation.name || it.selectedVariation.title || "").slice(0, 120),
        }
      : null,
    selectedMaterial: it?.selectedMaterial ? String(it.selectedMaterial).slice(0, 120) : null,
    personalizedBox: it?.personalizedBox ? String(it.personalizedBox).slice(0, 200) : null,
  }));
}

function buildCheckoutData(input, cartItems) {
  return JSON.stringify({
    customerName: String(input.customerName || "").trim().slice(0, 200),
    customerEmail: String(input.customerEmail || "").trim().slice(0, 200),
    customerPhone: String(input.customerPhone || "").trim().slice(0, 40),
    cartItems,
    subtotal: roundMoney(input.subtotal),
    shipping: roundMoney(input.shipping),
    discount: roundMoney(input.discount),
    total: roundMoney(input.total),
    currency: "USD",
  });
}

function buildRecoveryMeta(previous, patch) {
  const prev = previous || {};
  return JSON.stringify({
    createdAt: prev.createdAt || patch.createdAt,
    updatedAt: patch.updatedAt,
    lastSeenAt: patch.lastSeenAt,
    recoveredAt: patch.recoveredAt !== undefined ? patch.recoveredAt : prev.recoveredAt || null,
    completedAt: patch.completedAt !== undefined ? patch.completedAt : prev.completedAt || null,
    recoveryCount:
      patch.recoveryCount !== undefined ? patch.recoveryCount : Number(prev.recoveryCount) || 0,
  });
}

export function displayStatus(doc, now = Date.now()) {
  const status = doc?.status || "active";
  if (status === "completed" || status === "recovered") return status;
  const meta = parseJson(doc?.recoveryMeta, {});
  const last = Date.parse(meta.lastSeenAt || doc?.$updatedAt || doc?.$createdAt || "");
  if (status === "active" && Number.isFinite(last) && now - last >= ABANDON_AFTER_MS) {
    return "abandoned";
  }
  return status;
}

async function findByToken(databases, databaseId, collectionId, token) {
  const existing = await databases.listDocuments(databaseId, collectionId, [
    Query.equal("recoveryToken", token),
    Query.limit(1),
  ]);
  return existing.documents?.[0] || null;
}

export async function saveAbandonedCheckout(input) {
  const token = String(input?.recoveryToken || "");
  if (!isValidRecoveryToken(token)) throw new Error("Invalid recovery token");

  const cartItems = snapshotItems(input.cartItems);
  if (cartItems.length === 0) throw new Error("Cart is empty");

  const email = String(input.customerEmail || "").trim();
  if (!email) throw new Error("Email is required");

  const { databases, databaseId, collectionId } = getDb();
  const now = new Date().toISOString();
  const current = await findByToken(databases, databaseId, collectionId, token);
  if (current?.status === "completed") {
    return { recoveryToken: token, status: "completed" };
  }

  const prevMeta = parseJson(current?.recoveryMeta, {});
  const data = {
    checkoutId: current?.checkoutId || ID.unique(),
    recoveryToken: token,
    checkoutData: buildCheckoutData(input, cartItems),
    status: current?.status === "recovered" ? "recovered" : "active",
    recoveryMeta: buildRecoveryMeta(prevMeta, {
      createdAt: prevMeta.createdAt || current?.$createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
    }),
  };

  if (current) {
    await databases.updateDocument(databaseId, collectionId, current.$id, data);
  } else {
    await databases.createDocument(databaseId, collectionId, ID.unique(), data);
  }

  return { recoveryToken: token, status: data.status };
}

export async function recoverAbandonedCheckout(token) {
  if (!isValidRecoveryToken(token)) throw new Error("Invalid recovery token");
  const { databases, databaseId, collectionId } = getDb();
  const doc = await findByToken(databases, databaseId, collectionId, token);
  if (!doc) return null;
  if (doc.status === "completed") return { status: "completed" };

  const checkout = parseJson(doc.checkoutData, {});
  const prevMeta = parseJson(doc.recoveryMeta, {});
  const now = new Date().toISOString();

  await databases.updateDocument(databaseId, collectionId, doc.$id, {
    checkoutId: doc.checkoutId,
    recoveryToken: doc.recoveryToken,
    checkoutData: doc.checkoutData,
    status: "recovered",
    recoveryMeta: buildRecoveryMeta(prevMeta, {
      createdAt: prevMeta.createdAt || doc.$createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
      recoveredAt: now,
      recoveryCount: (Number(prevMeta.recoveryCount) || 0) + 1,
    }),
  });

  return {
    status: "recovered",
    cartItems: Array.isArray(checkout.cartItems) ? checkout.cartItems : [],
    contact: {
      fullName: checkout.customerName || "",
      email: checkout.customerEmail || "",
      phone: checkout.customerPhone || "",
    },
    recoveryToken: doc.recoveryToken,
  };
}

export async function completeAbandonedCheckout(token) {
  if (!isValidRecoveryToken(token)) return { ok: false };
  const { databases, databaseId, collectionId } = getDb();
  const doc = await findByToken(databases, databaseId, collectionId, token);
  if (!doc) return { ok: false };

  const prevMeta = parseJson(doc.recoveryMeta, {});
  const now = new Date().toISOString();
  await databases.updateDocument(databaseId, collectionId, doc.$id, {
    checkoutId: doc.checkoutId,
    recoveryToken: doc.recoveryToken,
    checkoutData: doc.checkoutData,
    status: "completed",
    recoveryMeta: buildRecoveryMeta(prevMeta, {
      createdAt: prevMeta.createdAt || doc.$createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
      completedAt: now,
    }),
  });
  return { ok: true };
}

export async function listAbandonedCheckouts() {
  const { databases, databaseId, collectionId } = getDb();
  const response = await databases.listDocuments(databaseId, collectionId, [
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ]);
  return (response.documents || []).map((doc) => ({
    checkoutId: doc.checkoutId,
    recoveryToken: doc.recoveryToken,
    status: displayStatus(doc),
    checkoutData: doc.checkoutData || "{}",
    recoveryMeta: doc.recoveryMeta || "{}",
    $createdAt: doc.$createdAt || null,
    $updatedAt: doc.$updatedAt || null,
  }));
}
