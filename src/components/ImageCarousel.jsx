import { useNavigate } from "react-router-dom";

const ImageCarousel = () => {
  const navigate = useNavigate();
  
  // Vite asset resolution: Use BASE_URL for proper SPA routing compatibility
  // BASE_URL defaults to '/' but ensures correct paths in all environments (Vercel/Netlify SPA routing)
  const baseUrl = import.meta.env.BASE_URL || '/';
  const heroImageSrc = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}img_3084.jpg`.replace(/\/+/g, '/');

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
      {/* Facebook in-app browser fix: Use CSS classes instead of conditional JS styles */}
      <div 
        className="relative w-full hero-container-mobile lg:hero-container-desktop"
        style={{ 
          // Mobile: Lock to viewport height to prevent CLS (works in Facebook browser)
          minHeight: '100svh',
          height: '100svh',
          // Fallback background color (not black) if image fails to load
          backgroundColor: '#2a2a2a',
        }}
      >
        {/* Desktop height spacer (hidden on mobile) */}
        <div 
          className="hidden lg:block absolute inset-0" 
          style={{ height: '700px', aspectRatio: '16/9' }} 
        />
        
        {/* Hero Image - LCP Element: Preloaded, optimized with explicit dimensions */}
        {/* Vite asset resolution: Uses import.meta.env.BASE_URL for SPA routing compatibility */}
        <img
          src={heroImageSrc}
          alt="Premium Timepieces & Fine Jewellery"
          className="w-full h-full object-cover absolute inset-0"
          width={desktopWidth}
          height={desktopHeight}
          loading="eager"
          fetchpriority="high"
          decoding="sync"
          style={{ 
            aspectRatio: '16/9', 
            objectFit: 'cover',
            // Prevent image reflow during load
            minHeight: '100%',
            minWidth: '100%',
            // Ensure image is visible (not hidden by default)
            opacity: 1,
            zIndex: 1
          }}
          onError={(e) => {
            // Simplified error handling - try fallback once, then show placeholder
            try {
              const img = e.target;
              if (!img) return;
              
              const attempts = parseInt(img.dataset?.attempts || '0') + 1;
              if (img.dataset) {
                img.dataset.attempts = String(attempts);
              }
              
              // Try alternative path if first attempt fails
              if (attempts === 1) {
                img.src = heroImageSrc;
              } else {
                // Final fallback: hide image and show gradient background
                if (img.style) {
                  img.style.display = 'none';
                }
                // Apply gradient to parent container
                const container = img.closest('.hero-container-mobile, .hero-container-desktop') || img.parentElement;
                if (container && container.style) {
                  container.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)';
                }
              }
            } catch (error) {
              // Silently fail - don't break the page
              try {
                if (e?.target?.style) {
                  e.target.style.display = 'none';
                }
              } catch {}
            }
          }}
          onLoad={(e) => {
            // Ensure image is visible when loaded
            try {
              const img = e.target;
              if (img && img.style) {
                img.style.opacity = '1';
                img.style.display = 'block';
              }
            } catch {}
          }}
        />
        
        {/* Hero Content Overlay - ONE headline, ONE CTA */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center px-4"
          style={{
            // Subtle dark gradient for readability (lighter to show image better)
            backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.2), rgba(0,0,0,0.05))',
            // Prevent text reflow during load
            minHeight: '100%',
            willChange: 'auto',
            // Ensure overlay is above image but doesn't block it
            zIndex: 2
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
