/** Complimentary gift. This is not a catalogue document and must never be priced from the browser. */
export const PROMO_GIFT_ID = "iceyout-promo-vvs-earrings";

export const PROMO_GIFT_NAME = "FREE PROMOTIONAL GIFT";

export const PROMO_GIFT_DETAIL = "VVS Moissanite Earrings";

export function isPromoGiftId(id) {
  return String(id || "").trim() === PROMO_GIFT_ID;
}

export function promoGiftLine() {
  return {
    productId: PROMO_GIFT_ID,
    name: PROMO_GIFT_NAME,
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    imageFileId: "",
    promotionalGift: true,
    giftDetail: PROMO_GIFT_DETAIL,
  };
}

/** Drop any client-supplied gift lines before catalogue lookup. */
export function paidRequestLines(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((line) => !isPromoGiftId(line?.productId));
}

/**
 * One complimentary pair when at least one priced catalogue line is in the order.
 * Gift quantity and price are fixed here. Extra client gift rows are ignored.
 */
export function withPromoGift(pricedLines) {
  const lines = (Array.isArray(pricedLines) ? pricedLines : []).filter(
    (line) => !isPromoGiftId(line?.productId)
  );
  const qualifies = lines.some((line) => Number(line?.lineTotal) > 0);
  if (!qualifies) return lines;
  return [...lines, promoGiftLine()];
}

export function payableTotal(lineItems) {
  const total = (Array.isArray(lineItems) ? lineItems : []).reduce((sum, line) => {
    if (line?.promotionalGift || isPromoGiftId(line?.productId)) return sum;
    const amount = Number(line?.lineTotal);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

export function cartQualifiesForGift(cart) {
  return (Array.isArray(cart) ? cart : []).some((item) => {
    if (isPromoGiftId(item?.$id ?? item?.id ?? item?.productId)) return false;
    const price = Number(item?.price ?? item?.unitPrice);
    const qty = Number(item?.quantity) || 0;
    return price > 0 && qty > 0;
  });
}
