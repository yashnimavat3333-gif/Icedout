// AdminOrders.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  ArrowLeft,
  Box,
  Edit2,
  Tag,
  Calendar,
  Clipboard,
  Save,
  Truck,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * AdminOrders.jsx
 *
 * - Uses lazy Appwrite init (same as CheckoutPage / OrderDetail).
 * - Shows order list and right-side detail/editing panel.
 * - Detail panel uses robust parsing logic (same as OrderDetail.jsx).
 */

const APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6875fd9e000f3ec8a910";
const APPWRITE_DATABASE_ID = "6875fde500233e4b5b8d";
const APPWRITE_COLLECTION_ID = "6911eeee00020c3218d5";

let appwriteClient = null;
let appwriteDatabases = null;

const initializeAppwrite = () => {
  if (typeof window === "undefined") return;
  if (appwriteClient) return;
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
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

// --- Helpers copied/adapted from OrderDetail.jsx ---
const safeParse = (maybeStr) => {
  if (!maybeStr) return null;
  if (typeof maybeStr === "object") return maybeStr;
  try {
    return JSON.parse(maybeStr);
  } catch {
    return null;
  }
};

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const getItemsFromOrder = (order) => {
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
  if (Array.isArray(order.items)) return order.items;
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

const getDeliveryText = (o) => {
  if (!o) return "Shipment takes place in 5-7 business days.";
  const val =
    (o &&
      (o.delivery ??
        o.delivery_time ??
        o.deliveryDate ??
        o.deliveryDateTime ??
        o.delivery_text)) ||
    "";
  if (!val || (typeof val === "string" && val.trim() === "")) {
    return "Shipment takes place in 5-7 business days.";
  }
  if (typeof val === "string") {
    // If it's ISO date string, try to format
    const maybeDate = Date.parse(val);
    if (!Number.isNaN(maybeDate) && val.includes("T")) {
      try {
        return new Date(val).toLocaleString();
      } catch {}
    }
    return val;
  }
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

// keep your existing rupee heuristic
const amountToDisplay = (o) => {
  const paise =
    o.amountPaise ?? o.amount ?? o.totalAmount ?? o.amount_formatted;
  if (!paise) return "$0.00";
  const n = Number(paise);
  if (Number.isNaN(n)) return "$0.00";
  if (Math.abs(n) >= 100) return `$${(n / 100).toFixed(2)}`;
  return `$${n.toFixed(2)}`;
};

// ------------------------------

export default function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const pageSize = 12;

  const navigate = useNavigate();
  const panelRef = useRef(null);

  useEffect(() => {
    initializeAppwrite();
    const t = setTimeout(() => fetchOrders(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = async (reset = false) => {
    setError(null);
    if (!appwriteDatabases) {
      let attempts = 0;
      while (!appwriteDatabases && attempts < 40) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (!appwriteDatabases) {
        setError("Appwrite SDK failed to load.");
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const { Query } = window.Appwrite;
      const queries = [Query.orderDesc("$createdAt"), Query.limit(pageSize)];

      if (searchQ?.trim()) {
        const q = searchQ.trim();
        try {
          queries.push(
            Query.or([
              Query.startsWith("order_id", q),
              Query.startsWith("userId", q),
              Query.startsWith("email", q),
              Query.startsWith("shipping_full_name", q),
            ])
          );
        } catch {
          // fallback: ignore search if SDK doesn't support Query.or
        }
      }

      if (filterStatus) {
        try {
          queries.push(Query.equal("orderStatus", filterStatus));
        } catch {}
      }

      if (!reset && cursor) {
        try {
          queries.push(Query.cursorAfter(cursor));
        } catch {}
      }

      const res = await appwriteDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_ID,
        queries
      );

      const docs = res.documents || [];
      if (reset) setOrders(docs);
      else setOrders((prev) => [...prev, ...docs]);

      if (!docs.length || docs.length < pageSize) {
        setDone(true);
      } else {
        setDone(false);
        setCursor(docs[docs.length - 1].$id || null);
      }
    } catch (e) {
      console.error("Fetch orders error:", e);
      setError(
        "Failed to load orders. Check collection permissions / network."
      );
    } finally {
      setLoading(false);
    }
  };

  const onSelectOrder = (doc) => {
    setSelected(doc);
    setTimeout(
      () => panelRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  };

  const saveOrderUpdates = async (updates) => {
    if (!selected) return;
    setSaving(true);
    setError(null);

    // optimistic UI update
    const prevOrders = [...orders];
    const prevSelected = { ...selected };
    const updated = { ...selected, ...updates };

    setOrders((s) => s.map((o) => (o.$id === updated.$id ? updated : o)));
    setSelected(updated);

    try {
      if (!appwriteDatabases) throw new Error("Appwrite not ready");
      const res = await appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_ID,
        selected.$id,
        updates
      );
      setOrders((s) => s.map((o) => (o.$id === res.$id ? res : o)));
      setSelected(res);
    } catch (e) {
      console.error("Update failed:", e);
      setError("Failed to update order. Check permissions or network.");
      setOrders(prevOrders);
      setSelected(prevSelected);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    const updates = { orderStatus: newStatus };

    // NOTE: avoid adding unknown attribute names that Appwrite schema doesn't allow.
    // If you added 'shipped_at' / 'delivered_at' to the schema, you can uncomment the lines below.
    if (newStatus === "shipped") {
      // updates.shipped_at = new Date().toISOString();
    }
    if (newStatus === "delivered") {
      // updates.delivered_at = new Date().toISOString();
    }
    if (newStatus === "cancelled") {
      // updates.cancelled_at = new Date().toISOString();
    }

    saveOrderUpdates(updates);
  };

  const handleFieldSave = (field, value) => {
    const body = {};
    body[field] = value;
    saveOrderUpdates(body);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Admin — Orders</h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border rounded px-3 py-2 gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                placeholder="Search order id / email / name..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="outline-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchOrders(true);
                }}
              />
              <button
                onClick={() => fetchOrders(true)}
                className="text-sm px-2 py-1 rounded bg-black text-white"
              >
                Search
              </button>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setTimeout(() => fetchOrders(true), 80);
              }}
              className="bg-white border px-3 py-2 rounded text-sm"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchOrders(true)}
              className="px-3 py-2 bg-white border rounded text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Orders list */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 space-y-3 max-h-[72vh] overflow-auto">
              {loading && orders.length === 0 ? (
                <div className="text-center text-gray-600 py-8">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  No orders found.
                </div>
              ) : (
                orders.map((o) => (
                  <div
                    key={o.$id}
                    onClick={() => onSelectOrder(o)}
                    className={`p-3 rounded border cursor-pointer ${
                      selected?.$id === o.$id
                        ? "border-green-600 bg-green-50"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">
                          {o.items_json
                            ? (() => {
                                try {
                                  const arr = JSON.parse(o.items_json);
                                  return arr[0]?.name || `Order ${o.$id}`;
                                } catch {
                                  return o.order_id || o.$id;
                                }
                              })()
                            : o.order_id || o.$id}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {o.userId || o.email || "—"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {amountToDisplay(o)}
                        </div>
                        <div className="text-xs mt-1">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              o.orderStatus === "delivered"
                                ? "bg-green-100 text-green-800"
                                : o.orderStatus === "shipped"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {o.orderStatus || "created"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      {formatDate(o.$createdAt || o.orderDate || Date.now())}
                    </div>
                  </div>
                ))
              )}

              <div className="text-center mt-3">
                {!done ? (
                  <button
                    onClick={() => fetchOrders(false)}
                    className="px-3 py-2 bg-white border rounded"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Load more"}
                  </button>
                ) : (
                  <div className="text-xs text-gray-500">No more orders</div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 mt-2">{error}</div>
              )}
            </div>
          </div>

          {/* Detail & editing panel */}
          <div className="md:col-span-2">
            {!selected ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-600">
                  Select an order to view details.
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6" ref={panelRef}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelected(null)}
                        className="p-2 bg-gray-100 rounded"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <div className="text-lg font-semibold">
                          Order {selected.orderId || selected.$id}
                        </div>
                        <div className="text-sm text-gray-500">
                          {selected.userId || selected.email || "—"} •{" "}
                          {formatDate(
                            selected.$createdAt ||
                              selected.orderDate ||
                              Date.now()
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 items-center">
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selected.orderStatus || ""}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          className="px-3 py-1 border rounded bg-white"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <div className="text-sm text-gray-600">
                          {selected.orderStatus || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Total</div>
                      <div className="text-lg font-bold">
                        {amountToDisplay(selected)}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            selected.$id || selected.order_id || ""
                          );
                        }}
                        className="p-2 bg-gray-100 rounded"
                        title="Copy ID"
                      >
                        <Clipboard className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Box className="w-4 h-4" /> Items
                  </h3>

                  <div className="mt-3 space-y-3">
                    {getItemsFromOrder(selected).length === 0 ? (
                      <div className="text-sm text-gray-600">
                        No item details available.
                      </div>
                    ) : (
                      getItemsFromOrder(selected).map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">
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
                          <div className="text-sm font-medium">
                            {it.quantity ? `x${it.quantity}` : ""}{" "}
                            {typeof it.price !== "undefined"
                              ? `• $${Number(it.price).toFixed(2)}`
                              : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Editable fields */}
                <div className="mt-6 border-t pt-4 space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Edit2 className="w-4 h-4" /> Edit order
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">
                        Delivery text / ETA
                      </label>
                      <textarea
                        className="w-full border rounded p-2 text-sm"
                        rows={2}
                        value={
                          selected.delivery || selected.delivery_text || ""
                        }
                        onChange={(e) =>
                          setSelected((s) => ({
                            ...s,
                            delivery: e.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() =>
                            handleFieldSave("delivery", selected.delivery)
                          }
                          className="px-3 py-1 bg-black text-white rounded text-sm flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" /> Save delivery
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">
                        Tracking ID
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded p-2 text-sm"
                        value={selected.tracking_id || ""}
                        onChange={(e) =>
                          setSelected((s) => ({
                            ...s,
                            tracking_id: e.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() =>
                            handleFieldSave(
                              "tracking_id",
                              selected.tracking_id || ""
                            )
                          }
                          className="px-3 py-1 bg-black text-white rounded text-sm flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" /> Save tracking
                        </button>
                        <button
                          onClick={() => {
                            if (!selected.tracking_id) return;
                            window.open(
                              `https://www.google.com/search?q=${encodeURIComponent(
                                selected.tracking_id
                              )}`,
                              "_blank"
                            );
                          }}
                          className="px-3 py-1 bg-white border rounded text-sm"
                        >
                          Track
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">
                        Shipping cost (number)
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded p-2 text-sm"
                        value={selected.shipping_cost ?? ""}
                        onChange={(e) =>
                          setSelected((s) => ({
                            ...s,
                            shipping_cost: e.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() =>
                            handleFieldSave(
                              "shipping_cost",
                              Number(selected.shipping_cost) || 0
                            )
                          }
                          className="px-3 py-1 bg-black text-white rounded text-sm flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" /> Save shipping
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">
                        Order notes
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded p-2 text-sm"
                        value={selected.notes || ""}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, notes: e.target.value }))
                        }
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() =>
                            handleFieldSave("notes", selected.notes || "")
                          }
                          className="px-3 py-1 bg-black text-white rounded text-sm flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" /> Save notes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Administrative actions */}
                <div className="mt-6 border-t pt-4 flex gap-3 items-center">
                  <button
                    onClick={() => handleStatusChange("shipped")}
                    className="px-3 py-2 bg-indigo-600 text-white rounded flex items-center gap-2"
                  >
                    <Truck className="w-4 h-4" /> Mark shipped
                  </button>

                  <button
                    onClick={() => handleStatusChange("delivered")}
                    className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark delivered
                  </button>

                  <button
                    onClick={() => handleStatusChange("cancelled")}
                    className="px-3 py-2 bg-yellow-500 text-white rounded flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" /> Cancel
                  </button>

                  <div className="ml-auto text-sm text-gray-500">
                    {saving
                      ? "Saving..."
                      : "Last updated: " +
                        (selected.$updatedAt
                          ? formatDate(selected.$updatedAt)
                          : "-")}
                  </div>
                </div>

                {/* Additional detail section (mirrors OrderDetail) */}
                <div className="border-t pt-4 mt-4 text-sm text-gray-700">
                  <div className="mb-2">
                    <div className="text-xs text-gray-500">Shipping</div>
                    <div className="text-gray-800 font-medium">
                      {selected.shipping_full_name ||
                        selected.shipping_full_name ||
                        selected.shipping_full_name ||
                        "—"}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selected.shippingAddress || selected.shipping || "—"}
                    </div>
                    {selected.shipping_phone && (
                      <div className="text-sm text-gray-600 mt-1">
                        Phone: {selected.shipping_phone}
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="text-xs text-gray-500">Delivery</div>
                    <div className="text-sm text-gray-800">
                      {getDeliveryText(selected)}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    <div>
                      Order id:{" "}
                      <span className="font-mono">
                        {selected.order_id || selected.$id || selected.orderId}
                      </span>
                    </div>
                    {selected.paypal_order_id && (
                      <div>PayPal order id: {selected.paypal_order_id}</div>
                    )}
                    {selected.paypal_capture_id && (
                      <div>PayPal capture id: {selected.paypal_capture_id}</div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 mt-3">{error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
