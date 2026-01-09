// =======================
// ProductDetail.jsx
// =======================

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

const UPLOADED_FALLBACK = "/placeholder-product.jpg";

/* =========================
   PURE HELPERS (NO HOOKS)
========================= */

const isTruthy = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") return val.trim().length > 0;
  return !!val;
};

const safeParseVar = (v) => {
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
};

const toNumber = (val) => {
  if (val === null || val === undefined) return null;
  const n = Number(String(val).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const hasVariations = (p) =>
  p &&
  isTruthy(p.useVariations) &&
  Array.isArray(p.variations) &&
  p.variations.length > 0;

const getActiveVariation = (p, idx) =>
  hasVariations(p) ? p.variations[idx] || p.variations[0] : null;

const detectMediaType = (fileId) =>
  /\.(mp4|webm|mov|m4v)$/i.test(String(fileId)) ? "video" : "image";

const getDisplayPricing = (p, idx) => {
  const v = getActiveVariation(p, idx);
  if (v?.price) return { price: toNumber(v.price) };
  return { price: toNumber(p?.price) };
};

/* =========================
   COMPONENT
========================= */

export default function ProductDetail() {
  /* ===== ALL HOOKS FIRST ===== */
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [mainSwiper, setMainSwiper] = useState(null);

  /* ===== FETCH PRODUCT ===== */
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const doc = await databases.getDocument(
          conf.appwriteDatabaseId,
          conf.appwriteProductCollectionId,
          id
        );

        const variations = Array.isArray(doc.variations)
          ? doc.variations.map(safeParseVar).filter(Boolean)
          : [];

        const processedMedia = (doc.images || [])
          .map((fileId) => {
            const type = detectMediaType(fileId);
            const view =
              type === "video"
                ? productService.getFilePreview(fileId) // ✅ FIX
                : productService.getOptimizedImageUrl(fileId, 1600);

            return {
              fileId,
              type,
              view: typeof view === "string" ? view : view?.href,
            };
          })
          .filter((m) => m.view);

        setProduct({
          ...doc,
          variations,
          processedMedia,
        });
      } catch (e) {
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  /* ===== RELATED PRODUCTS ===== */
  useEffect(() => {
    if (!product?.categories) return;

    databases
      .listDocuments(
        conf.appwriteDatabaseId,
        conf.appwriteProductCollectionId,
        [Query.equal("categories", product.categories), Query.limit(6)]
      )
      .then((res) => setRelatedProducts(res.documents || []));
  }, [product]);

  /* ===== MEMOS ===== */
  const pricing = useMemo(
    () => getDisplayPricing(product, selectedVarIndex),
    [product, selectedVarIndex]
  );

  const media = product?.processedMedia || [];

  /* ===== EARLY RETURNS ===== */
  if (loading) return <SpinnerLoader />;
  if (error) return <p className="text-center">{error}</p>;
  if (!product) return null;

  /* =========================
     RENDER
  ========================= */

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ===== GALLERY ===== */}
        <div className="relative">
          <Swiper
            onSwiper={setMainSwiper}
            onSlideChange={(s) => setSelectedImage(s.activeIndex)}
          >
            {media.map((m, i) => (
              <SwiperSlide key={i}>
                {m.type === "video" ? (
                  <video
                    src={m.view}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={m.view}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* ===== INFO ===== */}
        <div>
          <h1 className="text-xl font-medium">{product.name}</h1>

          <p className="text-2xl mt-2">
            ${pricing.price?.toLocaleString()}
          </p>

          <button
            className="mt-6 w-full bg-black text-white py-3"
            onClick={() => {
              addToCart({ ...product, quantity: 1 });
              navigate("/cart");
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>

      {/* ===== RELATED ===== */}
      {relatedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl mb-6">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.$id} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}