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

// ========== Helper Functions (Pure, No Hooks) ==========
const isTruthy = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0 && !Number.isNaN(val);
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return ["true", "1", "yes", "y", "on", "enabled"].includes(s) || s.length > 0;
  }
  return !!val;
};

const safeParseVar = (v) => {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const o = JSON.parse(v);
      return o && typeof o === "object" ? o : null;
    } catch {
      return null;
    }
  }
  return null;
};

const toNumber = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const cleaned = String(val).trim().replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const isInStock = (variant) => {
  if (!variant) return true;
  if (typeof variant.inStock === "boolean") return variant.inStock;
  const n = toNumber(variant.stock);
  return n === null ? true : n > 0;
};

const hasVariations = (p) =>
  p &&
  isTruthy(p?.useVariations) &&
  Array.isArray(p?.variations) &&
  p.variations.length > 0;

const getActiveVariation = (p, idx) => {
  if (!hasVariations(p)) return null;
  const list = p.variations;
  return list[idx] || list[0] || null;
};

// Detect media type from fileId or URL
const detectMediaType = (fileId, viewUrl) => {
  const fileIdStr = String(fileId || "").toLowerCase();
  if (fileIdStr.match(/\.(mp4|webm|ogg|mov|avi)(\?|$)/i)) return "video";
  const urlStr = String(viewUrl || "").toLowerCase();
  if (urlStr.match(/\.(mp4|webm|ogg|mov|avi)(\?|$)/i)) return "video";
  return "image";
};

// Get display pricing - variant price if exists, else product price
const getDisplayPricing = (p, selectedVarIndex) => {
  if (!p) return { price: null, originalPrice: null, discountPct: 0 };

  const v = getActiveVariation(p, selectedVarIndex);
  if (v) {
    const varPrice = toNumber(v.price);
    if (varPrice !== null && varPrice > 0) {
      const varDiscountPct = toNumber(v.discount);
      if (varDiscountPct !== null && varDiscountPct > 0 && varDiscountPct < 100) {
        const discounted = Math.max(0, varPrice * (1 - varDiscountPct / 100));
        return {
          price: discounted,
          originalPrice: varPrice,
          discountPct: Math.round(varDiscountPct),
        };
      }
      return { price: varPrice, originalPrice: null, discountPct: 0 };
    }
  }

  // Fallback to product price (never default to 0)
  const base = toNumber(p?.price);
  if (base === null) return { price: null, originalPrice: null, discountPct: 0 };

  const original = toNumber(p?.originalPrice ?? p?.compareAtPrice ?? p?.mrp);
  const discountPct =
    original !== null && original > base
      ? Math.round((1 - base / original) * 100)
      : 0;
  return { price: base, originalPrice: original, discountPct };
};

// ========== Thumbnail Component ==========
const ThumbMedia = React.memo(({ src, alt, isVideo = false }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const v = videoRef.current;
    if (document.visibilityState === "hidden") {
      try {
        v.pause();
      } catch {}
    } else {
      v.play().catch(() => {
        setError(true);
      });
    }
  }, [isVideo]);

  if (error || !src) {
    return (
      <div className="w-full h-full rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        <div className="w-7 h-7 rounded-md border-2 border-gray-400 flex items-center justify-center">
          <div className="w-3 h-3 bg-gray-400 rounded-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-md overflow-hidden bg-gray-100 relative">
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoadedData={() => setLoaded(true)}
            onError={() => {
              setError(true);
              setLoaded(false);
            }}
            muted
            playsInline
            loop
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-white ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </>
      ) : (
        <img
          src={src}
          alt={alt}
          width={64}
          height={64}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setError(true);
            setLoaded(true);
          }}
          loading="lazy"
          decoding="async"
          style={{ contain: "paint", backfaceVisibility: "hidden" }}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
});
ThumbMedia.displayName = "ThumbMedia";

