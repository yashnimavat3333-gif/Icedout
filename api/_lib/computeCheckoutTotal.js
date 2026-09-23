import { Client, Databases, Query } from "node-appwrite";

function getAppwrite() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const productsCollectionId =
    process.env.APPWRITE_PRODUCTS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_COLLECTION_ID;
  const couponsCollectionId =
    process.env.APPWRITE_COUPONS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_COUPONS_COLLECTION_ID ||
    "coupons";

  if (!endpoint || !projectId || !apiKey || !databaseId || !productsCollectionId) {
    throw new Error("Missing Appwrite configuration for checkout total");
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  const databases = new Databases(client);

  return { databases, databaseId, productsCollectionId, couponsCollectionId };
}

function parseVariations(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function unitPriceFromProduct(doc, variationName) {
  const variations = parseVariations(doc.variations);
  let v = null;
  if (variationName && variations.length) {
    const key = String(variationName).trim().toLowerCase();
    v = variations.find((x) => {
      const n = String(x.name || x.title || "").trim().toLowerCase();
      return n && n === key;
    });
  }
  if (v && v.price !== undefined && v.price !== null && v.price !== "") {
    const varPrice = Number(v.price) || 0;
    const varDiscountPct = Number(v.discount) || 0;
    if (varDiscountPct > 0 && varDiscountPct < 100) {
      return Math.max(0, varPrice * (1 - varDiscountPct / 100));
    }
    return varPrice;
  }
  return Number(doc?.price) || 0;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Server-authoritative checkout total (matches checkout: subtotal − coupon, free shipping).
 * @param {{ items: { productId: string, quantity: number, variationName?: string|null }[], couponCode?: string|null }} input
 */
export async function computeCheckoutTotal({ items, couponCode }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty");
  }

  const { databases, databaseId, productsCollectionId, couponsCollectionId } =
    getAppwrite();

  let subtotal = 0;
  const lineItems = [];

  for (const line of items) {
    const productId = String(line?.productId || "").trim();
    const quantity = Math.max(1, Math.floor(Number(line?.quantity) || 1));
    if (!productId) throw new Error("Invalid cart line");

    const doc = await databases.getDocument(
      databaseId,
      productsCollectionId,
      productId
    );
    const unit = unitPriceFromProduct(doc, line.variationName || null);
    const lineTotal = roundMoney(unit * quantity);
    subtotal += lineTotal;
    lineItems.push({
      productId,
      name: doc.name || "Item",
      quantity,
      unitPrice: unit,
      lineTotal,
    });
  }

  subtotal = roundMoney(subtotal);

  let discountAmount = 0;
  let discountPercent = 0;
  const code = (couponCode || "").trim().toUpperCase();

  if (code) {
    const response = await databases.listDocuments(
      databaseId,
      couponsCollectionId,
      [Query.equal("code", code), Query.equal("active", true)]
    );
    const coupons = response?.documents || [];
    if (coupons.length === 0) throw new Error("Invalid coupon code");
    const coupon = coupons[0];
    const dp = Number(coupon.discount_percent);
    if (!Number.isFinite(dp) || dp < 0 || dp > 100) {
      throw new Error("Invalid discount configuration");
    }
    discountPercent = dp;
    discountAmount = roundMoney((subtotal * dp) / 100);
    if (discountAmount > subtotal) discountAmount = subtotal;
  }

  const totalUsd = roundMoney(Math.max(0, subtotal - discountAmount));

  return {
    subtotal,
    discountAmount,
    discountPercent,
    totalUsd,
    currency: "USD",
    lineItems,
  };
}
