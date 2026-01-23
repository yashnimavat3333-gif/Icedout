// pages/SearchResults.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/products/ProductCard";

const INITIAL_DISPLAY_COUNT = 12; // Initial products to display
const LOAD_MORE_COUNT = 12; // Products to load per "Load More" click

const SearchResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(INITIAL_DISPLAY_COUNT);

  // Prefer state from the SearchBar navigation, fall back to ?q= query param
  const params = new URLSearchParams(location.search);
  const term = (location.state?.term ?? params.get("q") ?? "").trim();

  // Only trust results from state (since we didn't fetch here)
  const results = useMemo(
    () =>
      Array.isArray(location.state?.results) ? location.state.results : [],
    [location.state]
  );

  const hasQuery = term.length > 0;
  const hasResults = results.length > 0;
  const visibleResults = results.slice(0, visibleCount);
  const hasMore = results.length > visibleCount;

  // Reset visible count when search term changes
  useEffect(() => {
    setVisibleCount(INITIAL_DISPLAY_COUNT);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [term]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, results.length));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {hasQuery ? `Search Results` : "Search"}
        </h2>
        {hasResults && (
          <span className="text-sm text-gray-500">
            Showing {visibleResults.length} of {results.length} result{results.length === 1 ? "" : "s"}
            {hasQuery ? ` for "${term}"` : ""}
          </span>
        )}
      </div>

      {/* If there's a query and no matches, show the empty state */}
      {hasQuery && !hasResults && (
        <p className="text-gray-600">
          No results found{hasQuery ? ` for "${term}"` : ""}.
        </p>
      )}

      {/* If there's no query and no results (e.g., direct visit), show nothing or a hint */}
      {!hasQuery && !hasResults && (
        <div className="text-gray-600">
          Type something in the search bar to see results.
        </div>
      )}

      {/* Results grid */}
      {hasResults && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {visibleResults.map((product, index) => {
              // First 8 products are above fold - eager load for LCP
              const isAboveFold = index < 8;
              return (
                <ProductCard
                  key={product.$id}
                  isAboveFold={isAboveFold}
                  product={{ ...product, id: product.$id }}
                />
              );
            })}
          </div>

          {/* Load More button */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                aria-label="Load more products"
              >
                Load More Products ({results.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Optional: a small back link */}
      <div className="mt-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm underline text-gray-600 hover:text-gray-900"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default SearchResults;
