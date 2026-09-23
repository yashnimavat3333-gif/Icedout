import { Client, Databases, Query } from "node-appwrite";
import { computeCheckoutTotal } from "../api/_lib/computeCheckoutTotal.js";

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_URL)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.VITE_APPWRITE_API_KEY);
const db = new Databases(client);
const doc = (
  await db.listDocuments(
    process.env.VITE_APPWRITE_DATABASE_ID,
    process.env.VITE_APPWRITE_COLLECTION_ID,
    [Query.limit(1)]
  )
).documents[0];

const productId = doc["$id"];
const result = await computeCheckoutTotal(
  {
    items: [{ id: productId, quantity: 1, selectedVariation: "Normal", name: doc.name }],
    couponCode: "",
  },
  process.env
);
console.log(JSON.stringify(result, null, 2));
