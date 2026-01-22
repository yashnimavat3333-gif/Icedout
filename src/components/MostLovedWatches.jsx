import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Client, Databases, Query } from "appwrite";
import conf from "../conf/conf";
import ProductCard from "./products/ProductCard";

const PAGE_SIZE = 50; // Appwrite’s max per request

const MostLovedWatches = () => {
  const scrollRef = useRef(null);
  const [lovedWatches, setLovedWatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const client = new Client()
    .setEndpoint(conf.appwriteUrl)
    .setProject(conf.appwriteProjectId);
  const databases = new Databases(client);

  useEffect(() => {
    const fetchAllLovedWatches = async () => {
      setLoading(true);
      try {
        let allDocs = [];
        let cursor = null;
        let keepFetching = true;

        while (keepFetching) {
          const queries = [Query.equal("tags", "most_loved")];
          if (cursor) queries.push(Query.cursorAfter(cursor));

          const res = await databases.listDocuments(
            conf.appwriteDatabaseId,
            conf.appwriteProductCollectionId,
            queries
          );

          const docs = res?.documents || [];
          allDocs = [...allDocs, ...docs];

          if (docs.length < PAGE_SIZE) {
            keepFetching = false;
          } else {
            cursor = docs[docs.length - 1].$id;
          }
        }

        // Normalize IDs
        const normalized = allDocs.map((d) => ({
          ...d,
          $id: d.$id ?? d.id,
        }));

        setLovedWatches(normalized);
      } catch (err) {
        console.error("Error fetching most loved watches:", err);
        setError("Failed to load watches.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllLovedWatches();
  }, []);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const scrollAmount = clientWidth * 0.8;
    scrollRef.current.scrollTo({
      left:
        direction === "left"
          ? Math.max(0, scrollLeft - scrollAmount)
          : scrollLeft + scrollAmount,
      behavior: "smooth",
    });
  };

  if (loading) {
    return (
      <section className="py-16 bg-neutral-50 text-center">
        <div className="animate-pulse flex space-x-4 justify-center">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-64 h-80 bg-neutral-200 rounded-lg"></div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-neutral-50 text-center">
        <p className="text-neutral-600">{error}</p>
      </section>
    );
  }

  if (!lovedWatches.length) {
    return (
      <section className="py-16 bg-neutral-50 text-center">
        <p className="text-neutral-500">No most-loved watches found.</p>
      </section>
    );
  }

  return (
    <section className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div className="mb-6 md:mb-0">
              <h2 className="text-3xl font-light tracking-tight text-neutral-900">
                Most Loved <span className="font-medium">Watches</span>
              </h2>
              <p className="mt-2 text-neutral-500">
                Curated collection of customer favorites
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                Showing {lovedWatches.length} products
              </p>
            </div>

            <div className="hidden md:flex gap-2">
              <button
                onClick={() => scroll("left")}
                className="p-2 bg-white border border-neutral-200 rounded-full shadow-sm hover:bg-neutral-50 transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="text-neutral-700 w-5 h-5" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="p-2 bg-white border border-neutral-200 rounded-full shadow-sm hover:bg-neutral-50 transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="text-neutral-700 w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
            {lovedWatches.map((watch) => (
              <ProductCard key={watch.$id} product={watch} />
            ))}
          </div>

          {/* Mobile Scrollable View */}
          <div className="relative p-4 md:hidden">
            <div
              ref={scrollRef}
              className="flex overflow-x-auto gap-4 scroll-smooth snap-x snap-mandatory scrollbar-hide pb-6 -mx-4 px-4"
            >
              {lovedWatches.map((watch) => (
                <div
                  key={watch.$id}
                  className="w-[calc(50%-0.5rem)] flex-shrink-0 snap-start"
                >
                  <ProductCard product={watch} />
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => scroll("left")}
                className="p-2 bg-white border border-neutral-200 rounded-full shadow-sm hover:bg-neutral-50 transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="text-neutral-700 w-5 h-5" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="p-2 bg-white border border-neutral-200 rounded-full shadow-sm hover:bg-neutral-50 transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="text-neutral-700 w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>
  );
};

export default MostLovedWatches;
