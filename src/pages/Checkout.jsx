// CheckoutPage.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  CreditCard,
  Lock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Package,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import emailjs from "@emailjs/browser";

// Appwrite configuration - use environment variables for consistency
const APPWRITE_ENDPOINT = 
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_ENDPOINT || import.meta.env.VITE_APPWRITE_URL || "https://cloud.appwrite.io/v1"
    : "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = 
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_PROJECT_ID || "6875fd9e000f3ec8a910"
    : "6875fd9e000f3ec8a910";
const APPWRITE_DATABASE_ID = 
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_DATABASE_ID || "6875fde500233e4b5b8d"
    : "6875fde500233e4b5b8d";
const APPWRITE_COLLECTION_ID = 
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_COLLECTION_ID || "6911eeee00020c3218d5"
    : "6911eeee00020c3218d5";
// Coupons collection ID (for dynamic coupon validation)
// IMPORTANT: Set VITE_APPWRITE_COUPONS_COLLECTION_ID in .env to your actual Appwrite coupons collection ID
// If not set, defaults to "coupons" - make sure this matches your Appwrite collection ID
const APPWRITE_COUPONS_COLLECTION_ID = 
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID || "coupons"
    : "coupons";

// Read PayPal client id from environment. (Vite: VITE_PAYPAL_CLIENT_ID)
const ENV_PAYPAL_CLIENT_ID =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_PAYPAL_CLIENT_ID
    : process.env.REACT_APP_PAYPAL_CLIENT_ID || "";

// Read EmailJS config from environment (set these in your Vite/.env)
const ENV_EMAILJS_SERVICE_ID =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_EMAILJS_SERVICE_ID
    : process.env.REACT_APP_EMAILJS_SERVICE_ID || "";
const ENV_EMAILJS_TEMPLATE_ID =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_EMAILJS_TEMPLATE_ID
    : process.env.REACT_APP_EMAILJS_TEMPLATE_ID || "";
const ENV_EMAILJS_PUBLIC_KEY =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    : process.env.REACT_APP_EMAILJS_PUBLIC_KEY || "";

// Lazy Appwrite holders
let appwriteClient = null;
let appwriteDatabases = null;

// sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// SDK source and config (keep your APPWRITE_* constants above)
const APPWRITE_SDK_SRC = "https://cdn.jsdelivr.net/npm/appwrite@14.0.1";

/**
 * ensureAppwriteReady - robustly ensures sdk loaded and clients created.
 * Returns true when ready, false on timeout/failure.
 */
