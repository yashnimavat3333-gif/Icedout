const PAYPAL_API = "https://api-m.paypal.com";

function requireProductionPayPal() {
  const env = (process.env.PAYPAL_ENVIRONMENT || "").toLowerCase();
  if (env !== "production") {
    throw new Error("PayPal is configured for production only");
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
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

export async function createPayPalOrder({ amountUsd }) {
  const accessToken = await getPayPalAccessToken();
  const value = formatUsd(amountUsd);
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value,
          },
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.message || data.details?.[0]?.description || "PayPal create order failed"
    );
  }
  if (!data.id) throw new Error("PayPal create order failed");
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
    throw new Error(
      data.message || data.details?.[0]?.description || "PayPal capture failed"
    );
  }
  const status = data.status;
  if (status !== "COMPLETED") {
    throw new Error(`PayPal capture not completed (${status || "unknown"})`);
  }
  return data;
}

export { PAYPAL_API };
