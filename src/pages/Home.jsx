import React, { lazy, Suspense, useEffect, useState, useRef } from "react";
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

// Intersection Observer wrapper to load components only when visible
const LazySection = ({ children, fallback }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};

function Home() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Hero / Video - Load immediately (above fold) */}
      <ImageCarousel />
  
      {/* ⭐ Trusted Reviews (NEW) - Lazy load with Intersection Observer */}
      <LazySection fallback={<SectionLoader />}>
        <Suspense fallback={<SectionLoader />}>
          <TrustedReviews />
        </Suspense>
      </LazySection>
  
      {/* Categories - Lazy load with Intersection Observer */}
      <LazySection fallback={<SectionLoader />}>
        <Suspense fallback={<SectionLoader />}>
          <ShopByCategory />
        </Suspense>
      </LazySection>
    </div>
  );
}

export default Home;
