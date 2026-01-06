import React from "react";
import { useNavigate } from "react-router-dom";
import productService from "../../appwrite/config";

export default function RelatedProducts({ relatedProducts }) {
  const navigate = useNavigate();

  if (!relatedProducts || relatedProducts.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Related Products
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {relatedProducts.map((item) => (
          <div
            key={item.$id}
            onClick={() => navigate(`/product/${item.$id}`)}
            className="cursor-pointer group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
          >
            <img
              src={
                item.images?.length
                  ? productService.getImagePreview(item.images[0])
                  : "/placeholder-product.jpg"
              }
              alt={item.name}
              className="h-40 w-full object-cover group-hover:scale-105 transition-transform"
              onError={(e) => (e.target.src = "/placeholder-product.jpg")}
            />
            <div className="p-3 space-y-1">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {item.subtitle || item.category}
              </p>
              <p className="text-sm font-semibold text-gray-800">
                ${item.price?.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
