export const OFFER_CLAIMED_KEY = "iceyout_offer_claimed";
export const OFFER_DISMISSED_KEY = "iceyout_offer_dismissed";
export const LEAD_ID_KEY = "iceyout_lead_id";
export const COUPON_CODE_KEY = "iceyout_coupon_code";

export function isOfferClaimed() {
  try {
    return localStorage.getItem(OFFER_CLAIMED_KEY) === "1";
  } catch {
    return false;
  }
}

export function isOfferDismissed() {
  try {
    return sessionStorage.getItem(OFFER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOffer() {
  try {
    sessionStorage.setItem(OFFER_DISMISSED_KEY, "1");
  } catch {}
}

export function rememberLead(leadId) {
  try {
    if (leadId) localStorage.setItem(LEAD_ID_KEY, leadId);
    localStorage.setItem(OFFER_CLAIMED_KEY, "1");
  } catch {}
}

export function getLeadId() {
  try {
    return localStorage.getItem(LEAD_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function getStoredCoupon() {
  try {
    return sessionStorage.getItem(COUPON_CODE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredCoupon(code) {
  try {
    if (!code) sessionStorage.removeItem(COUPON_CODE_KEY);
    else sessionStorage.setItem(COUPON_CODE_KEY, String(code).trim().toUpperCase());
    window.dispatchEvent(new Event("iceyout-coupon"));
  } catch {}
}

export function cartLinesForServer(cart) {
  if (!Array.isArray(cart)) return [];
  return cart
    .slice(0, 30)
    .map((it) => ({
      productId: String(it?.$id ?? it?.id ?? "").trim(),
      quantity: Math.max(1, Math.floor(Number(it?.quantity) || 1)),
      variationName:
        it?.selectedVariation?.name || it?.selectedVariation?.title || null,
    }))
    .filter((it) => it.productId);
}
