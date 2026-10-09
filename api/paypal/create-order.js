import { computeCheckoutTotal } from "../_lib/computeCheckoutTotal.js";
import { createPayPalOrder } from "../_lib/paypalServer.js";
import { nextIceyNumber, saveIceyOrder, logOrderRecovery } from "../_lib/iceyOrder.js";

function customerFrom(body) {
  return {
    customerName: String(body.customerName || "").trim(),
    customerPhone: String(body.customerPhone || "").trim(),
    shippingAddress: String(body.shippingAddress || "").trim(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const totals = await computeCheckoutTotal({
      items: body.items,
      couponCode: body.couponCode || null,
    });
    if (!(totals.totalUsd > 0)) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    let sequence = 10000 + Math.floor(Math.random() * 89999);
    try {
      sequence = (await nextIceyNumber()).sequence;
    } catch (err) {
      logOrderRecovery("number", { message: err?.message || "number failed" });
    }

    const imageFileId = totals.lineItems.find((line) => line.imageFileId)?.imageFileId || "";
    const customer = customerFrom(body);
    let order = null;
    let orderNumber = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      orderNumber = `ICEY-${sequence}`;
      const pendingOrder = {
        orderNumber,
        sequence,
        imageFileId,
        lineItems: totals.lineItems,
        ...customer,
        amount: totals.totalUsd,
        orderStatus: "pending",
        paypalStatus: "CREATED",
        paypalOrderId: "",
        paypalCaptureId: "",
      };
      try {
        await saveIceyOrder(pendingOrder);
      } catch (err) {
        logOrderRecovery("pending-save", {
          orderNumber,
          amount: totals.totalUsd,
          message: err?.message || "save failed",
        });
        return res.status(500).json({ error: "Could not create PayPal order" });
      }
      try {
        order = await createPayPalOrder({
          amountUsd: totals.totalUsd,
          iceyOrderNumber: orderNumber,
        });
        break;
      } catch (err) {
        if (err?.paypalIssue === "DUPLICATE_INVOICE_ID" && attempt < 4) {
          sequence += 1;
          continue;
        }
        throw err;
      }
    }

    try {
      await saveIceyOrder({
        orderNumber,
        sequence,
        imageFileId,
        lineItems: totals.lineItems,
        ...customer,
        amount: totals.totalUsd,
        orderStatus: "pending",
        paypalStatus: "CREATED",
        paypalOrderId: order.id,
        paypalCaptureId: "",
      });
    } catch (err) {
      logOrderRecovery("pending-paypal-id", {
        orderNumber,
        paypalOrderId: order.id,
        amount: totals.totalUsd,
        message: err?.message || "save failed",
      });
    }

    return res.status(200).json({ id: order.id, orderNumber });
  } catch (err) {
    console.error("[paypal/create-order]", err?.message || err);
    const msg = err?.message || "";
    if (
      msg.includes("Invalid coupon") ||
      msg.includes("Cart is empty") ||
      msg.includes("Invalid cart")
    ) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes("Missing Appwrite") || msg.includes("Order storage")) {
      return res.status(500).json({ error: "Could not create PayPal order" });
    }
    return res.status(500).json({ error: "Could not create PayPal order" });
  }
}
