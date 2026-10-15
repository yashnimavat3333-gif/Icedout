import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMO_GIFT_ID,
  PROMO_GIFT_NAME,
  cartQualifiesForGift,
  paidRequestLines,
  payableTotal,
  promoGiftLine,
  withPromoGift,
} from "./promoGift.js";
import { orderSnapshot } from "./iceyOrder.js";
import { paymentDecision } from "./paypalCapture.js";
import { clientCheckoutEvent } from "./checkoutPaymentState.js";
import { buildCatalogLine } from "./computeCheckoutTotal.js";

const watch = { productId: "watch-1", name: "Watch", quantity: 1, unitPrice: 540, lineTotal: 540 };
const chain = { productId: "chain-1", name: "Chain", quantity: 2, unitPrice: 200, lineTotal: 400 };

test("empty cart includes no gift", () => {
  assert.deepEqual(withPromoGift([]), []);
  assert.equal(cartQualifiesForGift([]), false);
  assert.equal(payableTotal([]), 0);
});

test("one eligible paid item adds exactly one free gift", () => {
  const lines = withPromoGift([watch]);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].productId, PROMO_GIFT_ID);
  assert.equal(lines[1].name, PROMO_GIFT_NAME);
  assert.equal(lines[1].quantity, 1);
  assert.equal(lines[1].unitPrice, 0);
  assert.equal(lines[1].lineTotal, 0);
  assert.equal(payableTotal(lines), 540);
});

test("multiple eligible paid items still include only one free gift", () => {
  const lines = withPromoGift([watch, chain, promoGiftLine(), { ...promoGiftLine(), quantity: 4, unitPrice: 25, lineTotal: 100 }]);
  const gifts = lines.filter((line) => line.productId === PROMO_GIFT_ID);
  assert.equal(gifts.length, 1);
  assert.equal(gifts[0].quantity, 1);
  assert.equal(gifts[0].unitPrice, 0);
  assert.equal(payableTotal(lines), 940);
});

test("removing all eligible products removes the gift", () => {
  assert.deepEqual(withPromoGift([{ productId: "free-sample", name: "Sample", quantity: 1, unitPrice: 0, lineTotal: 0 }]), [
    { productId: "free-sample", name: "Sample", quantity: 1, unitPrice: 0, lineTotal: 0 },
  ]);
  assert.equal(cartQualifiesForGift([{ id: "watch-1", price: 0, quantity: 1 }]), false);
});

test("a browser-supplied gift price or quantity cannot make the gift payable", () => {
  const requested = paidRequestLines([
    { productId: PROMO_GIFT_ID, quantity: 9, unitPrice: 0, price: 0 },
    { productId: "watch-1", quantity: 1 },
  ]);
  assert.deepEqual(requested, [{ productId: "watch-1", quantity: 1 }]);
  const forced = promoGiftLine();
  forced.unitPrice = 80;
  forced.lineTotal = 80;
  forced.quantity = 3;
  const lines = withPromoGift([watch, forced]);
  assert.equal(lines.filter((line) => line.promotionalGift).length, 1);
  assert.equal(lines.at(-1).unitPrice, 0);
  assert.equal(lines.at(-1).quantity, 1);
  assert.equal(payableTotal(lines), 540);
});

test("PayPal payable total excludes the gift", () => {
  const lines = withPromoGift([watch]);
  assert.equal(payableTotal(lines), watch.lineTotal);
  assert.notEqual(payableTotal(lines), watch.lineTotal + 1);
});

test("a repeated PayPal capture stays a duplicate when the order includes the gift", () => {
  const items = orderSnapshot({
    orderNumber: "ICEY-10050",
    lineItems: withPromoGift([watch]),
  });
  const saved = JSON.parse(items);
  assert.equal(saved.lines[1].name, PROMO_GIFT_NAME);
  assert.equal(saved.lines[1].gift, true);
  assert.equal(saved.lines[1].unitPrice, 0);
  const paid = {
    orderId: 10050,
    orderStatus: "paid",
    paypal_status: "COMPLETED",
    paypal_capture_id: "CAP1",
    paypal_order_id: "PAYPALORDER1",
    items,
    totalAmount: 540,
    amount: 540,
  };
  assert.equal(
    paymentDecision(paid, {
      orderNumber: "ICEY-10050",
      captureId: "CAP1",
      paypalOrderId: "PAYPALORDER1",
      amount: 540,
    }).action,
    "duplicate"
  );
});

test("catalogue prices are unchanged by the promotion helper", () => {
  const line = buildCatalogLine(
    { name: "Watch", price: 100, variations: [{ name: "Gold", price: 80, discount: 0 }] },
    { productId: "watch-1", quantity: 1, variationName: "Gold" }
  );
  assert.equal(line.unitPrice, 80);
  assert.equal(line.lineTotal, 80);
});

test("WhatsApp remains the fallback when PayPal checkout closes", () => {
  assert.match(clientCheckoutEvent("popup-closed").message, /WhatsApp/);
});
