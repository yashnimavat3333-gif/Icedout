// Profile.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client, Account, Databases, Query } from "appwrite";
import { User, Package, Mail, Calendar } from "react-feather";

/**
 * Profile.jsx
 * - Displays current user's profile and recent orders
 * - Env vars (frontend):
 *   VITE_APPWRITE_ENDPOINT
 *   VITE_APPWRITE_PROJECT_ID
 *   VITE_APPWRITE_DATABASE_ID (optional, default "default")
 *   VITE_APPWRITE_ORDERS_COLLECTION_ID (optional, default "orders")
 */

export default function Profile() {
  const navigate = useNavigate();

  const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
  const APPWRITE_PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID;
  const APPWRITE_DB = import.meta.env.VITE_APPWRITE_DATABASE_ID || "default";
  const APPWRITE_COLLECTION =
    import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID || "orders";

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersCursor, setOrdersCursor] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersDone, setOrdersDone] = useState(false);
  const ORDERS_PAGE_SIZE = 8;

  const [error, setError] = useState(null);

  // ensure we don't trigger concurrent loadOrders calls
  const loadingRef = useRef(false);

  // Appwrite client + helpers
  const client = useMemo(() => {
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT) return null;
    return new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT);
  }, [APPWRITE_ENDPOINT, APPWRITE_PROJECT]);

  const account = useMemo(
    () => (client ? new Account(client) : null),
    [client]
  );
  const databases = useMemo(
    () => (client ? new Databases(client) : null),
    [client]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!account) {
        setAuthChecked(true);
        return;
      }
      try {
        const me = await account.get();
        if (!mounted) return;
        setUser(me);
      } catch (e) {
        // unauthenticated
        setUser(null);
      } finally {
        if (mounted) setAuthChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [account]);

  // Fetch first page of orders for current user when ready
  useEffect(() => {
    if (!databases) return;
    if (!authChecked) return;
    if (!user || !user.$id) return;
    // reset cursor & list when user changes
    setOrders([]);
    setOrdersCursor(null);
    setOrdersDone(false);
    loadOrders(true).catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databases, user, authChecked]);

  // load orders (if reset = true, will reset list)
  const loadOrders = async (reset = false) => {
    if (!databases) throw new Error("Appwrite not configured");
    if (!user || !user.$id) return;
    if (loadingRef.current) return; // prevent concurrent loads
    setError(null);
    setLoadingOrders(true);
    loadingRef.current = true;

    try {
      const queries = [
        Query.equal("userId", user.$id),
        Query.orderDesc("$createdAt"),
        Query.limit(ORDERS_PAGE_SIZE),
      ];

      // Try to use cursorAfter if available and we have a cursor
      if (!reset && ordersCursor) {
        try {
          // Query.cursorAfter may not exist on older SDKs — wrap in try
          queries.push(Query.cursorAfter(ordersCursor));
        } catch (e) {
          // ignore, fallback will just fetch the next chunk (may result in duplicates if backend doesn't support cursor)
        }
      }

      const res = await databases.listDocuments(
        APPWRITE_DB,
        APPWRITE_COLLECTION,
        queries
      );
      console.log(res);
      const fetched = res.documents || [];

      if (reset) {
        setOrders(fetched);
      } else {
        // append, avoid duplicates by ID
        setOrders((prev) => {
          const ids = new Set(prev.map((p) => p.$id));
          const newDocs = fetched.filter((d) => !ids.has(d.$id));
          return [...prev, ...newDocs];
        });
      }

      // mark done if fewer results than page size
      if (!fetched.length || fetched.length < ORDERS_PAGE_SIZE) {
        setOrdersDone(true);
        setOrdersCursor(null);
      } else {
        const last = fetched[fetched.length - 1];
        setOrdersCursor(last.$id || null);
      }
    } catch (e) {
      console.error("loadOrders error:", e);
      setError(
        "Unable to load orders. Check collection permissions or Appwrite config."
      );
      // stop further pagination if error
      setOrdersDone(true);
    } finally {
      setLoadingOrders(false);
      loadingRef.current = false;
    }
  };

  const handleViewOrder = (doc) => {
    const docId = doc.$id || doc.id || doc.order_id || doc.razorpay_order_id;
    navigate(`/order/${docId}`, {
      state: {
        order: doc,
        items: doc.items_json ? safeParseJSON(doc.items_json) : undefined,
      },
    });
  };

  const handleSignIn = () => {
    navigate("/login");
  };

  const handleSignOut = async () => {
    if (!account) return;
    try {
      await account.deleteSession("current");
      setUser(null);
      setOrders([]);
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  // small helper for parsing
  const safeParseJSON = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  const formatAmount = (o) => {
    // prefer amountPaise then amount; try to detect paise vs rupees
    const paise = o.amountPaise ?? o.amount ?? o.amount_in_paise ?? null;
    if (!paise) return "$0.00";
    const n = Number(paise);
    if (Number.isNaN(n)) return "$0.00";
    // Heuristic: if >= 1000 treat as paise (i.e., divide by 100)
    if (Math.abs(n) >= 100) {
      return `$${(n / 100).toFixed(2)}`;
    }
    return `$${n.toFixed(2)}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
            <User />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Your profile
            </h2>
            <div className="text-sm text-gray-700">
              Manage your account & view orders
            </div>
          </div>
        </div>

        <div>
          {!authChecked ? null : user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSignOut}
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
                className="px-1 py-1 text-sm w-[5rem] border-[#6B655C] border-2 rounded text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={handleSignIn}
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
                className="px-4 py-2 bg-black text-[#f1efe7] rounded-md shadow-sm hover:bg-[#f1efe7] hover:text-black"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
          className="lg:col-span-1 border-[#6B655C] border-2 rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center text-gray-400">
              <User />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700">Account</div>
              <div className="mt-1">
                <div className="text-sm font-medium text-gray-900">
                  {user?.name || user?.$id || "Guest"}
                </div>
                <div className="text-xs text-gray-700 mt-1 flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  <span>{user?.email || "Not signed in"}</span>
                </div>
                {user?.prefs && (
                  <div className="mt-2 text-xs text-gray-700">
                    {Array.isArray(user.prefs.addresses)
                      ? `${user.prefs.addresses.length} saved address(es)`
                      : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-700">
            <div>
              Member ID:{" "}
              <span className="font-mono text-xs text-gray-700 break-all">
                {user?.$id || "—"}
              </span>
            </div>
            {user?.$createdAt && (
              <div className="mt-1">
                Joined:{" "}
                <span className="text-gray-600">
                  {new Date(user.$createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Orders list */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-700" /> Recent Orders
            </h3>
            <div className="text-sm text-gray-700">{orders.length} shown</div>
          </div>

          <div className="space-y-3">
            {orders.length === 0 && !loadingOrders && (
              <div className="p-4 border-[#6B655C] border-2 rounded text-sm text-gray-700">
                {user
                  ? "You have no orders yet."
                  : "Sign in to view your orders."}
              </div>
            )}

            {orders.map((o) => (
              <div
                key={o.$id || o.id || o.order_id}
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
                className="border-[#6B655C] border-2 rounded p-4 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {o.items_json
                        ? (() => {
                            try {
                              const arr = JSON.parse(o.items_json);
                              return (
                                arr[0]?.name || `Order ${o.$id || o.order_id}`
                              );
                            } catch {
                              return o.order_id || o.$id;
                            }
                          })()
                        : o.order_id || o.$id}
                    </div>
                    <div className="text-xs text-gray-400">
                      • {o.status || "created"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    {o.razorpay_order_id
                      ? `Razorpay: ${o.razorpay_order_id}`
                      : `Doc: ${o.$id || "—"}`}
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-4">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatAmount(o)}
                  </div>
                  <button
                    onClick={() => handleViewOrder(o)}
                    className="text-sm px-3 py-1 bg-black text-[#f1efe7] rounded hover:bg-[#f1efe7] hover:text-black hover:border-black"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}

            {loadingOrders && (
              <div className="p-4 border-[#6B655C] border-2 rounded text-sm text-gray-700">
                Loading orders…
              </div>
            )}

            {!ordersDone && orders.length > 0 && (
              <div className="text-center">
                <button
                  onClick={() => loadOrders(false)}
                  style={{ borderColor: "rgba(0,0,0,0.06)" }}
                  className="inline-flex items-center gap-2 px-4 py-2 border-[#6B655C] border-2 rounded hover:bg-gray-50"
                >
                  {loadingOrders ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* small footer / actions */}
      <div className="mt-8 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>
            Need to update profile details? Use your account settings page.
          </span>
        </div>
      </div>

      {/* global error */}
      {error && (
        <div className="mt-4 text-red-700 bg-red-50 border border-red-100 rounded p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
