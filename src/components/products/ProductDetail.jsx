import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Query } from "appwrite";
import conf from "../../conf/conf";
import { databases } from "../../conf/index";
import productService from "../../appwrite/config";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { Check, Truck, ChevronRight, ChevronLeft } from "react-feather";
import { useCart } from "../../context/CartContext";
import SpinnerLoader from "../SpinnerLoader";
import ProductCard from "./ProductCard";
import parse from "html-react-parser";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

/* ============================
   Helpers (NO HOOK VIOLATIONS)
============================ */

const UPLOADED_FALLBACK = "/placeholder-product.jpg";

/* ============================
   Main Component
============================ */

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  /* ============================
     Fetch Product
  ============================ */

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const doc = await databases.getDocument(
          conf.appwriteDatabaseId,
          conf.appwriteProductCollectionId,
          id
        );

        const processedMedia = (doc.images || []).map((fileId) => ({
          fileId,
          view: productService.getOptimizedImageUrl(fileId, 1600),
        }));

        setProduct({
          ...doc,
          processedMedia,
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  /* ============================
     Related Products
  ============================ */

  useEffect(() => {
    if (!product) return;

    databases
      .listDocuments(
        conf.appwriteDatabaseId,
        conf.appwriteProductCollectionId,
        [
          Query.equal("categories", product.categories),
          Query.notEqual("$id", product.$id),
          Query.limit(6),
        ]
      )
      .then((res) => setRelatedProducts(res.documents || []))
      .catch(() => {});
  }, [product]);

  /* ============================
     Early States
  ============================ */

  if (loading) return <SpinnerLoader />;

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error}
      </div>
    );

  if (!product)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Product not found
      </div>
    );

  /* ============================
     SAFE DERIVED VALUES (NO HOOKS)
  ============================ */

  const productName = product.name || "Product";
  const productPrice = Number(product.price || 0);
  const productCategories = product.categories || "";
  const productDescription = product.description || "";
  const productMedia = product.processedMedia || [];

  /* ❗ FIXED PART (NO useMemo inside useMemo) */
  const categoryLower = productCategories.toLowerCase();
  let categoryText =
    "⭐ Quality-tested & customer-approved · Inspected before dispatch";

  if (categoryLower === "luxury watch") {
    categoryText =
      "💎 Set with VVS1 D-Color Moissanite Diamonds · Precision-set for maximum brilliance";
  } else if (categoryLower === "ring" || categoryLower === "bracelet") {
    categoryText =
      "✨ Crafted from pure 925 sterling silver · Set with VVS1 D-Color Moissanite Diamonds";
  }

  /* ============================
     UI
  ============================ */

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
            {productMedia.length > 0 ? (
              <Swiper
                slidesPerView={1}
                onSlideChange={(s) => setSelectedImage(s.activeIndex)}
              >
                {productMedia.map((m, i) => (
                  <SwiperSlide key={i}>
                    <img
                      src={m.view}
                      alt={productName}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => setZoomOpen(true)}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
            ) : (
              <img
                src={UPLOADED_FALLBACK}
                alt={productName}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-medium">{productName}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {productCategories}
              </p>
              <p className="text-xs text-gray-600 mt-2">{categoryText}</p>
            </div>

            <div className="text-2xl font-semibold">
              ${productPrice.toLocaleString()}
            </div>

            <button
              className="w-full py-3 bg-black text-white rounded-md"
              onClick={() => {
                addToCart({ ...product, quantity: 1 });
                navigate("/cart");
              }}
            >
              Add to Cart
            </button>

            <div className="prose text-sm">
              {parse(productDescription)}
            </div>
          </div>
        </div>

        {/* Related */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold mb-6">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.$id} product={p} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Zoom Modal */}
      {zoomOpen && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setZoomOpen(false)}
        >
          <TransformWrapper>
            <TransformComponent>
              <img
                src={productMedia[selectedImage]?.view || UPLOADED_FALLBACK}
                alt={productName}
                className="max-h-screen max-w-screen"
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </>
  );
}