async function ensureAppwriteReady({ timeoutMs = 8000 } = {}) {
  // quick path
  if (appwriteDatabases && appwriteClient) return true;

  // if window.Appwrite present, create clients now
  if (typeof window !== "undefined" && window.Appwrite) {
    try {
      const { Client, Databases } = window.Appwrite;
      if (!appwriteClient) {
        appwriteClient = new Client()
          .setEndpoint(APPWRITE_ENDPOINT)
          .setProject(APPWRITE_PROJECT_ID);
      }
      if (!appwriteDatabases) appwriteDatabases = new Databases(appwriteClient);
      console.debug("Appwrite: client created from window.Appwrite");
      return true;
    } catch (err) {
      console.warn("Appwrite instantiate error:", err);
    }
  }

  // if script already present, wait for window.Appwrite
  const existingScript = Array.from(
    document.querySelectorAll("script[src]")
  ).find((s) => s.src && s.src.indexOf(APPWRITE_SDK_SRC) === 0);

  const waitForNamespace = async (timeout) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (window.Appwrite) {
        const { Client, Databases } = window.Appwrite;
        appwriteClient = new Client()
          .setEndpoint(APPWRITE_ENDPOINT)
          .setProject(APPWRITE_PROJECT_ID);
        appwriteDatabases = new Databases(appwriteClient);
        console.debug("Appwrite: client created after script present");
        return true;
      }
      // sleep 100ms
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  if (existingScript) {
    return await waitForNamespace(timeoutMs);
  }

  // else inject script and wait
  return await new Promise((resolve) => {
    let resolved = false;
    const script = document.createElement("script");
    script.src = APPWRITE_SDK_SRC;
    script.async = true;

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    const onLoad = async () => {
      try {
        const ok = await waitForNamespace(timeoutMs);
        resolved = true;
        cleanup();
        resolve(ok);
      } catch (e) {
        cleanup();
        resolve(false);
      }
    };

    const onError = (e) => {
      cleanup();
      console.error("Appwrite SDK load error:", e);
      resolve(false);
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    document.head.appendChild(script);

    // safety timeout
    setTimeout(() => {
      if (!resolved) {
        try {
          cleanup();
        } catch {}
        resolve(false);
      }
    }, timeoutMs + 200);
  });
}

// TODO: Re-enable Wise after Wise team confirmation
const WISE_PAYMENT_ENABLED = false; // Temporarily disabled - set to true to re-enable

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    setCartItems,
    getTotal,
  } = useCart();

  // Form & UI state
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
    country: "",
  });
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [wiseLoading, setWiseLoading] = useState(false);
  const [wiseError, setWiseError] = useState(null);
  const paypalRef = useRef(null);

  // ── CRITICAL: Refs to break stale closures inside PayPal useEffect ──
  // PayPal Buttons are rendered in a useEffect that does NOT depend on formData,
  // appliedCoupon, discountAmount, etc.  When the onApprove callback fires, the
  // closure captures whatever those values were at the time the effect ran (often
  // the INITIAL empty state).  These refs always hold the LATEST values.
  const formDataRef = useRef(formData);
  const appliedCouponRef = useRef(null);
  const discountAmountRef = useRef(0);
  const finalAmountRef = useRef(0);
  const cartItemsRef = useRef([]);

  const cartItems = Array.isArray(cart) ? cart : [];
  const subtotalAmount =
    typeof getTotal === "function"
      ? getTotal()
      : cartItems.reduce(
          (s, it) => s + (Number(it.price) || 0) * (it.quantity || 1),
          0
        );

  // Coupon state (frontend-only, non-blocking)
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // ── Keep refs in sync with latest state (for PayPal closure) ──
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { appliedCouponRef.current = appliedCoupon; }, [appliedCoupon]);
  useEffect(() => { cartItemsRef.current = cartItems; });

  useEffect(() => {
    // eagerly pre-load Appwrite so it's ready by checkout time
    (async () => {
      const ok = await ensureAppwriteReady({ timeoutMs: 8000 });
      console.debug("Appwrite preload ready:", ok);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Track Meta Pixel InitiateCheckout event when checkout page loads
  // Use ref to ensure it only fires once per session (not on refresh)
  const checkoutTrackedRef = useRef(false);
  useEffect(() => {
    // Only track once when checkout page loads with items in cart
    if (cartItems.length > 0 && !checkoutTrackedRef.current) {
      checkoutTrackedRef.current = true;
      try {
        if (typeof window.trackMetaPixelInitiateCheckout === 'function') {
          const totalValue = subtotalAmount || 0;
          const productIds = cartItems.map(item => item.$id || item.id || '').filter(Boolean);
          window.trackMetaPixelInitiateCheckout(totalValue, 'USD', cartItems.length, productIds);
        }
      } catch (e) {
        // Silently fail - do not break checkout page
        console.warn('Meta Pixel InitiateCheckout tracking failed:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // initialize EmailJS (client-side)
  useEffect(() => {
    if (ENV_EMAILJS_PUBLIC_KEY) {
      try {
        emailjs.init(ENV_EMAILJS_PUBLIC_KEY);
        console.debug("EmailJS initialized");
      } catch (e) {
        console.warn("EmailJS init failed:", e);
      }
    } else {
      console.warn("EmailJS public key not available in env");
    }
  }, []);

  // If arrived via Buy Now, replace cart with single item
  useEffect(() => {
    const state = location.state || {};
    if (state.buyNow && state.item) {
      const buyItem = state.item;
      if (typeof setCartItems === "function") {
        setCartItems([{ ...buyItem, quantity: buyItem.quantity ?? 1 }]);
      } else {
        try {
          if (typeof clearCart === "function") clearCart();
        } catch {}
        try {
          if (typeof addToCart === "function") addToCart(buyItem);
        } catch {}
      }

      if (state.prefill) {
        setFormData((prev) => ({ ...prev, ...state.prefill }));
      }

      setTimeout(() => {
        if (paypalRef.current) {
          paypalRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // PayPal SDK loader (safe)
  useEffect(() => {
    const baseSrc = "https://www.paypal.com/sdk/js";
    const clientId = (ENV_PAYPAL_CLIENT_ID || "").trim();

    if (!clientId) {
      console.error(
        "PayPal client id not set. Set VITE_PAYPAL_CLIENT_ID (Vite) or REACT_APP_PAYPAL_CLIENT_ID."
      );
      setOrderStatus({
        type: "error",
        message:
          "Payment provider not configured. Please configure PayPal client id in environment.",
      });
      return;
    }

    const srcWithParams = `${baseSrc}?client-id=${encodeURIComponent(
      clientId
    )}&currency=USD&intent=capture`;

    const existing = Array.from(document.querySelectorAll("script[src]")).find(
      (s) => s.src && s.src.indexOf(baseSrc) === 0
    );

    if (existing) {
      if (
        (existing.getAttribute &&
          existing.getAttribute("data-loaded") === "true") ||
        window.paypal
      ) {
        setPaypalLoaded(true);
      } else {
        const onLoadExisting = () => {
          existing.setAttribute("data-loaded", "true");
          setPaypalLoaded(true);
        };
        existing.addEventListener("load", onLoadExisting);
        return () => existing.removeEventListener("load", onLoadExisting);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = srcWithParams;
    script.async = true;

    const onLoad = () => {
      script.setAttribute("data-loaded", "true");
      setPaypalLoaded(true);
    };
    const onError = (e) => {
      console.error("Failed to load PayPal SDK script", e);
      setOrderStatus({ type: "error", message: "Failed to load PayPal SDK." });
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // compute discount and final total (subtotal-only, non-negative)
  const { discountAmount, finalAmount, discountPercent } = useMemo(() => {
    if (!appliedCoupon) {
      return { discountAmount: 0, finalAmount: subtotalAmount, discountPercent: 0 };
    }

    const pct = Math.min(
      100,
      Math.max(0, Number(appliedCoupon.discountPercent || 0))
    );
    let discount = (subtotalAmount * pct) / 100;
    if (discount > subtotalAmount) discount = subtotalAmount;
    const final = Math.max(0, subtotalAmount - discount);

    return {
      discountAmount: Number(discount),
      finalAmount: Number(final),
      discountPercent: pct,
    };
  }, [appliedCoupon, subtotalAmount]);

  // Keep financial refs in sync (used by PayPal closure)
  useEffect(() => { discountAmountRef.current = discountAmount; }, [discountAmount]);
  useEffect(() => { finalAmountRef.current = finalAmount; }, [finalAmount]);

  // ── Helper: extract shipping data from PayPal captured order ──
  // PayPal returns payer + shipping info after approval; use it to fill gaps
  const extractPayPalShipping = (order) => {
    try {
      const payer = order?.payer || {};
      const shipping = order?.purchase_units?.[0]?.shipping || {};
      const addr = shipping?.address || {};
      const payerName = [payer?.name?.given_name, payer?.name?.surname]
        .filter(Boolean)
        .join(" ");
      return {
        email: payer?.email_address || "",
        fullName: shipping?.name?.full_name || payerName || "",
        phone: payer?.phone?.phone_number?.national_number || "",
        address: addr?.address_line_1 || "",
        city: addr?.admin_area_2 || "",
        zipCode: addr?.postal_code || "",
        country: addr?.country_code || "",
      };
    } catch (e) {
      return {};
    }
  };

  // ── Merge: prefer user-entered data, fall back to PayPal data ──
  const mergeShipping = (formVals, paypalVals) => {
    const merged = { ...formVals };
    Object.keys(paypalVals).forEach((key) => {
      if (!merged[key] || !String(merged[key]).trim()) {
        merged[key] = paypalVals[key] || "";
      }
    });
    return merged;
  };

  // Render PayPal buttons immediately when SDK loads — NO form-valid gate.
  // Shipping validation is deferred to AFTER PayPal approval (onApprove).
  useEffect(() => {
    let mounted = true;
    if (!paypalLoaded || !paypalRef.current || !window.paypal) {
      return;
    }

    paypalRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      // ── createOrder: no validation, just create the PayPal order ──
      createOrder: (data, actions) => {
        // Only sanity-check: must have items and a positive amount
        if (cartItems.length === 0 || finalAmount <= 0) {
          setOrderStatus({
            type: "error",
            message: "Your cart is empty. Please add items before paying.",
          });
          return Promise.reject(new Error("Cart is empty"));
        }

        return actions.order.create({
          purchase_units: [
            {
              amount: { value: finalAmount.toFixed(2) },
              description: `Order - ${cartItems.length} items`,
            },
          ],
        });
      },

      // ── onApprove: capture, extract PayPal shipping, merge, then save ──
      onApprove: async (data, actions) => {
        try {
          console.info("[CHECKOUT] onApprove fired – capturing PayPal order…");
          const order = await actions.order.capture();
          console.info("[CHECKOUT] PayPal capture SUCCESS:", order?.id, order?.status);

          // ── Read LATEST state via refs (closure values are stale) ──
          const latestFormData   = formDataRef.current;
          const latestCoupon     = appliedCouponRef.current;
          const latestDiscount   = discountAmountRef.current;
          const latestFinal      = finalAmountRef.current;
          const latestCartItems  = cartItemsRef.current;

          console.info("[CHECKOUT] Latest formData (from ref):", latestFormData);
          console.info("[CHECKOUT] Latest financials:", { latestFinal, latestDiscount, coupon: latestCoupon?.code });

          // Extract shipping details PayPal collected from the buyer
          const paypalShipping = extractPayPalShipping(order);
          console.info("[CHECKOUT] PayPal shipping extracted:", paypalShipping);

          // Merge: user-entered fields take priority, PayPal fills any blanks
          const mergedData = mergeShipping(latestFormData, paypalShipping);
          console.info("[CHECKOUT] Merged shipping data:", mergedData);

          // Persist merged data into React state (so the success page shows it)
          setFormData(mergedData);

          // Pass merged data + latest financials to avoid stale closure
          await handlePaymentSuccess(order, mergedData, {
            finalAmt: latestFinal,
            discountAmt: latestDiscount,
            coupon: latestCoupon,
            items: latestCartItems,
          });
        } catch (err) {
          console.error("[CHECKOUT] onApprove CRITICAL error:", err);
          // Attempt emergency localStorage save so order data is not lost
          try {
            const emergencyData = {
              timestamp: new Date().toISOString(),
              error: String(err?.message || err),
              paypalData: data,
              formData: formDataRef.current,
            };
            const existing = JSON.parse(localStorage.getItem("iceyout_failed_orders") || "[]");
            existing.push(emergencyData);
            localStorage.setItem("iceyout_failed_orders", JSON.stringify(existing));
            console.warn("[CHECKOUT] Emergency save to localStorage:", emergencyData);
          } catch (lsErr) { /* ignore */ }

          setOrderStatus({
            type: "error",
            message: "Payment was captured but order save failed. Your payment is safe — please contact support with PayPal order " + (data?.orderID || "N/A") + ".",
          });
        }
      },

      onError: (err) => {
        // Suppress cart-empty rejections (user already sees the message)
        if (err && String(err.message || err).indexOf("Cart is empty") !== -1) {
          return;
        }
        console.error("PayPal error:", err);
        setOrderStatus({
          type: "error",
          message: "Payment failed. Please try again.",
        });
      },
    });

    buttons.render(paypalRef.current).catch((err) => {
      if (!mounted) return;
      if (err && String(err.message || err).indexOf("Cart is empty") !== -1) {
        return;
      }
      console.error("PayPal Buttons render failed:", err);
      setOrderStatus({
        type: "error",
        message: "Failed to initialize PayPal buttons. Try reloading the page.",
      });
    });

    return () => {
      mounted = false;
      if (paypalRef.current) paypalRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paypalLoaded, finalAmount, cartItems.length]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const checkFormValidity = () => {
    const isValid =
      !!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) &&
      formData.fullName.trim() &&
      formData.phone.trim() &&
      formData.address.trim() &&
      formData.city.trim() &&
      formData.zipCode.trim() &&
      formData.country.trim() &&
      cartItems.length > 0;

    setIsFormValid(isValid);
  };

  useEffect(() => {
    checkFormValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, cartItems]);

  // ── saveOrderViaAPI — sends order to /api/create-order (server-side Appwrite) ──
  // No client-side Appwrite SDK needed. The API route uses APPWRITE_API_KEY.
  const saveOrderViaAPI = async (
    orderData,
    finalAmt,
    discountAmt,
    coupon,
    fd // merged form data (passed from onApprove to avoid stale closure)
  ) => {
    const form = fd || formDataRef.current || formData;

    console.info("[CHECKOUT] saveOrderViaAPI called", {
      paypalOrderId: orderData?.id,
      finalAmt,
      email: form?.email,
      name: form?.fullName,
    });

    // ── helpers ──
    const safeStr = (v) => (v == null ? "" : String(v));
    const safeInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

    const shippingData = {
      fullName: safeStr(form.fullName),
      phone: safeStr(form.phone),
      address: safeStr(form.address),
      city: safeStr(form.city),
      zipCode: safeStr(form.zipCode),
      country: safeStr(form.country),
    };

    const verificationData = {
      id: safeStr(orderData?.id),
      status: safeStr(orderData?.status),
      amount: safeStr(orderData?.purchase_units?.[0]?.amount?.value),
      captureId: safeStr(orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id),
      timestamp: new Date().toISOString(),
    };

    const latestCartItems = cartItemsRef.current || cartItems;
    const itemsData = (Array.isArray(latestCartItems) ? latestCartItems : []).map(
      (item) => ({
        id: safeStr(item.id ?? item.$id),
        name: safeStr(item.name),
        price: item.price,
        quantity: item.quantity,
        size: item.selectedSize,
        variation: item.selectedVariation?.name,
        sku: item.selectedVariation?.sku,
      })
    );

    const captureId = safeStr(orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id);

    // ── Build the same payload the Appwrite document expects ──
    const payload = {
      orderId: Math.floor(Math.random() * 1000000),
      customerId: Math.floor(Math.random() * 1000000),
      orderDate: new Date().toISOString(),
      totalAmount: subtotalAmount || 0,
      shippingAddress: `${safeStr(form.address)}, ${safeStr(form.city)}, ${safeStr(form.zipCode)}`,
      billingAddress: `${safeStr(form.address)}, ${safeStr(form.city)}, ${safeStr(form.zipCode)}`,
      orderStatus: "completed",
      email: safeStr(form.email),
      userId: safeStr(form.email),
      amount: Math.floor(finalAmt || 0),
      currency: "USD",
      paypal_order_id: safeStr(orderData?.id),
      paypal_payment_id: captureId,
      status: safeStr(orderData?.status),
      amountPaise: Math.floor((finalAmt || 0) * 100),
      items_json: JSON.stringify(itemsData).substring(0, 999),
      verification_raw: JSON.stringify(verificationData).substring(0, 999),
      payment_method: "paypal",
      shipping_full_name: safeStr(form.fullName),
      shipping_phone: safeStr(form.phone),
      shipping_line_1: safeStr(form.address),
      shipping_city: safeStr(form.city),
      shipping_postal_code: safeInt(form.zipCode),
      order_id: safeStr(orderData?.id),
      shipping_country: safeStr(form.country),
      shipping: JSON.stringify(shippingData).substring(0, 999),
      items: JSON.stringify(itemsData).substring(0, 999),
      shipping_json: JSON.stringify(shippingData).substring(0, 999),
      amount_formatted: Math.floor((finalAmt || 0) * 100),
      paypal_capture_id: captureId,
      paypal_status: safeStr(orderData?.status),
      coupon_code: safeStr(coupon?.code),
      discount_percent:
        typeof coupon?.discountPercent === "number" ? coupon.discountPercent : 0,
      discount_amount: Number(discountAmt || 0),
      influencer: safeStr(coupon?.influencer),
      // Private fields used by API route only (stripped before Appwrite insert)
      _couponId: coupon?.$id || "",
      _couponCode: safeStr(coupon?.code),
    };

    console.info("[CHECKOUT] Payload built:", {
      email: payload.email,
      amount: payload.amount,
      paypal_order_id: payload.paypal_order_id,
      paypal_capture_id: payload.paypal_capture_id,
      itemCount: itemsData.length,
      fieldCount: Object.keys(payload).length,
    });

    // ── POST to /api/create-order with retry (3 attempts) ──
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.info(`[CHECKOUT] /api/create-order attempt ${attempt}/3…`);
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMsg = json?.error || `HTTP ${res.status}`;
          console.error(`[CHECKOUT] API attempt ${attempt} FAILED:`, errMsg, json);
          // 400-level errors won't self-fix — stop retrying
          if (res.status >= 400 && res.status < 500) {
            throw new Error(`Order API error (${res.status}): ${errMsg}`);
          }
          lastError = new Error(errMsg);
          if (attempt < 3) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.info(`[CHECKOUT] Retrying in ${delay}ms…`);
            await sleep(delay);
          }
          continue;
        }

        console.info("[CHECKOUT] ✅ Order saved via API:", json.orderId);
        // Return a shape compatible with what handlePaymentSuccess expects
        return { $id: json.orderId, ...payload };
      } catch (err) {
        lastError = err;
        console.error(`[CHECKOUT] /api/create-order attempt ${attempt} threw:`, err?.message);
        if (attempt < 3) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await sleep(delay);
        }
      }
    }

    // All attempts failed
    const finalErr = lastError || new Error("Order API failed after 3 attempts");
    console.error("[CHECKOUT] All API save attempts failed:", finalErr);
    throw finalErr;
  };

  // Send order confirmation email via EmailJS (client-side)
  const sendOrderConfirmationEmail = async (orderPayload = {}, paypalOrder) => {
    if (!ENV_EMAILJS_SERVICE_ID || !ENV_EMAILJS_TEMPLATE_ID) {
      console.warn("EmailJS config missing - skipping email send");
      return { ok: false, reason: "EmailJS not configured" };
    }

    try {
      const cartItemsParam =
        Array.isArray(orderPayload.items) && orderPayload.items.length > 0
          ? orderPayload.items
          : Array.isArray(cartItems)
          ? cartItems
          : [];

      const formDataParam =
        orderPayload.shipping || orderPayload.formData || formData || {};

      console.debug("sendOrderConfirmationEmail called", {
        itemsCount: cartItemsParam.length,
        email: orderPayload.email || formDataParam.email || formData.email,
        orderId:
          orderPayload.order_id || orderPayload.orderId || paypalOrder?.id,
      });

      const escapeHtml = (str = "") =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      // Build orders array with 'price' (template expects {{price}})
      const ordersArray = cartItemsParam.map((it = {}) => {
        const name = it.name || it.title || it.product_name || "Item";
        const units = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
        const rawPrice =
          Number(it.price ?? it.unit_price ?? it.amount ?? 0) || 0;
        const price = rawPrice.toFixed(2);
        const image_url =
          (it.image || it.img || it.thumbnail || "").toString() || "";
        return { image_url, name, units, price };
      });

      // HTML fallback table (use {{{orders_html}}} in template if supported)
      const ordersHtml = cartItemsParam
        .map((it = {}) => {
          const name = it.name || it.title || it.product_name || "Item";
          const qty = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
          const rawPrice =
            Number(it.price ?? it.unit_price ?? it.amount ?? 0) || 0;
          const price = rawPrice.toFixed(2);
          const imageUrl = it.image || it.img || it.thumbnail || "";

          return `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 0; vertical-align:top;">
              ${
                imageUrl
                  ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(
                      name
                    )}" width="48" style="display:block;border:0;"/>`
                  : ""
              }
            </td>
            <td style="padding:8px 12px; vertical-align:top;">
              <div style="font-weight:600;">${escapeHtml(name)}</div>
              <div style="font-size:12px;color:#666;">QTY: ${qty}</div>
            </td>
            <td style="padding:8px 0; text-align:right; vertical-align:top; font-weight:600;">
              $${price}
            </td>
          </tr>`;
        })
        .join("");

      const ordersTableHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        <tbody>
          ${ordersHtml}
        </tbody>
      </table>
    `;

      const ordersText = cartItemsParam
        .map((it = {}) => {
          const name = it.name || it.title || it.product_name || "Item";
          const qty = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
          const price = Number(
            it.price ?? it.unit_price ?? it.amount ?? 0
          ).toFixed(2);
          return `${name} x ${qty} - $${price}`;
        })
        .join("\n");

      const parseNum = (v) => {
        if (v == null) return 0;
        if (typeof v === "number") return v;
        if (typeof v === "string" && v.trim() !== "") {
          const p = Number(v);
          return isNaN(p) ? 0 : p;
        }
        return 0;
      };

      const shippingCost = parseNum(
        orderPayload.shipping?.shippingCost ??
          orderPayload.shipping?.shipping ??
          orderPayload.shippingCost ??
          0
      );
      const taxAmount = parseNum(
        orderPayload.taxAmount ?? orderPayload.tax ?? 0
      );

      const safeFinal =
        typeof orderPayload.finalAmount !== "undefined" &&
        orderPayload.finalAmount !== null
          ? Number(orderPayload.finalAmount)
          : parseNum(orderPayload.total ?? orderPayload.amount ?? finalAmount);

      const costObj = {
        shipping: shippingCost.toFixed(2),
        tax: taxAmount.toFixed(2),
        total: (safeFinal || 0).toFixed(2),
      };

      // Template params: include nested cost and flattened keys
      const templateParams = {
        email: (
          orderPayload.email ||
          formDataParam.email ||
          formData.email ||
          ""
        ).toString(),
        name: (
          orderPayload.customerName ||
          orderPayload.name ||
          formDataParam.fullName ||
          formData.fullName ||
          ""
        ).toString(),
        order_id:
          paypalOrder?.id ||
          orderPayload.order_id ||
          orderPayload.orderId ||
          orderPayload.$id ||
          "",
        orders: ordersArray,
        orders_html: ordersTableHtml,
        orders_text: ordersText,
        shipping_address: `${formDataParam.address || ""}${
          formDataParam.city ? ", " + formDataParam.city : ""
        }${formDataParam.zipCode ? ", " + formDataParam.zipCode : ""}${
          formDataParam.country ? ", " + formDataParam.country : ""
        }`,
        // nested object for safer mustache resolution: use {{cost.shipping}} in template
        cost: costObj,
        // flattened variants in case template expects them
        "cost.shipping": costObj.shipping,
        "cost.tax": costObj.tax,
        "cost.total": costObj.total,
        cost_shipping: costObj.shipping,
        cost_tax: costObj.tax,
        cost_total: costObj.total,
        discount_amount: Number(orderPayload.discount ?? 0).toFixed(2),
      };

      console.debug("Email templateParams preview", {
        order_id: templateParams.order_id,
        email: templateParams.email,
        name: templateParams.name,
        orders_count: Array.isArray(templateParams.orders)
          ? templateParams.orders.length
          : 0,
        orders_html_length: String(templateParams.orders_html).length,
        cost_total: templateParams.cost?.total ?? templateParams.cost_total,
      });

      // Ensure emailjs has been initialized elsewhere: emailjs.init("YOUR_USER_ID");
      const res = await emailjs.send(
        ENV_EMAILJS_SERVICE_ID,
        ENV_EMAILJS_TEMPLATE_ID,
        templateParams
      );

      console.info("EmailJS send result:", res);
      return { ok: true, result: res };
    } catch (err) {
      console.error("EmailJS send error:", err);
      return { ok: false, reason: err?.message || "Failed to send email" };
    }
  };

  // small helper for manual testing of EmailJS
  const testSendEmail = async () => {
    if (
      !ENV_EMAILJS_SERVICE_ID ||
      !ENV_EMAILJS_TEMPLATE_ID ||
      !ENV_EMAILJS_PUBLIC_KEY
    ) {
      console.warn("EmailJS env missing:", {
        ENV_EMAILJS_SERVICE_ID,
        ENV_EMAILJS_TEMPLATE_ID,
        ENV_EMAILJS_PUBLIC_KEY,
      });
      return;
    }

    try {
      const params = {
        email: formData?.email || "sabuqatada@gmail.com",
        name: formData?.fullName || "Test User",
        order_id: "TEST-1234",
        orders_text: "Test item x1 - $9.99",
        cost_total: "9.99",
      };
      console.debug("Test email params:", params);
      const res = await emailjs.send(
        ENV_EMAILJS_SERVICE_ID,
        ENV_EMAILJS_TEMPLATE_ID,
        params
      );
      console.info("EmailJS test send result:", res);
    } catch (err) {
      console.error("EmailJS test send error:", err);
    }
  };

  // --- small helper: escape HTML text to avoid breaking template when injecting raw names ---
  function escapeHtmlLocal(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const handlePaymentSuccess = async (order, mergedFormData, latestFinancials) => {
    setLoading(true);
    // Use merged data passed from onApprove (avoids stale closure)
    const fd = mergedFormData || formDataRef.current || formData;
    // Use latest financials passed from onApprove (avoids stale closure)
    const useFinal    = latestFinancials?.finalAmt    ?? finalAmountRef.current   ?? finalAmount;
    const useDiscount = latestFinancials?.discountAmt ?? discountAmountRef.current ?? discountAmount;
    const useCoupon   = latestFinancials?.coupon      ?? appliedCouponRef.current  ?? appliedCoupon;
    const useItems    = latestFinancials?.items        ?? cartItemsRef.current      ?? cartItems;

    console.info("[CHECKOUT] handlePaymentSuccess called", {
      paypalOrderId: order?.id,
      formEmail: fd?.email,
      formName: fd?.fullName,
      finalAmount: useFinal,
      discount: useDiscount,
      coupon: useCoupon?.code,
      itemCount: useItems?.length,
    });

    try {
      const savedOrder = await saveOrderViaAPI(
        order,
        useFinal,
        useDiscount,
        useCoupon,
        fd
      );

      console.info("[CHECKOUT] Order saved via API:", savedOrder?.$id);

      // Track Meta Pixel Purchase event after successful order save
      if (savedOrder && savedOrder.$id) {
        try {
          if (typeof window.trackMetaPixelPurchase === 'function') {
            const productIds = useItems.map(item => item.$id || item.id || '').filter(Boolean);
            const productNames = useItems.map(item => item.name || '').filter(Boolean);
            const productQuantities = useItems.map(item => item.quantity || 1);
            
            window.trackMetaPixelPurchase(
              useFinal || 0,
              'USD',
              productIds,
              productNames,
              productQuantities
            );
          }
        } catch (e) {
          console.warn('Meta Pixel Purchase tracking failed:', e);
        }
      }

      setCompletedOrder({
        ...savedOrder,
        paypalOrderId: order.id,
        items: useItems,
      });

      // Build explicit payload for email send
      const emailOrderPayload = {
        items: useItems.map((it) => ({
          id: it.id ?? it.$id,
          name: it.name || it.title,
          price: it.price,
          quantity: it.quantity ?? 1,
          image: it.image || it.img,
          selectedSize: it.selectedSize,
          selectedVariation: it.selectedVariation,
        })),
        email: fd.email,
        customerName: fd.fullName,
        shipping: {
          address: fd.address,
          city: fd.city,
          zipCode: fd.zipCode,
          country: fd.country,
          phone: fd.phone,
        },
        total: useFinal,
        discount: useDiscount,
        order_id: savedOrder?.$id ?? order.id,
        finalAmount: useFinal,
      };

      // Attempt to send confirmation email (best-effort, never blocks success)
      try {
        console.info("[CHECKOUT] Sending confirmation email…");
        const emailRes = await sendOrderConfirmationEmail(
          emailOrderPayload,
          order
        );
        if (!emailRes.ok) {
          console.warn("[CHECKOUT] Order saved but email failed:", emailRes.reason);
          setOrderStatus((prev) => ({ ...(prev || {}), emailSent: false }));
        } else {
          console.info("[CHECKOUT] Confirmation email sent OK");
          setOrderStatus((prev) => ({ ...(prev || {}), emailSent: true }));
        }
      } catch (e) {
        console.warn("[CHECKOUT] Email send threw:", e);
        setOrderStatus((prev) => ({ ...(prev || {}), emailSent: false }));
      }

      try {
        if (typeof clearCart === "function") clearCart();
        else if (typeof setCartItems === "function") setCartItems([]);
      } catch (e) {
        console.warn("Failed to clear cart via context", e);
      }

      setOrderStatus({
        type: "success",
        message: "Payment successful! Order confirmation sent to your email.",
        orderId: order.id,
      });
    } catch (error) {
      // ──────────────────────────────────────────────────────────────────
      // CRITICAL: Log the FULL error so we know WHY the order save failed
      // ──────────────────────────────────────────────────────────────────
      console.error("[CHECKOUT] handlePaymentSuccess FAILED:", error);
      console.error("[CHECKOUT] Error details:", {
        message: error?.message,
        code: error?.code,
        type: error?.type,
        response: error?.response,
      });

      // Emergency save to localStorage so the order is not permanently lost
      try {
        const recovery = {
          timestamp: new Date().toISOString(),
          paypalOrderId: order?.id,
          paypalStatus: order?.status,
          captureId: order?.purchase_units?.[0]?.payments?.captures?.[0]?.id,
          formData: fd,
          finalAmount: useFinal,
          discount: useDiscount,
          coupon: useCoupon?.code,
          items: useItems.map(it => ({ name: it.name, price: it.price, qty: it.quantity })),
          error: String(error?.message || error),
          errorCode: error?.code,
        };
        const existing = JSON.parse(localStorage.getItem("iceyout_failed_orders") || "[]");
        existing.push(recovery);
        localStorage.setItem("iceyout_failed_orders", JSON.stringify(existing));
        console.warn("[CHECKOUT] Emergency order data saved to localStorage:", recovery);
      } catch (lsErr) { /* ignore */ }

      setOrderStatus({
        type: "error",
        message:
          "Payment was captured successfully but we couldn't save the order. " +
          "Your payment is safe. Please contact support with PayPal Order ID: " +
          (order?.id || "N/A") + ". Error: " + (error?.message || "Unknown"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecrease = (item) => updateQuantity?.(item.$id ?? item.id, -1);
  const handleIncrease = (item) => updateQuantity?.(item.$id ?? item.id, +1);
  const handleRemove = (item) => removeFromCart?.(item.$id ?? item.id);

  const loadUserOrders = async () => {
    try {
      let attempts = 0;
      while (!appwriteDatabases && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (!appwriteDatabases) return;

      const Account = window.Appwrite?.Account;
      let appwriteUserId = null;
      if (Account && appwriteClient) {
        try {
          const account = new Account(appwriteClient);
          const me = await account.get();
          appwriteUserId = me?.$id || null;
        } catch {
          appwriteUserId = null;
        }
      }

      if (!window.Appwrite || !window.Appwrite.Query) return;
      const { Query } = window.Appwrite;

      if (appwriteUserId) {
        try {
          const responseById = await appwriteDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_ID,
            [Query.equal("userId", appwriteUserId)]
          );
          const byIdDocs = responseById.documents || [];
          if (byIdDocs.length > 0) {
            setUserOrders(byIdDocs);
            return;
          }
        } catch (e) {
          // ignore and fall back to email query
        }
      }

      if (formData.email) {
        try {
          const responseByEmail = await appwriteDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_ID,
            [Query.equal("userId", formData.email)]
          );
          setUserOrders(responseByEmail.documents || []);
        } catch (e) {
          console.error("Error loading orders by email:", e);
          setUserOrders([]);
        }
      } else {
        setUserOrders([]);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  // Coupon helpers (dynamic, queries Appwrite)
  const validateCouponFromAppwrite = async (code) => {
    if (!code || typeof code !== "string") {
      return { ok: false, reason: "Enter a coupon code" };
    }

    try {
      // Ensure Appwrite is ready
      const ready = await ensureAppwriteReady({ timeoutMs: 10000 });
      if (!ready || !appwriteDatabases) {
        console.error("Appwrite not ready for coupon validation");
        return { ok: false, reason: "Service unavailable. Please try again." };
      }

      if (!window.Appwrite || !window.Appwrite.Query) {
        return { ok: false, reason: "Service unavailable. Please try again." };
      }
      const { Query } = window.Appwrite;
      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        return { ok: false, reason: "Enter a coupon code" };
      }

      // Query Appwrite coupons collection: code == inputCode AND active == true
      const queries = [
        Query.equal("code", normalizedCode),
        Query.equal("active", true),
      ];

      console.debug("Querying coupons collection:", {
        databaseId: APPWRITE_DATABASE_ID,
        collectionId: APPWRITE_COUPONS_COLLECTION_ID,
        code: normalizedCode,
      });

      const response = await appwriteDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_COUPONS_COLLECTION_ID,
        queries
      );

      const coupons = response?.documents || [];
      
      console.debug("Coupon query result:", {
        found: coupons.length,
        documents: coupons,
      });

      if (coupons.length === 0) {
        return { ok: false, reason: "Invalid coupon code" };
      }

      const coupon = coupons[0];

      // Validate discount_percent is a valid number
      const discountPercent = Number(coupon.discount_percent);
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        console.error("Invalid discount_percent in coupon:", coupon);
        return { ok: false, reason: "Invalid discount configuration" };
      }

      // Return normalized coupon data
      return {
        ok: true,
        coupon: {
          $id: coupon.$id,
          code: coupon.code,
          discountPercent: discountPercent,
          influencer: coupon.influencer || null,
        },
      };
    } catch (err) {
      console.error("validateCouponFromAppwrite error:", err);
      console.error("Error details:", {
        message: err?.message,
        code: err?.code,
        type: err?.type,
      });
      return { ok: false, reason: "Failed to validate coupon. Please try again." };
    }
  };

  const applyCoupon = async () => {
    setCouponError("");
    setCouponLoading(true);
    try {
      // Read user input, trim and convert to uppercase
      const code = (couponInput || "").trim().toUpperCase();
      
      if (!code) {
        setCouponError("Enter a coupon code");
        setCouponLoading(false);
        return;
      }

      // Prevent applying multiple coupons
      if (appliedCoupon) {
        setCouponError("Please remove the current coupon before applying a new one");
        setCouponLoading(false);
        return;
      }

      console.debug("Applying coupon:", code);

      // Query Appwrite and validate
      const res = await validateCouponFromAppwrite(code);
      
      if (!res.ok) {
        setCouponError(res.reason || "Invalid coupon");
        setCouponLoading(false);
        return;
      }

      // Store coupon data for order submission
      setAppliedCoupon(res.coupon);
      setCouponError("");
      setCouponLoading(false);
      
      console.debug("Coupon applied successfully:", res.coupon);
    } catch (err) {
      console.error("applyCoupon error:", err);
      setCouponError("Failed to apply coupon. Please try again.");
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  // Handle Wise payment test button
  const handleWisePayment = async () => {
    setWiseLoading(true);
    setWiseError(null);

    try {
      const response = await fetch("/api/wise/create-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 100,
          orderId: "iceyout-test-001",
        }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = "Failed to create payment link";
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            if (errorText && errorText.trim()) {
              errorMessage = errorText;
            } else {
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
          } catch (textError) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Parse successful response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      // Validate payment URL
      if (!data.paymentUrl) {
        throw new Error("Payment URL not received from server");
      }

      // Validate URL format before redirecting
      try {
        const url = new URL(data.paymentUrl);
        if (!url.protocol.startsWith("http")) {
          throw new Error("Invalid payment URL format");
        }
      } catch (urlError) {
        throw new Error("Invalid payment URL received. Please contact support.");
      }

      // Redirect to Wise payment URL
      window.location.href = data.paymentUrl;
      // Note: setWiseLoading(false) is not called here because we're redirecting
      
    } catch (error) {
      console.error("Wise payment error:", error);
      
      // Provide user-friendly error message
      let userMessage = "Failed to create payment link. Please try again.";
      if (error.message) {
        userMessage = error.message;
      } else if (error instanceof TypeError && error.message.includes("fetch")) {
        userMessage = "Network error. Please check your connection and try again.";
      }
      
      setWiseError(userMessage);
      setWiseLoading(false);
    }
  };

  // Local page state
  const [currentPageLocal, setCurrentPageLocal] = useState("checkout");

  // UI: success page
  if (currentPageLocal === "success" || orderStatus?.type === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Order Confirmed!
            </h2>
            <p className="text-gray-600 mb-6">{orderStatus?.message}</p>

            {completedOrder && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Order ID</p>
                    <p className="font-mono text-sm text-gray-800">
                      {completedOrder.paypalOrderId}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Shipping Address:
                  </p>
                  <p className="text-sm text-gray-600">
                    {completedOrder.shippingAddress}
                  </p>
                </div>

                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Order Items:
                  </p>
                  {completedOrder.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm mb-2"
                    >
                      <span className="text-gray-600">
                        {item.name} x {item.quantity}
                        {item.size ? ` (${item.size})` : ""}
                      </span>
                      <span className="text-gray-800 font-medium">
                        ${((item.price || 0) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  navigate("/profile");
                }}
                className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                View My Orders
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex-1 border border-gray-900 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Orders page
  if (currentPageLocal === "orders") {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setCurrentPageLocal("checkout")}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          </div>

          {userOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No orders found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userOrders.map((order) => (
                <div
                  key={order.$id}
                  className="bg-white rounded-lg shadow-sm p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Order #{order.orderId}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.orderStatus === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {order.orderStatus}
                    </span>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Shipping:</strong> {order.shippingAddress}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      Total: ${order.totalAmount?.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Checkout UI (markup with promo UI included)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-full transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-gray-800">
              Secure Checkout
            </h1>
            <div className="flex items-center gap-2 text-gray-600 mt-1">
              <Lock className="w-4 h-4" />
              <span className="text-sm">256-bit SSL Encrypted</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Order Summary
              </h2>
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    Your cart is empty
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.$id ?? item.id} className="flex gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity}
                        </p>
                        {item.selectedSize && (
                          <p className="text-xs text-gray-500">
                            Size: {item.selectedSize}
                          </p>
                        )}
                        <p className="font-semibold text-gray-800 mt-1">
                          ${(Number(item.price) || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDecrease(item)}
                            className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncrease(item)}
                            className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleRemove(item)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t pt-4 space-y-2">
                {/* Coupon input */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coupon code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="Enter coupon (e.g. ICEYASH10)"
                    />
                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponLoading}
                        className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {couponLoading ? "Applying..." : "Apply"}
                      </button>
                    )}
                  </div>
                  {couponError && (
                    <p className="mt-1 text-xs text-red-600">{couponError}</p>
                  )}
                  {appliedCoupon && !couponError && (
                    <p className="mt-1 text-xs text-green-600">
                      Coupon <span className="font-semibold">{appliedCoupon.code}</span>{" "}
                      applied ({discountPercent}% off)
                    </p>
                  )}
                </div>
                {/* Trust Badges & Delivery Info - Above price breakdown */}
                <div className="mb-4 pb-4 border-b border-gray-200 space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                    <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-900">Free Worldwide Shipping</p>
                      <p className="text-xs text-blue-700">Estimated delivery: 5-6 business days</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-medium text-gray-700">7-Day Returns</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-medium text-gray-700">Secure Payment</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Discount</span>
                  <span className="text-red-600">
                    -${discountAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="text-green-600 font-medium">FREE</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold text-gray-800 pt-2 border-t">
                  <span>Total</span>
                  <span>${finalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {orderStatus?.type === "error" && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800">{orderStatus.message}</p>
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Shipping Information
              </h2>

              <div className="space-y-4 mb-8">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                        errors.fullName ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                        errors.email ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                      errors.phone ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                      errors.address ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                        errors.city ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="New York"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                        errors.zipCode ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="10001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                        errors.country ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="USA"
                    />
                  </div>
                </div>
              </div>

              {/* Return/Refund Policy & WhatsApp Reassurance - Before Payment */}
              <div className="border-t pt-6 mb-6 space-y-3">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">7-Day Easy Returns</p>
                      <p className="text-xs text-gray-600 mt-0.5">Full refund if not satisfied. No questions asked.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Authenticity Guarantee</p>
                      <p className="text-xs text-gray-600 mt-0.5">100% authentic. Passes diamond tester verification.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-6 h-6" />
                  Payment Method
                </h3>

                <div className="bg-gray-50 rounded-lg p-6">
                  <div>
                    <div
                      ref={paypalRef}
                      id="paypal-button-container"
                      className="min-h-[150px]"
                    />
                    {!paypalLoaded && (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">
                          Loading PayPal...
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span>Secure payment powered by PayPal</span>
                </div>

                {/* TODO: Re-enable Wise after Wise team confirmation */}
                {/* Wise Test Payment Button - Temporarily disabled */}
                {WISE_PAYMENT_ENABLED && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleWisePayment}
                    disabled={wiseLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    {wiseLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Creating payment link...</span>
                      </>
                    ) : (
                      <span>Pay with Wise (TEST)</span>
                    )}
                  </button>
                  {wiseError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{wiseError}</p>
                    </div>
                  )}
                </div>
                )}
              </div>

              {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-800 font-semibold">
                      Processing your order...
                    </p>
                  </div>
                </div>
              )}

              {/* quick test button (dev only) */}
              {/* <div className="mt-4 text-right">
                <button
                  onClick={testSendEmail}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Send test email
                </button>
              </div> */}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            By completing this purchase, you agree to our Terms of Service and
            Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
