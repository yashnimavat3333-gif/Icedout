// pages/SearchResults.jsx
import { useLocation } from "react-router-dom";
import ProductCard from "../components/products/ProductCard";
import { useEffect } from "react";

const SearchResults = () => {
  const location = useLocation();
  const results = location.state?.results || [];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []); // removed [loading]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold mb-4">Search Results</h2>
      {results.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {results.map((product) => (
            <ProductCard
              key={product.$id}
              product={{ ...product, id: product.$id }}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No results found.</p>
      )}
    </div>
  );
};

export default SearchResults;
