import { Client, Databases, ID, Query } from "node-appwrite";
import { computeCheckoutTotal } from "./computeCheckoutTotal.js";

const ABANDON_AFTER_MS = 30 * 60 * 1000;
const OFFER_CODE = "GET10";

const writes = new Map();

export function bridgeAppwriteEnv() {
  const fill = (name, ...fallbacks) => {
    if (process.env[name]) return;
    for (const key of fallbacks) {
      if (process.env[key]) {
        process.env[name] = process.env[key];
        return;
      }
    }
  };
  fill("APPWRITE_ENDPOINT", "VITE_APPWRITE_URL", "VITE_APPWRITE_ENDPOINT");
  fill("APPWRITE_PROJECT_ID", "VITE_APPWRITE_PROJECT_ID");
  fill("APPWRITE_API_KEY", "VITE_APPWRITE_API_KEY", "VITE_APPWRITE_KEY");
  fill("APPWRITE_DATABASE_ID", "VITE_APPWRITE_DATABASE_ID");
  fill("APPWRITE_PRODUCTS_COLLECTION_ID", "VITE_APPWRITE_COLLECTION_ID");
  fill("APPWRITE_COUPONS_COLLECTION_ID", "VITE_APPWRITE_COUPONS_COLLECTION_ID");
}

function getDb() {
  bridgeAppwriteEnv();
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_LEADS_COLLECTION_ID || "customer_leads";
  if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
    const err = new Error("Lead storage is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { databases: new Databases(client), databaseId, collectionId };
}

export function allowLeadWrite(ip) {
  const key = String(ip || "unknown").slice(0, 80);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const row = writes.get(key) || { count: 0, start: now };
  if (now - row.start > windowMs) {
    writes.set(key, { count: 1, start: now });
    return true;
  }
  if (row.count >= 12) return false;
  row.count += 1;
  writes.set(key, row);
  return true;
}

export function parseContact(raw) {
  const value = String(raw || "").replace(/[\u0000-\u001F]/g, "").trim();
  if (!value) return { ok: false, error: "Enter an email address or phone number." };
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    return { ok: true, email, phone: "" };
  }
  const phone = value.replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  return { ok: true, email: "", phone };
}

export function chooseExistingLead(docs, { leadId, email, phone }) {
  const list = Array.isArray(docs) ? docs : [];
  const byId = leadId ? list.find((doc) => doc.leadId === leadId) : null;
  if (byId) return { doc: byId, reason: "id" };

  const emailHits = email ? list.filter((doc) => doc.email === email) : [];
  const phoneHits = phone ? list.filter((doc) => doc.phone === phone) : [];

  if (email && emailHits.length > 1) return { doc: null, reason: "ambiguous-email" };
  if (phone && phoneHits.length > 1) return { doc: null, reason: "ambiguous-phone" };

  if (email && emailHits.length === 1) {
    const doc = emailHits[0];
    if (phone && doc.phone && doc.phone !== phone) return { doc: null, reason: "email-phone-conflict" };
    if (phoneHits.length === 1 && phoneHits[0].$id !== doc.$id) return { doc: null, reason: "split-identity" };
    return { doc, reason: "email" };
  }

  if (phone && phoneHits.length === 1) {
    const doc = phoneHits[0];
    if (email && doc.email && doc.email !== email) return { doc: null, reason: "phone-email-conflict" };
    return { doc, reason: "phone" };
  }

  return { doc: null, reason: "new" };
}

function parseCart(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw || "");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function displayLeadStatus(doc, now = Date.now()) {
  if (doc?.leadStatus === "purchased" || doc?.checkoutStatus === "paid") return "purchased";
  const last = Date.parse(doc?.lastActivityAt || doc?.$updatedAt || "");
  if (Number.isFinite(last) && now - last >= ABANDON_AFTER_MS) return "abandoned";
  if (doc?.leadStatus === "new") return "new";
  return "active";
}

function snapshotFromQuote(items, totals, couponCode) {
  const lines = (totals?.lineItems || []).map((line, index) => ({
    productId: line.productId,
    name: line.name,
    quantity: line.quantity,
    variationName: String(items?.[index]?.variationName || "").slice(0, 120),
    imageFileId: line.imageFileId || "",
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  }));
  return {
    lines,
    subtotal: totals?.subtotal || 0,
    discountAmount: totals?.discountAmount || 0,
    discountPercent: totals?.discountPercent || 0,
    total: totals?.totalUsd || 0,
    couponCode: couponCode || "",
    currency: "USD",
  };
}

function emptySnapshot() {
  return {
    lines: [],
    subtotal: 0,
    discountAmount: 0,
    discountPercent: 0,
    total: 0,
    couponCode: "",
    currency: "USD",
  };
}

async function priceCart(items, couponCode) {
  bridgeAppwriteEnv();
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return { totals: null, snapshot: emptySnapshot() };
  const totals = await computeCheckoutTotal({
    items: list,
    couponCode: couponCode || null,
  });
  return { totals, snapshot: snapshotFromQuote(list, totals, couponCode || "") };
}

export async function quoteCart(items, couponCode) {
  const code = String(couponCode || "").trim().toUpperCase();
  const priced = await priceCart(items, code || null);
  if (!priced.totals) {
    const err = new Error("Cart is empty");
    err.status = 400;
    throw err;
  }
  return {
    ok: true,
    couponCode: code,
    subtotal: priced.totals.subtotal,
    discountAmount: priced.totals.discountAmount,
    discountPercent: priced.totals.discountPercent,
    totalUsd: priced.totals.totalUsd,
  };
}

