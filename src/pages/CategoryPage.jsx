// src/pages/CategoryPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Client, Databases, Query } from "appwrite";
import ProductCard from "../components/products/ProductCard";
import conf from "../conf/conf";
import SpinnerLoader from "../components/SpinnerLoader";

const PAGE = 100; // Appwrite max per request

const CategoryPage = ({ category: propCategory }) => {
  const { categoryName: urlCategoryName } = useParams();
  const location = useLocation();

  const [category, setCategory] = useState(propCategory || null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [categoryName]);

  // Helper: fetch *all* pages for given base queries
  const fetchAll = async (baseQueries) => {
    let cursor = undefined;
    const all = [];
    // Add a stable order so cursor paging is deterministic
    // (orderBy is optional; if you have $createdAt use that)
    const order = []; // e.g., [Query.orderDesc("$createdAt")]

    while (true) {
      const queries = [
        Query.limit(PAGE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ...order,
        ...baseQueries,
      ];

      const res = await databases.listDocuments(
        conf.appwriteDatabaseId,
        conf.appwriteProductCollectionId,
        queries
      );

      const docs = Array.isArray(res?.documents) ? res.documents : [];
      all.push(...docs);

      if (docs.length < PAGE) break; // reached last page
      cursor = docs[docs.length - 1].$id;
    }
    return all;
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        let docs = [];

        if (categoryName) {
          // 1) Try exact match on the field (fast, indexed)
          try {
            docs = await fetchAll([Query.equal("categories", categoryName)]);
          } catch (err) {
            // 2) Fallback: fetch all and filter in JS for case/shape mismatches
            const all = await fetchAll([]); // no filter -> get everything (paged)
            docs = all.filter((p) => {
              const c = p?.categories;
              if (typeof c === "string")
                return c.toLowerCase() === categoryName.toLowerCase();
              if (c && typeof c === "object" && c.name)
                return c.name.toLowerCase() === categoryName.toLowerCase();
              if (c && c.$id) return c.$id === categoryName;
              // if categories is an array of strings
              if (Array.isArray(c))
                return c
                  .map(String)
                  .some((x) => x.toLowerCase() === categoryName.toLowerCase());
              return false;
            });
          }

          setProducts(docs);
          if (!category && docs.length > 0) {
            setCategory({ name: categoryName });
          }
        } else {
          // No category provided: fetch all products (paged)
          docs = await fetchAll([]);
          setProducts(docs);
        }
      } catch (e) {
        console.error("Failed to fetch category data:", e);
        setError(`Failed to load category data: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName]); // re-run when category changes

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
          {products.length} {products.length === 1 ? "product" : "products"}{" "}
          available
        </p>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {products.map((product) => (
            <ProductCard
              key={product.$id}
              product={{
                id: product.$id,
                name: product.name,
                subtitle: product.subtitle || product.category,
                price: product.price,
                images: product.images,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No products found in this category
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
