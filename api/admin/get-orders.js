import { Client, Databases, Query } from "node-appwrite";

let client = null;
let databases = null;

function getClient() {
  if (client && databases) return { client, databases };

  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing Appwrite env vars. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY."
    );
  }

  client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  databases = new Databases(client);
  return { client, databases };
}

function verifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const auth = req.headers["authorization"] || req.headers["Authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === secret;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_COLLECTION_ID;

  if (!databaseId || !collectionId) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { databases: db } = getClient();

    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const offset = parseInt(req.query.offset) || 0;

    const queries = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    const result = await db.listDocuments(databaseId, collectionId, queries);

    return res.status(200).json({
      success: true,
      orders: result.documents,
      total: result.total,
    });
  } catch (error) {
    console.error("[admin/get-orders] Error:", error?.message);
    return res.status(500).json({
      error: error?.message || "Failed to fetch orders",
    });
  }
}
