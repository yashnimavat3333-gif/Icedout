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
const APPWRITE_COUPONS_COLLECTION_ID =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID || "coupons"
    : "coupons";

const ENV_PAYPAL_CLIENT_ID =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_PAYPAL_CLIENT_ID
    : process.env.REACT_APP_PAYPAL_CLIENT_ID || "";

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

let appwriteClient = null;
let appwriteDatabases = null;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const APPWRITE_SDK_SRC = "https://cdn.jsdelivr.net/npm/appwrite@14.0.1";

async function ensureAppwriteReady({ timeoutMs = 8000 } = {}) {
  if (appwriteDatabases && appwriteClient) return true;

  if (typeof window !== "undefined" && window.Appwrite) {
    try {
      const { Client, Databases } = window.Appwrite;
      if (!appwriteClient) {
        appwriteClient = new Client()
          .setEndpoint(APPWRITE_ENDPOINT)
          .setProject(APPWRITE_PROJECT_ID);
      }
      if (!appwriteDatabases) appwriteDatabases = new Databases(appwriteClient);
      return true;
    } catch (err) {
      console.warn("Appwrite instantiate error:", err);
    }
  }

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
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  if (existingScript) {
    return await waitForNamespace(timeoutMs);
  }

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
      } catch {
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

    setTimeout(() => {
      if (!resolved) {
        try { cleanup(); } catch {}
        resolve(false);
      }
    }, timeoutMs + 200);
  });
}

const WISE_PAYMENT_ENABLED = false;

const CHECKOUT_STEPS = [
  { num: 1, label: "Shipping" },
  { num: 2, label: "Payment" },
  { num: 3, label: "Confirmation" },
];

const REQUIRED_SHIPPING_FIELDS = [
  { key: "fullName", label: "Full Name", type: "text", placeholder: "John Doe" },
  { key: "email", label: "Email Address", type: "email", placeholder: "john@example.com" },
  { key: "phone", label: "Phone Number", type: "tel", placeholder: "+1 (555) 123-4567" },
  { key: "address", label: "Street Address", type: "text", placeholder: "123 Main Street" },
  { key: "city", label: "City", type: "text", placeholder: "New York" },
  { key: "zipCode", label: "ZIP / Postal Code", type: "text", placeholder: "10001" },
  { key: "country", label: "Country", type: "text", placeholder: "USA" },
];

const StepIndicator = ({ current }) => (
  <div className="flex items-center justify-center mb-8 px-4">
    {CHECKOUT_STEPS.map((step, idx) => (
      <React.Fragment key={step.num}>
        {idx > 0 && (
          <div
            className={`flex-1 h-0.5 max-w-[80px] mx-1 sm:mx-3 transition-colors duration-300 ${
              current >= step.num ? "bg-blue-600" : "bg-gray-300"
            }`}
          />
        )}
        <div className="flex flex-col items-center min-w-[60px]">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              current > step.num
                ? "bg-green-500 text-white"
                : current === step.num
                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {current > step.num ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              step.num
            )}
          </div>
          <span
            className={`text-xs mt-1.5 font-medium transition-colors duration-300 ${
              current >= step.num ? "text-blue-700" : "text-gray-400"
            }`}
          >
            {step.label}
          </span>
        </div>
      </React.Fragment>
    ))}
  </div>
);

