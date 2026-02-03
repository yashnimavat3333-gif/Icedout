import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import productService from "../appwrite/config"; // Adjust if your path is different

const ShopByCategory = () => {
  const scrollRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [visibleCards, setVisibleCards] = useState(4);

  const brandColors = {
    dark: "#202706",
    light: "#afd494",
    accent: "#1a893a",
    highlight: "#27d524",
    gradient: "linear-gradient(135deg, #1a893a 0%, #27d524 100%)",
  };

  useEffect(() => {
    const handleResize = () => {
      setVisibleCards(window.innerWidth > 768 ? 4 : 1);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await productService.listCategories();
        // console.log(res);

        setCategories(res.documents);
      } catch (err) {
        console.error("Failed to fetch categories", err);
        setError("Failed to load categories. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;

    const el = scrollRef.current;

    const updateScroll = () => {
      if (!el) return;
      setScrollPosition(el.scrollLeft);
      setMaxScroll(el.scrollWidth - el.clientWidth);
    };

    // Only perform the initial layout read once the page is fully loaded
    const runInitialWhenReady = () => {
      if (document.readyState === "complete") {
        updateScroll();
      } else {
        window.addEventListener(
          "load",
          () => {
            updateScroll();
          },
          { once: true }
        );
      }
    };

    el.addEventListener("scroll", updateScroll);
    runInitialWhenReady();

    return () => {
      el.removeEventListener("scroll", updateScroll);
    };
  }, [categories, visibleCards]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstChild?.clientWidth || 300;
    const gap = 24;
    const amount =
      (cardWidth + gap) *
      (dir === "left" ? -1 : 1) *
      (visibleCards === 4 ? 4 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (error) {
    return (
      <section className="px-4 py-12 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg"
            style={{ background: brandColors.gradient, color: "white" }}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <section className="px-4 py-12 bg-white text-center">
        <p className="text-gray-500 text-lg">No categories available yet</p>
        <p className="text-gray-400 mt-2">
          Check back soon for our collections
        </p>
      </section>
    );
  }

  return (
    <section className="px-4 py-16 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
          <div className="mb-6 md:mb-0">
            <div className="flex items-center mb-4">
              <div
                className="w-3 h-8 mr-3 rounded-full"
                style={{ background: brandColors.gradient }}
              ></div>
              <h2
                className="text-sm font-medium uppercase tracking-wider"
                style={{ color: brandColors.accent }}
              >
                ICEDOUT COLLECTIONS
              </h2>
            </div>
            <h3 className="text-4xl md:text-5xl font-light text-gray-900 leading-tight">
              Discover Our <br className="hidden md:block" />
              Categories
            </h3>
          </div>
          {categories.length > visibleCards && (
            <div className="flex space-x-3">
              <button
                onClick={() => scroll("left")}
                disabled={scrollPosition <= 0}
                className="p-3 rounded-full transition hover:scale-105 disabled:opacity-30"
                style={{
                  background: "white",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                <ChevronLeft className="w-5 h-5 text-black" />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={scrollPosition >= maxScroll}
                className="p-3 rounded-full transition hover:scale-105 disabled:opacity-30"
                style={{
                  background: "white",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                <ChevronRight className="w-5 h-5 text-black" />
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          {loading ? (
            <div
              className={`grid ${
                visibleCards === 4 ? "grid-cols-4" : "grid-cols-1"
              } gap-6`}
            >
              {[...Array(visibleCards)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-60 bg-gray-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-4 gap-6">
                {categories.map((cat) => (
                  <Link
                    key={cat.$id}
                    to={`/category/${encodeURIComponent(
                      cat.name.toLowerCase()
                    )}`}
                    className="group relative block rounded-2xl overflow-hidden transition-all hover:-translate-y-2 hover:shadow-xl"
                  >
                    {/* CLS Fix: Reserve space immediately with explicit dimensions */}
                    <div 
                      className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100" 
                      style={{ 
                        aspectRatio: '4/5',
                        width: '100%',
                        position: 'relative',
                        minHeight: '400px'
                      }}
                    >
                      {/* CLS Fix: Placeholder to reserve space */}
                      <div 
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          aspectRatio: '4/5',
                          width: '100%',
                          height: '100%',
                          zIndex: 1
                        }}
                        aria-hidden="true"
                      />
                      <img
                        src={cat.image || "/fallback.jpg"}
                        alt={`${cat.name} category`}
                        width="400"
                        height="500"
                        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                        loading={cat.$id === categories[0]?.$id ? "eager" : "lazy"}
                        fetchPriority={cat.$id === categories[0]?.$id ? "high" : "auto"}
                        decoding={cat.$id === categories[0]?.$id ? "sync" : "async"}
                        style={{ 
                          aspectRatio: '4/5',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'relative',
                          zIndex: 2,
                          // Prevent layout shift
                          contain: 'layout style paint'
                        }}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
                      <div className="absolute bottom-0 p-6 z-20 text-white">
                        <h4 className="text-2xl font-medium">{cat.name}</h4>
                        {cat.productCount !== undefined && (
                          <p className="text-sm mt-2">
                            {cat.productCount} premium items
                          </p>
                        )}
                      </div>
                      <div
                        className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold z-20 shadow-md"
                        style={{
                          background: brandColors.gradient,
                          color: "white",
                        }}
                      >
                        NEW
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div
                ref={scrollRef}
                className="md:hidden grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-6 overflow-x-auto scroll-smooth scrollbar-hide"
              >
                {categories.map((cat) => (
                  <Link
                    key={cat.$id}
                    to={`/category/${encodeURIComponent(
                      cat.name.toLowerCase()
                    )}`}
                    className="group relative block rounded-2xl overflow-hidden transition-all hover:-translate-y-2 hover:shadow-xl"
                    aria-label={`Browse ${cat.name} category`}
                  >
                    {/* CLS Fix: Reserve space immediately with explicit dimensions */}
                    <div 
                      className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100" 
                      style={{ 
                        aspectRatio: '4/5',
                        width: '100%',
                        position: 'relative',
                        minHeight: '400px'
                      }}
                    >
                      {/* CLS Fix: Placeholder to reserve space */}
                      <div 
                        className="absolute inset-0 bg-gray-200"
                        style={{
                          aspectRatio: '4/5',
                          width: '100%',
                          height: '100%',
                          zIndex: 1
                        }}
                        aria-hidden="true"
                      />
                      {cat.image && (
                        <img
                          src={cat.image}
                          alt={`${cat.name} category`}
                          width="400"
                          height="500"
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                          loading={cat.$id === categories[0]?.$id ? "eager" : "lazy"}
                          fetchPriority={cat.$id === categories[0]?.$id ? "high" : "auto"}
                          decoding={cat.$id === categories[0]?.$id ? "sync" : "async"}
                          style={{ 
                            aspectRatio: '4/5',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'relative',
                            zIndex: 2,
                            // Prevent layout shift
                            contain: 'layout style paint'
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
                      <div className="absolute bottom-0 p-6 z-20 text-white">
                        <h4 className="text-2xl font-medium">{cat.name}</h4>
                        {cat.productCount !== undefined && (
                          <p className="text-sm mt-2">
                            {cat.productCount} premium items
                          </p>
                        )}
                      </div>
                      <div
                        className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold z-20 shadow-md"
                        style={{
                          background: brandColors.gradient,
                          color: "white",
                        }}
                      >
                        NEW
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ShopByCategory;
