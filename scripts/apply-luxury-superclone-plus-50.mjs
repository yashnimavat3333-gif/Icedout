/**
 * +$50 on final customer price for Luxury Watch Superclone variants only.
 * Usage: node --env-file=.env scripts/apply-luxury-superclone-plus-50.mjs [--dry-run]
 */
import { Client, Databases, Query } from "node-appwrite";

const DRY_RUN = process.argv.includes("--dry-run");
const INCREASE = 50;
const IDEMPOTENCY_TAG = "luxury-superclone-final-plus-50-v1";
const SUPERCLONE = "superclone";

const endpoint =
  process.env.VITE_APPWRITE_URL || process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey =
  process.env.VITE_APPWRITE_API_KEY || process.env.VITE_APPWRITE_KEY;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const collectionId = process.env.VITE_APPWRITE_COLLECTION_ID;

const readClient = new Client().setEndpoint(endpoint).setProject(projectId);
const readDb = new Databases(readClient);
const writeClient = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);
const writeDb = new Databases(writeClient);

function parseVar(v) {
  if (typeof v === "object" && v) return { ...v };
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function finalPrice(v) {
  const p = Number(v.price);
  if (!Number.isFinite(p)) return null;
  const d = Number(v.discount) || 0;
  if (d > 0 && d < 100) return p * (1 - d / 100);
  return p;
}

function baseFromFinal(targetFinal, discountPct) {
  const d = Number(discountPct) || 0;
  if (d > 0 && d < 100) return targetFinal / (1 - d / 100);
  return targetFinal;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function variantKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function hasTag(tags) {
  return Array.isArray(tags) && tags.includes(IDEMPOTENCY_TAG);
}

async function listLuxuryWatches() {
  const docs = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await readDb.listDocuments(databaseId, collectionId, [
      Query.equal("categories", "Luxury Watch"),
      Query.limit(limit),
      Query.offset(offset),
    ]);
    docs.push(...res.documents);
    offset += res.documents.length;
    if (offset >= res.total || res.documents.length === 0) break;
  }
  return docs;
}

const report = {
  productsFound: 0,
  productsUpdated: 0,
  productsSkippedTagged: 0,
  productsWithoutSuperclone: 0,
  supercloneVariantsUpdated: 0,
  examples: [],
  errors: [],
};

const products = await listLuxuryWatches();
report.productsFound = products.length;

for (const doc of products) {
  const tags = Array.isArray(doc.tags) ? [...doc.tags] : [];
  if (hasTag(tags)) {
    report.productsSkippedTagged++;
    continue;
  }

  const parsed = (doc.variations || []).map(parseVar);
  if (!parsed.length || parsed.some((v) => !v)) {
    report.errors.push({ id: doc.$id, reason: "Invalid variations" });
    continue;
  }

  let changed = false;
  const example = { id: doc.$id, name: doc.name, superclone: null };

  for (const v of parsed) {
    if (variantKey(v.name) !== SUPERCLONE) continue;

    const currentFinal = finalPrice(v);
    if (currentFinal === null) {
      report.errors.push({
        id: doc.$id,
        variant: v.name,
        reason: "Invalid price",
      });
      continue;
    }

    const targetFinal = roundMoney(currentFinal + INCREASE);
    const discountPct = Number(v.discount) || 0;
    const newBase = roundMoney(baseFromFinal(targetFinal, discountPct));

    example.superclone = {
      before: {
        base: Number(v.price),
        discount: discountPct,
        final: roundMoney(currentFinal),
      },
      after: {
        base: newBase,
        discount: discountPct,
        final: targetFinal,
      },
    };

    v.price = newBase;
    changed = true;
    report.supercloneVariantsUpdated++;
  }

  if (!changed) {
    report.productsWithoutSuperclone++;
    continue;
  }

  if (report.examples.length < 3) report.examples.push(example);

  const newTags = [...tags, IDEMPOTENCY_TAG];

  if (DRY_RUN) {
    report.productsUpdated++;
    continue;
  }

  try {
    await writeDb.updateDocument(databaseId, collectionId, doc.$id, {
      variations: parsed.map((v) => JSON.stringify(v)),
      tags: newTags,
    });
    report.productsUpdated++;
  } catch (err) {
    report.errors.push({ id: doc.$id, reason: err.message || String(err) });
  }
}

console.log(JSON.stringify(report, null, 2));
