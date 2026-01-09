import React from "react";
import { useNavigate } from "react-router-dom";
import productService from "../../appwrite/config";

export default function RelatedProducts({ relatedProducts }) {
  // ALL HOOKS MUST BE AT TOP LEVEL
  const navigate = useNavigate();

  // Safe defaults - ensure consistent render tree
  const safeRelatedProducts = Array.isArray(relatedProducts) ? relatedProducts : [];
  const hasProducts = safeRelatedProducts.length > 0;

  // Render fallback UI instead of null (prevents hydration mismatch)
  if (!hasProducts) {
    return null; // Related products section can be empty
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Related Products
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {safeRelatedProducts
          .filter((item) => {
            if (!item) return false;
            const itemId = item.$id || item.id || "";
            return itemId.length > 0;
          })
          .map((item) => {
            // Safe defaults for each item
            const itemId = item.$id || item.id || "";
            const itemName = item?.name || "Product";
            const itemPrice = typeof item?.price === "number" ? item.price : null;
            const itemImages = Array.isArray(item?.images) ? item.images : [];
            const itemSlug = item?.slug || itemId || "";
            const itemDescription = item?.description || "";
            const itemStock = item?.stock ?? null;
            const itemBrand = item?.brand || "";
            const itemSubtitle = item?.subtitle || item?.category || "";
            
            const firstImage = itemImages.length > 0 ? itemImages[0] : null;
            
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
                  alt={itemName}
                  width={400}
                  height={533}
                  className="h-40 w-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => (e.target.src = "/placeholder-product.jpg")}
                />
                <div className="p-3 space-y-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {itemName}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {itemSubtitle}
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {itemPrice !== null ? `$${itemPrice.toLocaleString()}` : "N/A"}
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
