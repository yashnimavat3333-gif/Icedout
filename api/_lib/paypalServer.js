const PAYPAL_API = "https://api-m.paypal.com";

function trimEnv(value) {
  if (value == null) return "";
  return String(value).trim().replace(/^["']|["']$/g, "");
}

function requireProductionPayPal() {
  const env = trimEnv(process.env.PAYPAL_ENVIRONMENT).toLowerCase();
  if (env !== "production") {
    throw new Error("PayPal is configured for production only");
  }
  const clientId = trimEnv(
    process.env.PAYPAL_CLIENT_ID ||
      process.env.PAYPAL_CLINT_ID ||
      process.env.VITE_PAYPAL_CLIENT_ID
  );
  const clientSecret = trimEnv(
    process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_CLINT_SECRET
  );
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }
  return { clientId, clientSecret };
}

export async function getPayPalAccessToken() {
  const { clientId, clientSecret } = requireProductionPayPal();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "PayPal auth failed");
  }
  return data.access_token;
}

function formatUsd(amount) {
  return roundMoney(amount).toFixed(2);
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function buildPayPalOrderBody({ amountUsd, iceyOrderNumber }) {
  const label = String(iceyOrderNumber || "").trim().slice(0, 127);
  if (!/^ICEY-\d+$/i.test(label)) throw new Error("Missing ICEY order reference");
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: formatUsd(amountUsd),
        },
        custom_id: label,
        invoice_id: label,
        description: "ICEYOUT order",
      },
    ],
  };
}

export async function createPayPalOrder({ amountUsd, iceyOrderNumber }) {
  const accessToken = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayPalOrderBody({ amountUsd, iceyOrderNumber })),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      data.message || data.details?.[0]?.description || "PayPal create order failed"
    );
    error.paypalIssue = data.details?.[0]?.issue || "";
    throw error;
  }
  if (!data.id) throw new Error("PayPal create order failed");
  return data;
}

export async function getPayPalOrder(orderId) {
  const accessToken = await getPayPalAccessToken();
  const id = String(orderId || "").trim();
  if (!id) throw new Error("Missing PayPal order id");
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "PayPal order lookup failed");
  }
  return data;
}

export async function getPayPalCapture(captureId) {
  const accessToken = await getPayPalAccessToken();
  const id = String(captureId || "").trim();
  if (!id) throw new Error("Missing PayPal capture id");
  const res = await fetch(`${PAYPAL_API}/v2/payments/captures/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "PayPal capture lookup failed");
  }
  return data;
}

export async function capturePayPalOrder(orderId) {
  const accessToken = await getPayPalAccessToken();
  const id = String(orderId || "").trim();
  if (!id) throw new Error("Missing PayPal order id");

  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      data.message || data.details?.[0]?.description || "PayPal capture failed"
    );
    error.paypalIssue = data.details?.[0]?.issue || "";
    throw error;
  }
  const status = data.status;
  if (status !== "COMPLETED") {
    throw new Error(`PayPal capture not completed (${status || "unknown"})`);
  }
  return data;
}

export { PAYPAL_API };
