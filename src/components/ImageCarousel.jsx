import { useNavigate } from "react-router-dom";

const ImageCarousel = () => {
  const navigate = useNavigate();

  // Mobile-first: Use optimized image sizes
  // Mobile: 800px width (h-[20rem] = 320px), Desktop: 1920px width (h-[700px])
  const mobileHeight = 320; // 20rem = 320px
  const desktopHeight = 700;
  const mobileWidth = Math.round((mobileHeight * 16) / 9); // ~569px for 16:9
  const desktopWidth = Math.round((desktopHeight * 16) / 9); // ~1244px for 16:9

  // Safe window check for in-app browsers
  const getIsMobile = () => {
    if (typeof window === 'undefined') return false;
    try {
      return window.innerWidth < 768;
    } catch {
      return false;
    }
  };

  // Instant CTA navigation (no delays)
  const handleCTAClick = (e) => {
    e.preventDefault();
    // Use instant navigation - no transitions or delays
    if (typeof navigate === 'function') {
      navigate("/categories", { replace: false });
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/categories';
    }
  };

  return (
    <div className="w-full mx-auto mt-0 shadow-md overflow-hidden relative">
      {/* Fixed height container - prevents CLS on mobile using 100svh */}
      <div 
        className="relative w-full"
        style={{ 
          // Mobile: Lock to viewport height to prevent CLS
          minHeight: '100svh',
          height: '100svh',
          // Desktop: Use fixed aspect ratio
          ...(typeof window !== 'undefined' && window.innerWidth >= 1024 ? {
            minHeight: '700px',
            height: '700px',
            aspectRatio: '16/9'
          } : {})
        }}
      >
        {/* Desktop height spacer (hidden on mobile) */}
        <div 
          className="hidden lg:block absolute inset-0" 
          style={{ height: '700px', aspectRatio: '16/9' }} 
        />
        
        {/* Hero Image - LCP Element: Preloaded, optimized with explicit dimensions */}
        <img
          src="/IMG_3084.JPG"
          alt="Premium Timepieces & Fine Jewellery"
          className="w-full h-full object-cover absolute inset-0"
          width={desktopWidth}
          height={desktopHeight}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          style={{ 
            aspectRatio: '16/9', 
            objectFit: 'cover',
            // Prevent image reflow during load
            minHeight: '100%',
            minWidth: '100%'
          }}
          onError={(e) => {
            try {
              const img = e.target;
              if (!img || !img.dataset) return;
              
              const currentSrc = img.src;
              
              // Track attempts to avoid infinite loop
              if (!img.dataset.attempts) {
                img.dataset.attempts = '1';
              } else {
                const attempts = parseInt(img.dataset.attempts) || 0;
                img.dataset.attempts = (attempts + 1).toString();
              }
              
              const attempts = parseInt(img.dataset.attempts) || 1;
              
              // Try different extensions
              if (attempts === 1) {
                img.src = '/IMG_3084.jpg';
              } else if (attempts === 2) {
                img.src = '/IMG_3084.jpeg';
              } else if (attempts === 3) {
                img.src = '/IMG_3084.png';
              } else {
                // All local attempts failed, use professional luxury watch/jewellery image
                // Optimized Unsplash image with mobile-friendly size
                const isMobile = getIsMobile();
                const optimizedWidth = isMobile ? 800 : 1920;
                img.src = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=${optimizedWidth}&q=75`;
                
                // Final fallback to gradient if even Unsplash fails
                img.onerror = () => {
                  try {
                    if (img && img.style) {
                      img.style.display = 'none';
                    }
                    if (img && img.parentElement) {
                      img.parentElement.classList.add('bg-gradient-to-br', 'from-gray-900', 'via-gray-800', 'to-gray-900');
                    }
                  } catch (fallbackError) {
                    // Silently fail - don't break the page
                  }
                };
              }
            } catch (error) {
              // Silently fail - don't break the page in in-app browsers
            }
          }}
        />
        
        {/* Hero Content Overlay - ONE headline, ONE CTA */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center px-4"
          style={{
            // Subtle dark gradient for readability
            backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.35), rgba(0,0,0,0.15))',
            // Prevent text reflow during load
            minHeight: '100%',
            willChange: 'auto'
          }}
        >
          {/* ONE Main headline - fixed height prevents CLS */}
          <h1 
            className="text-2xl md:text-4xl lg:text-5xl font-light text-white text-center mb-4 max-w-4xl"
            style={{
              // Lock height to prevent reflow
              minHeight: '2.5rem',
              lineHeight: '1.25'
            }}
          >
            Hand-Set VVS Diamond Luxury Watches &amp; Jewellery
          </h1>
          
          {/* ONE CTA - instant click, no delays */}
          <button
            onClick={handleCTAClick}
            className="px-6 py-3 bg-white text-gray-900 rounded-md hover:bg-gray-100 font-medium"
            style={{
              // Ensure button is always visible and clickable
              minHeight: '3rem',
              cursor: 'pointer',
              touchAction: 'manipulation',
              // Prevent layout shift
              willChange: 'auto'
            }}
            aria-label="Explore our luxury collections"
          >
            Explore Collections
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCarousel;
