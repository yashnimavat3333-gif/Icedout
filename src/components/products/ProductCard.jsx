// src/components/ProductCard.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import productService from "../../appwrite/config";
import PropTypes from "prop-types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD", // change to "INR" if needed
  maximumFractionDigits: 0,
});

// ---------- helpers ----------
function isTruthy(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0 && !Number.isNaN(val);
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return (
      ["true", "1", "yes", "y", "on", "enabled"].includes(s) || s.length > 0
    );
  }
  return !!val;
}

function safeParseVar(v) {
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
}

function toNumber(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const cleaned = String(val)
    .trim()
    .replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isInStock(variant) {
  if (!variant) return true;
  if (typeof variant.inStock === "boolean") return variant.inStock;
  const n = toNumber(variant.stock);
  return n === null ? true : n > 0; // treat missing stock as in-stock
}

/**
 * Compute display price for cards:
 * - If variations exist: take the MIN effective price among in-stock variations.
 *   Effective price:
 *     1) If compareAt > price, show price with compareAt struck.
 *     2) Else if discount% (0-100), price*(1 - pct) with compareAt=price.
 *     3) Else price as-is.
 * - Else fallback to product.price / product.compareAtPrice (or aliases).
 */
function getCardPricing(product) {
  const rawVariations =
    product?.variations ?? product?.variants ?? product?.options ?? [];
  const hasVarArray = Array.isArray(rawVariations) && rawVariations.length > 0;

  // If a variations array exists, prefer using it even if the flag is missing/odd.
  const usingVars =
    hasVarArray &&
    (product?.useVariations === undefined
      ? true
      : isTruthy(product?.useVariations));

  if (usingVars) {
    const varObjs = rawVariations
      .map(safeParseVar)
      .filter(Boolean)
      .map((v) => {
        // Accept common key aliases
        const rawPrice =
          v.price ??
          v.selling_price ??
          v.sellingPrice ??
          v.salePrice ??
          v.variant_price ??
          v.amount ??
          v.basePrice;
        const rawCompare =
          v.compareAt ??
          v.compare_at_price ??
          v.compareAtPrice ??
          v.mrp ??
          v.listPrice ??
          v.strikePrice;
        const rawDiscount =
          v.discount ?? v.discount_percent ?? v.discountPercent;

        return {
          name: v.name ?? v.title ?? "",
          price: toNumber(rawPrice),
          compareAtCandidate: toNumber(rawCompare),
          discountPct: toNumber(rawDiscount),
          stock: toNumber(v.stock ?? v.quantity),
          sku: v.sku ?? v.code ?? null,
          inStock: typeof v.inStock === "boolean" ? v.inStock : undefined,
        };
      })
      .filter(isInStock);

    if (varObjs.length) {
      const effective = varObjs
        .map((v) => {
          if (typeof v.price !== "number") {
            return { price: Infinity, compareAt: null };
          }

          const hasCompare =
            typeof v.compareAtCandidate === "number" &&
            v.compareAtCandidate > v.price;
          if (hasCompare) {
            return { price: v.price, compareAt: v.compareAtCandidate };
          }

          if (
            typeof v.discountPct === "number" &&
            v.discountPct > 0 &&
            v.discountPct < 100
          ) {
            const discounted = Math.max(0, v.price * (1 - v.discountPct / 100));
            return { price: discounted, compareAt: v.price };
          }

          return { price: v.price, compareAt: null };
        })
        .filter((x) => Number.isFinite(x.price));

      if (effective.length) {
        const min = effective.reduce(
          (acc, cur) => (cur.price < acc.price ? cur : acc),
          effective[0]
        );
        return {
          price: min.price,
          compareAt: typeof min.compareAt === "number" ? min.compareAt : null,
          usedVariations: true,
          hasMultiple: varObjs.length > 1,
        };
      }
    }
  }

  // Fallback to product-level pricing (do NOT coerce to 0)
  const base = toNumber(product?.price);
  const compareAt = toNumber(
    product?.compareAtPrice ?? product?.mrp ?? product?.listPrice
  );
  const showCompare =
    typeof base === "number" &&
    typeof compareAt === "number" &&
    compareAt > base;

  return {
    price: typeof base === "number" ? base : null,
    compareAt: showCompare ? compareAt : null,
    usedVariations: false,
    hasMultiple: false,
  };
}

const ProductCard = ({ product, isAboveFold = false }) => {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();
  const fallbackImg = "/assets/no-image.png";

  const productId = product?.id || product?.$id || "";

  // Safely extract first fileId (string or {$id})
  const fileId = useMemo(() => {
    if (!product?.images || product.images.length === 0) return null;
    const first = product.images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && first.$id) return first.$id;
    return null;
  }, [product]);

  // Appwrite file view URL
  const previewUrl = useMemo(() => {
    if (!fileId) return "";
    try {
      const u = productService.getFileView(fileId);
      return typeof u === "string" ? u : u?.href || u?.toString() || "";
    } catch {
      return "";
    }
  }, [fileId]);

  const { price, compareAt, usedVariations, hasMultiple } = useMemo(
    () => getCardPricing(product),
    [product]
  );

  const imageSrc = !imgError && previewUrl ? previewUrl : fallbackImg;
  const hasNumericPrice = typeof price === "number";
  
  // Above-the-fold images should be eager-loaded for LCP
  const loadingStrategy = isAboveFold ? "eager" : "lazy";
  const fetchPriority = isAboveFold ? "high" : "auto";
  const decodingStrategy = isAboveFold ? "sync" : "async";
  {
    // console.log(product);
  }
  return (
    <div
      onClick={() => navigate(`/product/${productId}`)}
      className="cursor-pointer group rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
    >
      <Link 
        to={`/product/${productId}`} 
        className="block w-full h-full"
        aria-label={`View ${product?.name || "product"} details`}
      >
        {/* Image - Fixed aspect-ratio to prevent CLS */}
        <div className="relative bg-gray-100 overflow-hidden" style={{ aspectRatio: '2/3' }}>
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-gray-200" style={{ aspectRatio: '2/3' }} />
          )}

          <img
            src={imageSrc}
            alt={product?.name || "Product image"}
            width="400"
            height="600"
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            loading={loadingStrategy}
            fetchPriority={fetchPriority}
            decoding={decodingStrategy}
            style={{ aspectRatio: '2/3' }}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setImgError(true);
              setLoaded(true);
            }}
          />

          {/* CTA */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-100 group-hover:opacity-100 transition-opacity">
            <button
              className="px-4 py-1 text-sm font-medium rounded-md bg-black text-white hover:bg-neutral-800 whitespace-nowrap"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/product/${productId}`);
              }}
              aria-label={`Buy ${product?.name || "product"} now`}
            >
              Buy Now
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 text-center space-y-1">
          <p className="text-sm font-medium text-neutral-900 line-clamp-1">
            {product?.name || "Untitled"}
          </p>

          <div className="flex justify-center items-center gap-2 text-sm">
            <span className="font-semibold text-neutral-900">
              {hasMultiple && hasNumericPrice ? "From " : ""}
              {hasNumericPrice ? currency.format(price) : "View details"}
            </span>
            {hasNumericPrice &&
              typeof compareAt === "number" &&
              compareAt > price && (
                <span className="line-through text-gray-500 text-xs">
                  {currency.format(compareAt)}
                </span>
              )}
          </div>

          {usedVariations && (
            <div className="text-[11px] text-gray-500">
              {hasMultiple ? "Multiple variants available" : "Variant pricing"}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    $id: PropTypes.string,
    id: PropTypes.string,
    name: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    compareAtPrice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    images: PropTypes.array,
    useVariations: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    variations: PropTypes.array, // objects or JSON strings
    mrp: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    listPrice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    variants: PropTypes.array,
    options: PropTypes.array,
  }).isRequired,
};

// Memoize ProductCard to prevent unnecessary re-renders
export default React.memo(ProductCard, (prevProps, nextProps) => {
  // Only re-render if product ID or critical data changes
  const prevId = prevProps.product?.$id || prevProps.product?.id;
  const nextId = nextProps.product?.$id || nextProps.product?.id;
  
  if (prevId !== nextId) return false; // IDs differ, re-render
  
  // Check if critical display data changed
  const prevPrice = prevProps.product?.price;
  const nextPrice = nextProps.product?.price;
  const prevName = prevProps.product?.name;
  const nextName = nextProps.product?.name;
  const prevImages = prevProps.product?.images?.[0];
  const nextImages = nextProps.product?.images?.[0];
  const prevAboveFold = prevProps.isAboveFold;
  const nextAboveFold = nextProps.isAboveFold;
  
  // Re-render only if critical props changed
  return (
    prevPrice === nextPrice &&
    prevName === nextName &&
    prevImages === nextImages &&
    prevAboveFold === nextAboveFold
  );
});
