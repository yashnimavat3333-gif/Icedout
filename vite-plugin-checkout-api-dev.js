import { loadEnv } from "vite";
import { computeCheckoutTotal } from "./api/_lib/computeCheckoutTotal.js";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/** Local dev: serve /api/checkout/compute-total without vercel dev */
export function checkoutApiDevPlugin() {
  return {
    name: "checkout-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || "").split("?")[0];
        if (pathname !== "/api/checkout/compute-total") return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const env = loadEnv(server.config.mode, server.config.root, "");
          Object.assign(process.env, env);

          const body = await readJsonBody(req);
          const result = await computeCheckoutTotal(body, process.env);
          if (!result.ok) {
            res.statusCode = result.status || 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: result.error }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: err?.message || "Failed to compute checkout total",
            })
          );
        }
      });
    },
  };
}
