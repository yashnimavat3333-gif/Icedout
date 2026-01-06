import React from "react";
import PayPalPayment from "../components/PayPalPayment";

/**
 * Example usage of PayPalPayment component
 *
 * This demonstrates how to integrate PayPal payments in your application
 */
const PayPalPaymentExample = () => {
  const handlePaymentSuccess = (details) => {
    console.log("Payment successful!", details);
    // Handle successful payment
    // e.g., save order to database, redirect to success page, etc.
    alert(`Payment successful! Transaction ID: ${details.id}`);
  };

  const handlePaymentError = (error) => {
    console.error("Payment error:", error);
    // Handle payment error
  };

  const handlePaymentCancel = (data) => {
    console.log("Payment cancelled:", data);
    // Handle payment cancellation
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Complete Your Payment</h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Order Summary</h2>
        <div className="flex justify-between mb-2">
          <span>Product</span>
          <span className="font-semibold">$10.00</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-bold">
          <span>Total</span>
          <span>$10.00</span>
        </div>
      </div>

      <PayPalPayment
        amount="10.00"
        currency="USD"
        description="Product Purchase"
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        onCancel={handlePaymentCancel}
      />
    </div>
  );
};

export default PayPalPaymentExample;
