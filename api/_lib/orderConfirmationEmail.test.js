import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderConfirmation, confirmationRecipient, deliverOrderConfirmation } from "./orderConfirmationEmail.js";

function paidOrder() {
  return {
    shipping_full_name: "Ava Stone",
    shippingAddress: "1 Main Street, New York, USA",
    totalAmount: 661.75,
    amount: 661,
    paypal_capture_id: "CAP1",
    items: JSON.stringify({
      orderNumber: "ICEY-10050",
      customerEmail: "ava@example.com",
      lines: [
        { name: "Rolex Datejust", variationName: "Normal", quantity: 1, unitPrice: 661.75, lineTotal: 661.75 },
        { name: "FREE PROMOTIONAL GIFT", quantity: 1, unitPrice: 0, lineTotal: 0, gift: true },
      ],
    }),
  };
}

test("confirmation uses the checkout email and the paid order details", () => {
  const message = buildOrderConfirmation({ order: paidOrder(), payerEmail: "other@example.com" });
  assert.equal(message.to, "ava@example.com");
  assert.match(message.from, /iceyoutleagacy@gmail.com/);
  assert.match(message.subject, /ICEY-10050/);
  assert.match(message.text, /Rolex Datejust/);
  assert.match(message.text, /FREE PROMOTIONAL GIFT/);
  assert.match(message.text, /\$0\.00/);
  assert.match(message.text, /\$661\.75/);
  assert.match(message.text, /CAP1/);
  assert.equal(message.text.includes("before ordering"), false);
});

test("PayPal email is used when the stored order has no email", () => {
  const order = paidOrder();
  const stored = JSON.parse(order.items);
  delete stored.customerEmail;
  order.items = JSON.stringify(stored);
  assert.equal(confirmationRecipient(order, "payer@example.com"), "payer@example.com");
  assert.equal(buildOrderConfirmation({ order, payerEmail: "not-an-email" }), null);
});

test("email is not sent when Gmail is not configured", async () => {
  const previous = process.env.ORDER_EMAIL_APP_PASSWORD;
  delete process.env.ORDER_EMAIL_APP_PASSWORD;
  const result = await deliverOrderConfirmation({ order: paidOrder(), payerEmail: "payer@example.com" });
  assert.deepEqual(result, { sent: false, reason: "not-configured" });
  if (previous) process.env.ORDER_EMAIL_APP_PASSWORD = previous;
});

test("a configured sender sends one confirmation and does not throw on failure", async () => {
  let sent = 0;
  const result = await deliverOrderConfirmation({
    order: paidOrder(),
    transport: {
      async sendMail(message) {
        sent += 1;
        assert.equal(message.to, "ava@example.com");
        assert.match(message.subject, /ICEY-10050/);
      },
    },
  });
  assert.equal(result.sent, true);
  assert.equal(sent, 1);

  const failed = await deliverOrderConfirmation({
    order: paidOrder(),
    transport: {
      async sendMail() {
        throw new Error("mailbox unavailable");
      },
    },
  });
  assert.equal(failed.sent, false);
  assert.equal(failed.reason, "send-failed");
});
