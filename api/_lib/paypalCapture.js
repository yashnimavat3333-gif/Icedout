const HISTORICAL_ORDER_ID = 1000000;

export function iceySequence(orderNumber) {
  const match = String(orderNumber || "").trim().match(/^ICEY-(\d+)$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  if (!Number.isInteger(sequence) || sequence < 10000 || sequence >= HISTORICAL_ORDER_ID) {
    return null;
  }
  return sequence;
}

export function imageFileIdFromDescription(description, orderNumber) {
  const text = String(description || "").trim();
  const prefix = `${orderNumber} `;
  if (!orderNumber || !text.startsWith(prefix)) return "";
  const token = text.slice(prefix.length).trim();
  if (!/^[A-Za-z0-9]{20}$/.test(token)) return "";
  return token;
}

function paypalName(paypalOrder, purchase) {
  const shippingName = String(purchase?.shipping?.name?.full_name || "").trim();
  if (shippingName) return shippingName;
  const payer = paypalOrder?.payer?.name || {};
  return [payer.given_name, payer.surname]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function paypalAddress(purchase) {
  const address = purchase?.shipping?.address || {};
  return [
    address.address_line_1,
    address.address_line_2,
    address.admin_area_2,
    address.admin_area_1,
    address.postal_code,
    address.country_code,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function factsFromVerifiedOrder(paypalOrder, expectedCaptureId = "") {
  const purchase = paypalOrder?.purchase_units?.[0] || {};
  const captures = Array.isArray(purchase?.payments?.captures) ? purchase.payments.captures : [];
  const wanted = String(expectedCaptureId || "").trim();
  const capture = wanted
    ? captures.find((item) => item?.id === wanted)
    : captures.find((item) => item?.status === "COMPLETED");
  if (!capture || capture.status !== "COMPLETED" || !capture.id) return null;
  if (String(paypalOrder?.status || "") !== "COMPLETED") return null;

  const orderNumber = [purchase.custom_id, purchase.invoice_id]
    .map((value) => String(value || "").trim())
    .find((value) => iceySequence(value));
  if (!orderNumber) return null;

  const amount = Number(capture.amount?.value);
  const currency = String(capture.amount?.currency_code || "");
  if (currency !== "USD" || !Number.isFinite(amount) || amount <= 0) return null;

  const paypalOrderId = String(paypalOrder?.id || "").trim();
  if (!paypalOrderId) return null;

  return {
    orderNumber,
    sequence: iceySequence(orderNumber),
    imageFileId: imageFileIdFromDescription(purchase.description, orderNumber),
    paypalOrderId,
    captureId: String(capture.id),
    amount,
    customerName: paypalName(paypalOrder, purchase),
    shippingAddress: paypalAddress(purchase),
    lineItems: [],
  };
}

function storedOrderNumber(doc) {
  try {
    const parsed = JSON.parse(doc?.items || "");
    return parsed && !Array.isArray(parsed) ? String(parsed.orderNumber || "") : "";
  } catch {
    return "";
  }
}

export function matchIceyDocument(documents, facts) {
  const candidates = (documents || []).filter((doc) => {
    if (!doc || Number(doc.orderId) > HISTORICAL_ORDER_ID) return false;
    if (facts.captureId && doc.paypal_capture_id === facts.captureId) return true;
    if (facts.paypalOrderId && doc.paypal_order_id === facts.paypalOrderId) return true;
    if (storedOrderNumber(doc) === facts.orderNumber) return true;
    return Number(doc.orderId) === facts.sequence;
  });
  candidates.sort((a, b) => rank(b, facts) - rank(a, facts));
  return candidates[0] || null;
}

function refersToSameIceyOrder(existing, facts) {
  const stored = storedOrderNumber(existing);
  if (stored && stored !== facts.orderNumber) return false;
  if (Number(existing.orderId) !== facts.sequence && stored !== facts.orderNumber) return false;
  return true;
}

export function recoveryEligibility(doc) {
  if (!doc || Number(doc.orderId) > HISTORICAL_ORDER_ID) return "ineligible";
  if (!String(doc.paypal_order_id || "").trim()) return "ineligible";
  if (doc.orderStatus === "paid" && doc.paypal_status === "COMPLETED") return "already";
  if (doc.orderStatus !== "pending") return "ineligible";
  return "eligible";
}

function rank(doc, facts) {
  if (facts.captureId && doc.paypal_capture_id === facts.captureId) return 3;
  if (facts.paypalOrderId && doc.paypal_order_id === facts.paypalOrderId) return 2;
  return 1;
}

export function paymentDecision(existing, facts) {
  if (!facts?.orderNumber || !facts.captureId || !facts.paypalOrderId) {
    return { action: "ignore" };
  }
  if (!existing) return { action: "missing" };
  if (Number(existing.orderId) > HISTORICAL_ORDER_ID) return { action: "ignore" };
  if (!refersToSameIceyOrder(existing, facts)) return { action: "ignore" };
  const storedAmount = Number(existing.amount);
  if (!Number.isFinite(storedAmount) || Math.abs(storedAmount - facts.amount) > 0.009) {
    return { action: "ignore" };
  }
  const sameCapture = existing.paypal_capture_id === facts.captureId;
  const paid = existing.orderStatus === "paid" && existing.paypal_status === "COMPLETED";
  if (sameCapture && paid) return { action: "duplicate" };
  if (existing.paypal_capture_id && !sameCapture) return { action: "ignore" };
  if (
    existing.paypal_order_id &&
    facts.paypalOrderId &&
    existing.paypal_order_id !== facts.paypalOrderId
  ) {
    return { action: "ignore" };
  }
  return { action: "markPaid" };
}

export const MISSING_PAYMENT_ORDER_NUMBER = "ICEY-989107";
export const MISSING_PAYMENT_SEQUENCE = 989107;
export const MISSING_PAYMENT_AMOUNT = 595.57;
export const PROTECTED_ORDER_ID = 989106;
export const MISSING_PAYMENT_FOLLOW_UP =
  "Product name, variant, and quantity were not included in the verified PayPal payment. Confirm the item before fulfilment.";

export function assessMissingPayment(paypalOrder, suppliedCaptureId = "") {
  if (!paypalOrder || typeof paypalOrder !== "object" || !String(paypalOrder.id || "").trim()) {
    return { action: "invalid" };
  }
  const purchase = paypalOrder.purchase_units?.[0] || {};
  const captures = Array.isArray(purchase.payments?.captures) ? purchase.payments.captures : [];
  const wanted = String(suppliedCaptureId || "").trim();
  const capture = wanted
    ? captures.find((item) => item?.id === wanted)
    : captures.find((item) => item?.status === "COMPLETED") || captures[0];
  if (!capture?.id) return { action: "invalid" };
  if (capture.status !== "COMPLETED" || String(paypalOrder.status || "") !== "COMPLETED") {
    return { action: "unpaid" };
  }

  const orderNumber = [purchase.custom_id, purchase.invoice_id]
    .map((value) => String(value || "").trim())
    .find((value) => value.toUpperCase() === MISSING_PAYMENT_ORDER_NUMBER);
  if (!orderNumber) return { action: "invalid" };

  const amount = Number(capture.amount?.value);
  const currency = String(capture.amount?.currency_code || "");
  if (currency !== "USD" || !Number.isFinite(amount)) return { action: "invalid" };
  if (Math.abs(amount - MISSING_PAYMENT_AMOUNT) > 0.001) return { action: "wrong-amount" };

  return {
    action: "verified",
    facts: {
      orderNumber: MISSING_PAYMENT_ORDER_NUMBER,
      sequence: MISSING_PAYMENT_SEQUENCE,
      imageFileId: imageFileIdFromDescription(purchase.description, MISSING_PAYMENT_ORDER_NUMBER),
      paypalOrderId: String(paypalOrder.id).trim(),
      captureId: String(capture.id),
      amount: MISSING_PAYMENT_AMOUNT,
      customerName: paypalName(paypalOrder, purchase),
      customerPhone: paypalPhone(paypalOrder, purchase),
      shippingAddress: paypalAddress(purchase),
      lineItems: [],
    },
  };
}

function paypalPhone(paypalOrder, purchase) {
  const raw =
    purchase?.shipping?.phone_number?.national_number ||
    paypalOrder?.payer?.phone?.phone_number?.national_number ||
    "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}

export function missingPaymentDecision(documents, facts) {
  if (!facts || facts.orderNumber !== MISSING_PAYMENT_ORDER_NUMBER) return { action: "invalid" };
  if (Math.abs(Number(facts.amount) - MISSING_PAYMENT_AMOUNT) > 0.001) return { action: "wrong-amount" };
  const existing = (documents || []).find((doc) => {
    if (!doc || Number(doc.orderId) === PROTECTED_ORDER_ID) return false;
    if (Number(doc.orderId) > HISTORICAL_ORDER_ID) return false;
    if (facts.captureId && doc.paypal_capture_id === facts.captureId) return true;
    if (facts.paypalOrderId && doc.paypal_order_id === facts.paypalOrderId) return true;
    return Number(doc.orderId) === MISSING_PAYMENT_SEQUENCE || storedOrderNumber(doc) === MISSING_PAYMENT_ORDER_NUMBER;
  });
  if (!existing) return { action: "create" };
  if (Number(existing.orderId) !== MISSING_PAYMENT_SEQUENCE) return { action: "invalid" };
  return { action: "duplicate", existing };
}

export function buildMissingPaymentRecord(facts, paidAt) {
  const when = paidAt || new Date().toISOString();
  const shippingAddress = String(facts?.shippingAddress || "").trim();
  return {
    orderId: MISSING_PAYMENT_SEQUENCE,
    orderDate: when,
    billingAddress: shippingAddress || "Not provided by PayPal",
    shippingAddress,
    shippingphone: facts?.customerPhone || "",
    shipping_full_name: facts?.customerName || "",
    amount: MISSING_PAYMENT_AMOUNT,
    totalAmount: MISSING_PAYMENT_AMOUNT,
    currency: "USD",
    orderStatus: "paid",
    payment_method: "paypal",
    paypal_status: "COMPLETED",
    paypal_order_id: facts.paypalOrderId,
    paypal_capture_id: facts.captureId,
    customerId: MISSING_PAYMENT_SEQUENCE,
    items: JSON.stringify({
      orderNumber: MISSING_PAYMENT_ORDER_NUMBER,
      imageFileId: facts.imageFileId || "",
      lines: [],
      followUp: MISSING_PAYMENT_FOLLOW_UP,
    }),
  };
}

export function applyMissingPaymentRecovery({ documents, paypalOrder, captureId, paidAt }) {
  const protectedDocs = (documents || []).filter((doc) => Number(doc.orderId) === PROTECTED_ORDER_ID);
  const before = protectedDocs.map((doc) => JSON.stringify(doc));
  const assessment = assessMissingPayment(paypalOrder, captureId);
  if (assessment.action !== "verified") {
    return { action: assessment.action, documents: documents || [] };
  }
  const decision = missingPaymentDecision(documents, assessment.facts);
  if (decision.action !== "create") {
    return { action: decision.action, documents: documents || [], order: decision.existing || null };
  }
  const record = buildMissingPaymentRecord(assessment.facts, paidAt);
  const after = (documents || [])
    .filter((doc) => Number(doc.orderId) === PROTECTED_ORDER_ID)
    .map((doc) => JSON.stringify(doc));
  if (before.join() !== after.join()) return { action: "invalid", documents: documents || [] };
  return {
    action: "created",
    record,
    documents: [...(documents || []), { $id: "recovered", ...record }],
  };
}

export async function loadVerifiedMissingPayment({ paypalId, getOrder, getCapture }) {
  const id = String(paypalId || "").trim();
  if (!/^[A-Za-z0-9]{10,36}$/.test(id)) return { action: "invalid" };

  try {
    const order = await getOrder(id);
    if (order?.id) return assessMissingPayment(order);
  } catch {
    // The value may be a capture id rather than a PayPal order id.
  }

  let capture;
  try {
    capture = await getCapture(id);
  } catch {
    return { action: "invalid" };
  }
  if (!capture?.id || String(capture.id) !== id) return { action: "invalid" };
  if (capture.status !== "COMPLETED") return { action: "unpaid" };
  const relatedOrderId = String(capture.supplementary_data?.related_ids?.order_id || "").trim();
  if (!relatedOrderId) return { action: "invalid" };
  try {
    const order = await getOrder(relatedOrderId);
    return assessMissingPayment(order, id);
  } catch {
    return { action: "invalid" };
  }
}

export async function loadCompletedCapture({ orderId, captureOrder, getOrder }) {
  try {
    return { order: await captureOrder(orderId), alreadyCaptured: false };
  } catch (err) {
    if (err?.paypalIssue !== "ORDER_ALREADY_CAPTURED") throw err;
    try {
      const order = await getOrder(orderId);
      if (order?.status !== "COMPLETED") throw err;
      return { order, alreadyCaptured: true };
    } catch (lookupErr) {
      if (lookupErr === err) throw err;
      return { order: null, alreadyCaptured: true, lookupFailed: true };
    }
  }
}