const FieldError = ({ message }) =>
  message ? (
    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  ) : null;

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
  const [completedOrder, setCompletedOrder] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [wiseLoading, setWiseLoading] = useState(false);
  const [wiseError, setWiseError] = useState(null);

  const [applePayEmail, setApplePayEmail] = useState("");
  const [applePayError, setApplePayError] = useState("");

  // Payment-first flow: captured order + missing-fields prompt
  const [capturedPaypalOrder, setCapturedPaypalOrder] = useState(null);
  const [pendingMergedData, setPendingMergedData] = useState(null);
  const [pendingFinancials, setPendingFinancials] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [showMissingFieldsPrompt, setShowMissingFieldsPrompt] = useState(false);

  const paypalRef = useRef(null);
  const formRef = useRef(null);
  const paymentCapturedRef = useRef(false);

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

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { appliedCouponRef.current = appliedCoupon; }, [appliedCoupon]);
  useEffect(() => { cartItemsRef.current = cartItems; });

  useEffect(() => {
    (async () => {
      await ensureAppwriteReady({ timeoutMs: 8000 });
    })();
  }, []);

  const checkoutTrackedRef = useRef(false);
  useEffect(() => {
    if (cartItems.length > 0 && !checkoutTrackedRef.current) {
      checkoutTrackedRef.current = true;
      try {
        if (typeof window.trackMetaPixelInitiateCheckout === "function") {
          const totalValue = subtotalAmount || 0;
          const productIds = cartItems
            .map((item) => item.$id || item.id || "")
            .filter(Boolean);
          window.trackMetaPixelInitiateCheckout(
            totalValue,
            "USD",
            cartItems.length,
            productIds
          );
        }
      } catch (e) {
        console.warn("Meta Pixel InitiateCheckout tracking failed:", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ENV_EMAILJS_PUBLIC_KEY) {
      try {
        emailjs.init(ENV_EMAILJS_PUBLIC_KEY);
      } catch (e) {
        console.warn("EmailJS init failed:", e);
      }
    }
  }, []);

  useEffect(() => {
    const state = location.state || {};
    if (state.buyNow && state.item) {
      const buyItem = state.item;
      if (typeof setCartItems === "function") {
        setCartItems([{ ...buyItem, quantity: buyItem.quantity ?? 1 }]);
      } else {
        try { if (typeof clearCart === "function") clearCart(); } catch {}
        try { if (typeof addToCart === "function") addToCart(buyItem); } catch {}
      }
      if (state.prefill) {
        setFormData((prev) => ({ ...prev, ...state.prefill }));
      }
      setTimeout(() => {
        if (paypalRef.current) {
          paypalRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    const baseSrc = "https://www.paypal.com/sdk/js";
    const clientId = (ENV_PAYPAL_CLIENT_ID || "").trim();

    if (!clientId) {
      setOrderStatus({
        type: "error",
        message: "Payment provider not configured. Please contact support.",
      });
      return;
    }

    const srcWithParams = `${baseSrc}?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    const existing = Array.from(document.querySelectorAll("script[src]")).find(
      (s) => s.src && s.src.indexOf(baseSrc) === 0
    );

    if (existing) {
      if (
        (existing.getAttribute && existing.getAttribute("data-loaded") === "true") ||
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
    const onError = () => {
      setOrderStatus({ type: "error", message: "Failed to load payment system. Please reload the page." });
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

  const { discountAmount, finalAmount, discountPercent } = useMemo(() => {
    if (!appliedCoupon) {
      return { discountAmount: 0, finalAmount: subtotalAmount, discountPercent: 0 };
    }
    const pct = Math.min(100, Math.max(0, Number(appliedCoupon.discountPercent || 0)));
    let discount = (subtotalAmount * pct) / 100;
    if (discount > subtotalAmount) discount = subtotalAmount;
    const final = Math.max(0, subtotalAmount - discount);
    return {
      discountAmount: Number(discount),
      finalAmount: Number(final),
      discountPercent: pct,
    };
  }, [appliedCoupon, subtotalAmount]);

  useEffect(() => { discountAmountRef.current = discountAmount; }, [discountAmount]);
  useEffect(() => { finalAmountRef.current = finalAmount; }, [finalAmount]);

  const currentStep = useMemo(() => {
    if (orderStatus?.type === "success") return 3;
    if (capturedPaypalOrder) return 2;
    return 1;
  }, [orderStatus?.type, capturedPaypalOrder]);

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
    } catch {
      return {};
    }
  };

  const mergeShipping = (formVals, paypalVals) => {
    const merged = { ...formVals };
    Object.keys(paypalVals).forEach((key) => {
      if (!merged[key] || !String(merged[key]).trim()) {
        merged[key] = paypalVals[key] || "";
      }
    });
    return merged;
  };

  // PayPal Buttons — payment-first, no pre-validation
  useEffect(() => {
    let mounted = true;
    if (paymentCapturedRef.current) return;
    if (!paypalLoaded || !paypalRef.current || !window.paypal) return;

    paypalRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      createOrder: (_data, actions) => {
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

      onApprove: async (data, actions) => {
        setLoading(true);
        paymentCapturedRef.current = true;

        try {
          const order = await actions.order.capture();
          setCapturedPaypalOrder(order);

          const latestFormData = formDataRef.current;
          const latestCoupon = appliedCouponRef.current;
          const latestDiscount = discountAmountRef.current;
          const latestFinal = finalAmountRef.current;
          const latestCartItems = cartItemsRef.current;

          const paypalShipping = extractPayPalShipping(order);
          const mergedData = mergeShipping(latestFormData, paypalShipping);

          formDataRef.current = mergedData;
          setFormData(mergedData);

          const financials = {
            finalAmt: latestFinal,
            discountAmt: latestDiscount,
            coupon: latestCoupon,
            items: latestCartItems,
          };

          const missing = REQUIRED_SHIPPING_FIELDS.filter(
            (f) => !mergedData[f.key]?.trim()
          );

          if (missing.length > 0) {
            setPendingMergedData(mergedData);
            setPendingFinancials(financials);
            setMissingFields(missing);
            setShowMissingFieldsPrompt(true);
            setLoading(false);
            return;
          }

          await handlePaymentSuccess(order, mergedData, financials);
        } catch (err) {
          console.error("[CHECKOUT] onApprove error:", err);
          try {
            const emergencyData = {
              timestamp: new Date().toISOString(),
              error: String(err?.message || err),
              paypalOrderId: data?.orderID,
              formData: formDataRef.current,
            };
            const existing = JSON.parse(localStorage.getItem("iceyout_failed_orders") || "[]");
            existing.push(emergencyData);
            localStorage.setItem("iceyout_failed_orders", JSON.stringify(existing));
          } catch {}

          setOrderStatus({
            type: "error",
            message:
              "Payment was captured but order save failed. Your payment is safe — please contact support with PayPal order " +
              (data?.orderID || "N/A") + ".",
          });
          setLoading(false);
        }
      },

      onError: (err) => {
        const msg = String(err?.message || err);
        if (msg.includes("Cart is empty")) return;
        console.error("PayPal error:", err);
        setOrderStatus({ type: "error", message: "Payment failed. Please try again." });
      },
    });

    buttons.render(paypalRef.current).catch((err) => {
      if (!mounted) return;
      const msg = String(err?.message || err);
      if (msg.includes("Cart is empty")) return;
      console.error("PayPal Buttons render failed:", err);
      setOrderStatus({
        type: "error",
        message: "Failed to initialize payment buttons. Try reloading the page.",
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

  const saveOrderViaAPI = async (orderData, finalAmt, discountAmt, coupon, fd) => {
    const form = fd || formDataRef.current || formData;

    const safeStr = (v) => (v == null ? "" : String(v));

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

    const addrStr = `${safeStr(form.address)}, ${safeStr(form.city)}, ${safeStr(form.zipCode)}`;
    const payload = {
      amount: Math.floor(finalAmt || 0),
      billingAddress: addrStr,
      items: JSON.stringify(itemsData),
      shippingphone: safeStr(form.phone),
      totalAmount: Math.floor(finalAmt || 0),
      shippingAddress: addrStr,
      email: safeStr(form.email),
      shipping_full_name: safeStr(form.fullName),
      paypalOrderId: safeStr(orderData?.id),
      paypalTransactionId: safeStr(
        orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id
      ),
      _couponId: coupon?.$id || "",
      _couponCode: safeStr(coupon?.code),
    };

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMsg = json?.error || `HTTP ${res.status}`;
          if (res.status >= 400 && res.status < 500) {
            throw new Error(`Order API error (${res.status}): ${errMsg}`);
          }
          lastError = new Error(errMsg);
          if (attempt < 3) await sleep(Math.pow(2, attempt - 1) * 1000);
          continue;
        }

        return { $id: json.orderId, ...payload };
      } catch (err) {
        lastError = err;
        if (attempt < 3) await sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError || new Error("Order API failed after 3 attempts");
  };

  const sendOrderConfirmationEmail = async (orderPayload = {}, paypalOrder) => {
    if (!ENV_EMAILJS_SERVICE_ID || !ENV_EMAILJS_TEMPLATE_ID) {
      return { ok: false, reason: "EmailJS not configured" };
    }

    try {
      const cartItemsParam =
        Array.isArray(orderPayload.items) && orderPayload.items.length > 0
          ? orderPayload.items
          : Array.isArray(cartItems) ? cartItems : [];

      const formDataParam =
        orderPayload.shipping || orderPayload.formData || formData || {};

      const escapeHtml = (str = "") =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const ordersArray = cartItemsParam.map((it = {}) => {
        const name = it.name || it.title || it.product_name || "Item";
        const units = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
        const rawPrice = Number(it.price ?? it.unit_price ?? it.amount ?? 0) || 0;
        const price = rawPrice.toFixed(2);
        const image_url = (it.image || it.img || it.thumbnail || "").toString() || "";
        return { image_url, name, units, price };
      });

      const ordersHtml = cartItemsParam
        .map((it = {}) => {
          const name = it.name || it.title || it.product_name || "Item";
          const qty = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
          const rawPrice = Number(it.price ?? it.unit_price ?? it.amount ?? 0) || 0;
          const price = rawPrice.toFixed(2);
          const imageUrl = it.image || it.img || it.thumbnail || "";
          return `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 0; vertical-align:top;">
              ${imageUrl
                ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="48" style="display:block;border:0;"/>`
                : ""}
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
        <tbody>${ordersHtml}</tbody>
      </table>`;

      const ordersText = cartItemsParam
        .map((it = {}) => {
          const name = it.name || it.title || it.product_name || "Item";
          const qty = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
          const price = Number(it.price ?? it.unit_price ?? it.amount ?? 0).toFixed(2);
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
          orderPayload.shippingCost ?? 0
      );
      const taxAmount = parseNum(orderPayload.taxAmount ?? orderPayload.tax ?? 0);
      const safeFinal =
        typeof orderPayload.finalAmount !== "undefined" && orderPayload.finalAmount !== null
          ? Number(orderPayload.finalAmount)
          : parseNum(orderPayload.total ?? orderPayload.amount ?? finalAmount);

      const costObj = {
        shipping: shippingCost.toFixed(2),
        tax: taxAmount.toFixed(2),
        total: (safeFinal || 0).toFixed(2),
      };

      const templateParams = {
        email: (orderPayload.email || formDataParam.email || formData.email || "").toString(),
        name: (orderPayload.customerName || orderPayload.name || formDataParam.fullName || formData.fullName || "").toString(),
        order_id: paypalOrder?.id || orderPayload.order_id || orderPayload.orderId || orderPayload.$id || "",
        orders: ordersArray,
        orders_html: ordersTableHtml,
        orders_text: ordersText,
        shipping_address: `${formDataParam.address || ""}${
          formDataParam.city ? ", " + formDataParam.city : ""
        }${formDataParam.zipCode ? ", " + formDataParam.zipCode : ""}${
          formDataParam.country ? ", " + formDataParam.country : ""
        }`,
        cost: costObj,
        "cost.shipping": costObj.shipping,
        "cost.tax": costObj.tax,
        "cost.total": costObj.total,
        cost_shipping: costObj.shipping,
        cost_tax: costObj.tax,
        cost_total: costObj.total,
        discount_amount: Number(orderPayload.discount ?? 0).toFixed(2),
      };

      const res = await emailjs.send(ENV_EMAILJS_SERVICE_ID, ENV_EMAILJS_TEMPLATE_ID, templateParams);
      return { ok: true, result: res };
    } catch (err) {
      console.error("EmailJS send error:", err);
      return { ok: false, reason: err?.message || "Failed to send email" };
    }
  };

  const handlePaymentSuccess = async (order, mergedFormData, latestFinancials) => {
    setLoading(true);
    const fd = mergedFormData || formDataRef.current || formData;
    const useFinal = latestFinancials?.finalAmt ?? finalAmountRef.current ?? finalAmount;
    const useDiscount = latestFinancials?.discountAmt ?? discountAmountRef.current ?? discountAmount;
    const useCoupon = latestFinancials?.coupon ?? appliedCouponRef.current ?? appliedCoupon;
    const useItems = latestFinancials?.items ?? cartItemsRef.current ?? cartItems;

    try {
      const savedOrder = await saveOrderViaAPI(order, useFinal, useDiscount, useCoupon, fd);

      if (savedOrder && savedOrder.$id) {
        try {
          if (typeof window.trackMetaPixelPurchase === "function") {
            const productIds = useItems.map((item) => item.$id || item.id || "").filter(Boolean);
            const productNames = useItems.map((item) => item.name || "").filter(Boolean);
            const productQuantities = useItems.map((item) => item.quantity || 1);
            window.trackMetaPixelPurchase(useFinal || 0, "USD", productIds, productNames, productQuantities);
          }
        } catch (e) {
          console.warn("Meta Pixel Purchase tracking failed:", e);
        }
      }

      setCompletedOrder({
        ...savedOrder,
        paypalOrderId: order.id,
        items: useItems,
      });

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

      try {
        const emailRes = await sendOrderConfirmationEmail(emailOrderPayload, order);
        if (!emailRes.ok) {
          setOrderStatus((prev) => ({ ...(prev || {}), emailSent: false }));
        } else {
          setOrderStatus((prev) => ({ ...(prev || {}), emailSent: true }));
        }
      } catch {
        setOrderStatus((prev) => ({ ...(prev || {}), emailSent: false }));
      }

      try {
        if (typeof clearCart === "function") clearCart();
        else if (typeof setCartItems === "function") setCartItems([]);
      } catch {}

      setOrderStatus({
        type: "success",
        message: "Payment successful! Order confirmation sent to your email.",
        orderId: order.id,
      });
    } catch (error) {
      console.error("[CHECKOUT] handlePaymentSuccess FAILED:", error);

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
          items: useItems.map((it) => ({ name: it.name, price: it.price, qty: it.quantity })),
          error: String(error?.message || error),
        };
        const existing = JSON.parse(localStorage.getItem("iceyout_failed_orders") || "[]");
        existing.push(recovery);
        localStorage.setItem("iceyout_failed_orders", JSON.stringify(existing));
      } catch {}

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

  const handleCompleteMissingFields = async () => {
    const fd = formDataRef.current || formData;
    const newErrors = {};

    for (const field of missingFields) {
      const val = (fd[field.key] || "").trim();
      if (!val) {
        newErrors[field.key] = `${field.label} is required`;
      } else if (field.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fd[field.key])) {
        newErrors[field.key] = "Please enter a valid email address";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setShowMissingFieldsPrompt(false);

    const completeMergedData = { ...pendingMergedData };
    for (const field of missingFields) {
      completeMergedData[field.key] = fd[field.key];
    }
    formDataRef.current = completeMergedData;
    setFormData(completeMergedData);

    await handlePaymentSuccess(capturedPaypalOrder, completeMergedData, pendingFinancials);
  };

  const handleDecrease = (item) => updateQuantity?.(item.$id ?? item.id, -1);
  const handleIncrease = (item) => updateQuantity?.(item.$id ?? item.id, +1);
  const handleRemove = (item) => removeFromCart?.(item.$id ?? item.id);

  const validateCouponFromAppwrite = async (code) => {
    if (!code || typeof code !== "string") {
      return { ok: false, reason: "Enter a coupon code" };
    }
    try {
      const ready = await ensureAppwriteReady({ timeoutMs: 10000 });
      if (!ready || !appwriteDatabases) {
        return { ok: false, reason: "Service unavailable. Please try again." };
      }
      if (!window.Appwrite || !window.Appwrite.Query) {
        return { ok: false, reason: "Service unavailable. Please try again." };
      }
      const { Query } = window.Appwrite;
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return { ok: false, reason: "Enter a coupon code" };

      const queries = [
        Query.equal("code", normalizedCode),
        Query.equal("active", true),
      ];
      const response = await appwriteDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_COUPONS_COLLECTION_ID,
        queries
      );
      const coupons = response?.documents || [];
      if (coupons.length === 0) return { ok: false, reason: "Invalid coupon code" };

      const coupon = coupons[0];
      const dp = Number(coupon.discount_percent);
      if (!Number.isFinite(dp) || dp < 0 || dp > 100) {
        return { ok: false, reason: "Invalid discount configuration" };
      }

      return {
        ok: true,
        coupon: {
          $id: coupon.$id,
          code: coupon.code,
          discountPercent: dp,
          influencer: coupon.influencer || null,
        },
      };
    } catch (err) {
      console.error("validateCouponFromAppwrite error:", err);
      return { ok: false, reason: "Failed to validate coupon. Please try again." };
    }
  };

  const applyCoupon = async () => {
    setCouponError("");
    setCouponLoading(true);
    try {
      const code = (couponInput || "").trim().toUpperCase();
      if (!code) { setCouponError("Enter a coupon code"); setCouponLoading(false); return; }
      if (appliedCoupon) { setCouponError("Remove the current coupon first"); setCouponLoading(false); return; }

      const res = await validateCouponFromAppwrite(code);
      if (!res.ok) { setCouponError(res.reason || "Invalid coupon"); setCouponLoading(false); return; }

      setAppliedCoupon(res.coupon);
      setCouponError("");
    } catch {
      setCouponError("Failed to apply coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const handleWisePayment = async () => {
    setWiseLoading(true);
    setWiseError(null);
    try {
      const response = await fetch("/api/wise/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100, orderId: "iceyout-test-001" }),
      });
      if (!response.ok) {
        let errorMessage = "Failed to create payment link";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          try {
            const errorText = await response.text();
            if (errorText?.trim()) errorMessage = errorText;
            else errorMessage = `Server error: ${response.status} ${response.statusText}`;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      let data;
      try { data = await response.json(); } catch { throw new Error("Invalid response from server."); }
      if (!data.paymentUrl) throw new Error("Payment URL not received from server");
      try {
        const url = new URL(data.paymentUrl);
        if (!url.protocol.startsWith("http")) throw new Error("Invalid payment URL format");
      } catch { throw new Error("Invalid payment URL received. Please contact support."); }
      window.location.href = data.paymentUrl;
    } catch (error) {
      let userMessage = "Failed to create payment link. Please try again.";
      if (error.message) userMessage = error.message;
      setWiseError(userMessage);
      setWiseLoading(false);
    }
  };

  const handleApplePayWhatsApp = () => {
    const email = applePayEmail.trim();
    if (!email || !email.includes("@")) {
      setApplePayError("Please enter a valid email address.");
      return;
    }
    setApplePayError("");

    const items = cartItemsRef.current || cartItems;
    const productNames = items.map((it) => it.name || "Item").join(", ");
    const total = (finalAmountRef.current || finalAmount || 0).toFixed(2);

    const message =
      `Hi, I want to pay with Apple Pay.\n` +
      `My email: ${email}\n` +
      `Product: ${productNames}\n` +
      `Amount: $${total}`;

    const url = `https://wa.me/+918850840154?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const [currentPageLocal, setCurrentPageLocal] = useState("checkout");

  const inputClasses = (fieldName) =>
    `w-full px-4 py-3 border rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 outline-none ${
      errors[fieldName]
        ? "border-red-400 bg-red-50 focus:ring-red-300"
        : "border-gray-300 focus:border-blue-500"
    }`;

  // ── Success page ──
  if (currentPageLocal === "success" || orderStatus?.type === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <StepIndicator current={3} />
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Order Confirmed!</h2>
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
                    <p className="text-sm font-medium text-gray-700 mb-2">Shipping Address:</p>
                    <p className="text-sm text-gray-600">{completedOrder.shippingAddress}</p>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Order Items:</p>
                    {completedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm mb-2">
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
                  onClick={() => navigate("/profile")}
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
      </div>
    );
  }

  // ── Orders page ──
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
                <div key={order.$id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-semibold text-gray-900">Order #{order.orderId}</p>
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

  // ── Main checkout page ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-full transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Secure Checkout</h1>
            <div className="flex items-center gap-2 text-gray-600 mt-1">
              <Lock className="w-4 h-4" />
              <span className="text-sm">256-bit SSL Encrypted</span>
            </div>
          </div>
        </div>

        <StepIndicator current={currentStep} />

        <div className="grid md:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">Your cart is empty</div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.$id ?? item.id} className="flex gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        {item.selectedSize && (
                          <p className="text-xs text-gray-500">Size: {item.selectedSize}</p>
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
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
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
                {/* Coupon */}
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

                {/* Trust Badges */}
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
                  <span className="text-red-600">-${discountAmount.toFixed(2)}</span>
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
          <div className="md:col-span-2" ref={formRef}>
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {orderStatus?.type === "error" && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Something went wrong</p>
                    <p className="text-red-700 text-sm mt-1">{orderStatus.message}</p>
                  </div>
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Shipping Information
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Pre-fill your details below, or provide them after payment via PayPal.
              </p>

              <div className="space-y-4 mb-8">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className={inputClasses("fullName")}
                      placeholder="John Doe"
                    />
                    <FieldError message={errors.fullName} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={inputClasses("email")}
                      placeholder="john@example.com"
                    />
                    <FieldError message={errors.email} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={inputClasses("phone")}
                    placeholder="+1 (555) 123-4567"
                  />
                  <FieldError message={errors.phone} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={inputClasses("address")}
                    placeholder="123 Main Street"
                  />
                  <FieldError message={errors.address} />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className={inputClasses("city")}
                      placeholder="New York"
                    />
                    <FieldError message={errors.city} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      className={inputClasses("zipCode")}
                      placeholder="10001"
                    />
                    <FieldError message={errors.zipCode} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className={inputClasses("country")}
                      placeholder="USA"
                    />
                    <FieldError message={errors.country} />
                  </div>
                </div>
              </div>

              {/* Policy */}
              <div className="border-t pt-6 mb-6 space-y-3">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">7-Day Easy Returns</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Full refund if not satisfied. No questions asked.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Authenticity Guarantee</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        100% authentic. Passes diamond tester verification.
                      </p>
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
                  {capturedPaypalOrder && (
                    <div className="text-center py-4">
                      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                      <p className="text-green-700 font-semibold">Payment captured successfully</p>
                      <p className="text-sm text-gray-500 mt-1">Completing your order...</p>
                    </div>
                  )}
                  <div
                    ref={paypalRef}
                    id="paypal-button-container"
                    className={capturedPaypalOrder ? "hidden" : "min-h-[150px]"}
                  />
                  {!paypalLoaded && !capturedPaypalOrder && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-4">Loading payment options...</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span>Secure payment powered by PayPal</span>
                </div>

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

                {/* Apple Pay via WhatsApp */}
                {!capturedPaypalOrder && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-base font-semibold text-gray-800 mb-1">
                      🍎 Want to pay with Apple Pay?
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Enter your email and we'll send you a secure Apple Pay link via WhatsApp.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={applePayEmail}
                        onChange={(e) => {
                          setApplePayEmail(e.target.value);
                          if (applePayError) setApplePayError("");
                        }}
                        placeholder="you@example.com"
                        className={`flex-1 px-4 py-3 border rounded-lg text-sm outline-none transition-colors duration-200 focus:ring-2 focus:ring-green-500 ${
                          applePayError
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300 focus:border-green-500"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleApplePayWhatsApp}
                        className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
                      >
                        Continue via WhatsApp
                      </button>
                    </div>
                    {applePayError && (
                      <p className="mt-2 text-sm text-red-600">{applePayError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Processing overlay (shown during order save, hidden when missing-fields modal is open) */}
              {loading && !showMissingFieldsPrompt && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-800 font-semibold text-lg">Processing your order...</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Please do not close this page or press back.
                    </p>
                  </div>
                </div>
              )}

              {/* Missing fields modal — shown after PayPal capture when required data is missing */}
              {showMissingFieldsPrompt && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in">
                    <div className="text-center mb-5">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-7 h-7 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Payment Successful!</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        We need a few more details to ship your order.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {missingFields.map((field, idx) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label} *
                          </label>
                          <input
                            type={field.type}
                            name={field.key}
                            value={formData[field.key]}
                            onChange={handleInputChange}
                            className={inputClasses(field.key)}
                            placeholder={field.placeholder}
                            autoFocus={idx === 0}
                          />
                          <FieldError message={errors[field.key]} />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleCompleteMissingFields}
                      disabled={loading}
                      className="w-full mt-5 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        "Complete Order"
                      )}
                    </button>

                    <p className="text-xs text-gray-400 mt-3 text-center">
                      Your payment has been captured. Please do not close this page.
                    </p>
                  </div>
                </div>
              )}
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