async function findCandidates(databases, databaseId, collectionId, { email, phone }) {
  const docs = [];
  const seen = new Set();
  const pull = async (attribute, value) => {
    if (!value) return;
    const page = await databases.listDocuments(databaseId, collectionId, [
      Query.equal(attribute, value),
      Query.limit(5),
    ]);
    for (const doc of page.documents || []) {
      if (seen.has(doc.$id)) continue;
      seen.add(doc.$id);
      docs.push(doc);
    }
  };
  await pull("email", email);
  await pull("phone", phone);
  return docs;
}

function contactRecord(email, phone, createdAt) {
  const data = {};
  if (email) data.email = email;
  if (phone) data.phone = phone;
  if (createdAt) data.createdAt = createdAt;
  return data;
}

export async function captureLead({ contact, marketingConsent, items, leadId, applyGet10 }) {
  const parsed = parseContact(contact);
  if (!parsed.ok) {
    const err = new Error(parsed.error);
    err.status = 400;
    throw err;
  }

  let couponApplied = false;
  let couponMessage = "";
  let snapshot = emptySnapshot();
  if (applyGet10) {
    try {
      const priced = await priceCart(items, OFFER_CODE);
      snapshot = priced.snapshot;
      if (priced.totals && priced.totals.discountPercent === 10) {
        couponApplied = true;
      } else {
        couponMessage = "GET10 is not available as a 10% discount right now.";
        const plain = await priceCart(items, null);
        snapshot = plain.snapshot;
      }
    } catch (err) {
      const msg = err?.message || "";
      couponMessage = msg.includes("Invalid coupon")
        ? "GET10 is not available right now. Checkout still works."
        : "We couldn't confirm the discount. Checkout still works.";
      try {
        const plain = await priceCart(items, null);
        snapshot = plain.snapshot;
      } catch {
        snapshot = emptySnapshot();
      }
    }
  } else {
    try {
      const plain = await priceCart(items, null);
      snapshot = plain.snapshot;
    } catch {
      snapshot = emptySnapshot();
    }
  }

  const now = new Date().toISOString();
  let saved = false;
  let savedLeadId = "";

  try {
    const { databases, databaseId, collectionId } = getDb();
    const docs = await findCandidates(databases, databaseId, collectionId, {
      email: parsed.email,
      phone: parsed.phone,
    });
    const choice = chooseExistingLead(docs, {
      leadId: "",
      email: parsed.email,
      phone: parsed.phone,
    });
    const existing = choice.doc;
    if (existing) {
      const data = contactRecord(
        existing.email ? "" : parsed.email,
        existing.phone ? "" : parsed.phone,
        existing.createdAt ? "" : existing.$createdAt || now
      );
      if (Object.keys(data).length > 0) {
        await databases.updateDocument(databaseId, collectionId, existing.$id, data);
      }
      saved = true;
      savedLeadId = existing.$id;
    } else {
      const doc = await databases.createDocument(
        databaseId,
        collectionId,
        ID.unique(),
        contactRecord(parsed.email, parsed.phone, now)
      );
      saved = true;
      savedLeadId = doc.$id;
    }
  } catch (err) {
    console.error("[leads] save failed", err?.code || err?.type || "error");
    saved = false;
  }

  return {
    saved,
    leadId: savedLeadId,
    couponApplied,
    couponCode: couponApplied ? OFFER_CODE : "",
    couponMessage,
    quote: {
      subtotal: snapshot.subtotal,
      discountAmount: snapshot.discountAmount,
      discountPercent: snapshot.discountPercent,
      totalUsd: snapshot.total,
    },
  };
}

export async function syncLead() {
  return { ok: true };
}

export async function markLeadPurchased({ orderNumber }) {
  return { ok: true, orderNumber: String(orderNumber || "") };
}

export async function restoreLeadCart() {
  return null;
}

export function toAdminLead(doc) {
  const cart = parseCart(doc.cartData);
  const status = displayLeadStatus(doc);
  const consent = Boolean(doc.marketingConsent);
  return {
    leadId: doc.$id || "",
    email: doc.email || "",
    phone: doc.phone || "",
    marketingConsent: consent,
    consentAt: doc.consentAt || "",
    consentChannel: doc.consentChannel || "",
    firstCapturedAt: doc.createdAt || doc.$createdAt || "",
    lastActivityAt: doc.lastActivityAt || doc.$updatedAt || "",
    status,
    checkoutStatus: doc.checkoutStatus || "none",
    orderNumber: doc.orderNumber || "",
    couponCode: cart.couponCode || "",
    subtotal: cart.subtotal || 0,
    discountAmount: cart.discountAmount || 0,
    discountPercent: cart.discountPercent || 0,
    total: cart.total || 0,
    lines: Array.isArray(cart.lines) ? cart.lines : [],
    recoveryToken: doc.recoveryToken || "",
    reminderEligible: consent && status === "abandoned",
    reminderSent: false,
  };
}

export async function listLeads() {
  const { databases, databaseId, collectionId } = getDb();
  const page = await databases.listDocuments(databaseId, collectionId, [
    Query.limit(100),
    Query.orderDesc("$updatedAt"),
  ]);
  return (page.documents || []).map(toAdminLead);
}
