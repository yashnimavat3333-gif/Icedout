import React, { useCallback, useMemo, useState } from "react";
import productService from "../appwrite/config";

const FILTERS = [
  ["all", "All leads"],
  ["new", "New leads"],
  ["active", "Active carts"],
  ["abandoned", "Abandoned carts"],
  ["purchased", "Purchased"],
  ["consent", "Marketing consent granted"],
];

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `$${num.toFixed(2)}`;
}

function when(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminLeads() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("admin_key") || "");
  const [authenticated, setAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async (key) => {
    setError("");
    const res = await fetch("/api/leads/admin", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) {
      setAuthenticated(false);
      sessionStorage.removeItem("admin_key");
      setAuthError("Invalid admin key.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load leads");
      setAuthenticated(true);
      return;
    }
    setRows(data.leads || []);
    setAuthenticated(true);
    sessionStorage.setItem("admin_key", key);
    setAdminKey(key);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "consent" && !row.marketingConsent) return false;
      if (filter !== "all" && filter !== "consent" && row.status !== filter) return false;
      if (!q) return true;
      return (
        String(row.email || "").toLowerCase().includes(q) ||
        String(row.phone || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const copyLink = async (token) => {
    const url = `${window.location.origin}/restore-cart/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
    } catch {
      setCopied("");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <form
          className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            load(keyInput.trim());
          }}
        >
          <h1 className="text-xl font-medium">Customer leads</h1>
          <p className="text-sm text-gray-400 mt-2">Enter the admin key to view private leads.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="mt-4 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            autoComplete="current-password"
          />
          {authError && <p className="mt-3 text-sm text-red-400">{authError}</p>}
          <button type="submit" className="mt-4 w-full bg-white text-black rounded-lg py-2 font-medium">
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-medium text-white">Customer leads</h1>
            <p className="text-sm text-gray-400 mt-1">No reminder messages are sent from this page.</p>
          </div>
          <button
            type="button"
            onClick={() => load(adminKey)}
            className="px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-900"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === id ? "bg-white text-black border-white" : "border-gray-700 text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or phone"
          className="w-full max-w-md mb-4 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm"
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="overflow-x-auto border border-gray-800 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-left">
              <tr>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Captured</th>
                <th className="px-3 py-3">Last activity</th>
                <th className="px-3 py-3">Cart</th>
                <th className="px-3 py-3">Coupon</th>
                <th className="px-3 py-3">Consent</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Order</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No leads match this view.
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr
                    key={row.leadId}
                    className="border-t border-gray-800 cursor-pointer hover:bg-gray-900/60"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-3 py-3">
                      <div>{row.email || "—"}</div>
                      <div className="text-gray-500">{row.phone || "—"}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{when(row.firstCapturedAt)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{when(row.lastActivityAt)}</td>
                    <td className="px-3 py-3">
                      <div>{money(row.total)}</div>
                      <div className="text-gray-500">{row.lines?.length || 0} items</div>
                    </td>
                    <td className="px-3 py-3">
                      {row.couponCode ? `${row.couponCode} (${row.discountPercent || 0}%)` : "—"}
                    </td>
                    <td className="px-3 py-3">{row.marketingConsent ? "Granted" : "Not granted"}</td>
                    <td className="px-3 py-3 capitalize">{row.status}</td>
                    <td className="px-3 py-3">{row.orderNumber || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="mt-6 border border-gray-800 rounded-xl p-4 bg-gray-900">
            <div className="flex justify-between gap-3">
              <h2 className="text-lg text-white">Lead detail</h2>
              <button type="button" onClick={() => setSelected(null)} className="text-sm text-gray-400">
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-300">
              {selected.email || "No email"} · {selected.phone || "No phone"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Marketing consent: {selected.marketingConsent ? "Granted" : "Not granted"}
              {selected.marketingConsent && selected.consentAt ? ` · ${when(selected.consentAt)}` : ""}
              {selected.consentChannel ? ` · ${selected.consentChannel}` : ""}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Checkout: {selected.checkoutStatus} · Discount {money(selected.discountAmount)} · Total {money(selected.total)}
            </p>
            <p className="mt-3 text-sm">
              {selected.reminderEligible
                ? "Eligible for a future reminder. No message has been sent."
                : "Not eligible for promotional reminders."}
            </p>
            {selected.recoveryToken && (
              <button
                type="button"
                onClick={() => copyLink(selected.recoveryToken)}
                className="mt-3 px-3 py-2 text-sm border border-gray-700 rounded-lg"
              >
                {copied === selected.recoveryToken ? "Cart link copied" : "Copy cart recovery link"}
              </button>
            )}
            <div className="mt-4 space-y-3">
              {(selected.lines || []).map((line, index) => {
                const image = line.imageFileId ? productService.getFileView(line.imageFileId) : "";
                return (
                  <div key={`${line.productId}-${index}`} className="flex gap-3 text-sm">
                    {image && <img src={image} alt="" className="w-14 h-14 object-cover rounded" />}
                    <div>
                      <div className="text-white">{line.name}</div>
                      <div className="text-gray-500">
                        Qty {line.quantity}
                        {line.variationName ? ` · ${line.variationName}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
