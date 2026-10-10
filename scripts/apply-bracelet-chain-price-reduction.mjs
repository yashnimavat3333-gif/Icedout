/**
 * Drop the customer-facing price on every Bracelet variant by $300
 * and every Chains variant by $150. Discount percent stays the same;
 * the stored base price is recalculated so the sale price lands on the new amount.
 * Usage: node --env-file=.env scripts/apply-bracelet-chain-price-reduction.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { Client, Databases, Query } from "node-appwrite";

const DRY_RUN = process.argv.includes("--dry-run");
const REDUCTIONS = {
  Bracelet: 300,
  Chains: 150,
};
const TAGS = {
  Bracelet: "bracelet-final-minus-300-2026-10-10",
  Chains: "chains-final-minus-150-2026-10-10",
};

function loadEnvFile() {
  try {
    const text = readFileSync(".env", "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* node --env-file may have loaded vars */
  }
}

loadEnvFile();

const endpoint =
  process.env.VITE_APPWRITE_URL ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT;
const projectId =
  process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const apiKey =
  process.env.VITE_APPWRITE_API_KEY ||
  process.env.VITE_APPWRITE_KEY ||
  process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.VITE_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID;
const collectionId =
  process.env.VITE_APPWRITE_COLLECTION_ID || process.env.APPWRITE_COLLECTION_ID;

if (!endpoint || !projectId || !databaseId || !collectionId) {
  console.error("Missing Appwrite configuration in environment.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId);
const db = new Databases(client);
const writeClient = new Client().setEndpoint(endpoint).setProject(projectId);
if (apiKey) writeClient.setKey(apiKey);
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

function hasTag(tags, tag) {
  return Array.isArray(tags) && tags.includes(tag);
}

async function listCategory(category) {
  const docs = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await db.listDocuments(databaseId, collectionId, [
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
  dryRun: DRY_RUN,
  byCategory: {},
  examples: [],
  flagged: [],
  errors: [],
};

for (const [category, reduction] of Object.entries(REDUCTIONS)) {
  const tag = TAGS[category];
  const summary = {
    productsFound: 0,
    productsUpdated: 0,
    productsSkippedAlreadyApplied: 0,
    variantsUpdated: 0,
    productLevelPricesUpdated: 0,
  };
  report.byCategory[category] = summary;

  const products = await listCategory(category);
  summary.productsFound = products.length;

  for (const doc of products) {
    const tags = Array.isArray(doc.tags) ? [...doc.tags] : [];
    if (hasTag(tags, tag)) {
      summary.productsSkippedAlreadyApplied++;
      continue;
    }

    const rawVars = Array.isArray(doc.variations) ? doc.variations : [];
    const usingVars = rawVars.length > 0 && doc.useVariations !== false;
    const parsed = rawVars.map(parseVar);

    if (usingVars && parsed.some((v) => !v)) {
      report.errors.push({ id: doc.$id, category, reason: "Invalid variations" });
      continue;
    }

    let blocked = false;
    const example = {
      id: doc.$id,
      category,
      name: doc.name,
      reduction,
      variants: [],
    };

    if (usingVars) {
      for (const v of parsed) {
        const currentFinal = finalPrice(v);
        if (currentFinal === null) {
          report.errors.push({
            id: doc.$id,
            category,
            variant: v.name,
            reason: "Invalid price",
          });
          blocked = true;
          break;
        }

        const targetFinal = roundMoney(currentFinal - reduction);
        if (targetFinal <= 0) {
          report.flagged.push({
            id: doc.$id,
            category,
            name: doc.name,
            variant: v.name,
            currentFinal: roundMoney(currentFinal),
            reason: "Sale price would be zero or negative",
          });
          blocked = true;
          break;
        }

        const discountPct = Number(v.discount) || 0;
        const newBase = roundMoney(baseFromFinal(targetFinal, discountPct));
        example.variants.push({
          name: v.name,
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
        });
        v.price = newBase;
      }
    } else {
      const current = Number(doc.price);
      if (!Number.isFinite(current)) {
        report.errors.push({
          id: doc.$id,
          category,
          reason: "No variations and no product price",
        });
        continue;
      }
      const target = roundMoney(current - reduction);
      if (target <= 0) {
        report.flagged.push({
          id: doc.$id,
          category,
          name: doc.name,
          currentFinal: current,
          reason: "Sale price would be zero or negative",
        });
        continue;
      }
      example.productPrice = { before: current, after: target };
    }

    if (blocked) continue;
    if (usingVars && example.variants.length === 0) continue;

    if (report.examples.length < 6) report.examples.push(example);

    const payload = { tags: [...tags, tag] };
    if (usingVars) {
      payload.variations = parsed.map((v) => JSON.stringify(v));
    } else {
      payload.price = example.productPrice.after;
    }

    if (DRY_RUN) {
      summary.productsUpdated++;
      if (usingVars) summary.variantsUpdated += example.variants.length;
      else summary.productLevelPricesUpdated++;
      continue;
    }

    let saved = false;
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await writeDb.updateDocument(databaseId, collectionId, doc.$id, payload);
        saved = true;
        break;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }

    if (saved) {
      summary.productsUpdated++;
      if (usingVars) summary.variantsUpdated += example.variants.length;
      else summary.productLevelPricesUpdated++;
    } else {
      report.errors.push({
        id: doc.$id,
        category,
        reason: lastError?.message || String(lastError),
      });
    }
  }
}

console.log(JSON.stringify(report, null, 2));
