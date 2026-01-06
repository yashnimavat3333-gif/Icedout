import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import productService from "../appwrite/config";
import SpinnerLoader from "../components/SpinnerLoader";

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await productService.listCategories();
        setCategories(response.documents);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
        setError("Failed to load categories. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (loading) return <SpinnerLoader />;

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">All Categories</h1>

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((category) => (
            <Link
              key={category.$id}
              to={{
                pathname: `/category/${encodeURIComponent(
                  category.name.toLowerCase()
                )}`,
                state: { categoryName: category.name }, // Passing the category name as state
              }}
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                <img
                  src={category.image || "/placeholder-category.jpg"}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.target.src = "/placeholder-category.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h2 className="text-xl font-semibold text-white">
                    {category.name}
                  </h2>
                  {/* <p className="text-gray-200 text-sm">
                    {category.productCount || 0}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </p> */}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No categories found
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
