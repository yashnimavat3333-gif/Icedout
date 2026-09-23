import React, { useCallback, useMemo, useState } from "react";
import { Client, Functions as AppwriteFunctions } from "appwrite";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { AlertCircle } from "lucide-react";
import {
  extractPayPalOrderId,
  fetchServerCheckoutQuote,
  parseFunctionResponse,
} from "../../lib/paypalCheckout";

const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT ||
  import.meta.env.VITE_APPWRITE_URL ||
  "https://cloud.appwrite.io/v1";

const CREATE_ORDER_FN_ID = import.meta.env.VITE_CREATE_ORDER_FUNCTION_ID;
const CAPTURE_ORDER_FN_ID =
  import.meta.env.VITE_CAPTURE_ORDER_FUNCTION_ID ||
  import.meta.env.VITE_VERIFY_PAYMENT_FUNCTION_ID;
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

const CheckoutPayPalSection = ({
  cartItems,
  appliedCoupon,
  formData,
  validateShipping,
  onSuccess,
  onError,
  userId = null,
  finalAmount = 0,
}) => {
  const [paypalError, setPaypalError] = useState("");
  const [processing, setProcessing] = useState(false);

  const client = useMemo(
    () =>
      new Client()
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID),
    []
  );
  const functions = useMemo(() => new AppwriteFunctions(client), [client]);

  const shippingPayload = useMemo(
    () => ({
      full_name: formData.fullName || "",
      phone: formData.phone || "",
      line_1: formData.address || "",
      city: formData.city || "",
      postal_code: formData.zipCode || "",
      country: formData.country || "US",
      email: formData.email || "",
    }),
    [formData]
  );

  const runFunction = useCallback(
    async (functionId, body) => {
      const exec = await functions.createExecution(functionId, JSON.stringify(body));
      return parseFunctionResponse(exec);
    },
    [functions]
  );

  const handleCreateOrder = useCallback(async () => {
    setPaypalError("");
    const validationError = validateShipping?.();
    if (validationError) throw new Error(validationError);

    if (!CREATE_ORDER_FN_ID || !CAPTURE_ORDER_FN_ID) {
      throw new Error("PayPal is not configured on the server.");
    }
    if (!cartItems?.length) {
      throw new Error("Your cart is empty.");
    }

    const quote = await fetchServerCheckoutQuote(cartItems, appliedCoupon?.code);
    const serverTotal = Number(quote.finalAmount);
    const displayTotal = Number(finalAmount);

    if (!Number.isFinite(serverTotal) || serverTotal <= 0) {
      throw new Error("Invalid order total.");
    }

    if (
      Number.isFinite(displayTotal) &&
      Math.abs(serverTotal - displayTotal) > 0.02
    ) {
      throw new Error(
        "Your cart total changed. Please refresh the page and try again."
      );
    }

    const createRes = await runFunction(CREATE_ORDER_FN_ID, {
      items: quote.items,
      userId,
      amount: quote.amountFormatted,
      currency: quote.currency || "USD",
      shipping: shippingPayload,
      payment_method: "paypal",
      couponCode: appliedCoupon?.code || "",
      discountPercent: quote.discountPercent || 0,
      _couponId: appliedCoupon?.$id || quote.coupon?.$id || "",
      subtotal: String(quote.subtotal),
      discountAmount: String(quote.discountAmount),
      shippingAmount: String(quote.shippingAmount ?? 0),
    });

    if (!createRes?.success) {
      throw new Error(
        createRes?.message || createRes?.error || "Could not start PayPal checkout."
      );
    }

    const paypalOrderId = extractPayPalOrderId(createRes);
    if (!paypalOrderId) {
      throw new Error("PayPal did not return an order ID.");
    }

    return paypalOrderId;
  }, [
    validateShipping,
    cartItems,
    appliedCoupon,
    finalAmount,
    userId,
    shippingPayload,
    runFunction,
  ]);

  const handleApprove = useCallback(
    async (data) => {
      setProcessing(true);
      setPaypalError("");
      try {
        const captureRes = await runFunction(CAPTURE_ORDER_FN_ID, {
          paypal_order_id: data.orderID,
          userId,
        });

        if (!captureRes?.success) {
          throw new Error(
            captureRes?.message || captureRes?.error || "Payment could not be completed."
          );
        }

        const capture = captureRes.capture || {};
        const paypalTransactionId =
          capture.id ||
          capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
          "";

        const appwriteDocId =
          captureRes.appwrite?.documentId ??
          captureRes.documentId ??
          captureRes.db?.id ??
          null;

        onSuccess?.({
          appwriteDocId,
          paypalOrderId: data.orderID,
          paypalTransactionId,
          amount: Number(finalAmount),
          items: cartItems,
          shippingAddress: [
            formData.fullName,
            formData.address,
            formData.city,
            formData.zipCode,
            formData.country,
          ]
            .filter(Boolean)
            .join(", "),
        });
      } catch (err) {
        const msg = err?.message || "Payment processing failed.";
        setPaypalError(msg);
        onError?.(err);
      } finally {
        setProcessing(false);
      }
    },
    [runFunction, userId, finalAmount, cartItems, formData, onSuccess, onError]
  );

  const handlePayPalError = useCallback(
    (err) => {
      const msg = err?.message || "PayPal could not start. Please try again.";
      setPaypalError(msg);
      onError?.(err instanceof Error ? err : new Error(msg));
    },
    [onError]
  );

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        PayPal is not configured.
      </div>
    );
  }

  if (!CREATE_ORDER_FN_ID || !CAPTURE_ORDER_FN_ID) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        PayPal server functions are not configured.
      </div>
    );
  }

  return (
    <div className="mt-6 border-t pt-6">
      <h4 className="text-base font-semibold text-gray-800 mb-2">Pay with PayPal</h4>
      <p className="text-sm text-gray-500 mb-4">
        You will pay ${Number(finalAmount).toFixed(2)} via PayPal (card options available in
        PayPal).
      </p>

      {paypalError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{paypalError}</span>
        </div>
      )}

      <PayPalScriptProvider
        options={{
          clientId: PAYPAL_CLIENT_ID,
          currency: "USD",
          intent: "capture",
          components: "buttons",
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
          disabled={processing || !cartItems?.length || !(Number(finalAmount) > 0)}
          createOrder={async () => {
            try {
              return await handleCreateOrder();
            } catch (err) {
              handlePayPalError(err);
              throw err;
            }
          }}
          onApprove={handleApprove}
          onCancel={() => {
            setPaypalError(
              "PayPal payment was cancelled. You can try again or use WhatsApp checkout."
            );
          }}
          onError={handlePayPalError}
        />
      </PayPalScriptProvider>

      {processing && (
        <p className="mt-3 text-center text-sm text-gray-500">Confirming your payment…</p>
      )}
    </div>
  );
};

export default CheckoutPayPalSection;
