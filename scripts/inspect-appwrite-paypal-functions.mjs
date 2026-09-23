/**
 * Lists Appwrite PayPal-related functions and variable NAMES only (no values).
 * Usage: node --env-file=.env scripts/inspect-appwrite-paypal-functions.mjs
 */
import { Client, Functions } from "node-appwrite";

const endpoint =
  process.env.VITE_APPWRITE_URL || process.env.VITE_APPWRITE_ENDPOINT;
const project = process.env.VITE_APPWRITE_PROJECT_ID;
const key = process.env.VITE_APPWRITE_API_KEY || process.env.VITE_APPWRITE_KEY;

const createId = process.env.VITE_CREATE_ORDER_FUNCTION_ID;
const captureId = process.env.VITE_CAPTURE_ORDER_FUNCTION_ID;
const verifyId = process.env.VITE_VERIFY_PAYMENT_FUNCTION_ID;

const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const functions = new Functions(client);

async function listVariableKeys(functionId) {
  try {
    const vars = await functions.listVariables(functionId);
    return (vars.variables || []).map((v) => ({
      key: v.key,
      secret: Boolean(v.secret),
    }));
  } catch (e) {
    return { error: e.message, code: e.code };
  }
}

async function main() {
  const list = await functions.list();
  console.log("=== All functions (id | name | runtime) ===");
  for (const f of list.functions || []) {
    console.log(`${f.$id} | ${f.name} | ${f.runtime}`);
  }

  const targets = [
    ["VITE_CREATE_ORDER_FUNCTION_ID", createId],
    ["VITE_CAPTURE_ORDER_FUNCTION_ID", captureId],
    ["VITE_VERIFY_PAYMENT_FUNCTION_ID", verifyId],
  ];

  for (const [envName, id] of targets) {
    console.log(`\n=== ${envName} => ${id || "(not set)"} ===`);
    if (!id) continue;
    try {
      const g = await functions.get(id);
      console.log("name:", g.name);
      console.log("runtime:", g.runtime);
      console.log("entrypoint:", g.entrypoint);
      console.log("execute roles:", JSON.stringify(g.execute || []));
      const keys = await listVariableKeys(id);
      if (keys.error) {
        console.log("variables: (could not list)", keys.error);
      } else {
        console.log("variable keys:");
        for (const k of keys) {
          console.log(`  - ${k.key}${k.secret ? " (secret)" : ""}`);
        }
      }
    } catch (e) {
      console.log("get failed:", e.code, e.message);
    }
  }

  // Probe create function for sandbox vs live hint (no secrets in output)
  if (createId) {
    console.log("\n=== Create function probe (PayPal mode hint only) ===");
    try {
      const exec = await functions.createExecution(
        createId,
        JSON.stringify({
          items: [{ id: "probe", name: "Probe", price: 1, quantity: 1 }],
          amount: "1.00",
          currency: "USD",
          shipping: {
            full_name: "Test",
            phone: "+15551234567",
            line_1: "1 St",
            city: "NYC",
            postal_code: "10001",
            country: "US",
          },
          payment_method: "paypal",
        }),
        false,
        "/",
        "POST"
      );
      const body = (exec.responseBody || "").slice(0, 800);
      const sandboxHint = /sandbox\.paypal/i.test(body);
      const liveHint = /api\.paypal\.com/i.test(body) && !/sandbox/i.test(body);
      console.log("execution status:", exec.status, "http:", exec.responseStatusCode);
      console.log("response mentions sandbox.paypal:", sandboxHint);
      console.log("response snippet (redacted):", body.replace(/[A-Za-z0-9_-]{20,}/g, "[REDACTED]"));
    } catch (e) {
      console.log("probe error:", e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
