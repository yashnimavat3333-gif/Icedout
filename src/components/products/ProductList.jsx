// src/components/ProductList.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import ProductCard from "./ProductCard";
import productService from "../../appwrite/config";

const CLIENT_PAGE_SIZE = 12; // Initial visible products (above fold)
const SERVER_PAGE_SIZE = 16; // Products per server batch
const EAGER_PREFETCH_ALL = false; // Disabled to prevent loading all products at once
const ABOVE_FOLD_COUNT = 8; // First 8 products are above fold (eager load)

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(CLIENT_PAGE_SIZE);
  const [serverCursor, setServerCursor] = useState(null);
  const [hasMoreServer, setHasMoreServer] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  /* -------------------- helpers -------------------- */
  const toNumber = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    const cleaned = String(val)
      .trim()
      .replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const getComparablePrice = (p) => {
    const base = toNumber(p?.price);
    if (typeof base === "number") return base;
    const variations = Array.isArray(p?.variations) ? p.variations : [];
    if (variations.length) {
      const parsed = variations
        .map((v) => {
          if (v && typeof v === "object") return v;
          try {
            return JSON.parse(v);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .map((v) => {
          const raw =
            v.price ??
            v.selling_price ??
            v.sellingPrice ??
            v.salePrice ??
            v.variant_price ??
            v.amount ??
            v.basePrice;
          return toNumber(raw);
        })
        .filter((n) => typeof n === "number");
      if (parsed.length) return Math.min(...parsed);
    }
    return null;
  };

  /* -------------------- server load - FIXED -------------------- */
  const fetchServerPage = useCallback(async (cursor) => {
    try {
      // Removed console.log for production performance

      // Call the service correctly - match the method signature from ProductService
      const res = await productService.listProducts({
        limit: SERVER_PAGE_SIZE,
        cursor: cursor,
        cursorDirection: cursor ? "after" : undefined,
      });

      const docs = Array.isArray(res?.documents) ? res.documents : [];

      const normalized = docs.map((p) => ({
        ...p,
        $id:
          p.$id ??
          p.id ??
          (globalThis.crypto?.randomUUID?.() || String(Math.random())),
      }));

      // Optimized state update - batch updates to prevent freezes
      setProducts((prev) => {
        const map = new Map(prev.map((x) => [x.$id, x]));
        for (const d of normalized) map.set(d.$id, d);
        return Array.from(map.values());
      });

      const last = normalized[normalized.length - 1];
      setServerCursor(last ? last.$id : cursor);
      return { count: normalized.length, lastId: last?.$id ?? null };
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("❌ Error in fetchServerPage:", error);
        }
        throw error;
      }
  }, []);

  /* -------------------- initial load - FIXED -------------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Real data loading
        const first = await fetchServerPage(null);

        if (!mounted) return;

        // EAGER_PREFETCH_ALL disabled to prevent freezes
        setHasMoreServer(first.count === SERVER_PAGE_SIZE);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("❌ Error fetching products:", e);
        }
        if (mounted) {
          setError("Failed to load products. Please try again later.");
          // Fallback to empty state
          setProducts([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchServerPage]);

  /* -------------------- filter & sort - OPTIMIZED -------------------- */
  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    // Early return if no query and no sorting needed
    if (!q && sortBy === "newest") {
      return products.slice();
    }

    // Optimized filtering - use indexOf instead of includes for better performance
    const filtered = q
      ? products.filter((p) => {
          // Cache searchable text to avoid repeated joins
          const name = (p?.name || "").toLowerCase();
          if (name.includes(q)) return true;
          
          const subtitle = (p?.subtitle || "").toLowerCase();
          if (subtitle.includes(q)) return true;
          
          const category = (p?.category || p?.categories || "").toLowerCase();
          if (category.includes(q)) return true;
          
          const brand = (p?.brand || "").toLowerCase();
          if (brand.includes(q)) return true;
          
          return false;
        })
      : products.slice();

    // Optimized sorting - avoid expensive localeCompare when possible
    if (filtered.length === 0) return filtered;
    
    const withComputed = filtered.map((p) => ({
      p,
      priceKey: getComparablePrice(p),
      createdAt: p?.$createdAt ? new Date(p.$createdAt).getTime() : 0,
      nameKey: (p?.name || "").toLowerCase(),
    }));

    // Use faster comparison for sorting
    withComputed.sort((a, b) => {
      switch (sortBy) {
        case "priceAsc": {
          const ax = a.priceKey ?? Number.POSITIVE_INFINITY;
          const bx = b.priceKey ?? Number.POSITIVE_INFINITY;
          if (ax !== bx) return ax - bx;
          // Only use localeCompare as fallback
          return a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;
        }
        case "priceDesc": {
          const ax = a.priceKey ?? Number.NEGATIVE_INFINITY;
          const bx = b.priceKey ?? Number.NEGATIVE_INFINITY;
          if (ax !== bx) return bx - ax;
          return a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;
        }
        case "nameAsc":
          return a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;
        case "newest":
        default:
          if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
          return a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;
      }
    });

    return withComputed.map((x) => x.p);
  }, [products, query, sortBy]);

  useEffect(() => {
    setVisibleCount(CLIENT_PAGE_SIZE);
  }, [query, sortBy]);

  const visibleProducts = filteredAndSorted.slice(0, visibleCount);
  const canRevealMoreClient = visibleCount < filteredAndSorted.length;

  const handleLoadMore = async () => {
    if (canRevealMoreClient) {
      setVisibleCount((c) => c + CLIENT_PAGE_SIZE);
      return;
    }
    if (!EAGER_PREFETCH_ALL && hasMoreServer && !loadingMore) {
      try {
        setLoadingMore(true);
        const { count } = await fetchServerPage(serverCursor);
        setHasMoreServer(count === SERVER_PAGE_SIZE);
        setVisibleCount((c) => c + CLIENT_PAGE_SIZE);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("Load more failed:", e);
        }
        setError("Couldn't load more products. Please try again.");
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const hasQuery = query.trim().length > 0;
  const hasResults = filteredAndSorted.length > 0;

  // Debug final state - only in development (removed for production performance)

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
        <p className="text-gray-600">Loading products...</p>
        {/* <p className="text-sm text-gray-500">Check console for details</p> */}
      </div>
    );
  }

  // if (error) {
  //   return (
  //     <div className="flex flex-col justify-center items-center h-64 text-red-500">
  //       <p className="text-lg font-semibold">{error}</p>
  //       <p className="text-sm mt-2">Check browser console for details</p>
  //     </div>
  //   );
  // }

  /* -------------------- UI -------------------- */
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Input */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Search products by name, category, or brand..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
          <div className="absolute right-4 top-4">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Title + product count */}
      <div className="flex flex-col items-center p-4 text-center mb-8">
        <h2 className="text-4xl font-bold mb-2 text-gray-800">
          {hasQuery ? "Search Results" : "All Products"}
        </h2>
        {hasResults && (
          <p className="text-gray-600 text-lg">
            Showing{" "}
            <span className="font-semibold text-blue-600">
              {visibleProducts.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-blue-600">
              {filteredAndSorted.length}
            </span>{" "}
            products
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-lg text-gray-700 font-medium">
            Sort by:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border-2 border-gray-300 rounded-lg px-4 py-2 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="newest">Newest First</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="nameAsc">Name A-Z</option>
          </select>
        </div>

        {/* Debug info */}
        {/* <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
          <strong>Debug Info:</strong> {products.length} total • {filteredAndSorted.length} filtered • {visibleProducts.length} visible
        </div> */}
      </div>

      {/* Empty state for search */}
      {hasQuery && !hasResults && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <svg
            className="w-16 h-16 mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xl mb-2">No products found</p>
          <p className="text-lg">
            No results for "
            <span className="font-semibold">{query.trim()}</span>"
          </p>
          <button
            onClick={() => setQuery("")}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Products Grid */}
      {hasResults && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mb-12">
            {visibleProducts.map((product, index) => {
              // First 8 products are above fold - eager load for LCP
              const isAboveFold = index < ABOVE_FOLD_COUNT;
              return (
                <div
                  key={product.$id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
                >
                  <ProductCard product={product} isAboveFold={isAboveFold} />
                </div>
              );
            })}
          </div>

          {/* Load more button */}
          {(canRevealMoreClient || (!EAGER_PREFETCH_ALL && hasMoreServer)) && (
            <div className="flex justify-center mt-12">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Loading...
                  </span>
                ) : (
                  "Load More Products"
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* No products at all */}
      {!hasQuery && !hasResults && !loading && (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <svg
            className="w-20 h-20 mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8V4a1 1 0 00-1-1h-2a1 1 0 00-1 1v1M9 7h6"
            />
          </svg>
          <p className="text-2xl mb-2">No Products Available</p>
          <p className="text-lg text-center max-w-md">
            We're working on adding new products. Please check back soon!
          </p>
        </div>
      )}
    </div>
  );
}
