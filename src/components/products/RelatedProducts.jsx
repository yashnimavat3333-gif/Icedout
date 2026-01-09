import React from "react";
import { useNavigate } from "react-router-dom";
import productService from "../../appwrite/config";

export default function RelatedProducts({ relatedProducts }) {
  const navigate = useNavigate();

  if (!relatedProducts || !Array.isArray(relatedProducts) || relatedProducts.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Related Products
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {relatedProducts
          .filter((item) => item && (item.$id || item.id))
          .map((item) => {
            const itemId = item.$id || item.id;
            const firstImage = Array.isArray(item.images) && item.images.length > 0 
              ? item.images[0] 
              : null;
            
            return (
              <div
                key={itemId}
                onClick={() => itemId && navigate(`/product/${itemId}`)}
                className="cursor-pointer group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <img
                  src={
                    firstImage
                      ? productService.getOptimizedImageUrl(firstImage, 800)
                      : "/placeholder-product.jpg"
                  }
                  alt={item?.name || "Related product"}
                  width={400}
                  height={533}
                  className="h-40 w-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => (e.target.src = "/placeholder-product.jpg")}
                />
                <div className="p-3 space-y-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {item?.name || "Product"}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {item?.subtitle || item?.category || ""}
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    ${typeof item?.price === "number" ? item.price.toLocaleString() : "N/A"}
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
