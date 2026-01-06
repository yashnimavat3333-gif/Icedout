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
    if (user && user.labels?.includes("admin")) {
      setIsAdmin(true);
      fetchProducts();
    } else {
      navigate("/not-authorized"); // or home
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

  return isAdmin ? (
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
        {products.map((product) => (
          <div key={product.$id} className="p-4 border rounded shadow">
            {/* {console.log(product.images[0])} */}
            {/* <img
              src={bucket.getFilePreview(
                conf.appwriteBucketId,
                product.images[0]
              )}
            /> */}

            <h2 className="text-lg font-semibold">{product.name}</h2>
            {/* <p>{product.description}</p> */}
            {/* <p className="text-sm text-gray-600">${product.price}</p> */}
            <div className="flex justify-between mt-3">
              <button
                onClick={() => navigate(`/edit/${product.$id}`)}
                className="text-teal-600 underline"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setDeleteId(product.$id);
                  setShowConfirm(true);
                }}
                className="text-red-600 underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
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
  ) : null;
};

export default AdminProductPanel;
