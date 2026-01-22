import { useNavigate } from "react-router-dom";

const ImageCarousel = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full mx-auto mt-0 shadow-md overflow-hidden relative">
      <div className="aspect-w-16 h-[20rem] aspect-h-[20rem] lg:h-[700px] relative">
        <video
          src="https://fra.cloud.appwrite.io/v1/storage/buckets/6876009e002e889ffa51/files/691ec7db0033909fe4c3/view?project=6875fd9e000f3ec8a910"
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          onError={(e) => {
            console.warn("Video failed to load, showing fallback");
            e.target.style.display = "none";
          }}
        />
        
        {/* Overlay Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 px-4">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-light text-white text-center mb-4 max-w-4xl">
            Premium Timepieces & Fine Jewellery — Trusted by Customers Worldwide
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-white/90 text-center mb-6 max-w-2xl">
            Hand-selected watches and jewellery, quality-checked and delivered worldwide.
          </p>
          <button
            onClick={() => navigate("/categories")}
            className="px-6 py-3 bg-white text-gray-900 rounded-md hover:bg-gray-100 transition-colors font-medium"
          >
            Explore Collection
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCarousel;