// ========== Main Slide Component ==========
const MediaSlide = React.memo(({ media, name, isActive, onOpenZoom }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const videoRef = useRef(null);
  const placeholder = "/placeholder-product.jpg";
  const mediaType = media?.type || "image";
  const isVideo = mediaType === "video";

  useEffect(() => {
    if (!isVideo || !videoRef.current || !isActive) return;
    const video = videoRef.current;
    video.play().catch(() => {
      setError(true);
    });
    return () => {
      if (video) {
        video.pause();
      }
    };
  }, [isVideo, isActive]);

  const handleOpen = () => {
    if (!isVideo) {
      onOpenZoom?.();
    }
  };

  if (!media?.view || error) {
    return (
      <div
        className="h-full w-full flex items-center justify-center p-0 cursor-zoom-in"
        onDoubleClick={handleOpen}
        onClick={handleOpen}
      >
        <img
          src={placeholder}
          alt="No media"
          width={1600}
          height={1600}
          className="w-full h-full object-cover"
          onLoad={() => setLoaded(true)}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full flex items-center justify-center p-0 ${
        isVideo ? "cursor-default" : "cursor-zoom-in"
      } relative`}
      onDoubleClick={handleOpen}
      onClick={handleOpen}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={media.view}
          preload="auto"
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoadedData={() => setLoaded(true)}
          onError={() => {
            setError(true);
            setLoaded(false);
          }}
          muted
          playsInline
          autoPlay={isActive}
          loop
          controls
          disablePictureInPicture
          disableRemotePlayback
        />
      ) : (
        <img
          src={media.view}
          alt={name || "Product media"}
          width={1600}
          height={1600}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setError(true);
            setLoaded(true);
          }}
          loading={isActive ? "eager" : "lazy"}
          decoding={isActive ? "sync" : "async"}
        />
      )}
    </div>
  );
});
MediaSlide.displayName = "MediaSlide";

// ========== Main Component ==========
export default function ProductDetail() {
  // ALL HOOKS AT TOP LEVEL
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
  const [expandedSections, setExpandedSections] = useState({
    description: false,
    warranty: false,
    shipping: false,
  });
  const [mainSwiper, setMainSwiper] = useState(null);
  const [isClient, setIsClient] = useState(false);

  const activeIndexRef = useRef(0);

  // Client-side only
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch product
  useEffect(() => {
    if (!id) {
      setError("Invalid product ID");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await databases.getDocument(
          conf.appwriteDatabaseId,
          conf.appwriteProductCollectionId,
          id
        );

        const rawVars = Array.isArray(doc.variations) ? doc.variations : [];
        const parsedVars = rawVars
          .map(safeParseVar)
          .filter(Boolean)
          .map((v) => ({
            name: v.name ?? "",
            price: v.price ?? "",
            stock: v.stock ?? "",
            sku: v.sku ?? null,
            discount: v.discount ?? null,
          }));

        const images = Array.isArray(doc.images) ? doc.images : [];
        const processedMedia = images.map((fileId) => {
          try {
            const view = productService.getOptimizedImageUrl(fileId, 1600);
            const norm = (u) =>
              typeof u === "string" ? u : u?.href || u?.toString() || "";
            const viewUrl = norm(view);
            const mediaType = detectMediaType(fileId, viewUrl);
            return { fileId, view: viewUrl, type: mediaType };
          } catch {
            return { fileId, view: "", type: "image" };
          }
        }).filter((m) => m.view);

        const fullDoc = {
          ...doc,
          useVariations: isTruthy(doc.useVariations),
          variations: parsedVars,
          processedMedia,
        };

        setProduct(fullDoc);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error fetching product:", err);
        }
        setError("Failed to load product. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Fetch related products
  useEffect(() => {
    if (!product || !product.categories || !product.$id) return;

    const fetchRelatedProducts = async () => {
      try {
        const rel = await databases.listDocuments(
          conf.appwriteDatabaseId,
          conf.appwriteProductCollectionId,
          [
            Query.equal("categories", product.categories),
            Query.notEqual("$id", product.$id),
            Query.limit(6),
          ]
        );
        setRelatedProducts(rel.documents || []);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error fetching related products:", err);
        }
      }
    };

    const timer = setTimeout(fetchRelatedProducts, 300);
    return () => clearTimeout(timer);
  }, [product]);

  // Initialize selected variation
  useEffect(() => {
    if (!product?.$id) return;
    if (hasVariations(product) && Array.isArray(product.variations) && product.variations.length > 0) {
      const firstInStock = product.variations.findIndex(isInStock);
      if (firstInStock >= 0) {
        setSelectedVarIndex(firstInStock);
      } else {
        setSelectedVarIndex(0);
      }
    } else {
      setSelectedVarIndex(0);
    }
  }, [product?.$id]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  // ALL HOOKS COMPLETE - NOW SAFE DERIVED VALUES
  if (loading) return <SpinnerLoader />;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gray-50">
        <p className="text-gray-600 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 text-sm border border-gray-900 text-gray-900 rounded-full hover:bg-gray-900 hover:text-white transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!product || !product.name) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gray-50">
        <p className="text-gray-600 font-medium">Product not found</p>
        <button
          onClick={() => navigate("/shop")}
          className="px-6 py-2 text-sm border border-gray-900 text-gray-900 rounded-full hover:bg-gray-900 hover:text-white transition-colors"
        >
          Browse Products
        </button>
      </div>
    );
  }

  // Safe defaults
  const productName = product?.name || "Product";
  const productCategories = product?.categories || "";
  const productSubtitle = product?.subtitle || "";
  const productDescription = product?.description || "";
  const productSize = Array.isArray(product?.size) ? product.size : [];
  const productProcessedMedia = product?.processedMedia || [];

  // Memoized values
  const pricing = useMemo(
    () => getDisplayPricing(product, selectedVarIndex),
    [product, selectedVarIndex]
  );

  const activeVariation = useMemo(
    () => getActiveVariation(product, selectedVarIndex),
    [product, selectedVarIndex]
  );

  const hasVariationsProduct = useMemo(
    () => hasVariations(product),
    [product]
  );

  // UI handlers
  const toggleSection = useCallback(
    (section) =>
      setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] })),
    []
  );

  const handleThumbnailClick = useCallback(
    (index) => {
      setSelectedImage(index);
      if (mainSwiper && typeof mainSwiper.slideTo === "function") {
        try {
          mainSwiper.slideTo(index);
        } catch (e) {
          if (process.env.NODE_ENV === "development") {
            console.warn("mainSwiper.slideTo failed", e);
          }
        }
      }
    },
    [mainSwiper]
  );

  const playActiveSlideVideo = useCallback((swiper) => {
    const activeIndex = swiper.activeIndex ?? 0;
    activeIndexRef.current = activeIndex;
    const activeSlide = swiper.slides?.[activeIndex];
    if (!activeSlide) return;
    const video = activeSlide.querySelector("video");
    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
    }
  }, []);

  const openZoom = useCallback(() => {
    const currentMedia = productProcessedMedia[selectedImage];
    if (currentMedia?.type !== "video") {
      setZoomOpen(true);
    }
  }, [productProcessedMedia, selectedImage]);

  const closeZoom = useCallback(() => {
    setZoomOpen(false);
  }, []);

  const goPrev = useCallback(() => {
    if (mainSwiper && typeof mainSwiper.slidePrev === "function") {
      mainSwiper.slidePrev();
    } else {
      setSelectedImage((i) => Math.max(0, i - 1));
    }
  }, [mainSwiper]);

  const goNext = useCallback(() => {
    const len = productProcessedMedia.length;
    if (mainSwiper && typeof mainSwiper.slideNext === "function") {
      mainSwiper.slideNext();
    } else {
      setSelectedImage((i) => Math.min(len - 1, i + 1));
    }
  }, [mainSwiper, productProcessedMedia.length]);

  // Keyboard controls for zoom modal
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeZoom();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen, closeZoom, goPrev, goNext]);

  // Format price display
  const displayPrice =
    pricing?.price !== null &&
    pricing.price !== undefined &&
    typeof pricing.price === "number" &&
    pricing.price > 0
      ? pricing.price
      : pricing?.price === 0
      ? 0
      : null;

  // ZoomContent - images only
  const ZoomContent = useMemo(() => {
    const currentMedia = productProcessedMedia[selectedImage];
    if (!currentMedia || currentMedia.type === "video") {
      return null;
    }

    const url = currentMedia.view || UPLOADED_FALLBACK;
    return (
      <img
        src={url}
        alt={productName}
        width={1600}
        height={1600}
        draggable={false}
        loading="lazy"
        decoding="async"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          cursor: "auto",
        }}
      />
    );
  }, [productProcessedMedia, selectedImage, productName]);

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Gallery */}
          <div className="lg:w-1/2">
            <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden">
              {isClient && productProcessedMedia.length > 0 ? (
                <>
                  <button
                    aria-label="Previous"
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>

                  <button
                    aria-label="Next"
                    onClick={goNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>

                  <Swiper
                    onSwiper={(s) => {
                      setMainSwiper(s);
                      playActiveSlideVideo(s);
                    }}
                    slidesPerView={1}
                    spaceBetween={10}
                    className="h-full w-full"
                    observer
                    observeParents
                    preloadImages={false}
                    lazy={true}
                    onSlideChange={(swiper) => {
                      setSelectedImage(swiper.activeIndex);
                      playActiveSlideVideo(swiper);
                    }}
                  >
                    {productProcessedMedia.map((m, index) => (
                      <SwiperSlide key={m?.fileId || m?.view || index}>
                        <MediaSlide
                          media={m || {}}
                          name={productName}
                          isActive={selectedImage === index}
                          onOpenZoom={openZoom}
                        />
                      </SwiperSlide>
                    ))}
                  </Swiper>

                  <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1 rounded-full text-xs shadow-sm">
                    {selectedImage + 1} / {productProcessedMedia.length || 1}
                  </div>
                </>
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <img
                    src={UPLOADED_FALLBACK}
                    alt={productName}
                    width={1600}
                    height={1600}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {productProcessedMedia.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {productProcessedMedia.map((m, idx) => {
                    if (!m) return null;
                    const isActive = selectedImage === idx;
                    const isVideo = m?.type === "video";
                    return (
                      <button
                        key={m?.fileId || m?.view || String(idx)}
                        onClick={() => handleThumbnailClick(idx)}
                        className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden border-2 ${
                          isActive
                            ? "border-gray-900"
                            : "border-transparent hover:border-gray-300"
                        }`}
                        title={`thumb-${idx}`}
                        aria-label={`Thumbnail ${idx + 1}`}
                      >
                        <ThumbMedia
                          src={
                            m?.fileId
                              ? productService.getOptimizedThumbnailUrl(
                                  m.fileId,
                                  160
                                )
                              : m?.view || ""
                          }
                          alt={`thumb-${idx}`}
                          isVideo={isVideo}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="lg:w-1/2 space-y-6">
            <div>
              <h1 className="text-[20px] font-normal text-gray-900">
                {productName}
              </h1>
              <p className="text-sm text-gray-500 uppercase tracking-wider mt-1">
                {productSubtitle || productCategories || "Product Category"}
              </p>
            </div>

            {/* Price */}
            <div className="flex items-center space-x-4">
              {displayPrice !== null && displayPrice !== undefined ? (
                <>
                  <p className="text-2xl font-medium text-gray-900">
                    ${Number(displayPrice).toLocaleString()}
                  </p>
                  {pricing?.originalPrice !== null &&
                    pricing?.originalPrice !== undefined &&
                    typeof pricing.originalPrice === "number" &&
                    pricing.originalPrice > displayPrice && (
                      <>
                        <p className="text-lg text-gray-400 line-through">
                          ${Number(pricing.originalPrice).toLocaleString()}
                        </p>
                        {pricing.discountPct > 0 && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            {pricing.discountPct}% OFF
                          </span>
                        )}
                      </>
                    )}
                </>
              ) : (
                <p className="text-2xl font-medium text-gray-900">
                  Contact for price
                </p>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 py-6 border-y border-gray-200">
              {[
                { Icon: Truck, label: "Free Worldwide Shipping", desc: "On all orders" },
                {
                  Icon: Check,
                  label: "Passes Diamond Tester",
                  desc: "Tested Quality",
                },
                { Icon: Check, label: "100% Satisfaction Guarantee", desc: "Extra Value" },
              ].map(({ Icon, label, desc }, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5 text-gray-700" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>

            {/* Variations */}
            {hasVariationsProduct &&
              Array.isArray(product?.variations) &&
              product.variations.length > 0 && (
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Select Variant:
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.variations.map((v, idx) => {
                      const isActive = selectedVarIndex === idx;
                      const inStock = isInStock(v);
                      return (
                        <button
                          key={v.sku || v.name || idx}
                          onClick={() => setSelectedVarIndex(idx)}
                          disabled={!inStock}
                          className={`px-3 py-1.5 text-sm border rounded-md transition-colors ${
                            isActive
                              ? "bg-gray-900 text-white border-gray-900"
                              : "border-gray-300 hover:bg-gray-50"
                          } ${!inStock ? "opacity-60 cursor-not-allowed" : ""}`}
                          title={v?.sku || v?.name || `variant-${idx}`}
                        >
                          {v?.name || `Variant ${idx + 1}`}{" "}
                          {(() => {
                            const vPrice = toNumber(v?.price);
                            return vPrice !== null && vPrice > 0
                              ? ` • $${Number(vPrice).toLocaleString()}`
                              : vPrice === 0
                              ? ` • $0`
                              : "";
                          })()}{" "}
                          {!inStock ? " • Out of stock" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Size Selection */}
            {productSize.length > 0 && (
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Select Size:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {productSize.map((size, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 text-sm border rounded-md transition-colors ${
                        selectedSize === size
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="border-b border-gray-200 pb-6">
              <button
                onClick={() => toggleSection("description")}
                className="flex justify-between items-center w-full py-3"
              >
                <h3 className="text-sm font-medium text-gray-900">
                  Product Description
                </h3>
                <ChevronRight
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    expandedSections.description ? "rotate-90" : ""
                  }`}
                />
              </button>
              {expandedSections.description && (
                <div className="mt-3 pb-4 text-gray-700 text-sm prose prose-sm max-w-none">
                  {productDescription ? (
                    <div>{parse(productDescription)}</div>
                  ) : (
                    <p className="text-gray-500">No description available</p>
                  )}
                </div>
              )}
            </div>

            {/* Warranty Section */}
            <div className="border-b border-gray-200 pb-6">
              <button
                onClick={() => toggleSection("warranty")}
                className="flex justify-between items-center w-full py-3"
              >
                <h3 className="text-sm font-medium text-gray-900">
                  Warranty & Quality Assurance
                </h3>
                <ChevronRight
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    expandedSections.warranty ? "rotate-90" : ""
                  }`}
                />
              </button>
              {expandedSections.warranty && (
                <div className="mt-3 pb-4 text-gray-700 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3 text-gray-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">One-Year International Warranty</p>
                        <p className="text-gray-600 mt-0.5">Covers manufacturing defects</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3 text-gray-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Valid Worldwide</p>
                        <p className="text-gray-600 mt-0.5">International coverage</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3 text-gray-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Quality-Checked Before Dispatch</p>
                        <p className="text-gray-600 mt-0.5">Every item inspected for quality</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shipping Section */}
            <div className="border-b border-gray-200 pb-6">
              <button
                onClick={() => toggleSection("shipping")}
                className="flex justify-between items-center w-full py-3"
              >
                <h3 className="text-sm font-medium text-gray-900">
                  Shipping Information
                </h3>
                <ChevronRight
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    expandedSections.shipping ? "rotate-90" : ""
                  }`}
                />
              </button>
              {expandedSections.shipping && (
                <div className="mt-3 pb-4 text-gray-700 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">🚚</span>
                      <div>
                        <p className="font-medium text-gray-900">Orders Processed in 3–4 Days</p>
                        <p className="text-gray-600 mt-0.5">Quick processing time</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">📦</span>
                      <div>
                        <p className="font-medium text-gray-900">Delivery Within 6–7 Business Days</p>
                        <p className="text-gray-600 mt-0.5">Worldwide shipping</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">🛡️</span>
                      <div>
                        <p className="font-medium text-gray-900">Fully Insured Shipping</p>
                        <p className="text-gray-600 mt-0.5">Protected against loss or damage</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">📦</span>
                      <div>
                        <p className="font-medium text-gray-900">Secure Packaging</p>
                        <p className="text-gray-600 mt-0.5">Double-boxed and bubble wrapped</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">✍️</span>
                      <div>
                        <p className="font-medium text-gray-900">Signature Confirmation on Delivery</p>
                        <p className="text-gray-600 mt-0.5">Secure delivery confirmation</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart & Buy Now */}
            <div className="flex space-x-4 pt-2">
              <button
                className="flex-1 py-3 px-6 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                onClick={() => {
                  if (productSize.length > 0 && !selectedSize) {
                    alert("Please select a size before adding to cart.");
                    return;
                  }
                  if (hasVariationsProduct && !isInStock(activeVariation)) {
                    alert("Selected variant is out of stock.");
                    return;
                  }
                  if (
                    window.confirm(
                      "Are you sure you want to add this item to your cart?"
                    )
                  ) {
                    addToCart({
                      ...product,
                      pricing: getDisplayPricing(product, selectedVarIndex),
                      selectedVariation: activeVariation,
                      selectedSize: selectedSize || null,
                    });
                    navigate("/cart");
                  }
                }}
              >
                Add to Cart
              </button>

              <button
                className="flex-1 py-3 px-6 border border-gray-900 text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => {
                  if (productSize.length > 0 && !selectedSize) {
                    alert("Please select a size before buying.");
                    return;
                  }
                  if (hasVariationsProduct && !isInStock(activeVariation)) {
                    alert("Selected variant is out of stock.");
                    return;
                  }

                  const finalPrice = pricing?.price ?? toNumber(product?.price);
                  const buyItem = {
                    $id: product.$id ?? product.id ?? id,
                    id: product.$id ?? product.id ?? id,
                    name: productName,
                    price: finalPrice !== null && finalPrice !== undefined ? finalPrice : 0,
                    quantity: 1,
                    image:
                      productProcessedMedia?.[0]?.view ||
                      product?.thumbnail ||
                      UPLOADED_FALLBACK,
                    selectedSize: selectedSize || null,
                    selectedVariation: activeVariation || null,
                    pricing: getDisplayPricing(product, selectedVarIndex),
                  };

                  navigate("/checkout", { state: { buyNow: true, item: buyItem } });
                }}
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Related Products
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.$id || p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </section>

      {/* Zoom Modal - Images Only */}
      {zoomOpen && ZoomContent && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={closeZoom}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeZoom();
            }}
            className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white"
            aria-label="Close zoom"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div
            className="w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              doubleClick={{
                disabled: false,
                step: 2.5,
                mode: "zoomIn",
              }}
              wheel={{
                step: 0.1,
              }}
              pan={{
                disabled: false,
                velocityDisabled: false,
                velocitySensitivity: 0.5,
                velocityEqualToMove: true,
              }}
              pinch={{
                step: 5,
              }}
              centerOnInit={true}
              limitToBounds={false}
              centerZoomedOut={true}
              smooth={true}
              smoothStep={0.03}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <TransformComponent
                  wrapperClass="w-full h-full flex items-center justify-center"
                  contentClass="flex items-center justify-center"
                >
                  {ZoomContent}
                </TransformComponent>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}
