import { useNavigate } from "react-router-dom";

const ImageCarousel = () => {
  const navigate = useNavigate();

  // Mobile-first: Use optimized image sizes
  // Mobile: 800px width (h-[20rem] = 320px), Desktop: 1920px width (h-[700px])
  const mobileHeight = 320; // 20rem = 320px
  const desktopHeight = 700;
  const mobileWidth = Math.round((mobileHeight * 16) / 9); // ~569px for 16:9
  const desktopWidth = Math.round((desktopHeight * 16) / 9); // ~1244px for 16:9

  return (
    <div className="w-full mx-auto mt-0 shadow-md overflow-hidden relative">
      <div className="aspect-w-16 h-[20rem] aspect-h-[20rem] lg:h-[700px] relative">
        {/* Hero Image - LCP Element: Optimized with explicit dimensions and fetchpriority */}
        <img
          src="/IMG_3084.JPG"
          alt="Premium Timepieces & Fine Jewellery"
          className="w-full h-full object-cover"
          width={desktopWidth}
          height={desktopHeight}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          onError={(e) => {
            const img = e.target;
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
              const isMobile = window.innerWidth < 768;
              const optimizedWidth = isMobile ? 800 : 1920;
              img.src = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=${optimizedWidth}&q=75`;
              
              // Final fallback to gradient if even Unsplash fails
              img.onerror = () => {
                img.style.display = 'none';
                if (img.parentElement) {
                  img.parentElement.classList.add('bg-gradient-to-br', 'from-gray-900', 'via-gray-800', 'to-gray-900');
                }
              };
            }
          }}
        />
        
        {/* Hero Content Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-4">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-light text-white text-center mb-4 max-w-4xl">
            Premium Timepieces & Fine Jewellery — Trusted by Customers Worldwide
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-white/90 text-center mb-6 max-w-2xl">
            Hand-selected watches and jewellery, quality-checked and delivered worldwide.
          </p>
          <button
            onClick={() => navigate("/categories")}
            className="px-6 py-3 bg-white text-gray-900 rounded-md hover:bg-gray-100 transition-colors font-medium"
            aria-label="Explore our watch collection"
          >
            Explore Collection
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCarousel;
