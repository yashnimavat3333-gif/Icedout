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
import ProductReviews from "../Review";

const UPLOADED_FALLBACK = "/mnt/data/6accbf97-f6dc-4ccc-bb6f-222bb1cd9d8c.png"; // local uploaded image fallback

// ---------- Optimized Thumbnail (Images Only) ----------
const ThumbMedia = React.memo(({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="w-full h-full rounded-md overflow-hidden bg-gray-100">
      {src && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(true);
          }}
          loading="lazy"
          decoding="async"
          width={80}
          height={80}
          style={{ 
            aspectRatio: '1/1',
            contain: "layout style paint", 
            backfaceVisibility: "hidden",
            contentVisibility: 'auto'
          }}
          referrerPolicy="no-referrer"
          sizes="80px"
        />
      )}

      {!src && (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="w-7 h-7 rounded-md border-2 border-gray-400 flex items-center justify-center">
            <div className="w-3 h-3 bg-gray-400 rounded-sm" />
          </div>
        </div>
      )}
    </div>
  );
});
ThumbMedia.displayName = "ThumbMedia";

// ---------- Optimized Main Slide (Images Only) ----------
const MediaSlide = React.memo(({ media, name, isActive, onOpenZoom, isFirst = false }) => {
  const [loaded, setLoaded] = useState(false);
  const placeholder = "/placeholder-product.jpg";

  const handleOpen = () => {
    onOpenZoom?.();
  };

  // First image is LCP element on product pages - optimize it
  const loadingStrategy = isFirst ? "eager" : "lazy";
  const fetchPriority = isFirst ? "high" : "auto";
  const decodingStrategy = isFirst ? "sync" : "async";

  return (
    <div
      className="h-full w-full flex items-center justify-center p-0 cursor-zoom-in"
      onDoubleClick={handleOpen}
      onClick={handleOpen}
    >
      {media?.view && (
        <img
          src={media.view}
          alt={name || "Product media"}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(true);
          }}
          loading={loadingStrategy}
          fetchPriority={fetchPriority}
          decoding={decodingStrategy}
          width={800}
          height={800}
          style={{
            aspectRatio: '1/1',
            contain: 'layout style paint',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      )}

      {!media?.view && (
        <img
          src={placeholder}
          alt="No media"
          className="w-full h-full object-cover"
          onLoad={() => setLoaded(true)}
          loading={loadingStrategy}
          width={800}
          height={800}
          style={{
            aspectRatio: '1/1',
            contain: 'layout style paint',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      )}
    </div>
  );
});
MediaSlide.displayName = "MediaSlide";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    description: false,
    warranty: false,
    shipping: false,
    sizes: false,
  });
  const [selectedSize, setSelectedSize] = useState(null);
  const [mainSwiper, setMainSwiper] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);

  // Zoom modal state (mobile-friendly)
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const pinchRef = useRef({
    initialDistance: 0,
    startScale: 1,
  });
  const lastTapRef = useRef(0);

  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => setIsClient(true), []);
  // Defer scroll to prevent blocking initial render
  useEffect(() => {
    if (!loading) {
      // Use requestAnimationFrame to defer scroll after paint
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [loading]);

  // Ensure session (private buckets)
  useEffect(() => {
    productService.ensureAnonymousSession?.().catch(() => {});
  }, []);

  // Helpers
  const isTruthy = useCallback(
    (val) =>
      typeof val === "boolean"
        ? val
        : typeof val === "string"
        ? ["true", "1", "yes", "y"].includes(val.toLowerCase())
        : !!val,
    []
  );

  const safeParseVar = useCallback((v) => {
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
  }, []);

  const hasVariations = useCallback(
    (p) =>
      p &&
      isTruthy(p?.useVariations) &&
      Array.isArray(p?.variations) &&
      p.variations.length > 0,
    [isTruthy]
  );

  const toNumber = useCallback((val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    const n = Number(
      String(val)
        .trim()
        .replace(/[^0-9.-]/g, "")
    );
    return Number.isFinite(n) ? n : null;
  }, []);

  const isInStock = useCallback(
    (variant) => {
      if (!variant) return true;
      if (typeof variant.inStock === "boolean") return variant.inStock;
      const n = toNumber(variant.stock);
      return n === null ? true : n > 0;
    },
    [toNumber]
  );

  const getActiveVariation = useCallback(
    (p, idx) => {
      if (!hasVariations(p)) return null;
      const list = p.variations;
      return list[idx] || list[0] || null;
    },
    [hasVariations]
  );

  const getDisplayPricing = useCallback(
    (p, idx) => {
      if (!p) return { price: 0, originalPrice: null, discountPct: 0 };

      const v = getActiveVariation(p, idx);
      if (v && v.price !== undefined && v.price !== null && v.price !== "") {
        const varPrice = Number(v.price) || 0;
        const varDiscountPct = Number(v.discount) || 0;
        if (varDiscountPct > 0 && varDiscountPct < 100) {
          const discounted = Math.max(0, varPrice * (1 - varDiscountPct / 100));
          return {
            price: discounted,
            originalPrice: varPrice,
            discountPct: Math.round(varDiscountPct),
          };
        }
        return { price: varPrice, originalPrice: null, discountPct: 0 };
      }
      const base = Number(p?.price) || 0;
      const original = Number(p?.originalPrice) || null;
      const discountPct =
        original && original > base
          ? Math.round((1 - base / original) * 100)
          : 0;
      return { price: base, originalPrice: original || null, discountPct };
    },
    [getActiveVariation]
  );

  // media processing (Images Only - filters out videos)
  const toProcessedMedia = useCallback(
    (images = []) =>
      images
        .map((fileId) => {
          const view = productService.getFileView(fileId);
          const norm = (u) =>
            typeof u === "string" ? u : u?.href || u?.toString() || "";
          const viewUrl = norm(view);
          // Filter out video files by checking URL extension
          const isVideo = viewUrl.match(/\.(mp4|webm|ogg|mov|avi)(\?|$)/i);
          if (isVideo) return null;
          return { fileId, view: viewUrl };
        })
        .filter(Boolean), // Remove null entries
    []
  );

  // fetch product
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
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

        const processedMedia = toProcessedMedia(doc.images || []);
        const fullDoc = {
          ...doc,
          useVariations: isTruthy(doc.useVariations),
          variations: parsedVars,
          processedMedia,
        };

        setProduct(fullDoc);

        if (hasVariations(fullDoc)) {
          const firstInStock = (fullDoc.variations || []).findIndex(isInStock);
          setSelectedVarIndex(firstInStock >= 0 ? firstInStock : 0);
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only depend on id to prevent unnecessary re-fetches

  // related products
  useEffect(() => {
    if (!product) return;

    const fetchRelatedProducts = async () => {
      try {
        const categoryName = product?.categories;
        const rel = await databases.listDocuments(
          conf.appwriteDatabaseId,
          conf.appwriteProductCollectionId,
          [
            Query.equal("categories", categoryName),
            Query.notEqual("$id", product.$id),
            Query.limit(6),
          ]
        );
        setRelatedProducts(rel.documents || []);
      } catch (err) {
        console.error("Error fetching related products:", err);
      }
    };

    const timer = setTimeout(fetchRelatedProducts, 300);
    return () => clearTimeout(timer);
  }, [product]);

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
          console.warn("mainSwiper.slideTo failed", e);
        }
      }
    },
    [mainSwiper]
  );


  // Zoom modal handlers
  const openZoom = useCallback(() => {
    setZoomOpen(true);
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    pinchRef.current = { initialDistance: 0, startScale: 1 };
  }, []);

  const closeZoom = useCallback(() => {
    setZoomOpen(false);
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    pinchRef.current = { initialDistance: 0, startScale: 1 };
  }, []);

  const changeZoom = useCallback((next) => {
    setZoomScale((s) => {
      const ns = Math.min(4, Math.max(0.5, +(s + next).toFixed(3)));
      if (Math.abs(ns - 1) < 0.001) setPan({ x: 0, y: 0 });
      return ns;
    });
  }, []);

  const onZoomSlider = useCallback((e) => {
    const v = Number(e.target.value);
    setZoomScale(v);
    if (Math.abs(v - 1) < 0.001) setPan({ x: 0, y: 0 });
  }, []);

  // pan/pinch helpers
  const onPanStart = useCallback(
    (clientX, clientY) => {
      panRef.current.dragging = true;
      panRef.current.startX = clientX;
      panRef.current.startY = clientY;
      panRef.current.originX = pan.x;
      panRef.current.originY = pan.y;
    },
    [pan.x, pan.y]
  );

  const onPanMove = useCallback((clientX, clientY) => {
    if (!panRef.current.dragging) return;
    const dx = clientX - panRef.current.startX;
    const dy = clientY - panRef.current.startY;
    setPan({
      x: panRef.current.originX + dx,
      y: panRef.current.originY + dy,
    });
  }, []);

  const onPanEnd = useCallback(() => {
    panRef.current.dragging = false;
  }, []);

  const getDistance = (t0, t1) => {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // touch handlers supporting pinch and single-finger pan and double-tap
  const onTouchStart = useCallback(
    (ev) => {
      if (!ev.touches) return;
      if (ev.touches.length === 2) {
        // start pinch
        const d = getDistance(ev.touches[0], ev.touches[1]);
        pinchRef.current.initialDistance = d;
        pinchRef.current.startScale = zoomScale;
      } else if (ev.touches.length === 1) {
        // double-tap to toggle zoom
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          // double tap
          if (zoomScale <= 1.01) {
            setZoomScale(2); // quick zoom in
          } else {
            setZoomScale(1);
            setPan({ x: 0, y: 0 });
          }
          lastTapRef.current = 0;
          ev.preventDefault();
          return;
        }
        lastTapRef.current = now;
        // start pan if zoomed
        if (zoomScale > 1) {
          const touch = ev.touches[0];
          onPanStart(touch.clientX, touch.clientY);
        }
      }
    },
    [zoomScale, onPanStart]
  );

  const onTouchMove = useCallback(
    (ev) => {
      if (!ev.touches) return;
      if (ev.touches.length === 2) {
        // pinch to zoom
        const d = getDistance(ev.touches[0], ev.touches[1]);
        const initial = pinchRef.current.initialDistance || d;
        const startScale = pinchRef.current.startScale || zoomScale;
        const scale = Math.min(4, Math.max(0.5, (startScale * d) / initial));
        setZoomScale(+scale.toFixed(3));
      } else if (ev.touches.length === 1 && zoomScale > 1) {
        const t = ev.touches[0];
        onPanMove(t.clientX, t.clientY);
      }
    },
    [zoomScale, onPanMove]
  );

  const onTouchEnd = useCallback(
    (ev) => {
      if (!ev.touches || ev.touches.length === 0) {
        onPanEnd();
        pinchRef.current.initialDistance = 0;
        pinchRef.current.startScale = zoomScale;
      } else {
        onPanEnd();
      }
    },
    [onPanEnd, zoomScale]
  );

  // mouse handlers for desktop (drag-to-pan)
  const onMouseDown = useCallback(
    (ev) => {
      if (zoomScale <= 1) return;
      onPanStart(ev.clientX, ev.clientY);
      ev.preventDefault();
    },
    [zoomScale, onPanStart]
  );

  const onMouseMove = useCallback(
    (ev) => {
      if (panRef.current.dragging) {
        onPanMove(ev.clientX, ev.clientY);
      }
    },
    [onPanMove]
  );

  const onMouseUp = useCallback(() => {
    onPanEnd();
  }, [onPanEnd]);

  // navigation functions for prev/next buttons and keyboard
  const goPrev = useCallback(() => {
    if (mainSwiper && typeof mainSwiper.slidePrev === "function") {
      mainSwiper.slidePrev();
    } else {
      setSelectedImage((i) => Math.max(0, i - 1));
    }
  }, [mainSwiper]);

  const goNext = useCallback(() => {
    const len = product?.processedMedia?.length || 0;
    if (mainSwiper && typeof mainSwiper.slideNext === "function") {
      mainSwiper.slideNext();
    } else {
      setSelectedImage((i) => Math.min(len - 1, i + 1));
    }
  }, [mainSwiper, product]);

  // keyboard controls while modal open
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeZoom();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+") changeZoom(0.25);
      else if (e.key === "-") changeZoom(-0.25);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen, closeZoom, goPrev, goNext, changeZoom]);

  // memoized values
  const pricing = useMemo(
    () => getDisplayPricing(product, selectedVarIndex),
    [product, selectedVarIndex, getDisplayPricing]
  );

  // Session-safe social proof data (frontend-only, resets per session)
  const socialProofData = useMemo(() => {
    if (!id) {
      // Fallback if product ID not available yet
      return {
        viewsToday: 12,
        recentState: "California",
        stockLeft: 2,
      };
    }

    try {
      const sessionKey = `social_proof_${id}`;
      const stored = sessionStorage.getItem(sessionKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      const states = [
        "California", "Texas", "New York", "Florida", 
        "New Jersey", "Illinois", "Georgia", "Arizona"
      ];
      
      const data = {
        viewsToday: Math.floor(Math.random() * 14) + 5, // 5-18
        recentState: states[Math.floor(Math.random() * states.length)],
        stockLeft: Math.floor(Math.random() * 3) + 1, // 1-3
      };
      
      sessionStorage.setItem(sessionKey, JSON.stringify(data));
      return data;
    } catch (error) {
      // Fallback if sessionStorage unavailable
      return {
        viewsToday: 12,
        recentState: "California",
        stockLeft: 2,
      };
    }
  }, [id]);

  const activeVariation = useMemo(
    () => getActiveVariation(product, selectedVarIndex),
    [product, selectedVarIndex, getActiveVariation]
  );

  const hasVariationsProduct = useMemo(
    () => hasVariations(product),
    [product, hasVariations]
  );

  // Build product info section
  const productInfoSection = useMemo(() => {
    if (!product) return null;

    const getCategoryText = (category) => {
      const categoryLower = category?.toLowerCase() || "";
      if (categoryLower === "luxury watch") {
        return "💎 Set with VVS1 D-Color Moissanite Diamonds · Precision-set for maximum brilliance";
      } else if (categoryLower === "plain watch") {
        return "⭐ Quality-tested & customer-approved · Inspected before dispatch";
      } else if (categoryLower === "ring" || categoryLower === "bracelet") {
        return "✨ Crafted from pure 925 sterling silver · Set with VVS1 D-Color Moissanite Diamonds";
      }
      // Default fallback
      return "⭐ Quality-tested & customer-approved · Inspected before dispatch";
    };

    const categoryText = getCategoryText(product.categories);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[20px] font-normal text-gray-900">
            {product.name || "Product Name"}
            {/* {console.log(product)} */}
          </h1>
          <p className="text-sm text-gray-500 uppercase tracking-wider mt-1">
            {product.subtitle || product.categories || "Product Category"}
          </p>

          <div className="mt-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              {categoryText}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <p className="text-2xl font-medium text-gray-900">
            ${Number(pricing?.price || 0).toLocaleString()}
          </p>
          {pricing?.originalPrice ? (
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
          ) : null}
        </div>

        {/* Real-Time Social Proof Indicators */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center text-xs text-gray-600">
            <span className="mr-1.5">🔥</span>
            <span>{socialProofData.viewsToday} people viewed this product today</span>
          </div>
          <div className="flex items-center text-xs text-gray-600">
            <span className="mr-1.5">📍</span>
            <span>Recently ordered from {socialProofData.recentState}</span>
          </div>
          <div className="flex items-center text-xs text-gray-600">
            <span className="mr-1.5">⏳</span>
            <span>Only {socialProofData.stockLeft} left in ready stock</span>
          </div>
        </div>

        {hasVariationsProduct && product.variations && (
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
                    {v?.price ? ` • $${Number(v.price).toLocaleString()}` : ""}{" "}
                    {!inStock ? " • Out of stock" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {Array.isArray(product.size) && product.size.length > 0 && (
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Select Size:
            </h3>
            <div className="flex flex-wrap gap-2">
              {product.size.map((size, index) => (
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

        <div className="grid grid-cols-3 gap-4 py-6 border-y border-gray-200">
          {[
            { Icon: Truck, label: "Free Shipping", desc: "On all orders" },
            {
              Icon: Check,
              label: "Passes Diamond Tester",
              desc: "Tested Quality",
            },
            { Icon: Check, label: "100% Satisfaction ", desc: "Extra Value" },
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

        {/* Why Customers Choose This */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Why Customers Choose This
          </h3>
          <div className="space-y-2">
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-700 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Premium wrist presence</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-700 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Inspected for finish and detailing</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-700 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Built for daily wear</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-700 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Trusted by first-time and repeat buyers</span>
            </div>
          </div>
        </div>

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
              {product.description ? (
                <div>{parse(product.description)}</div>
              ) : (
                <p className="text-gray-500">No description available</p>
              )}
            </div>
          )}
        </div>

        {/* Why Iceyout? Section */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            Why Iceyout?
          </h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 leading-relaxed">Feel confident wearing — same look, weight, and presence as high-end originals</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 leading-relaxed">Premium finishing you can feel — no compromises on quality or detail</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 leading-relaxed">Every piece personally inspected — quality-checked before it leaves our hands</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 leading-relaxed">Real support when you need it — reach us on Instagram & WhatsApp anytime</span>
            </div>
          </div>
        </div>

        {product.warranty && (
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
              <div className="mt-3 pb-4 text-gray-700 text-sm prose prose-sm max-w-none">
                <div>
                  <p className="mb-3">
                    This timepiece is covered by a 12-month seller warranty provided by Iceyout.
                  </p>
                  <p className="mb-3">
                    We guarantee proper functionality, finishing quality, and performance under normal use.<br />
                    If any manufacturing or functional issue arises, we will repair, replace, or resolve it at no extra cost.
                  </p>
                  <p>
                    This warranty is handled directly by Iceyout and is independent of any brand manufacturer.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {product.shipping && (
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
              <div className="mt-3 pb-4 text-gray-700 text-sm prose prose-sm max-w-none">
                <div>
                  <p className="mb-4">
                    Orders are processed within 1–2 business days.<br />
                    Delivery typically takes 4–5 business days worldwide.
                  </p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start">
                      <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">Fully insured shipping</span>
                    </div>
                    <div className="flex items-start">
                      <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">Secure packaging for high-value items</span>
                    </div>
                    <div className="flex items-start">
                      <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">FedEx Express shipping service</span>
                    </div>
                    <div className="flex items-start">
                      <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">Trusted global logistics partners</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 italic">
                    If there is any delay, loss, or issue during transit, we take full responsibility and ensure a replacement or full resolution.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Reassurance Section */}
        <div className="pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-center text-xs text-gray-600 text-center px-2">
            <span>🔒 Buyer protection applies · Secure PayPal & card checkout</span>
          </div>
          <div className="flex items-center justify-center gap-3 opacity-50">
            {/* PayPal */}
            <div className="flex items-center">
              <span className="text-[10px] font-medium text-gray-400 tracking-wide">PayPal</span>
            </div>
            {/* Visa */}
            <div className="flex items-center">
              <span className="text-[10px] font-semibold text-gray-400 tracking-wide">VISA</span>
            </div>
            {/* Mastercard */}
            <div className="flex items-center">
              <span className="text-[10px] font-semibold text-gray-400 tracking-wide">MC</span>
            </div>
            {/* American Express */}
            <div className="flex items-center">
              <span className="text-[9px] font-semibold text-gray-400 tracking-wide">AMEX</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-4 pt-2">
          <button
            className="flex-1 py-3 px-6 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
            onClick={() => {
              if (product.size?.length && !selectedSize) {
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
              if (product.size?.length && !selectedSize) {
                alert("Please select a size before buying.");
                return;
              }
              if (hasVariationsProduct && !isInStock(activeVariation)) {
                alert("Selected variant is out of stock.");
                return;
              }

              const buyItem = {
                $id: product.$id ?? product.id,
                id: product.$id ?? product.id,
                name: product.name,
                price: (pricing?.price ?? product.price) || 0,
                quantity: 1,
                image:
                  product.processedMedia?.[0]?.view ||
                  product.thumbnail ||
                  "/placeholder-product.jpg",
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

        {/* Risk Reversal Reassurance Section */}
        <div className="pt-5 pb-3 space-y-3 border-t border-gray-100 mt-4">
          <div className="flex items-start">
            <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-700 leading-relaxed">Guaranteed delivery or full resolution</span>
          </div>
          <div className="flex items-start">
            <Check className="w-4 h-4 text-gray-900 mr-2.5 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-700 leading-relaxed">WhatsApp support before & after delivery</span>
          </div>
        </div>

        {/* Trust Badges */}
<div className="mt-4 flex flex-wrap gap-2">
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-700">
    <span className="text-green-600">✔</span>
    Trusted by 1,000+ customers
  </div>

  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-700">
    <span className="text-green-600">🔒</span>
    Secure & encrypted checkout
  </div>

  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-700">
    <span className="text-green-600">🚚</span>
    Worldwide insured shipping
  </div>

  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-700">
    <span className="text-green-600">💬</span>
    WhatsApp support before & after delivery
  </div>
</div>

        {/* <ProductReviews productId={product.$id} /> */}
      </div>
    );
  }, [
    product,
    pricing,
    hasVariationsProduct,
    activeVariation,
    selectedVarIndex,
    selectedSize,
    expandedSections,
    toggleSection,
    addToCart,
    navigate,
    getDisplayPricing,
    isInStock,
    toNumber,
    socialProofData,
  ]);

  const relatedProductsSection = useMemo(
    () =>
      relatedProducts.length > 0 ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Related Products
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.$id} product={p} />
            ))}
          </div>
        </section>
      ) : null,
    [relatedProducts]
  );

  if (loading) return <SpinnerLoader />;
  if (error)
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
  if (!product) return null;

  // ZoomContent with local fallback (Images Only)
  const ZoomContent = () => {
    const m = product?.processedMedia?.[selectedImage];
    const url = (m && m.view) || UPLOADED_FALLBACK;

    const commonStyle = {
      maxWidth: "none",
      maxHeight: "none",
      transformOrigin: "center center",
      willChange: "transform",
      display: "block",
      userSelect: "none",
      touchAction: "none",
    };

    return (
      <img
        src={url}
        alt={product?.name || "Product"}
        draggable={false}
        width={1200}
        height={1200}
        style={{
          ...commonStyle,
          cursor: zoomScale > 1 ? "grab" : "auto",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: '1/1',
          contain: 'layout style paint',
          objectFit: 'contain'
        }}
        sizes="100vw"
      />
    );
  };

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Gallery */}
          <div className="lg:w-1/2">
            <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden">
              {isClient && product.processedMedia ? (
                <>
                  {/* Prev / Next Buttons (overlay) */}
                  <button
                    aria-label="Previous"
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                    title="Previous"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>

                  <button
                    aria-label="Next"
                    onClick={goNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                    title="Next"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>

                  <Swiper
                    onSwiper={(s) => {
                      setMainSwiper(s);
                    }}
                    slidesPerView={1}
                    spaceBetween={10}
                    className="h-full w-full"
                    observer
                    observeParents
                    preloadImages={false}
                    lazy={{
                      enabled: true,
                      loadPrevNext: true,
                      loadPrevNextAmount: 1,
                    }}
                    watchSlidesProgress={true}
                    onSlideChange={(swiper) => {
                      setSelectedImage(swiper.activeIndex);
                    }}
                  >
                    {product.processedMedia.map((m, index) => (
                      <SwiperSlide key={m.fileId || m.view || index}>
                        <MediaSlide
                          media={m}
                          name={product.name}
                          isActive={selectedImage === index}
                          onOpenZoom={() => openZoom()}
                          isFirst={index === 0}
                        />
                      </SwiperSlide>
                    ))}
                  </Swiper>

                  <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1 rounded-full text-xs shadow-sm">
                    {selectedImage + 1} / {product.processedMedia.length}
                  </div>
                </>
              ) : (
                <div className="h-full w-full flex items-center justify-center" style={{ aspectRatio: '1/1' }}>
                  <img
                    src={"/placeholder-product.jpg"}
                    alt={product.name || "Product"}
                    className="w-full h-full object-cover"
                    width={800}
                    height={800}
                    style={{ aspectRatio: '1/1' }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.processedMedia && product.processedMedia.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {product.processedMedia.map((m, idx) => {
                    const isActive = selectedImage === idx;
                    return (
                      <button
                        key={m.fileId || m.view || String(idx)}
                        onClick={() => handleThumbnailClick(idx)}
                        className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden border-2 ${
                          isActive
                            ? "border-gray-900"
                            : "border-transparent hover:border-gray-300"
                        }`}
                        title={`thumb-${idx}`}
                        aria-label={`Thumbnail ${idx + 1}`}
                      >
                        <ThumbMedia src={m.view} alt={`thumb-${idx}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="lg:w-1/2">{productInfoSection}</div>
        </div>

        {/* Related */}
        {relatedProductsSection}
      </section>

      {/* Zoom / Fullscreen Modal (mobile-friendly) */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          {/* top-right controls - hide range slider on small screens */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-40">
            <button
              onClick={() => changeZoom(-0.25)}
              className="px-3 py-2 bg-white/95 rounded-md text-sm touch-manipulation"
              title="Zoom out"
            >
              −
            </button>

            {/* slider visible on sm+ */}
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.01}
              value={zoomScale}
              onChange={onZoomSlider}
              className="hidden sm:block w-44"
            />

            <button
              onClick={() => changeZoom(0.25)}
              className="px-3 py-2 bg-white/95 rounded-md text-sm touch-manipulation"
              title="Zoom in"
            >
              +
            </button>

            <button
              onClick={() => goPrev()}
              className="px-3 py-2 bg-white/95 rounded-md text-sm touch-manipulation"
              title="Previous"
            >
              Prev
            </button>

            <button
              onClick={() => goNext()}
              className="px-3 py-2 bg-white/95 rounded-md text-sm touch-manipulation"
              title="Next"
            >
              Next
            </button>

            <button
              onClick={closeZoom}
              className="px-3 py-2 bg-white/95 rounded-md text-sm touch-manipulation"
              title="Close"
            >
              Close
            </button>
          </div>

          {/* central viewport */}
          <div
            className="w-full h-full max-w-[100vw] max-h-[100vh] flex items-center justify-center"
            onMouseDown={(e) => {
              if (e.button === 0 && zoomScale > 1)
                onPanStart(e.clientX, e.clientY);
            }}
            onMouseLeave={() => onMouseUp()}
            onDoubleClick={() => {
              if (zoomScale <= 1.01) {
                setZoomScale(2);
              } else {
                setZoomScale(1);
                setPan({ x: 0, y: 0 });
              }
            }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative overflow-hidden"
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "none",
              }}
            >
              <div
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
                  transition: panRef.current.dragging
                    ? "none"
                    : "transform 120ms",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
                onMouseDown={(e) => {
                  if (zoomScale > 1) onPanStart(e.clientX, e.clientY);
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoomScale})`,
                    transition: "transform 80ms",
                    maxWidth: "none",
                    maxHeight: "none",
                    display: "inline-block",
                  }}
                >
                  <ZoomContent />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
