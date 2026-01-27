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

/**
 * PROMO FEATURE (client-side sample catalog)
 */
const PROMO_CATALOG = {
  WELCOME10: {
    code: "WELCOME10",
    type: "percent",
    value: 10,
    minCartValue: 0,
    expiresAt: "2026-12-31T23:59:59.000Z",
    description: "10% off for new customers",
  },
  FLAT50: {
    code: "FLAT50",
    type: "fixed",
    value: 50,
    minCartValue: 200,
    expiresAt: "2026-12-31T23:59:59.000Z",
    description: "$50 off orders over $200",
  },
  FREESHIP: {
    code: "FREESHIP",
    type: "fixed",
    value: 10,
    minCartValue: 0,
    expiresAt: "2026-12-31T23:59:59.000Z",
    description: "$10 off (free shipping promo)",
  },
};
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

  const cartItems = Array.isArray(cart) ? cart : [];
  const subtotalAmount =
    typeof getTotal === "function"
      ? getTotal()
      : cartItems.reduce(
          (s, it) => s + (Number(it.price) || 0) * (it.quantity || 1),
          0
        );

  // Promo state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    // eagerly pre-load Appwrite so it's ready by checkout time
    (async () => {
      const ok = await ensureAppwriteReady({ timeoutMs: 8000 });
      console.debug("Appwrite preload ready:", ok);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // compute discount and final total
  const { discountAmount, finalAmount } = useMemo(() => {
    if (!appliedPromo)
      return { discountAmount: 0, finalAmount: subtotalAmount };
    const promo = appliedPromo;
    let discount = 0;
    if (promo.type === "percent") {
      discount = (subtotalAmount * Number(promo.value || 0)) / 100;
    } else {
      discount = Number(promo.value || 0);
    }
    if (discount > subtotalAmount) discount = subtotalAmount;
    const final = Math.max(0, subtotalAmount - discount);
    return { discountAmount: Number(discount), finalAmount: Number(final) };
  }, [appliedPromo, subtotalAmount]);

  // Render PayPal buttons when SDK loaded, form valid, and ref present
  useEffect(() => {
    let mounted = true;
    if (!paypalLoaded || !isFormValid || !paypalRef.current || !window.paypal) {
      return;
    }

    paypalRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [
            {
              amount: { value: finalAmount.toFixed(2) },
              description: `Order - ${cartItems.length} items`,
            },
          ],
        });
      },
      onApprove: async (data, actions) => {
        try {
          const order = await actions.order.capture();
          await handlePaymentSuccess(order);
        } catch (err) {
          console.error("onApprove capture error:", err);
          setOrderStatus({
            type: "error",
            message: "Payment capture failed. Please contact support.",
          });
        }
      },
      onError: (err) => {
        console.error("PayPal error:", err);
        setOrderStatus({
          type: "error",
          message: "Payment failed. Please try again.",
        });
      },
    });

    buttons.render(paypalRef.current).catch((err) => {
      if (!mounted) return;
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
  }, [paypalLoaded, isFormValid, finalAmount, cartItems.length]);

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

  // Helper: try to get current Appwrite user id (if signed in)
  const getAppwriteUserId = async () => {
    try {
      let attempts = 0;
      while (!appwriteClient && attempts < 50) {
        await sleep(100);
        attempts++;
      }
      if (!appwriteClient || !window.Appwrite) return null;
      const Account = window.Appwrite.Account;
      if (!Account) return null;
      const account = new Account(appwriteClient);
      const me = await account.get();
      return me?.$id || null;
    } catch (e) {
      return null;
    }
  };

  // ---------- REPLACE EXISTING saveOrderToAppwrite WITH THIS ----------
  const saveOrderToAppwrite = async (
    orderData,
    finalAmt,
    discountAmt,
    promo
  ) => {
    try {
      // ensure SDK + clients are ready
      const ready = await ensureAppwriteReady({ timeoutMs: 10000 });
      if (!ready || !appwriteDatabases) {
        throw new Error("Appwrite not initialized (timed out)");
      }

      // now safe to use window.Appwrite
      const { ID } = window.Appwrite;

      // try get logged-in user id (best-effort)
      let appwriteUserId = null;
      try {
        appwriteUserId = await getAppwriteUserId();
      } catch (e) {
        appwriteUserId = null;
      }

      const shippingData = {
        fullName: formData.fullName,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        zipCode: formData.zipCode,
        country: formData.country,
      };

      const verificationData = {
        id: orderData?.id ?? null,
        status: orderData?.status ?? null,
        amount: orderData?.purchase_units?.[0]?.amount?.value ?? null,
        captureId:
          orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
        timestamp: new Date().toISOString(),
      };

      const itemsData = (Array.isArray(cartItems) ? cartItems : []).map(
        (item) => ({
          id: item.id ?? item.$id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.selectedSize,
          variation: item.selectedVariation?.name,
          sku: item.selectedVariation?.sku,
        })
      );

      const payload = {
        orderId: Math.floor(Math.random() * 1000000),
        customerId: Math.floor(Math.random() * 1000000),
        orderDate: new Date().toISOString(),
        totalAmount: subtotalAmount,
        shippingAddress: `${formData.address}, ${formData.city}, ${formData.zipCode}`,
        billingAddress: `${formData.address}, ${formData.city}, ${formData.zipCode}`,
        orderStatus: "completed",
        userId: appwriteUserId || formData.email,
        amount: Math.floor(finalAmt || 0),
        currency: "USD",
        paypal_order_id: orderData?.id ?? null,
        paypal_payment_id:
          orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
        status: orderData?.status ?? null,
        amountPaise: Math.floor((finalAmt || 0) * 100),
        items_json: JSON.stringify(itemsData).substring(0, 999),
        verification_raw: JSON.stringify(verificationData).substring(0, 999),
        payment_method: "paypal",
        shipping_full_name: formData.fullName,
        shipping_phone: formData.phone,
        shipping_line_1: formData.address,
        shipping_city: formData.city,
        shipping_postal_code: parseInt(formData.zipCode) || 0,
        order_id: orderData?.id ?? null,
        shipping_country: formData.country,
        shipping: JSON.stringify(shippingData).substring(0, 999),
        items: JSON.stringify(itemsData).substring(0, 999),
        shipping_json: JSON.stringify(shippingData).substring(0, 999),
        amount_formatted: Math.floor((finalAmt || 0) * 100),
        paypal_capture_id:
          orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
        paypal_status: orderData?.status ?? null,
      };

      const response = await appwriteDatabases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_ID,
        ID.unique(),
        payload
      );

      return response;
    } catch (error) {
      console.error("Appwrite error:", error);
      throw error;
    }
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

  const handlePaymentSuccess = async (order) => {
    setLoading(true);
    try {
      const savedOrder = await saveOrderToAppwrite(
        order,
        finalAmount,
        discountAmount,
        appliedPromo
      );

      setCompletedOrder({
        ...savedOrder,
        paypalOrderId: order.id,
        items: cartItems,
      });

      // Build explicit payload for email send (avoid relying on Appwrite doc shape)
      const emailOrderPayload = {
        items: cartItems.map((it) => ({
          id: it.id ?? it.$id,
          name: it.name || it.title,
          price: it.price,
          quantity: it.quantity ?? 1,
          image: it.image || it.img,
          selectedSize: it.selectedSize,
          selectedVariation: it.selectedVariation,
        })),
        email: formData.email,
        customerName: formData.fullName,
        shipping: {
          address: formData.address,
          city: formData.city,
          zipCode: formData.zipCode,
          country: formData.country,
          phone: formData.phone,
        },
        total: finalAmount,
        discount: discountAmount,
        order_id: savedOrder?.$id ?? order.id,
        finalAmount,
      };
      // console.log(emailOrderPayload);
      // Attempt to send confirmation email (best-effort)
      try {
        const emailRes = await sendOrderConfirmationEmail(
          emailOrderPayload,
          order
        );
        // console.log(emailRes);
        if (!emailRes.ok) {
          console.warn("Order saved but email failed:", emailRes.reason);
          setOrderStatus((prev) => ({ ...(prev || {}), emailSent: false }));
        } else {
          setOrderStatus((prev) => ({ ...(prev || {}), emailSent: true }));
        }
      } catch (e) {
        console.warn("Email send threw:", e);
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
      setOrderStatus({
        type: "error",
        message:
          "Payment processed but failed to save order. Please contact support.",
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

  // Promo helpers
  const validatePromoLocal = (code) => {
    if (!code || typeof code !== "string")
      return { ok: false, reason: "Invalid code" };
    const upper = code.trim().toUpperCase();
    const promo = PROMO_CATALOG[upper];
    if (!promo) return { ok: false, reason: "Promo code not found" };

    if (promo.expiresAt) {
      const exp = new Date(promo.expiresAt);
      if (isNaN(exp.getTime()) === false && exp < new Date()) {
        return { ok: false, reason: "Promo code expired" };
      }
    }

    if (promo.minCartValue && subtotalAmount < Number(promo.minCartValue)) {
      return {
        ok: false,
        reason: `Minimum cart value $${promo.minCartValue} required`,
      };
    }

    return { ok: true, promo };
  };

  const applyPromo = async () => {
    setPromoError("");
    setPromoLoading(true);
    try {
      const code = (promoInput || "").trim().toUpperCase();
      if (!code) {
        setPromoError("Enter a promo code");
        setPromoLoading(false);
        return;
      }

      const res = validatePromoLocal(code);
      if (!res.ok) {
        setPromoError(res.reason || "Invalid promo");
        setPromoLoading(false);
        return;
      }

      setAppliedPromo(res.promo);
      setPromoError("");
      setPromoLoading(false);
    } catch (err) {
      console.error("applyPromo err", err);
      setPromoError("Failed to apply promo");
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError("");
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

              <div className="border-t pt-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-6 h-6" />
                  Payment Method
                </h3>

                <div className="bg-gray-50 rounded-lg p-6">
                  {!isFormValid ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">
                        Please complete all shipping information and add items
                        to cart to proceed
                      </p>
                    </div>
                  ) : (
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
                  )}
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
