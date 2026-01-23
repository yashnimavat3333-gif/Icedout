import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import productService from "../appwrite/config";
import ProductCard from "../components/products/ProductCard";

const INITIAL_PRODUCTS_PER_CATEGORY = 12; // Initial products to show per category
const LOAD_MORE_COUNT = 12; // Products to load per "Load More" click

const ProductsByCategory = () => {
  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [visibleCounts, setVisibleCounts] = useState({}); // Track visible count per category
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch categories
        const categoriesResponse = await productService.listCategories();
        setCategories(categoriesResponse.documents);

        // Fetch all products
        const productsResponse = await productService.listProducts();
        const allProducts = productsResponse.documents;

        // Group products by category
        const grouped = {};
        categoriesResponse.documents.forEach((category) => {
          grouped[category.$id] = {
            categoryInfo: category,
            products: allProducts.filter(
              (product) => product.category === category.$id
            ),
          };
        });

        setProductsByCategory(grouped);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {Object.entries(productsByCategory).map(
        ([categoryId, { categoryInfo, products }]) => (
          <div key={categoryId} className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                {categoryInfo.name}
              </h2>
              <Link
                to={`/category/${categoryInfo.slug}`}
                className="text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>

            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {products
                    .slice(0, visibleCounts[categoryId] || INITIAL_PRODUCTS_PER_CATEGORY)
                    .map((product, index) => {
                      // First 8 products are above fold - eager load for LCP
                      const isAboveFold = index < 8;
                      return (
                        <ProductCard
                          key={product.$id}
                          isAboveFold={isAboveFold}
                          product={product}
                        />
                      );
                    })}
                </div>
                {products.length > (visibleCounts[categoryId] || INITIAL_PRODUCTS_PER_CATEGORY) && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => {
                        setVisibleCounts((prev) => ({
                          ...prev,
                          [categoryId]: (prev[categoryId] || INITIAL_PRODUCTS_PER_CATEGORY) + LOAD_MORE_COUNT,
                        }));
                      }}
                      className="px-6 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                    >
                      Load More {categoryInfo.name} Products (
                      {products.length - (visibleCounts[categoryId] || INITIAL_PRODUCTS_PER_CATEGORY)} remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500">No products in this category</p>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default ProductsByCategory;
