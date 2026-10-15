import { Link } from "react-router-dom";
import { PROMO_GIFT_DETAIL } from "../../api/_lib/promoGift.js";

export const PROMO_EARRING_SRC = "/promo-vvs-earrings.webp?v=2";

export function EarringPhoto({ className = "h-14 w-14", alt = "" }) {
  return (
    <span className={`inline-block overflow-hidden bg-white ${className}`}>
      <img
        src={PROMO_EARRING_SRC}
        alt={alt}
        className="h-full w-full object-cover object-center"
        style={{ transform: "scale(2.6)", transformOrigin: "center" }}
      />
    </span>
  );
}

export function GiftIncludedNote() {
  return (
    <div className="flex gap-3 border border-[#c6a15b]/50 bg-[#111] p-3 text-white">
      <EarringPhoto className="h-16 w-16 shrink-0" alt="VVS moissanite stud earrings" />
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#d4bc86]">Free gift included</p>
        <p className="mt-1 text-sm leading-relaxed text-[#f6ead0]">
          Purchase this product and receive a complimentary pair of {PROMO_GIFT_DETAIL}. The gift is added with the order and is not added to the price.
        </p>
      </div>
    </div>
  );
}

export default function PromoOffer() {
  return (
    <section className="bg-[#070707] text-white" aria-label="Complimentary earrings offer">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .promo-sparkle { animation: none !important; }
        }
        @keyframes promo-sparkle {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        .promo-sparkle { animation: promo-sparkle 2.8s ease-in-out infinite; }
      `}</style>
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 py-8 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#d4bc86]">
            Complimentary gift <span className="promo-sparkle" aria-hidden="true">✦</span>
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-white sm:text-5xl" style={{ fontFamily: 'Palatino, "Palatino Linotype", Georgia, serif' }}>
            A gift that shines. On us.
          </h2>
          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-[#f6ead0] sm:text-base">
            Order any 1 product and get a free pair of VVS moissanite earrings.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#d9d0c3]">
            Your next statement piece comes with something extra. One complimentary pair is included with the order.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex min-h-12 items-center bg-[linear-gradient(180deg,#f6ead0_0%,#c6a15b_48%,#8d6b32_100%)] px-6 text-sm font-medium text-[#1a1206]"
          >
            Shop the Offer
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <img
            src="/img_3084.jpg"
            alt="ICEYOUT iced-out watches and jewellery"
            className="h-52 w-full object-cover sm:h-64"
            width="640"
            height="512"
          />
          <div className="relative h-52 overflow-hidden border border-[#c6a15b]/40 bg-white sm:h-64">
            <img
              src={PROMO_EARRING_SRC}
              alt="Pair of VVS moissanite stud earrings"
              className="h-full w-full object-cover object-center"
              style={{ transform: "scale(2.15)", transformOrigin: "center" }}
              width="640"
              height="800"
            />
            <p className="absolute inset-x-0 bottom-0 bg-[#070707]/85 px-2 py-2 text-center text-[10px] uppercase leading-snug tracking-[0.12em] text-[#f6ead0]">
              {PROMO_GIFT_DETAIL}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

