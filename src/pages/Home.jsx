import React, { lazy, Suspense } from "react";
import ImageCarousel from "../components/ImageCarousel";

// Lazy load components below the fold for better initial load performance
const TrustedReviews = lazy(() => import("../components/TrustedReviews"));
const ShopByCategory = lazy(() => import("../components/ShopByCategory"));

// Loading placeholder component
const SectionLoader = () => (
  <div className="w-full py-16 bg-white flex items-center justify-center">
    <div className="animate-pulse">
      <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
      <div className="h-4 w-48 bg-gray-200 rounded"></div>
    </div>
  </div>
);

function Home() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Hero Image - Load immediately (above fold) */}
      <ImageCarousel />

      {/* Static trust strip - directly below hero, no animation */}
      <section className="w-full bg-gray-50 border-t border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm text-gray-900 font-medium md:flex md:items-center md:justify-center md:space-x-8">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span aria-hidden="true">✓</span>
              <span>Free Worldwide Shipping</span>
            </div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span aria-hidden="true">✓</span>
              <span>7-Day Easy Returns</span>
            </div>
            <div className="flex items-center gap-2 justify-center md:justify-start md:ml-0 col-span-2 md:col-span-1">
              <span aria-hidden="true">✓</span>
              <span>Secure PayPal Checkout</span>
            </div>
          </div>
        </div>
      </section>

      {/* ICEDOUT Collections - Lazy load (above reviews) */}
      <Suspense fallback={<SectionLoader />}>
        <ShopByCategory />
      </Suspense>

      {/* ⭐ Trusted Reviews - Lazy load (moved to bottom) */}
      <Suspense fallback={<SectionLoader />}>
        <TrustedReviews />
      </Suspense>
    </div>
  );
}

export default Home;
