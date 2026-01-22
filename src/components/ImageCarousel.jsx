import { useNavigate } from "react-router-dom";

const ImageCarousel = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full mx-auto mt-0 shadow-md overflow-hidden relative">
      <div className="aspect-w-16 h-[20rem] aspect-h-[20rem] lg:h-[700px] relative">
        {/* Hero Image */}
        <img
          src="/IMG_3084.jpg"
          alt="Premium Timepieces & Fine Jewellery"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Try alternative extensions if .jpg fails
            const extensions = ['.jpeg', '.png', '.webp'];
            const currentSrc = e.target.src;
            const basePath = currentSrc.substring(0, currentSrc.lastIndexOf('.'));
            const currentExt = currentSrc.substring(currentSrc.lastIndexOf('.'));
            const currentIndex = extensions.indexOf(currentExt);
            
            if (currentIndex < extensions.length - 1) {
              e.target.src = basePath + extensions[currentIndex + 1];
            } else {
              // Fallback to gradient if all extensions fail
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('bg-gradient-to-br', 'from-gray-900', 'via-gray-800', 'to-gray-900');
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
