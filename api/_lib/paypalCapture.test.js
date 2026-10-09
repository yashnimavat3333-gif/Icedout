import test from "node:test";
import assert from "node:assert/strict";
import {
  factsFromVerifiedOrder,
  loadCompletedCapture,
  matchIceyDocument,
  paymentDecision,
  recoveryEligibility,
} from "./paypalCapture.js";
import { persistVerifiedCapture, shouldPreservePaidOrder } from "./iceyOrder.js";
import { buildPayPalOrderBody } from "./paypalServer.js";

const IMAGE_ID = "abcdef0123456789abcd";

function paypalOrder() {
  return {
    id: "PAYPALORDER1",
    status: "COMPLETED",
    payer: {
      name: { given_name: "Ava", surname: "Stone" },
      email_address: "customer@example.com",
    },
    purchase_units: [
      {
        custom_id: "ICEY-10050",
        invoice_id: "ICEY-10050",
        description: `ICEY-10050 ${IMAGE_ID}`,
        payments: {
          captures: [
            {
              id: "CAP1",
              status: "COMPLETED",
              amount: { currency_code: "USD", value: "120.00" },
            },
          ],
        },
      },
    ],
  };
}

function memoryDb(initial = []) {
  const docs = initial.map((doc) => ({ ...doc }));
  return {
    docs,
    databases: {
      async listDocuments() {
        return { documents: docs };
      },
      async createDocument(_databaseId, _collectionId, id, data) {
        const doc = { $id: id, ...data };
        docs.push(doc);
        return doc;
      },
      async updateDocument(_databaseId, _collectionId, id, data) {
        const doc = docs.find((item) => item.$id === id);
        Object.assign(doc, data);
        return doc;
      },
    },
    databaseId: "db",
    collectionId: "order",
  };
}

test("verified capture keeps the PayPal amount and does not invent product lines", () => {
  const facts = factsFromVerifiedOrder(paypalOrder(), "CAP1");
  assert.equal(facts.orderNumber, "ICEY-10050");
  assert.equal(facts.amount, 120);
  assert.equal(facts.imageFileId, IMAGE_ID);
  assert.deepEqual(facts.lineItems, []);
  assert.equal(JSON.stringify(facts).includes("customer@example.com"), false);
  assert.equal(factsFromVerifiedOrder(paypalOrder(), "OTHER"), null);
  const unlabeled = paypalOrder();
  delete unlabeled.purchase_units[0].custom_id;
  delete unlabeled.purchase_units[0].invoice_id;
  assert.equal(factsFromVerifiedOrder(unlabeled, "CAP1"), null);
});

test("a missing order is not created from PayPal alone", async () => {
  const historical = {
    $id: "old",
    orderId: 1771463573709,
    orderStatus: "pending",
    paypal_status: "none",
    items: JSON.stringify({ orderNumber: "ICEY-10050", lines: [{ name: "Old", quantity: 9 }] }),
    amount: 919,
  };
  const db = memoryDb([historical]);
  const facts = factsFromVerifiedOrder(paypalOrder(), "CAP1");
  const result = await persistVerifiedCapture(db, facts, "2026-10-09T00:00:00.000Z");
  assert.equal(result.action, "missing");
  assert.equal(db.docs.length, 1);
  assert.equal(db.docs[0].orderStatus, "pending");
  assert.equal(db.docs[0].amount, 919);
});

test("an existing pending order is marked paid without replacing its product lines", async () => {
  const items = JSON.stringify({
    orderNumber: "ICEY-10050",
    imageFileId: IMAGE_ID,
    lines: [{ productId: "p1", name: "Watch", quantity: 2, unitPrice: 60, lineTotal: 120 }],
  });
  const db = memoryDb([
    {
      $id: "pending1",
      orderId: 10050,
      orderStatus: "pending",
      paypal_status: "CREATED",
      paypal_order_id: "PAYPALORDER1",
      paypal_capture_id: "",
      items,
      amount: 120,
    },
  ]);
  const facts = factsFromVerifiedOrder(paypalOrder(), "CAP1");
  const result = await persistVerifiedCapture(db, facts);
  const again = await persistVerifiedCapture(db, facts);
  assert.equal(result.action, "updated");
  assert.equal(again.action, "duplicate");
  assert.equal(db.docs.length, 1);
  assert.equal(db.docs[0].orderStatus, "paid");
  assert.equal(db.docs[0].paypal_status, "COMPLETED");
  assert.equal(db.docs[0].items, items);
});

