import { Link } from "react-router-dom";

const shots = [
  {
    src: "/customer-trust/customer-cartier.webp?v=2",
    width: 473,
    height: 1024,
    alt: "Customer conversation with a photo of a red-dial watch, saying they just received it, the quality is great, and they will be doing business again.",
    caption: "Quality that speaks for itself.",
  },
  {
    src: "/customer-trust/customer-rose-gold.webp?v=2",
    width: 560,
    height: 1024,
    alt: "Customer conversation with a FedEx note and a photo of a rose gold watch, captioned that it was received.",
    caption: "Customer feedback.",
  },
  {
    src: "/customer-trust/customer-pink-dial.webp?v=2",
    width: 562,
    height: 1024,
    alt: "Customer conversation with a photo of a pink-dial watch, thanks for the box and papers, and a note that it is accurate.",
    caption: "Customer feedback.",
  },
  {
    src: "/customer-trust/customer-quality.webp?v=2",
    width: 498,
    height: 1024,
    alt: "Customer conversation with a FedEx shipment screen and messages that the watch arrived and the quality is good.",
    caption: "Customer feedback.",
  },
  {
    src: "/customer-trust/customer-crown.webp?v=2",
    width: 473,
    height: 1024,
    alt: "Customer conversation with a watch photo and messages saying perfect, you are the best, and you have my business for life.",
    caption: "Customer feedback.",
  },
  {
    src: "/customer-trust/customer-delivered.webp?v=2",
    width: 712,
    height: 1024,
    alt: "FedEx delivery screen marked delivered, with the delivery photo.",
    caption: "Delivered.",
  },
];

export default function CustomerTrust() {
  return (
    <section className="bg-[#f6f3ec] py-16 sm:py-20" aria-labelledby="customer-trust-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8d6b32]">From our customers</p>
        <h2
          id="customer-trust-heading"
          className="mt-3 max-w-3xl text-3xl uppercase leading-tight tracking-[0.04em] text-gray-950 sm:text-5xl"
          style={{ fontFamily: 'Palatino, "Palatino Linotype", Georgia, serif' }}
        >
          Real customers. Real deliveries.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
          Real experiences from customers around the world. See their feedback, product photos, and ICEYOUT deliveries.
        </p>

        <ul
          className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible lg:grid-cols-3"
          aria-label="Customer photos and messages"
        >
          {shots.map((shot) => (
            <li
              key={shot.src}
              className="w-[82%] shrink-0 snap-start border border-[#c6a15b]/45 bg-white sm:w-[46%] md:w-auto"
            >
              <img
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                loading="lazy"
                decoding="async"
                className="h-auto w-full"
              />
              <p className="border-t border-[#c6a15b]/30 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#8d6b32]">
                {shot.caption}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            to="/shop"
            className="inline-flex min-h-12 items-center bg-[linear-gradient(180deg,#f6ead0_0%,#c6a15b_48%,#8d6b32_100%)] px-6 text-sm font-medium uppercase tracking-[0.16em] text-[#1a1206]"
          >
            Explore the Collection
          </Link>
        </div>
      </div>
    </section>
  );
}
