import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Client, Databases, Query } from "appwrite";
import ProductCard from "../components/products/ProductCard";
import conf from "../conf/conf";
import SpinnerLoader from "../components/SpinnerLoader";

const PRODUCTS_PER_PAGE = 10;
const ABOVE_FOLD_COUNT = 8;

const CategoryPage = ({ category: propCategory }) => {
  const { categoryName: urlCategoryName } = useParams();
  const location = useLocation();

  const [category, setCategory] = useState(propCategory || null);
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const databases = useMemo(() => {
    const client = new Client()
      .setEndpoint(conf.appwriteUrl)
      .setProject(conf.appwriteProjectId);
    return new Databases(client);
  }, []);

  const categoryName =
    propCategory?.name || location.state?.categoryName || urlCategoryName;

  const totalPages = Math.ceil(totalCount / PRODUCTS_PER_PAGE);

  const fetchProducts = useCallback(
    async (page) => {
      setLoading(true);
      setError(null);

      try {
        const offset = (page - 1) * PRODUCTS_PER_PAGE;
        const baseQueries = categoryName
          ? [Query.equal("categories", categoryName)]
          : [];

        const queries = [
          Query.limit(PRODUCTS_PER_PAGE),
          Query.offset(offset),
          ...baseQueries,
        ];

        const res = await databases.listDocuments(
          conf.appwriteDatabaseId,
          conf.appwriteProductCollectionId,
          queries
        );

        const docs = Array.isArray(res?.documents) ? res.documents : [];
        setProducts(docs);
        setTotalCount(res.total ?? 0);

        if (!category && docs.length > 0) {
          setCategory({ name: categoryName });
        }
      } catch (e) {
        console.error("Failed to fetch category data:", e);
        setError(`Failed to load category data: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [databases, categoryName, category]
  );

  // Reset to page 1 when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryName]);

  // Fetch products whenever page or category changes
  useEffect(() => {
    fetchProducts(currentPage);
  }, [currentPage, fetchProducts]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Generate visible page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    pages.push(1);

    if (currentPage > 3) pages.push("…");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("…");

    pages.push(totalPages);
    return pages;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => fetchProducts(currentPage)}
          className="mt-4 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
        >
          Try Again
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
          {totalCount > 0 ? (
            <>
              {totalCount} {totalCount === 1 ? "product" : "products"}
              {totalPages > 1 && (
                <span className="text-gray-400">
                  {" "}· Page {currentPage} of {totalPages}
                </span>
              )}
            </>
          ) : (
            "0 products available"
          )}
        </p>
        {products.length > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            Tap any product to view full details
          </p>
        )}
        {products.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            ✓ Worldwide insured shipping • Quality checked before dispatch
          </p>
        )}
      </div>

      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {products.map((product, index) => (
              <ProductCard
                key={product.$id}
                isAboveFold={index < ABOVE_FOLD_COUNT}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1.5 mt-12 mb-4">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
              >
                Previous
              </button>

              <div className="flex items-center gap-1 mx-2">
                {getPageNumbers().map((page, idx) =>
                  page === "…" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-9 text-center text-gray-400 text-sm select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`w-9 h-9 text-sm font-medium rounded-md transition-colors ${
                        page === currentPage
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
              >
                Next
              </button>
            </nav>
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
