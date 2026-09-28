import React, { useCallback, useMemo, useState } from "react";

const FILTERS = ["all", "active", "abandoned", "recovered", "completed"];

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `$${num.toFixed(2)}`;
}

function parseStoredJson(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function AdminAbandonedCheckouts() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("admin_key") || "");
  const [authenticated, setAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async (key) => {
    setError("");
    const res = await fetch("/api/admin/abandoned-checkouts", {
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
      setError(data.error || "Could not load checkouts");
      return;
    }
    setRows(data.checkouts || []);
    setAuthenticated(true);
    sessionStorage.setItem("admin_key", key);
    setAdminKey(key);
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const copyLink = async (token) => {
    const url = `${window.location.origin}/recover/${token}`;
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
          className="w-full max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            load(keyInput.trim() || adminKey);
          }}
        >
          <h1 className="text-xl font-semibold">Abandoned checkouts</h1>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin key"
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
          />
          {authError && <p className="text-sm text-red-400">{authError}</p>}
          <button type="submit" className="w-full py-2 rounded bg-white text-black font-medium">
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold">Abandoned checkouts</h1>
          <button type="button" onClick={() => load(adminKey)} className="text-sm underline">
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(name)}
              className={`px-3 py-1 rounded-full text-sm border ${
                filter === name ? "bg-white text-black border-white" : "border-gray-700"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 mb-4">{error}</p>}
        <div className="space-y-3">
          {visible.map((row) => {
            const data = parseStoredJson(row.checkoutData);
            const meta = parseStoredJson(row.recoveryMeta);
            return (
            <div key={row.recoveryToken} className="border border-gray-800 rounded-lg p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{data.customerName || "—"}</p>
                  <p className="text-sm text-gray-400">{data.customerEmail}</p>
                  <p className="text-sm text-gray-400">{data.customerPhone || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(data.total)}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-400">{row.status}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mt-3">
                {(data.cartItems || [])
                  .map((item) => `${item.name} x${item.quantity}`)
                  .join(", ") || "—"}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Created {formatDate(meta.createdAt || row.$createdAt)} · Last activity {formatDate(meta.lastSeenAt || row.$updatedAt)}
              </p>
              <button
                type="button"
                onClick={() => copyLink(row.recoveryToken)}
                className="mt-3 text-sm underline"
              >
                {copied === row.recoveryToken ? "Copied" : "Copy Recovery Link"}
              </button>
            </div>
            );
          })}
          {visible.length === 0 && <p className="text-gray-500">No checkouts in this filter.</p>}
        </div>
      </div>
    </div>
  );
}
