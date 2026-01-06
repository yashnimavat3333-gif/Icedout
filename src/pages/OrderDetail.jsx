// OrderDetail.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Mail,
  Calendar,
  Tag,
  DollarSign,
  Clipboard,
} from "lucide-react";

/**
 * OrderDetail.jsx
 * - Route: /order/:id
 * - Reads Appwrite document from same DB / collection used in CheckoutPage
 * - Accepts order object in location.state.order to skip fetch when available
 */

// Appwrite configuration (match CheckoutPage)
const APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6875fd9e000f3ec8a910";
const APPWRITE_DATABASE_ID =
  "6871fde500233e4b5b8d" === ""
    ? "6875fde500233e4b5b8d"
    : "6875fde500233e4b5b8d"; // keep same DB id as your project
const APPWRITE_COLLECTION_ID = "6911eeee00020c3218d5";

// Lazy holders reused across components
let appwriteClient = null;
let appwriteDatabases = null;

const initializeAppwrite = () => {
  if (typeof window !== "undefined" && !appwriteClient) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/appwrite@14.0.1";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (!window.Appwrite) return;
      const { Client, Databases } = window.Appwrite;
      appwriteClient = new Client()
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

      appwriteDatabases = new Databases(appwriteClient);
    };
  }
};

const safeParse = (maybeStr) => {
  if (!maybeStr) return null;
  if (typeof maybeStr === "object") return maybeStr;
  try {
    return JSON.parse(maybeStr);
  } catch {
    return null;
  }
};

