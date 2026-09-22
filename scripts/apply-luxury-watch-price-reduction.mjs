/**
 * One-time idempotent Luxury Watch price reduction ($200 off final selling price).
 * Usage: node --env-file=.env scripts/apply-luxury-watch-price-reduction.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { Client, Databases, Query } from "node-appwrite";

const DRY_RUN = process.argv.includes("--dry-run");
const REDUCTION = 200;
const IDEMPOTENCY_TAG = "luxury-watch-final-minus-200-v1";
const TARGET_VARIANT_NAMES = new Set(["normal", "superclone"]);

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

function isLuxuryWatch(category) {
  return String(category || "")
    .trim()
    .toLowerCase() === "luxury watch";
}

function variantKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function hasIdempotencyTag(tags) {
  const list = Array.isArray(tags) ? tags : [];
  return list.includes(IDEMPOTENCY_TAG);
}

async function listAllLuxuryWatches() {
  const docs = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await db.listDocuments(databaseId, collectionId, [
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
  productsSkippedAlreadyApplied: 0,
  normalVariantsUpdated: 0,
  supercloneVariantsUpdated: 0,
  productsMissingSuperclone: [],
  flagged: [],
  examples: [],
  errors: [],
};

try {
  const products = await listAllLuxuryWatches();
  report.productsFound = products.length;

  for (const doc of products) {
    if (!isLuxuryWatch(doc.categories)) continue;

    const tags = Array.isArray(doc.tags) ? [...doc.tags] : [];
    if (hasIdempotencyTag(tags)) {
      report.productsSkippedAlreadyApplied++;
      continue;
    }

    const rawVars = Array.isArray(doc.variations) ? doc.variations : [];
    const parsed = rawVars.map(parseVar);
    if (!parsed.length || parsed.some((v) => !v)) {
      report.errors.push({ id: doc.$id, reason: "Invalid variations payload" });
      continue;
    }

    let changed = false;
    let blocked = false;
    const beforeAfter = { id: doc.$id, name: doc.name, variants: [] };
    const variantNames = parsed.map((v) => variantKey(v.name));
    if (!variantNames.includes("superclone")) {
      report.productsMissingSuperclone.push({ id: doc.$id, name: doc.name });
    }

    let normalDelta = 0;
    let supercloneDelta = 0;

    for (let i = 0; i < parsed.length; i++) {
      const v = parsed[i];
      const key = variantKey(v.name);
      if (!TARGET_VARIANT_NAMES.has(key)) continue;

      const currentFinal = finalPrice(v);
      if (currentFinal === null) {
        report.errors.push({
          id: doc.$id,
          variant: v.name,
          reason: "Invalid price",
        });
        continue;
      }

      const targetFinal = roundMoney(currentFinal - REDUCTION);
      if (targetFinal < 0) {
        report.flagged.push({
          id: doc.$id,
          name: doc.name,
          variant: v.name,
          currentFinal,
          reason: "Would become negative",
        });
        blocked = true;
        break;
      }

      const discountPct = Number(v.discount) || 0;
      const newBase = roundMoney(baseFromFinal(targetFinal, discountPct));

      beforeAfter.variants.push({
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
      changed = true;
      if (key === "normal") normalDelta++;
      if (key === "superclone") supercloneDelta++;
    }

    if (blocked || !changed) continue;

    const newVariations = parsed.map((v) => JSON.stringify(v));
    const newTags = [...tags, IDEMPOTENCY_TAG];

    if (report.examples.length < 3) report.examples.push(beforeAfter);

    if (DRY_RUN) {
      report.productsUpdated++;
      report.normalVariantsUpdated += normalDelta;
      report.supercloneVariantsUpdated += supercloneDelta;
      continue;
    }

    try {
      await writeDb.updateDocument(databaseId, collectionId, doc.$id, {
        variations: newVariations,
        tags: newTags,
      });
      report.productsUpdated++;
      report.normalVariantsUpdated += normalDelta;
      report.supercloneVariantsUpdated += supercloneDelta;
    } catch (err) {
      report.errors.push({
        id: doc.$id,
        reason: err.message || String(err),
      });
    }
  }
} catch (err) {
  console.error("Fatal:", err.message || err);
  if (err.code === 401 || err.type === "project_key_expired") {
    console.error(
      "\nAppwrite API key is missing or expired. Renew APPWRITE_API_KEY / VITE_APPWRITE_API_KEY in .env, then re-run."
    );
  }
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
