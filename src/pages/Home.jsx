import React, { lazy, Suspense } from "react";
import ImageCarousel from "../components/ImageCarousel";

// Lazy-load below-the-fold components for faster initial render
const TrustedReviews = lazy(() => import("../components/TrustedReviews"));
const ShopByCategory = lazy(() => import("../components/ShopByCategory"));
const MostLovedWatches = lazy(() => import("../components/MostLovedWatches"));

function Home() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Hero / Video - Above the fold, eager load */}
      <ImageCarousel />
  
      {/* ⭐ Trusted Reviews - Below the fold, lazy load */}
      <Suspense fallback={null}>
        <TrustedReviews />
      </Suspense>
  
      {/* Categories - Below the fold, lazy load */}
      <Suspense fallback={null}>
        <ShopByCategory />
      </Suspense>
  
      {/* Most Loved - Below the fold, lazy load */}
      <Suspense fallback={null}>
        <MostLovedWatches />
      </Suspense>
    </div>
  );
}

export default Home;