export default function OrderDetail() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(location.state?.order ?? null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    initializeAppwrite();
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchOrder = async (docId) => {
      if (!docId) {
        setError("Invalid order id");
        setLoading(false);
        return;
      }

      // If we already have order from location.state, skip fetch
      if (location.state?.order && location.state.order.order_id === docId) {
        setOrder(location.state.order);
        setLoading(false);
        return;
      }

      // wait briefly for appwriteDatabases to be available
      let attempts = 0;
      while (!appwriteDatabases && attempts < 40) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }

      if (!appwriteDatabases) {
        if (!mounted) return;
        setError(
          "Appwrite SDK not available. If you were redirected from checkout, the order details may still be available in the previous page."
        );
        setLoading(false);
        return;
      }

      try {
        const doc = await appwriteDatabases.getDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTION_ID,
          docId
        );
        if (!mounted) return;
        setOrder(doc);
      } catch (e) {
        console.error("Failed to fetch order document:", e);
        if (!mounted) return;
        setError("Order not found or you don't have permission to view it.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (!order) fetchOrder(routeId);

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, location.state]);

  const formatDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const getItems = () => {
    if (!order) return [];
    const candidates = [
      order.items_json,
      order.items,
      order.itemsJson,
      order.items_array,
      order.items_list,
    ];
    for (const c of candidates) {
      const parsed = safeParse(c);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    // sometimes items were stored in 'items' as an array already
    if (Array.isArray(order.items)) return order.items;
    // fallback: try to make something from name/sku fields
    const fallbackName = order?.name || order?.title;
    if (fallbackName)
      return [
        {
          name: fallbackName,
          quantity: order.quantity || 1,
          price: order.totalAmount || order.amount,
        },
      ];
    return [];
  };

  const amountToDisplay = (o) => {
    const paise =
      o.amountPaise ?? o.amount ?? o.totalAmount ?? o.amount_formatted;
    if (!paise) return "$0.00";
    const n = Number(paise);
    if (Number.isNaN(n)) return "$0.00";
    // heuristic: if large treat as paise
    if (Math.abs(n) >= 100) return `$${(n / 100).toFixed(2)}`;
    return `$${n.toFixed(2)}`;
  };

  // New: delivery text fallback
  const getDeliveryText = (o) => {
    // Accept both string and object; if empty or whitespace show fallback
    const val =
      (o &&
        (o.delivery ??
          o.delivery_time ??
          o.deliveryDate ??
          o.deliveryDateTime)) ||
      "";
    if (!val || (typeof val === "string" && val.trim() === "")) {
      return "Shipment takes place in 5-7 business days.";
    }
    // If it's a string, return as-is. If it's a date-like string, you may choose to format.
    if (typeof val === "string") return val;
    // If it's an object (e.g., {from:..., to:...}) create readable text
    if (typeof val === "object") {
      if (val.from && val.to) {
        try {
          const from = new Date(val.from).toLocaleDateString();
          const to = new Date(val.to).toLocaleDateString();
          return `Estimated delivery: ${from} — ${to}`;
        } catch {
          return JSON.stringify(val);
        }
      }
      return JSON.stringify(val);
    }
    return String(val);
  };

  const handlePrint = () => {
    if (!receiptRef.current) {
      window.print();
      return;
    }
    // print only the receipt area
    const printHtml = `
      <html>
        <head>
          <title>Order ${
            order?.orderId || order?.order_id || order?.$id
          }</title>
          <style>
            body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 20px; color: #111827;}
            .section { margin-bottom: 16px; }
            .muted { color: #6b7280; font-size: 0.9em; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            .total { font-weight: 700; font-size: 1.1em; }
          </style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (!w) {
      alert("Pop-up blocked. Please allow pop-ups to print the receipt.");
      return;
    }
    w.document.open();
    w.document.write(printHtml);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(order?.$id || order?.order_id || "");
      alert("Order id copied to clipboard");
    } catch {
      // fallback: no clipboard
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading order…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 text-center">
          <div className="text-red-700 font-semibold mb-3">Error</div>
          <div className="text-gray-700 mb-6">{error}</div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded border border-gray-200"
            >
              Back
            </button>
            <a
              href={`mailto:support@yourdomain.com?subject=Order%20help%20(${routeId})`}
              className="px-4 py-2 rounded bg-black text-white"
            >
              Contact support
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 text-center">
          <div className="text-gray-700 mb-4">No order details available.</div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded border border-gray-200"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const items = getItems();
  const deliveryText = getDeliveryText(order);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Order Details
              </h1>
              <div className="text-sm text-gray-600 mt-1">
                <span className="font-mono mr-2">
                  {order.orderId || order.order_id || order.$id}
                </span>
                <span className="text-gray-400">•</span>
                <span className="ml-2">
                  {formatDate(order.orderDate || order.$createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyId}
              className="px-3 py-2 bg-white rounded border border-gray-200 flex items-center gap-2"
            >
              <Clipboard className="w-4 h-4" /> Copy ID
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-black text-white rounded flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Receipt
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div
            className="md:col-span-2 bg-white rounded-lg shadow p-6"
            ref={receiptRef}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Shipping</div>
                <div className="text-gray-800 font-medium">
                  {order.shipping_full_name ||
                    order.shipping_full_name ||
                    order.shipping_full_name ||
                    "—"}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {order.shippingAddress || order.shipping || "—"}
                </div>
                {order.shipping_phone && (
                  <div className="text-sm text-gray-600 mt-1">
                    Phone: {order.shipping_phone}
                  </div>
                )}

                {/* Delivery info shown under Shipping */}
                <div className="mt-3 text-sm text-gray-700">
                  <div className="text-xs text-gray-500">Delivery</div>
                  <div className="text-sm text-gray-800">{deliveryText}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-500">Status</div>
                <div
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                    order.orderStatus === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {order.orderStatus || order.status || "—"}
                </div>

                <div className="text-sm text-gray-500 mt-3">Payment</div>
                <div className="text-gray-800 font-medium mt-1">
                  {order.payment_method || order.paymentMethod || "—"}
                </div>

                <div className="text-sm text-gray-500 mt-3">Total</div>
                <div className="text-gray-900 font-bold mt-1">
                  {amountToDisplay(order)}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Items
              </h3>

              {items.length === 0 ? (
                <div className="text-sm text-gray-600">
                  No item details available.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-800">
                          {it.name || it.title || `Item ${idx + 1}`}
                        </div>
                        {it.variation && (
                          <div className="text-xs text-gray-500 mt-1">
                            {it.variation}
                          </div>
                        )}
                        {it.sku && (
                          <div className="text-xs text-gray-500 mt-1">
                            SKU: {it.sku}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">
                          Qty {it.quantity ?? it.qty ?? 1}
                        </div>
                        <div className="text-sm font-medium text-gray-900 mt-1">
                          {typeof it.price !== "undefined"
                            ? `$${Number(it.price).toFixed(2)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4 mt-4 text-sm text-gray-700">
              <div className="flex justify-between">
                <div>Subtotal</div>
                <div>
                  {order.totalAmount
                    ? `$${Number(order.totalAmount).toFixed(2)}`
                    : amountToDisplay(order)}
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <div>Shipping</div>
                <div>
                  {order.shipping_cost
                    ? `$${Number(order.shipping_cost).toFixed(2)}`
                    : "FREE"}
                </div>
              </div>
              <div className="flex justify-between mt-3 font-semibold text-gray-900">
                <div>Total</div>
                <div>{amountToDisplay(order)}</div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4 text-xs text-gray-500">
              <div>
                Order id:{" "}
                <span className="font-mono">
                  {order.order_id || order.$id || order.orderId}
                </span>
              </div>
              {order.paypal_order_id && (
                <div>PayPal order id: {order.paypal_order_id}</div>
              )}
              {order.paypal_capture_id && (
                <div>PayPal capture id: {order.paypal_capture_id}</div>
              )}
            </div>
          </div>

          <div className="md:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Placed</div>
                  <div className="text-sm text-gray-800">
                    {formatDate(order.orderDate || order.$createdAt)}
                  </div>
                </div>
              </div>

              {/* Show delivery also in the sidebar for quick glance */}
              <div className="mt-3 flex items-start gap-2">
                <DollarSign className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Delivery</div>
                  <div className="text-sm text-gray-800">{deliveryText}</div>
                </div>
              </div>
            </div>

            {/* <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Contact</div>
                  <div className="text-sm text-gray-800">
                    <a
                      href={`mailto:${
                        order.userId || order.email || "support@yourdomain.com"
                      }`}
                      className="underline"
                    >
                      {order.userId || order.email || "support@yourdomain.com"}
                    </a>
                  </div>
                </div>
              </div>
            </div> */}

            {/* <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 mb-2">Actions</div>
              <div className="flex flex-col gap-2">
                <a
                  href={`mailto:support@yourdomain.com?subject=Order%20help%20(${
                    order.orderId || order.$id
                  })&body=I%20need%20help%20with%20order%20${
                    order.orderId || order.$id
                  }`}
                  className="px-3 py-2 rounded border border-gray-200 text-center"
                >
                  <Mail className="w-4 h-4 inline-block mr-2" /> Contact support
                </a>
                <button
                  onClick={() => {
                    // example: navigate to reorder / product page (if you wish)
                    navigate("/");
                  }}
                  className="px-3 py-2 rounded bg-black text-white text-center"
                >
                  Continue shopping
                </button>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