test("an incomplete or mismatched PayPal order is not marked paid", () => {
  const pending = {
    $id: "pending1",
    orderId: 10050,
    orderStatus: "pending",
    paypal_status: "CREATED",
    paypal_order_id: "PAYPALORDER1",
    paypal_capture_id: "",
    items: JSON.stringify({ orderNumber: "ICEY-10050", lines: [{ name: "Watch", quantity: 2 }] }),
    amount: 120,
  };
  assert.equal(recoveryEligibility(pending), "eligible");
  assert.equal(recoveryEligibility({ ...pending, orderStatus: "paid", paypal_status: "COMPLETED" }), "already");
  assert.equal(recoveryEligibility({ ...pending, paypal_order_id: "" }), "ineligible");
  assert.equal(recoveryEligibility({ ...pending, orderId: 1771463573709 }), "ineligible");

  const unpaid = paypalOrder();
  unpaid.status = "APPROVED";
  unpaid.purchase_units[0].payments.captures[0].status = "PENDING";
  assert.equal(factsFromVerifiedOrder(unpaid), null);
  assert.equal(paymentDecision(pending, factsFromVerifiedOrder(paypalOrder(), "CAP1") && { ...factsFromVerifiedOrder(paypalOrder(), "CAP1"), amount: 10 }).action, "ignore");

  const repeated = factsFromVerifiedOrder(paypalOrder(), "CAP1");
  const paid = { ...pending, orderStatus: "paid", paypal_status: "COMPLETED", paypal_capture_id: "CAP1" };
  assert.equal(paymentDecision(paid, repeated).action, "duplicate");
});

test("PayPal receives only the amount and ICEY reference", () => {
  const body = buildPayPalOrderBody({ amountUsd: 120, iceyOrderNumber: "ICEY-10050" });
  const unit = body.purchase_units[0];
  assert.equal(body.intent, "CAPTURE");
  assert.deepEqual(unit.amount, { currency_code: "USD", value: "120.00" });
  assert.equal(unit.custom_id, "ICEY-10050");
  assert.equal(unit.invoice_id, "ICEY-10050");
  assert.equal(unit.description, "ICEYOUT order");
  assert.equal(unit.items, undefined);
  assert.equal(JSON.stringify(body).includes(IMAGE_ID), false);
  assert.equal(JSON.stringify(body).includes("customer@example.com"), false);
});

test("an already captured PayPal order is reloaded once and is not captured again", async () => {
  let captures = 0;
  const completed = paypalOrder();
  const result = await loadCompletedCapture({
    orderId: "PAYPALORDER1",
    captureOrder: async () => {
      captures += 1;
      const error = new Error("already captured");
      error.paypalIssue = "ORDER_ALREADY_CAPTURED";
      throw error;
    },
    getOrder: async () => completed,
  });
  assert.equal(captures, 1);
  assert.equal(result.alreadyCaptured, true);
  assert.equal(result.order, completed);

  const failedLookup = await loadCompletedCapture({
    orderId: "PAYPALORDER1",
    captureOrder: async () => {
      const error = new Error("already captured");
      error.paypalIssue = "ORDER_ALREADY_CAPTURED";
      throw error;
    },
    getOrder: async () => {
      throw new Error("temporary lookup failure");
    },
  });
  assert.equal(failedLookup.lookupFailed, true);
  assert.equal(failedLookup.order, null);
});

test("a paid order is not replaced or attached to a different PayPal order", () => {
  const paid = {
    orderId: 10050,
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    paypal_order_id: "PAYPALORDER1",
    paypal_capture_id: "CAP1",
  };
  assert.equal(shouldPreservePaidOrder(paid), true);
  assert.equal(shouldPreservePaidOrder({ ...paid, orderStatus: "pending", paypal_status: "CREATED" }), false);
  const facts = factsFromVerifiedOrder(paypalOrder(), "CAP1");
  assert.equal(
    paymentDecision({ ...paid, paypal_order_id: "OTHER-ORDER", paypal_capture_id: "" }, facts).action,
    "ignore"
  );
});

test("historical orders and a different capture are not rewritten", () => {
  const historical = { orderId: 1771463573709, paypal_capture_id: "CAP1", items: "{}" };
  assert.equal(matchIceyDocument([historical], factsFromVerifiedOrder(paypalOrder(), "CAP1")), null);
  const other = {
    orderId: 10050,
    paypal_capture_id: "CAP-OTHER",
    paypal_order_id: "PAYPALORDER1",
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    items: JSON.stringify({ orderNumber: "ICEY-10050", lines: [] }),
  };
  assert.equal(paymentDecision(other, factsFromVerifiedOrder(paypalOrder(), "CAP1")).action, "ignore");
});
