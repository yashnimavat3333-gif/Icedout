/** Shared PayPal + Appwrite checkout helpers (browser-safe). */

export function cartLinesForServerQuote(cartItems) {
  return (Array.isArray(cartItems) ? cartItems : []).map((it) => ({
    id: it.$id ?? it.id,
    name: it.name,
    quantity: it.quantity ?? 1,
    selectedVariation: it.selectedVariation,
    selectedSize: it.selectedSize,
    size: it.selectedSize,
  }));
}

export async function fetchServerCheckoutQuote(cartItems, couponCode) {
  const res = await fetch("/api/checkout/compute-total", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      couponCode: couponCode || "",
      items: cartLinesForServerQuote(cartItems),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Unable to calculate order total on the server.");
  }
  return data;
}

export function parseFunctionResponse(exec) {
  try {
    return JSON.parse(exec.responseBody || "{}");
  } catch {
    return exec.responseBody || {};
  }
}

export function extractPayPalOrderId(createRes) {
  return (
    createRes?.paypal?.orderId ||
    createRes?.paypal?.order_id ||
    createRes?.orderId ||
    createRes?.paypal_order_id ||
    createRes?.id ||
    null
  );
}
