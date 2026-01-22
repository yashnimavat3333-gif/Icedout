import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Client, Functions as AppwriteFunctions, Account } from "appwrite";
import { Check } from "react-feather";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const PayPalPayment = ({
  amount = "10.00",
  currency = "USD",
  description = "Product Purchase",
  items = [],
  userId = null,
  shipping: initialShipping = {},
  onSuccess,
  onError,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [successPopup, setSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // shipping form state
  const [shipping, setShipping] = useState({
    full_name: "",
    phone: "",
    line_1: "",
    city: "",
    postal_code: "",
    country: "US",
    ...initialShipping,
  });

  // payment method
  const [paymentMethod, setPaymentMethod] = useState("paypal");

  // Appwrite setup - use consistent environment variable names
  const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || import.meta.env.VITE_APPWRITE_URL || "https://cloud.appwrite.io/v1")
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
  const functions = new AppwriteFunctions(client);
  const account = new Account(client);

  const CREATE_ORDER_FN_ID = import.meta.env.VITE_CREATE_ORDER_FUNCTION_ID;
  const CAPTURE_ORDER_FN_ID = import.meta.env.VITE_CAPTURE_ORDER_FUNCTION_ID;
  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

  const safeParseExec = (exec) => {
    try {
      return JSON.parse(exec.responseBody || "{}");
    } catch {
      return exec.responseBody || {};
    }
  };

  // Normalize items
  const normalizedItems = Array.isArray(items) ? items : items ? [items] : [];

  useEffect(() => {
    let mounted = true;

    // Auto-fill shipping from props or user data
    (async () => {
      try {
        const me = await account.get();
        if (mounted) {
          setUser(me);
          // Fill shipping from user data if not provided via props
          if (
            (!shipping.full_name || !shipping.phone) &&
            me?.prefs?.addresses?.length
          ) {
            const userAddress = me.prefs.addresses[0];
            setShipping((s) => ({
              ...s,
              full_name: s.full_name || userAddress.name || me.name || "",
              phone: s.phone || userAddress.phone || "",
              line_1:
                s.line_1 || userAddress.line1 || userAddress.address || "",
              city: s.city || userAddress.city || "",
              postal_code:
                s.postal_code || userAddress.postal || userAddress.zip || "",
              country: s.country || userAddress.country || "US",
            }));
          }
        }
      } catch (err) {
        console.log("User not logged in, continuing with guest checkout");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const createServerOrder = async (payload) => {
    try {
      console.log("Creating server order with payload:", payload);
      const exec = await functions.createExecution(
        CREATE_ORDER_FN_ID,
        JSON.stringify(payload)
      );
      const result = safeParseExec(exec);
      console.log("Server order response:", result);
      return result;
    } catch (error) {
      console.error("Server order creation error:", error);
      throw error;
    }
  };

  const captureServerPayment = async (payload) => {
    try {
      console.log("Capturing payment with payload:", payload);
      const exec = await functions.createExecution(
        CAPTURE_ORDER_FN_ID,
        JSON.stringify(payload)
      );
      const result = safeParseExec(exec);
      console.log("Capture payment response:", result);
      return result;
    } catch (error) {
      console.error("Capture payment error:", error);
      throw error;
    }
  };

  const validateShipping = () => {
    if (
      !shipping.full_name ||
      !shipping.phone ||
      !shipping.line_1 ||
      !shipping.city ||
      !shipping.postal_code
    ) {
      return "Please complete the shipping address (name, phone, address, city, ZIP).";
    }
    return null;
  };

  const handleCreateCODOrder = async () => {
    setError(null);

    const validationError = validateShipping();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreatingOrder(true);
    try {
      const createPayload = {
        items: normalizedItems,
        userId: userId || user?.$id || null,
        amount: amount,
        currency: currency,
        shipping,
        payment_method: "cod",
      };

      const createRes = await createServerOrder(createPayload);

      if (!createRes || !createRes.success) {
        setError(createRes?.message || "Failed to create order");
        setCreatingOrder(false);
        return;
      }

      const appwriteDocId =
        createRes.appwrite?.documentId ??
        createRes.appwrite?.document_id ??
        null;

      const orderForDisplay =
        createRes.appwrite?.documentId || createRes.appwrite?.document_id
          ? {
              appwriteId:
                createRes.appwrite.documentId || createRes.appwrite.document_id,
              raw: createRes,
            }
          : createRes.orderId
          ? { orderId: createRes.orderId, raw: createRes }
          : createRes;

      setSuccessData({
        order: orderForDisplay,
        items: normalizedItems,
        shipping,
        appwriteDocId,
        note: "cod",
      });

      setSuccessPopup(true);

      // Call success callback
      if (onSuccess) {
        onSuccess({
          details: orderForDisplay,
          type: "cod",
          appwriteDocId,
        });
      }
    } catch (err) {
      const errorMsg = err?.message || "Error while creating order.";
      setError(errorMsg);
      if (onError) onError(new Error(errorMsg));
    } finally {
      setCreatingOrder(false);
    }
  };

  const handlePayPalCreateOrder = async (data, actions) => {
    try {
      console.log("PayPal createOrder started");

      const validationError = validateShipping();
      if (validationError) {
        throw new Error(validationError);
      }

      const createPayload = {
        items: normalizedItems,
        userId: userId || user?.$id || null,
        amount: amount,
        currency: currency,
        shipping,
        payment_method: "paypal",
      };

      console.log("Sending create order request:", createPayload);

      const createRes = await createServerOrder(createPayload);
      console.log("Create order response:", createRes);

      if (!createRes) {
        throw new Error("No response from server");
      }

      if (!createRes.success) {
        const errorMessage =
          createRes.message ||
          createRes.error ||
          "Failed to create PayPal order";
        throw new Error(errorMessage);
      }

      // Extract PayPal order ID from response - try multiple possible locations
      const paypalOrderId =
        createRes.paypal?.orderId ||
        createRes.paypal?.order_id ||
        createRes.orderId ||
        createRes.paypal_order_id ||
        createRes.id;

      console.log("Extracted PayPal order ID:", paypalOrderId);

      if (!paypalOrderId) {
        console.error("No PayPal order ID found in response:", createRes);
        throw new Error("No order ID received from server");
      }

      console.log("Returning PayPal order ID to SDK:", paypalOrderId);
      return paypalOrderId;
    } catch (err) {
      console.error("PayPal createOrder error:", err);
      const errorMessage = err.message || "Failed to create PayPal order";
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
      throw new Error(errorMessage);
    }
  };

  const handlePayPalApprove = async (data, actions) => {
    try {
      console.log("PayPal onApprove started:", data);
      setLoading(true);

      const capturePayload = {
        paypal_order_id: data.orderID,
        appwrite_document_id: null,
        userId: userId || user?.$id || null,
      };

      console.log("Sending capture request:", capturePayload);

      const captureRes = await captureServerPayment(capturePayload);
      console.log("Capture response:", captureRes);

      if (captureRes && captureRes.success) {
        const appwriteDocId =
          captureRes.appwrite?.documentId ??
          captureRes.documentId ??
          captureRes.db?.id ??
          null;

        const orderForDisplay = captureRes.capture || { orderId: data.orderID };

        setSuccessData({
          order: orderForDisplay,
          items: normalizedItems,
          shipping,
          appwriteDocId,
        });

        setSuccessPopup(true);

        // Call success callback
        if (onSuccess) {
          onSuccess({
            details: orderForDisplay,
            type: "paypal",
            appwriteDocId,
            captureData: captureRes.capture,
          });
        }
      } else {
        const errorMsg =
          captureRes?.message ||
          captureRes?.error ||
          "Payment verification failed";
        console.error("Capture failed:", errorMsg);
        setError(errorMsg);
        if (onError) onError(new Error(errorMsg));
      }
    } catch (err) {
      const errorMsg = err?.message || "Payment processing failed";
      console.error("Capture error:", err);
      setError(errorMsg);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalError = (err) => {
    console.error("PayPal SDK error:", err);
    const errorMsg =
      err?.message || "Payment initialization failed. Please try again.";
    setError(errorMsg);
    if (onError) onError(new Error(errorMsg));
  };

  const handlePayPalCancel = (data) => {
    console.log("PayPal payment cancelled:", data);
    const cancelMsg = "Payment was cancelled.";
    setError(cancelMsg);
    if (onCancel) onCancel(data);
  };

  const handleCloseSuccess = () => {
    setSuccessPopup(false);
    // Optionally navigate away or reset form
    if (successData?.appwriteDocId) {
      navigate("/orders"); // or wherever you want to redirect
    }
  };

  /* --- Styling --- */
  const colors = {
    cream: "#f1efe7",
    black: "#0B0B0B",
    muted: "#6B655C",
    card: "#ffffff",
    subtleBorder: "rgba(11,11,11,0.06)",
  };

  const paypalOptions = {
    "client-id": PAYPAL_CLIENT_ID,
    currency: currency,
    intent: "capture",
    components: "buttons",
  };

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div
        style={{
          padding: "20px",
          border: "1px solid #f5c6cb",
          background: "#f8d7da",
          color: "#721c24",
          borderRadius: "8px",
          textAlign: "center",
        }}
      >
        <strong>PayPal not configured:</strong> Please set{" "}
        <code>VITE_PAYPAL_CLIENT_ID</code> environment variable.
      </div>
    );
  }

  return (
    <div
      style={{
        background: colors.cream,
        color: colors.black,
        minHeight: "100vh",
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h2
          style={{ color: colors.black }}
          className="text-2xl font-semibold mb-4"
        >
          Checkout
        </h2>

        {/* Order Summary */}
        <div
          className="rounded-lg shadow-sm border p-4 mb-4"
          style={{ background: colors.card, borderColor: colors.subtleBorder }}
        >
          <h3 style={{ color: colors.black, fontWeight: 600 }}>
            Order Summary
          </h3>
          <div className="mt-2 text-sm" style={{ color: colors.muted }}>
            <p>
              Items:{" "}
              <span style={{ color: colors.black, fontWeight: 600 }}>
                {normalizedItems.length}
              </span>
            </p>
            <p>
              Amount:{" "}
              <span style={{ color: colors.black, fontWeight: 600 }}>
                {currency === "USD" ? "$" : currency} {amount}
              </span>
            </p>
            <p>
              Description:{" "}
              <span style={{ color: colors.black, fontWeight: 600 }}>
                {description}
              </span>
            </p>
          </div>
        </div>

        {/* Shipping Form */}
        <div
          className="rounded-lg shadow-sm border p-4 mb-4"
          style={{ background: colors.card, borderColor: colors.subtleBorder }}
        >
          <h3 style={{ color: colors.black, fontWeight: 600, marginBottom: 8 }}>
            Shipping Address
          </h3>
          <div className="grid gap-3">
            <input
              value={shipping.full_name}
              onChange={(e) =>
                setShipping((s) => ({ ...s, full_name: e.target.value }))
              }
              placeholder="Full name"
              className="p-2 rounded"
              style={{ border: `1px solid ${colors.subtleBorder}` }}
            />
            <input
              value={shipping.phone}
              onChange={(e) =>
                setShipping((s) => ({ ...s, phone: e.target.value }))
              }
              placeholder="Phone"
              className="p-2 rounded"
              style={{ border: `1px solid ${colors.subtleBorder}` }}
            />
            <input
              value={shipping.line_1}
              onChange={(e) =>
                setShipping((s) => ({ ...s, line_1: e.target.value }))
              }
              placeholder="Address line"
              className="p-2 rounded"
              style={{ border: `1px solid ${colors.subtleBorder}` }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={shipping.city}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, city: e.target.value }))
                }
                placeholder="City"
                className="flex-1 p-2 rounded"
                style={{ border: `1px solid ${colors.subtleBorder}` }}
              />
              <input
                value={shipping.postal_code}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, postal_code: e.target.value }))
                }
                placeholder="ZIP Code"
                className="w-28 p-2 rounded"
                style={{ border: `1px solid ${colors.subtleBorder}` }}
              />
            </div>
            <input
              value={shipping.country}
              onChange={(e) =>
                setShipping((s) => ({ ...s, country: e.target.value }))
              }
              placeholder="Country"
              className="p-2 rounded"
              style={{ border: `1px solid ${colors.subtleBorder}` }}
            />
          </div>
        </div>

        {/* Payment Method */}
        <div
          className="rounded-lg shadow-sm border p-4 mb-4"
          style={{ background: colors.card, borderColor: colors.subtleBorder }}
        >
          <h3 style={{ color: colors.black, fontWeight: 600, marginBottom: 8 }}>
            Payment Method
          </h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${
                  paymentMethod === "paypal"
                    ? colors.black
                    : colors.subtleBorder
                }`,
                flex: 1,
                minWidth: 180,
                cursor: "pointer",
                background: paymentMethod === "paypal" ? "#fff" : colors.card,
              }}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "paypal"}
                onChange={() => setPaymentMethod("paypal")}
                className="mr-2"
              />
              Pay with PayPal
            </label>

            <label
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${
                  paymentMethod === "cod" ? colors.black : colors.subtleBorder
                }`,
                flex: 1,
                minWidth: 180,
                cursor: "pointer",
                background: paymentMethod === "cod" ? "#fff" : colors.card,
              }}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                className="mr-2"
              />
              Cash on Delivery (COD)
            </label>
          </div>
        </div>

        {error && (
          <div
            className="rounded p-3 mb-3"
            style={{
              background: "rgba(255,0,0,0.04)",
              color: "#c53030",
              border: `1px solid rgba(255,0,0,0.06)`,
            }}
          >
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Check the browser console for more details.
            </div>
          </div>
        )}

        {/* PayPal Button Section */}
        {paymentMethod === "paypal" && (
          <div
            className="rounded-lg shadow-sm border p-4 mb-4"
            style={{
              background: colors.card,
              borderColor: colors.subtleBorder,
            }}
          >
            <h3
              style={{ color: colors.black, fontWeight: 600, marginBottom: 12 }}
            >
              PayPal Payment
            </h3>
            <PayPalScriptProvider
              options={paypalOptions}
              onError={handlePayPalError}
            >
              <PayPalButtons
                createOrder={handlePayPalCreateOrder}
                onApprove={handlePayPalApprove}
                onError={handlePayPalError}
                onCancel={handlePayPalCancel}
                style={{
                  layout: "vertical",
                  color: "blue",
                  shape: "rect",
                  label: "paypal",
                  height: 45,
                }}
                disabled={loading}
              />
            </PayPalScriptProvider>
            {loading && (
              <div className="text-center mt-2" style={{ color: colors.muted }}>
                Processing payment...
              </div>
            )}
          </div>
        )}

        {/* COD Button */}
        {paymentMethod === "cod" && (
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button
              onClick={handleCreateCODOrder}
              disabled={creatingOrder}
              className="rounded-md"
              style={{
                flex: 1,
                padding: "12px 16px",
                background: creatingOrder ? "#999" : colors.black,
                color: "#fff",
                border: "none",
                fontWeight: 700,
                cursor: creatingOrder ? "not-allowed" : "pointer",
              }}
            >
              {creatingOrder
                ? "Creating Order..."
                : `Place COD Order — ${
                    currency === "USD" ? "$" : currency
                  }${amount}`}
            </button>

            <button
              onClick={() => onCancel?.() || navigate(-1)}
              className="rounded-md"
              style={{
                padding: "12px 16px",
                background: "transparent",
                color: colors.black,
                border: `1px solid ${colors.subtleBorder}`,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <div style={{ marginTop: 18, color: colors.muted, fontSize: 13 }}>
          <p>
            <Check className="inline mr-1" /> Secure checkout{" "}
            {paymentMethod === "paypal"
              ? "powered by PayPal"
              : "— pay on delivery"}
          </p>
        </div>
      </div>

      {/* Success Popup */}
      {successPopup && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-6 max-w-sm w-full text-center"
            style={{ background: colors.card, color: colors.black }}
          >
            <Check className="mx-auto mb-3 text-green-600" size={40} />
            <h3 className="text-xl font-semibold mb-2">Order Successful!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Thank you for your purchase. Your order has been placed
              successfully.
            </p>
            <button
              onClick={handleCloseSuccess}
              className="w-full py-2 px-4 rounded-md"
              style={{
                background: colors.black,
                color: "#fff",
                fontWeight: 600,
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayPalPayment;
