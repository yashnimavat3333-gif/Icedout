import { Client, Databases, Query } from "node-appwrite";

function parseOneVariation(entry) {
  if (!entry) return null;
  if (typeof entry === "object") return entry;
  if (typeof entry === "string") {
    try {
      return JSON.parse(entry);
    } catch {
      return null;
    }
  }
  return null;
}

function parseVariations(raw) {
  if (Array.isArray(raw)) {
    return raw.map(parseOneVariation).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map(parseOneVariation).filter(Boolean)
        : parseOneVariation(parsed)
          ? [parseOneVariation(parsed)]
          : [];
    } catch {
      return [];
    }
  }
  return [];
}

function variationLabel(v) {
  if (!v || typeof v !== "object") return "";
  return String(v.name ?? v.title ?? v.label ?? "").trim().toLowerCase();
}

function unitPriceFromVariation(v) {
  if (!v) return 0;
  const varPrice = Number(v.price) || 0;
  const varDiscountPct = Number(v.discount) || 0;
  if (varDiscountPct > 0 && varDiscountPct < 100) {
    return Math.max(0, varPrice * (1 - varDiscountPct / 100));
  }
  return varPrice;
}

function resolveUnitPrice(productDoc, line) {
  const variations = parseVariations(productDoc?.variations);
  const sel = line.selectedVariation ?? line.variation;
  const selName =
    typeof sel === "string"
      ? sel
      : sel && typeof sel === "object"
        ? sel.name ?? sel.title ?? sel.label ?? ""
        : "";

  let variation = null;
  if (selName && variations.length) {
    const norm = String(selName).trim().toLowerCase();
    variation =
      variations.find((v) => variationLabel(v) === norm) ||
      variations.find((v) => variationLabel(v).includes(norm)) ||
      null;
  }
  if (!variation && typeof line.variationIndex === "number" && variations[line.variationIndex]) {
    variation = variations[line.variationIndex];
  }
  if (!variation && variations.length === 1) {
    variation = variations[0];
  }
  if (variation) return unitPriceFromVariation(variation);

  const base = Number(productDoc?.price) || 0;
  const original = Number(productDoc?.originalPrice) || null;
  if (original && original > base) return base;
  return base;
}

function getAppwrite(env) {
  const endpoint = env.APPWRITE_ENDPOINT || env.VITE_APPWRITE_URL || env.VITE_APPWRITE_ENDPOINT;
  const projectId = env.APPWRITE_PROJECT_ID || env.VITE_APPWRITE_PROJECT_ID;
  const apiKey = env.APPWRITE_API_KEY || env.VITE_APPWRITE_API_KEY || env.VITE_APPWRITE_KEY;
  const databaseId = env.APPWRITE_DATABASE_ID || env.VITE_APPWRITE_DATABASE_ID;
  const productsCollectionId =
    env.APPWRITE_PRODUCTS_COLLECTION_ID ||
    env.VITE_APPWRITE_COLLECTION_ID;

  if (!endpoint || !projectId || !apiKey || !databaseId || !productsCollectionId) {
    throw new Error(
      "Missing Appwrite configuration for checkout total (endpoint, project, API key, database, products collection)."
    );
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return {
    databases: new Databases(client),
    databaseId,
    productsCollectionId,
    couponsCollectionId:
      env.APPWRITE_COUPONS_COLLECTION_ID ||
      env.VITE_APPWRITE_COUPONS_COLLECTION_ID ||
      "coupons",
  };
}

/**
 * Server-side checkout total from Appwrite catalog prices (not client cart prices).
 */
export async function computeCheckoutTotal(body, env = process.env) {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return { ok: false, status: 400, error: "Cart is empty" };
  }

  const { databases, databaseId, productsCollectionId, couponsCollectionId } = getAppwrite(env);

  let subtotal = 0;
  const normalizedLines = [];

  for (const line of items) {
    const productId = String(line.id ?? line.$id ?? "").trim();
    const quantity = Math.max(1, parseInt(line.quantity, 10) || 1);
    if (!productId) {
      return { ok: false, status: 400, error: "Each line item must include a product id" };
    }

    const doc = await databases.getDocument(databaseId, productsCollectionId, productId);
    const unitPrice = resolveUnitPrice(doc, line);
    if (!(unitPrice > 0)) {
      return { ok: false, status: 400, error: `Invalid price for product ${productId}` };
    }

    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    normalizedLines.push({
      id: productId,
      name: String(line.name || doc.name || "Item"),
      price: Number(unitPrice.toFixed(2)),
      quantity,
      size: String(line.size ?? line.selectedSize ?? ""),
      variation: String(
        typeof line.selectedVariation === "object"
          ? line.selectedVariation?.name ?? ""
          : line.selectedVariation ?? line.variation ?? ""
      ),
    });
  }

  let discountAmount = 0;
  let discountPercent = 0;
  let coupon = null;
  const couponCode = String(body?.couponCode ?? "").trim().toUpperCase();

  if (couponCode) {
    const list = await databases.listDocuments(databaseId, couponsCollectionId, [
      Query.equal("code", couponCode),
      Query.equal("active", true),
      Query.limit(1),
    ]);
    const couponDoc = list.documents?.[0];
    if (!couponDoc) {
      return { ok: false, status: 400, error: "Invalid or inactive coupon" };
    }
    discountPercent = Math.min(100, Math.max(0, Number(couponDoc.discount_percent) || 0));
    discountAmount = (subtotal * discountPercent) / 100;
    if (discountAmount > subtotal) discountAmount = subtotal;
    coupon = {
      $id: couponDoc.$id,
      code: couponDoc.code,
      discountPercent,
    };
  }

  const finalAmount = Math.max(0, subtotal - discountAmount);
  const shippingAmount = 0;

  return {
    ok: true,
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    discountPercent,
    shippingAmount,
    finalAmount: Number(finalAmount.toFixed(2)),
    amountFormatted: finalAmount.toFixed(2),
    currency: "USD",
    items: normalizedLines,
    coupon,
  };
}
