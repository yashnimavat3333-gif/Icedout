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
  
      {/* ⭐ Trusted Reviews - Lazy load */}
      <Suspense fallback={<SectionLoader />}>
        <TrustedReviews />
      </Suspense>
  
      {/* Categories - Lazy load */}
      <Suspense fallback={<SectionLoader />}>
        <ShopByCategory />
      </Suspense>
    </div>
  );
}

export default Home;
