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
import CheckoutPayPalButtons from "../components/CheckoutPayPalButtons";

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
const APPWRITE_COUPONS_COLLECTION_ID =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID || "coupons"
    : "coupons";

let appwriteClient = null;
let appwriteDatabases = null;

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
  const [orderStatus, setOrderStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [completedOrder, setCompletedOrder] = useState(null);
  const [userOrders, setUserOrders] = useState([]);

  const [paypalError, setPaypalError] = useState("");

  const formRef = useRef(null);

  const formDataRef = useRef(formData);
  const cartItemsRef = useRef([]);
  const appliedCouponRef = useRef(null);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

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

  useEffect(() => { appliedCouponRef.current = appliedCoupon; }, [appliedCoupon]);

  const currentStep = useMemo(() => {
    if (orderStatus?.type === "success") return 3;
    return 1;
  }, [orderStatus?.type]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
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

  const validateShippingFields = () => {
    const fd = formDataRef.current || formData;
    const newErrors = {};

    for (const field of REQUIRED_SHIPPING_FIELDS) {
      const val = (fd[field.key] || "").trim();
      if (!val) {
        newErrors[field.key] = `${field.label} is required`;
      } else if (field.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        newErrors[field.key] = "Please enter a valid email address";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return "Please fill in all shipping details above before proceeding.";
    }
    setErrors({});
    return null;
  };

  const buildPayPalCartPayload = () => {
    const items = (cartItemsRef.current || cartItems).map((it) => ({
      productId: it.$id ?? it.id,
      quantity: it.quantity || 1,
      variationName:
        it.selectedVariation?.name ?? it.selectedVariation?.title ?? null,
    }));
    const coupon = appliedCouponRef.current;
    return {
      items,
      couponCode: coupon?.code || null,
    };
  };

  const handlePayPalPaid = async ({ orderID, captureId }) => {
    const fd = formDataRef.current || formData;
    const items = cartItemsRef.current || cartItems;
    const shippingAddress = `${fd.fullName}, ${fd.address}, ${fd.city}, ${fd.zipCode}, ${fd.country} — ${fd.email} — ${fd.phone}`;

    setCompletedOrder({
      orderId: captureId || orderID,
      shippingAddress,
      items: items.map((it) => ({
        name: it.name || "Item",
        quantity: it.quantity || 1,
        price: Number(it.price) || 0,
        size: it.selectedSize || null,
      })),
    });
    setOrderStatus({
      type: "success",
      message: "Payment successful! Thank you for your order.",
    });
    setPaypalError("");
    try {
      if (typeof clearCart === "function") clearCart();
    } catch {}
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
                        {completedOrder.orderId || completedOrder.$id || "—"}
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
                Fill in your details below to proceed with Apple Pay checkout.
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
                  <p className="text-sm text-gray-600 mb-4 text-center">
                    Fill in your shipping details above, then pay securely with PayPal below.
                  </p>
                  <CheckoutPayPalButtons
                    buildCartPayload={buildPayPalCartPayload}
                    validateShipping={validateShippingFields}
                    onPaid={handlePayPalPaid}
                    onError={(msg) => setPaypalError(msg || "PayPal checkout error")}
                  />
                  {paypalError && (
                    <p className="mt-3 text-sm text-red-600 text-center">{paypalError}</p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span>Secure payment via PayPal</span>
                </div>
              </div>
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
