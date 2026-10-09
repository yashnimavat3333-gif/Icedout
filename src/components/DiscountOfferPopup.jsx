import React, { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import {
  cartLinesForServer,
  dismissOffer,
  getLeadId,
  getStoredCoupon,
  isOfferClaimed,
  isOfferDismissed,
  rememberLead,
  setStoredCoupon,
} from "../lib/offerStorage";

export default function DiscountOfferPopup() {
  const { cart, addedTick } = useCart();
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!addedTick) return;
    if (isOfferClaimed() || isOfferDismissed()) return;
    setResult(null);
    setError("");
    setOpen(true);
  }, [addedTick]);

  const close = () => {
    dismissOffer();
    setOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const existingCoupon = getStoredCoupon();
      const applyGet10 = !existingCoupon || existingCoupon === "GET10";
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          marketingConsent: consent,
          items: cartLinesForServer(cart),
          leadId: getLeadId(),
          applyGet10,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Enter a valid phone number.");
        return;
      }
      if (!applyGet10) {
        if (data.saved && data.leadId) rememberLead(data.leadId);
        setResult({
          couponApplied: false,
          saved: Boolean(data.saved),
          message: "",
          blocked: true,
        });
        return;
      }
      if (data.saved && data.leadId) rememberLead(data.leadId);
      if (data.couponApplied) {
        setStoredCoupon("GET10");
        if (!data.leadId) rememberLead("");
      }
      if (!data.saved && !data.couponApplied) {
        setError(data.couponMessage || "We couldn't save your details. Checkout still works.");
        return;
      }
      setResult({
        couponApplied: Boolean(data.couponApplied),
        saved: Boolean(data.saved),
        message: data.couponMessage || "",
        blocked: false,
      });
    } catch {
      setError("Something went wrong. You can keep shopping and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/55">
      <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8 relative my-2"
        role="dialog"
        aria-labelledby="offer-title"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 w-9 h-9 rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Close"
        >
          ×
        </button>

        {result ? (
          <div className="text-center">
            <p className="text-[11px] tracking-[0.22em] uppercase text-gray-500">Iceyout</p>
            {result.couponApplied ? (
              <>
                <h2 id="offer-title" className="mt-3 text-2xl font-light text-gray-900">
                  Your 10% discount is ready. We’ve applied GET10 to your cart.
                </h2>
                <div className="mt-5 border border-dashed border-gray-300 rounded-xl py-4 text-2xl tracking-[0.28em] font-medium">
                  GET10
                </div>
              </>
            ) : (
              <h2 id="offer-title" className="mt-3 text-xl font-light text-gray-900">
                {result.blocked
                  ? "Another coupon is already applied. Remove it at checkout if you want to use GET10."
                  : result.message || "GET10 is not available right now. Checkout still works."}
              </h2>
            )}
            {result.couponApplied && !result.saved && (
              <p className="mt-4 text-sm text-gray-600">
                We could not store your contact yet. Your code is still applied for this visit.
              </p>
            )}
            <button
              type="button"
              onClick={close}
              className="mt-6 w-full py-3.5 bg-black text-white rounded-xl font-medium"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-[11px] tracking-[0.22em] uppercase text-gray-500">Iceyout</p>
            <h2 id="offer-title" className="mt-3 text-2xl sm:text-3xl font-light tracking-wide text-gray-900">
              GET 10% OFF YOUR ORDER
            </h2>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Unlock your exclusive 10% discount.
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Enter your phone number to receive your offer.
            </p>
            <label className="block mt-5 text-xs uppercase tracking-wide text-gray-500">
              Phone number
              <input
                type="tel"
                inputMode="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                autoComplete="tel"
                className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
                placeholder="Phone number"
              />
            </label>
            <label className="mt-4 flex items-start gap-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>Send me offers and cart reminders. Optional.</span>
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full py-3.5 bg-black hover:bg-gray-900 text-white rounded-xl font-medium disabled:opacity-60"
            >
              {busy ? "Unlocking..." : "UNLOCK MY 10% OFF"}
            </button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
