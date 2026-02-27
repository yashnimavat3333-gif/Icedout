import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import productService from "../../appwrite/config";
import authService from "../../appwrite/auth"; // assumed auth service
import SpinnerLoader from "../SpinnerLoader"; // optional loading component
import { bucket } from "../../conf";
import conf from "../../conf/conf";

const AdminProductPanel = () => {
  const [products, setProducts] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProducts = async () => {
    const response = await productService.listProducts();
    setProducts(response.documents);
  };

  const checkAdmin = async () => {
    const user = await authService.getCurrentUser();
    console.log("Admin Check:", user);

    if (!user) {
      navigate("/login");
      return;
    }

    if (Array.isArray(conf.adminUserIds) && conf.adminUserIds.includes(user.$id)) {
      setIsAdmin(true);
      fetchProducts();
    }

    setLoading(false);
  };

  useEffect(() => {
    checkAdmin();
  }, []);

  const handleDelete = async () => {
    await productService.deleteProduct(deleteId);
    setShowConfirm(false);
    fetchProducts();
  };

  if (loading) return <SpinnerLoader />;

  if (!isAdmin) {
    return (
      <div style={{padding: "40px", textAlign: "center"}}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Admin Product Panel</h1>
        <button
          onClick={() => navigate("/add-product")}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          + Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((product) => {
          // Extract first image fileId (string or {$id})
          const getFileId = () => {
            if (!product?.images || product.images.length === 0) return null;
            const first = product.images[0];
            if (typeof first === "string") return first;
            if (first && typeof first === "object" && first.$id) return first.$id;
            return null;
          };

          const fileId = getFileId();
          const imageUrl = fileId ? productService.getFileView(fileId) : null;

          return (
            <div key={product.$id} className="p-4 border rounded shadow flex flex-col sm:flex-row gap-3">
              {/* Product Image Thumbnail */}
              <div className="flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name || "Product"}
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded border border-gray-200"
                    onError={(e) => {
                      e.target.onerror = null; // Prevent infinite loop
                      e.target.style.display = "none";
                      const placeholder = e.target.parentElement.querySelector(".placeholder-icon");
                      if (placeholder) placeholder.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className={`w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 border border-gray-200 rounded flex items-center justify-center ${
                    imageUrl ? "hidden" : ""
                  } placeholder-icon`}
                >
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate">{product.name}</h2>
                {/* <p>{product.description}</p> */}
                {/* <p className="text-sm text-gray-600">${product.price}</p> */}
                <div className="flex justify-between mt-3 gap-2">
                  <button
                    onClick={() => navigate(`/edit/${product.$id}`)}
                    className="text-teal-600 underline text-sm whitespace-nowrap"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeleteId(product.$id);
                      setShowConfirm(true);
                    }}
                    className="text-red-600 underline text-sm whitespace-nowrap"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded shadow-lg text-center">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p>Are you sure you want to delete this product?</p>
            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductPanel;
