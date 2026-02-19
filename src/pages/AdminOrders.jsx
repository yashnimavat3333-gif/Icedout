import React, { useEffect, useState, useCallback } from "react";

const STATUS_OPTIONS = ["pending", "paid", "shipped", "delivered", "cancelled"];

const STATUS_COLORS = {
  pending:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  paid:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
  shipped:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  delivered: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

const PAGE_SIZE = 100;

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAmount(val) {
  if (val == null) return "—";
  const n = Number(val);
  if (Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 100) return `$${(n / 100).toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

function parseItems(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AdminOrders() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("admin_key") || "");
  const [authenticated, setAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = useCallback(async (key) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/get-orders?limit=${PAGE_SIZE}&offset=0`, {
        headers: { Authorization: `Bearer ${key}` },
      });

      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem("admin_key");
        setAuthError("Invalid admin key.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setAuthenticated(true);
    } catch (err) {
      setError(err.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) {
      fetchOrders(adminKey);
    }
  }, [adminKey, fetchOrders]);

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError("");
    if (!keyInput.trim()) {
      setAuthError("Please enter the admin key.");
      return;
    }
    const key = keyInput.trim();
    sessionStorage.setItem("admin_key", key);
    setAdminKey(key);
  };

  const handleStatusUpdate = async (documentId, newStatus) => {
    setUpdatingId(documentId);
    setError(null);
    setSuccessMsg("");
    try {
      const res = await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ documentId, status: newStatus }),
      });

      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem("admin_key");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setOrders((prev) =>
        prev.map((o) => (o.$id === documentId ? { ...o, orderStatus: newStatus } : o))
      );
      setSuccessMsg(`Order ${documentId.slice(0, 8)}… status updated to "${newStatus}"`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_key");
    setAdminKey("");
    setAuthenticated(false);
    setOrders([]);
    setKeyInput("");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Admin Access</h1>
              <p className="text-sm text-gray-400">Enter your admin secret key</p>
            </div>
          </div>

          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin secret key"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-500"
            autoFocus
          />

          {authError && (
            <p className="text-red-400 text-sm mt-3">{authError}</p>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Order Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {total} total order{total !== 1 ? "s" : ""} · Sorted newest first
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchOrders(adminKey)}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 hover:bg-red-900/50 border border-gray-700 rounded-lg text-sm font-medium transition-colors text-gray-300 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Toast messages */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && orders.length === 0 && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Loading orders…</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && orders.length === 0 && !error && (
        <div className="flex items-center justify-center py-32">
          <p className="text-gray-500 text-sm">No orders found.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Order ID</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">User ID</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-right font-medium">Amount</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Currency</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Status</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Payment</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">PayPal Status</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Name</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Phone</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">City</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Country</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium min-w-[220px]">Items</th>
                    <th className="sticky top-0 bg-gray-800/95 backdrop-blur-sm px-4 py-3 text-left font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {orders.map((order) => (
                    <tr
                      key={order.$id}
                      className="hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                        {order.orderId || order.order_id || order.$id?.slice(0, 12)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap max-w-[120px] truncate">
                        {order.userId || order.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white whitespace-nowrap">
                        {formatAmount(order.amount ?? order.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {order.currency || "USD"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <select
                            value={order.orderStatus || "pending"}
                            onChange={(e) => handleStatusUpdate(order.$id, e.target.value)}
                            disabled={updatingId === order.$id}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer appearance-none bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                              STATUS_COLORS[order.orderStatus] || STATUS_COLORS.pending
                            }`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s} className="bg-gray-900 text-gray-100">
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                          {updatingId === order.$id && (
                            <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {order.payment_method || "paypal"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {order.paypal_status || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                        {order.shipping_full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {order.shippingphone || order.shipping_phone || order.Shippingphone || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {order.shipping_city || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {order.shipping_country || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {(() => {
                          const items = parseItems(order.items);
                          if (!items.length) return <span className="text-gray-600">—</span>;
                          return (
                            <div className="space-y-1.5 min-w-[200px]">
                              {items.map((item, idx) => (
                                <div key={idx} className="bg-gray-800/50 rounded px-2 py-1.5 leading-relaxed">
                                  <div className="font-medium text-gray-200 truncate max-w-[200px]">{item.name || "Unnamed"}</div>
                                  <div className="text-gray-500 mt-0.5">
                                    Size: {item.size || "N/A"} · Qty: {item.quantity ?? 1} · ${Number(item.price ?? 0).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(order.$createdAt || order.orderDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800 text-xs text-gray-500">
              Showing {orders.length} of {total} orders
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
