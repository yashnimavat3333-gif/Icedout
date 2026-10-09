import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMissingPaymentRecovery,
  factsFromVerifiedOrder,
  loadCompletedCapture,
  loadVerifiedMissingPayment,
  matchIceyDocument,
  paymentDecision,
  publicRecoveryError,
  recoveryEligibility,
  storedMoney,
} from "./paypalCapture.js";
import { orderSnapshot, persistVerifiedCapture, shouldPreservePaidOrder } from "./iceyOrder.js";
import {
  ORDER_NOT_STORED,
  captureCustomerResult,
  clientCheckoutEvent,
  savePendingWithRetry,
} from "./checkoutPaymentState.js";
import { buildPayPalOrderBody } from "./paypalServer.js";
import { buildCatalogLine } from "./computeCheckoutTotal.js";

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

test("a decimal PayPal total is stored exactly, paid once, and preserved with its variant", async () => {
  assert.deepEqual(storedMoney(595.57), { amount: 595, totalAmount: 595.57 });
  assert.equal(Number.isInteger(storedMoney(595.57).amount), true);

  const product = {
    name: "Watch",
    price: 100,
    images: [IMAGE_ID],
    variations: [
      { name: "Gold", price: 595.57 },
      { name: "Silver", price: 400 },
    ],
  };
  const gold = buildCatalogLine(product, { productId: "p1", quantity: 1, variationName: "gold" });
  const plain = buildCatalogLine(product, { productId: "p2", quantity: 2, variationName: null });
  const unknown = buildCatalogLine(product, { productId: "p3", quantity: 1, variationName: "Platinum" });
  assert.equal(gold.variationName, "Gold");
  assert.equal(gold.unitPrice, 595.57);
  assert.equal(gold.imageFileId, IMAGE_ID);
  assert.equal(plain.variationName, undefined);
  assert.equal(plain.quantity, 2);
  assert.equal(plain.unitPrice, 100);
  assert.equal(unknown.variationName, undefined);
  assert.equal(unknown.unitPrice, 100);

  const items = orderSnapshot({
    orderNumber: "ICEY-10050",
    imageFileId: IMAGE_ID,
    lineItems: [gold, plain],
  });
  const savedLines = JSON.parse(items).lines;
  assert.equal(savedLines[0].variationName, "Gold");
  assert.equal(Object.hasOwn(savedLines[1], "variationName"), false);

  const neighbour = {
    $id: "neighbour",
    orderId: 989106,
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    amount: 892,
    totalAmount: 892.5,
    items: JSON.stringify({ orderNumber: "ICEY-989106", lines: [{ name: "Other", quantity: 1 }] }),
  };
  const pending = {
    $id: "pending-cents",
    orderId: 10050,
    orderStatus: "pending",
    paypal_status: "CREATED",
    paypal_order_id: "PAYPALORDER1",
    paypal_capture_id: "",
    items,
    amount: 595,
    totalAmount: 595.57,
    shipping_full_name: "Ava Stone",
    shippingphone: "5551234567",
    shippingAddress: "1 Main Street",
  };
  const db = memoryDb([neighbour, pending]);
  const paypal = paypalOrder();
  paypal.purchase_units[0].payments.captures[0].amount.value = "595.57";
  const verified = factsFromVerifiedOrder(paypal, "CAP1");
  assert.equal(paymentDecision(pending, verified).action, "markPaid");
  assert.equal(paymentDecision(pending, { ...verified, amount: 595 }).action, "ignore");
  assert.equal(paymentDecision(pending, { ...verified, amount: 10 }).action, "ignore");

  const wrongReference = paypalOrder();
  wrongReference.purchase_units[0].custom_id = "ICEY-10051";
  wrongReference.purchase_units[0].invoice_id = "ICEY-10051";
  wrongReference.purchase_units[0].payments.captures[0].amount.value = "595.57";
  const rejected = await persistVerifiedCapture(db, factsFromVerifiedOrder(wrongReference, "CAP1"));
  assert.equal(rejected.action, "ignore");
  assert.equal(db.docs[1].orderStatus, "pending");
  assert.equal(db.docs[1].paypal_capture_id, "");

  const wrongAmount = paypalOrder();
  wrongAmount.purchase_units[0].payments.captures[0].amount.value = "10.00";
  const ignored = await persistVerifiedCapture(db, factsFromVerifiedOrder(wrongAmount, "CAP1"));
  assert.equal(ignored.action, "ignore");
  assert.equal(db.docs[1].orderStatus, "pending");
  assert.equal(JSON.stringify(db.docs[0]), JSON.stringify(neighbour));

  const first = await persistVerifiedCapture(db, verified);
  const second = await persistVerifiedCapture(db, verified);
  assert.equal(first.action, "updated");
  assert.equal(second.action, "duplicate");
  assert.equal(db.docs.length, 2);
  assert.equal(db.docs[1].orderStatus, "paid");
  assert.equal(db.docs[1].paypal_status, "COMPLETED");
  assert.equal(db.docs[1].paypal_order_id, "PAYPALORDER1");
  assert.equal(db.docs[1].paypal_capture_id, "CAP1");
  assert.equal(db.docs[1].amount, 595);
  assert.equal(Number.isInteger(db.docs[1].amount), true);
  assert.equal(db.docs[1].totalAmount, 595.57);
  assert.equal(db.docs[1].items, items);
  assert.equal(db.docs[1].shipping_full_name, "Ava Stone");
  assert.equal(db.docs[1].shippingphone, "5551234567");
  assert.equal(db.docs[1].shippingAddress, "1 Main Street");
  assert.equal(JSON.stringify(db.docs[0]), JSON.stringify(neighbour));
  assert.equal(verified.orderNumber, "ICEY-10050");
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

function missingPaymentOrder(overrides = {}) {
  return {
    id: "PAYPAL989107",
    status: "COMPLETED",
    payer: {
      name: { given_name: "Ava", surname: "Stone" },
      email_address: "customer@example.com",
    },
    purchase_units: [
      {
        custom_id: "ICEY-989107",
        invoice_id: "ICEY-989107",
        description: "ICEY-989107 6904a15b001318b4185c",
        payments: {
          captures: [
            {
              id: "6SC00796S3350412Y",
              status: "COMPLETED",
              amount: { currency_code: "USD", value: "595.57" },
            },
          ],
        },
      },
    ],
    ...overrides,
  };
}

test("missing payment recovery rejects a wrong amount, an unpaid payment, and an invalid id", async () => {
  const neighbour = {
    $id: "neighbour",
    orderId: 989106,
    orderStatus: "paid",
    amount: 100,
    items: JSON.stringify({ orderNumber: "ICEY-989106", lines: [{ name: "Other", quantity: 1 }] }),
  };
  const wrongAmount = missingPaymentOrder();
  wrongAmount.purchase_units[0].payments.captures[0].amount.value = "10.00";
  const wrong = applyMissingPaymentRecovery({ documents: [neighbour], paypalOrder: wrongAmount });
  assert.equal(wrong.action, "wrong-amount");
  assert.equal(wrong.documents.length, 1);
  assert.equal(JSON.stringify(wrong.documents[0]), JSON.stringify(neighbour));

  const unpaidOrder = missingPaymentOrder();
  unpaidOrder.status = "APPROVED";
  unpaidOrder.purchase_units[0].payments.captures[0].status = "PENDING";
  assert.equal(applyMissingPaymentRecovery({ documents: [neighbour], paypalOrder: unpaidOrder }).action, "unpaid");

  const otherReference = missingPaymentOrder();
  otherReference.purchase_units[0].custom_id = "ICEY-10050";
  otherReference.purchase_units[0].invoice_id = "ICEY-10050";
  assert.equal(applyMissingPaymentRecovery({ documents: [neighbour], paypalOrder: otherReference }).action, "invalid");

  const invalid = await loadVerifiedMissingPayment({
    paypalId: "bad id",
    getOrder: async () => missingPaymentOrder(),
    getCapture: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(invalid.action, "invalid");
});

test("missing payment recovery creates one ICEY-989107 record and a retry does not duplicate it", () => {
  const neighbour = {
    $id: "neighbour",
    orderId: 989106,
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    amount: 100,
    items: JSON.stringify({ orderNumber: "ICEY-989106", lines: [{ name: "Other", quantity: 1 }] }),
  };
  const first = applyMissingPaymentRecovery({
    documents: [neighbour],
    paypalOrder: missingPaymentOrder(),
    paidAt: "2026-10-09T00:00:00.000Z",
  });
  assert.equal(first.action, "created");
  assert.equal(first.documents.length, 2);
  assert.equal(JSON.stringify(first.documents[0]), JSON.stringify(neighbour));
  const saved = JSON.parse(first.record.items);
  assert.equal(first.record.orderId, 989107);
  assert.equal(first.record.amount, 595);
  assert.equal(Number.isInteger(first.record.amount), true);
  assert.equal(first.record.totalAmount, 595.57);
  assert.equal(first.record.shippingphone, "Not provided by PayPal");
  assert.equal(first.record.orderStatus, "paid");
  assert.equal(first.record.paypal_status, "COMPLETED");
  assert.equal(first.record.shipping_full_name, "Ava Stone");
  assert.deepEqual(saved.lines, []);
  assert.equal(saved.imageFileId, "6904a15b001318b4185c");
  assert.match(saved.followUp, /variant, and quantity/);
  assert.equal(JSON.stringify(first.record).includes("customer@example.com"), false);
  assert.equal(JSON.stringify(first.record).includes("Audemars"), false);

  const second = applyMissingPaymentRecovery({
    documents: first.documents,
    paypalOrder: missingPaymentOrder(),
  });
  assert.equal(second.action, "duplicate");
  assert.equal(second.documents.length, 2);
  assert.equal(JSON.stringify(second.documents[0]), JSON.stringify(neighbour));
});

test("a failed save reports a sanitized reason and does not mark the payment recovered", () => {
  const neighbour = {
    $id: "neighbour",
    orderId: 989106,
    orderStatus: "paid",
    amount: 892,
    totalAmount: 892.5,
  };
  const thrown = new Error(
    'Invalid document structure: Attribute "amount" has invalid type. Bearer secret-token customer@example.com'
  );
  thrown.code = 400;
  thrown.type = "document_invalid_structure";
  const safe = publicRecoveryError(thrown);
  assert.match(safe, /400/);
  assert.match(safe, /document_invalid_structure/);
  assert.match(safe, /amount/);
  assert.equal(safe.includes("secret-token"), false);
  assert.equal(safe.includes("customer@example.com"), false);
  assert.equal(safe.includes("Bearer secret"), false);

  const rejected = applyMissingPaymentRecovery({
    documents: [neighbour],
    paypalOrder: { id: "PAYPAL989107", status: "APPROVED", purchase_units: [] },
  });
  assert.notEqual(rejected.action, "created");
  assert.equal(rejected.documents.length, 1);
  assert.equal(JSON.stringify(rejected.documents[0]), JSON.stringify(neighbour));
});

test("a capture id is accepted only when the related PayPal order matches ICEY-989107", async () => {
  const verified = await loadVerifiedMissingPayment({
    paypalId: "6SC00796S3350412Y",
    getOrder: async (id) => {
      if (id === "6SC00796S3350412Y") throw new Error("not an order");
      assert.equal(id, "PAYPAL989107");
      return missingPaymentOrder();
    },
    getCapture: async () => ({
      id: "6SC00796S3350412Y",
      status: "COMPLETED",
      supplementary_data: { related_ids: { order_id: "PAYPAL989107" } },
    }),
  });
  assert.equal(verified.action, "verified");
  assert.equal(verified.facts.amount, 595.57);
  assert.equal(verified.facts.captureId, "6SC00796S3350412Y");

  const unpaid = await loadVerifiedMissingPayment({
    paypalId: "6SC00796S3350412Y",
    getOrder: async () => {
      throw new Error("not an order");
    },
    getCapture: async () => ({ id: "6SC00796S3350412Y", status: "PENDING" }),
  });
  assert.equal(unpaid.action, "unpaid");
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

test("a failed pending save does not open PayPal, and a confirmed capture is not shown as saved", async () => {
  assert.equal(ORDER_NOT_STORED.body.paypalOpened, false);
  assert.equal(ORDER_NOT_STORED.body.ok, false);
  assert.match(ORDER_NOT_STORED.body.error, /not opened/);
  assert.match(ORDER_NOT_STORED.body.error, /Nothing was charged/);

  let saves = 0;
  const recovered = await savePendingWithRetry(async () => {
    saves += 1;
    if (saves === 1) throw new Error("temporary storage failure");
  });
  assert.equal(recovered.ok, true);
  assert.equal(saves, 2);

  let opened = false;
  const blocked = await savePendingWithRetry(async () => {
    throw new Error("storage unavailable");
  });
  if (blocked.ok) opened = true;
  assert.equal(blocked.ok, false);
  assert.equal(opened, false);

  const paid = paypalOrder();
  paid.purchase_units[0].payments.captures[0].amount.value = "595.57";
  const saved = captureCustomerResult({
    paypalOrder: paid,
    persistResult: { action: "updated", orderNumber: "ICEY-10050" },
    requestedOrderId: "PAYPALORDER1",
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.saved, true);
  assert.equal(saved.body.captureId, "CAP1");

  const again = captureCustomerResult({
    paypalOrder: paid,
    persistResult: { action: "duplicate", orderNumber: "ICEY-10050" },
    requestedOrderId: "PAYPALORDER1",
  });
  assert.equal(again.body.ok, true);
  assert.equal(again.body.code, "duplicate");

  const wrongAmount = captureCustomerResult({
    paypalOrder: paid,
    persistResult: { action: "ignore", orderNumber: "ICEY-10050" },
    requestedOrderId: "PAYPALORDER1",
  });
  assert.equal(wrongAmount.body.ok, false);
  assert.equal(wrongAmount.body.saved, false);
  assert.equal(wrongAmount.body.code, "payment-not-matched");

  const wrongReference = captureCustomerResult({
    paypalOrder: paid,
    persistResult: { action: "missing", orderNumber: "ICEY-10051" },
    requestedOrderId: "PAYPALORDER1",
  });
  assert.equal(wrongReference.body.ok, false);
  assert.equal(wrongReference.body.code, "order-not-linked");

  const databaseFailed = captureCustomerResult({
    paypalOrder: paid,
    persistError: new Error("database unavailable"),
    requestedOrderId: "PAYPALORDER1",
  });
  assert.equal(databaseFailed.body.ok, false);
  assert.equal(databaseFailed.body.paymentCaptured, true);
  assert.equal(databaseFailed.body.saved, false);
  assert.equal(databaseFailed.body.code, "order-save-failed");
  assert.match(databaseFailed.body.error, /Do not pay again/);

  const unconfirmed = captureCustomerResult({
    lookupFailed: true,
    requestedOrderId: "PAYPALORDER1",
  });
  assert.equal(unconfirmed.body.ok, false);
  assert.equal(unconfirmed.body.code, "capture-unconfirmed");

  const cancelled = clientCheckoutEvent("cancel");
  const closed = clientCheckoutEvent("popup-closed");
  assert.equal(cancelled.level, "notice");
  assert.match(cancelled.message, /have not been charged/);
  assert.match(closed.message, /WhatsApp/);

  const snapshot = JSON.parse(orderSnapshot({
    orderNumber: "ICEY-10050",
    imageFileId: IMAGE_ID,
    customerEmail: "customer@example.com",
    lineItems: [{ productId: "p1", name: "Watch", quantity: 1, variationName: "Gold", unitPrice: 595.57, lineTotal: 595.57, imageFileId: IMAGE_ID }],
  }));
  assert.equal(snapshot.customerEmail, "customer@example.com");
  assert.equal(snapshot.lines[0].variationName, "Gold");
  const withoutEmail = JSON.parse(orderSnapshot({
    orderNumber: "ICEY-10050",
    imageFileId: IMAGE_ID,
    lineItems: [{ productId: "p1", name: "Watch", quantity: 1, unitPrice: 10, lineTotal: 10, imageFileId: IMAGE_ID }],
  }));
  assert.equal(withoutEmail.customerEmail, undefined);
});
