// src/pages/CategoryPage.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Client, Databases, Query } from "appwrite";
import ProductCard from "../components/products/ProductCard";
import conf from "../conf/conf";
import SpinnerLoader from "../components/SpinnerLoader";

const INITIAL_BATCH_SIZE = 16; // Initial products to load
const BATCH_SIZE = 16; // Products per batch for infinite scroll
const MAX_BATCH_SIZE = 100; // Appwrite max per request

const CategoryPage = ({ category: propCategory }) => {
  const { categoryName: urlCategoryName } = useParams();
  const location = useLocation();

  const [category, setCategory] = useState(propCategory || null);
  const [products, setProducts] = useState([]); // Only visible products
  const [allProductsCount, setAllProductsCount] = useState(0); // Total count for display
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [baseQueries, setBaseQueries] = useState([]);
  
  // Refs for infinite scroll
  const observerTarget = useRef(null);
  const isInitialLoad = useRef(true);

  // Init Appwrite client once
  const databases = useMemo(() => {
    const client = new Client()
      .setEndpoint(conf.appwriteUrl)
      .setProject(conf.appwriteProjectId);
    return new Databases(client);
  }, []);

  // Category from props, router state, or URL
  const categoryName =
    propCategory?.name || location.state?.categoryName || urlCategoryName;

  useEffect(() => {
    // Defer scroll to prevent blocking initial render
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [categoryName]);

  // Fetch a single batch of products
  const fetchBatch = useCallback(async (baseQueries, cursor = null, limit = BATCH_SIZE) => {
    const queries = [
      Query.limit(limit),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ...baseQueries,
    ];

    const res = await databases.listDocuments(
      conf.appwriteDatabaseId,
      conf.appwriteProductCollectionId,
      queries
    );

    const docs = Array.isArray(res?.documents) ? res.documents : [];
    const newCursor = docs.length > 0 ? docs[docs.length - 1].$id : null;
    const hasMoreData = docs.length === limit;

    return { docs, cursor: newCursor, hasMore: hasMoreData };
  }, [databases]);

  // Get total count (for display only, doesn't fetch all products)
  const fetchTotalCount = useCallback(async (baseQueries) => {
    try {
      const res = await databases.listDocuments(
        conf.appwriteDatabaseId,
        conf.appwriteProductCollectionId,
        [Query.limit(1), ...baseQueries]
      );
      // Appwrite doesn't provide total count directly, so we estimate
      // by checking if there are more than initial batch
      return res.total || null;
    } catch {
      return null;
    }
  }, [databases]);

  // Build base queries based on category
  useEffect(() => {
    const buildBaseQueries = async () => {
      if (categoryName) {
        try {
          // Try exact match first
          setBaseQueries([Query.equal("categories", categoryName)]);
        } catch {
          // Fallback handled in fetchBatch
          setBaseQueries([]);
        }
      } else {
        setBaseQueries([]);
      }
    };
    buildBaseQueries();
  }, [categoryName]);

  // Initial load: fetch first batch only
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setProducts([]);
        setCursor(null);
        setHasMore(true);
        isInitialLoad.current = true;

        let queries = [];
        if (categoryName) {
          try {
            queries = [Query.equal("categories", categoryName)];
          } catch {
            // Will handle in fetchBatch
            queries = [];
          }
        }

        // Fetch initial batch only - never load more than INITIAL_BATCH_SIZE
        const { docs, cursor: newCursor, hasMore: hasMoreData } = await fetchBatch(
          queries,
          null,
          INITIAL_BATCH_SIZE
        );

        // Set products - if no results, show empty state (don't load all products)
        setProducts(docs);
        setCursor(newCursor);
        setHasMore(hasMoreData);
        // Only show count of loaded products, not total (avoids loading all)
        setAllProductsCount(docs.length);

        if (!category && docs.length > 0) {
          setCategory({ name: categoryName });
        }
      } catch (e) {
        console.error("Failed to fetch category data:", e);
        setError(`Failed to load category data: ${e.message}`);
      } finally {
        setLoading(false);
        isInitialLoad.current = false;
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName, fetchBatch]); // re-run when category changes

  // Load more products (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;

    setLoadingMore(true);
    try {
      const { docs, cursor: newCursor, hasMore: hasMoreData } = await fetchBatch(
        baseQueries,
        cursor,
        BATCH_SIZE
      );

      setProducts((prev) => [...prev, ...docs]);
      setCursor(newCursor);
      setHasMore(hasMoreData);
      setAllProductsCount((prev) => prev + docs.length);
    } catch (e) {
      console.error("Failed to load more products:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, cursor, baseQueries, fetchBatch]);

  // Intersection Observer for infinite scroll - optimized for performance
  useEffect(() => {
    // Don't set up observer during initial load or if no more products
    if (isInitialLoad.current || loading || !hasMore || !cursor) return;

    let observer;
    const currentTarget = observerTarget.current;

    // Use requestIdleCallback to defer observer setup (non-blocking)
    const setupObserver = () => {
      if (!currentTarget || loadingMore) return;

      observer = new IntersectionObserver(
        (entries) => {
          // Only trigger if element is intersecting and we're not already loading
          if (entries[0]?.isIntersecting && hasMore && !loadingMore && cursor) {
            loadMore();
          }
        },
        { 
          threshold: 0.1, 
          rootMargin: "300px" // Start loading 300px before reaching bottom for smoother UX
        }
      );

      observer.observe(currentTarget);
    };

    // Defer observer setup to prevent blocking
    if (window.requestIdleCallback) {
      window.requestIdleCallback(setupObserver, { timeout: 1000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(setupObserver, 100);
    }

    return () => {
      if (observer && currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore, loadMore, cursor]);

  // ProductCard is already memoized at export, no need to memoize again

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <SpinnerLoader />
      </div>
    );
  }

  return (
    <div className="container min-h-screen mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {(category?.name || categoryName || "All Products").toUpperCase()}
        </h1>
        <p className="text-gray-600 mt-2">
          {allProductsCount > 0 ? (
            <>
              Showing {products.length}
              {hasMore && ` of ${allProductsCount}+`} {products.length === 1 ? "product" : "products"}
            </>
          ) : (
            "0 products available"
          )}
        </p>
      </div>

      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {products.map((product) => (
              <ProductCard
                key={product.$id}
                product={{
                  id: product.$id,
                  $id: product.$id,
                  name: product.name,
                  subtitle: product.subtitle || product.category,
                  price: product.price,
                  images: product.images,
                  variations: product.variations,
                  useVariations: product.useVariations,
                  compareAtPrice: product.compareAtPrice,
                  mrp: product.mrp,
                  listPrice: product.listPrice,
                }}
              />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          {hasMore && (
            <div
              ref={observerTarget}
              className="flex justify-center items-center py-8"
            >
              {loadingMore && (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-900"></div>
                  <span className="text-gray-600">Loading more products...</span>
                </div>
              )}
            </div>
          )}

          {/* Manual load more button (fallback for older browsers) */}
          {hasMore && !loadingMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                aria-label="Load more products"
              >
                Load More Products
              </button>
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              All products loaded
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No products found in this category
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
