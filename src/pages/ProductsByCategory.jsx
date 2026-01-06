import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import productService from "../appwrite/config";

const ProductsByCategory = () => {
  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.$id} product={product} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No products in this category</p>
            )}
          </div>
        )
      )}
    </div>
  );
};

const ProductCard = ({ product }) => {
  return (
    <Link
      to={`/product/${product.slug}`}
      className="group bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow duration-300"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.images?.[0] || "/placeholder-product.jpg"}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.discount > 0 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            {product.discount}% OFF
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-1 truncate">
          {product.name}
        </h3>
        <p className="text-gray-500 text-sm mb-2 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <div>
            {product.discount > 0 ? (
              <>
                <span className="text-lg font-bold text-gray-900">
                  ${(product.price * (1 - product.discount / 100)).toFixed(2)}
                </span>
                <span className="ml-2 text-sm text-gray-500 line-through">
                  ${product.price.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-gray-900">
                ${product.price.toFixed(2)}
              </span>
            )}
          </div>
          {product.stock > 0 ? (
            <span className="text-xs text-green-600">In Stock</span>
          ) : (
            <span className="text-xs text-red-600">Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductsByCategory;
