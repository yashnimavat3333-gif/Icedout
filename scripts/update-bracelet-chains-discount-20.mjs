/**
 * Set variant discount from 15% to 20% for Bracelet and Chains only.
 * Usage: node --env-file=.env scripts/update-bracelet-chains-discount-20.mjs [--dry-run]
 */
import { Client, Databases, Query } from "node-appwrite";

const DRY_RUN = process.argv.includes("--dry-run");
const FROM_PCT = 15;
const TO_PCT = 20;
const TARGET_CATEGORIES = ["Bracelet", "Chains"];

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
  const d = Number(v.discount) || 0;
  if (d > 0 && d < 100) return p * (1 - d / 100);
  return p;
}

async function listCategory(category) {
  const docs = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await readDb.listDocuments(databaseId, collectionId, [
      Query.equal("categories", category),
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
  categories: TARGET_CATEGORIES,
  productsUpdated: 0,
  variantsUpdated: 0,
  variantsSkippedAlready20: 0,
  variantsSkippedOtherDiscount: 0,
  examples: [],
  errors: [],
};

for (const category of TARGET_CATEGORIES) {
  const products = await listCategory(category);
  for (const doc of products) {
    const rawVars = Array.isArray(doc.variations) ? doc.variations : [];
    const parsed = rawVars.map(parseVar);
    if (!parsed.length || parsed.some((v) => !v)) continue;

    let changed = false;
    const example = { id: doc.$id, category, name: doc.name, variants: [] };

    for (const v of parsed) {
      const d = Number(v.discount);
      if (d === TO_PCT) {
        report.variantsSkippedAlready20++;
        continue;
      }
      if (d !== FROM_PCT) {
        report.variantsSkippedOtherDiscount++;
        continue;
      }

      const beforeFinal = finalPrice(v);
      v.discount = TO_PCT;
      const afterFinal = finalPrice(v);

      example.variants.push({
        name: v.name,
        base: Number(v.price),
        beforeDiscount: FROM_PCT,
        afterDiscount: TO_PCT,
        beforeFinal: Math.round(beforeFinal * 100) / 100,
        afterFinal: Math.round(afterFinal * 100) / 100,
      });
      changed = true;
      report.variantsUpdated++;
    }

    if (!changed) continue;
    if (report.examples.length < 4) report.examples.push(example);

    if (DRY_RUN) {
      report.productsUpdated++;
      continue;
    }

    try {
      await writeDb.updateDocument(databaseId, collectionId, doc.$id, {
        variations: parsed.map((v) => JSON.stringify(v)),
      });
      report.productsUpdated++;
    } catch (err) {
      report.errors.push({ id: doc.$id, reason: err.message || String(err) });
    }
  }
}

console.log(JSON.stringify(report, null, 2));
