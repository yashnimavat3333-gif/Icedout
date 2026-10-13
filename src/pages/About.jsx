import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  Gem,
  Globe,
  Headset,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import productService from "../appwrite/config";
import SEO from "../components/SEO";
import { whatsAppHref } from "../components/WhatsAppFloatingButton";

const INSTAGRAM_URL =
  "https://www.instagram.com/iceyoutnyc?utm_source=ig_web_button_share_sheet&igsh=dTI2eGRldm8xZnRl";
const SUPPORT_WHATSAPP = whatsAppHref(
  "Hi Iceyout, I have a question about a piece or an order."
);

const ABOUT_TAGS = [
  "ICEYOUT",
  "iced-out watches",
  "jewellery",
  "about ICEYOUT",
];

const ABOUT_SCHEMA = { type: "AboutPage" };

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Reveal({ children, className = "" }) {
  const [node, setNode] = useState(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    if (!node || shown) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, shown]);

  return (
    <div
      ref={setNode}
      className={`about-reveal ${shown ? "about-reveal-in" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.32em] text-[#d4bc86]">
      {children}
    </p>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="font-serif text-3xl leading-tight text-white sm:text-4xl md:text-5xl">
      {children}
    </h2>
  );
}

function GoldButton({ href, to, onClick, children, variant = "solid" }) {
  const className =
    variant === "solid"
      ? "inline-flex min-h-12 items-center justify-center px-6 text-center text-sm font-medium tracking-wide text-[#1a1206] bg-[linear-gradient(180deg,#f6ead0_0%,#c6a15b_48%,#8d6b32_100%)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3e6c4]"
      : "inline-flex min-h-12 items-center justify-center border border-[#c6a15b]/80 px-6 text-center text-sm font-medium tracking-wide text-[#f6ead0] transition hover:bg-[#c6a15b]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3e6c4]";

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

function imageFileId(product) {
  const images = product?.images;
  if (!Array.isArray(images) || images.length === 0) return "";
  const first = images[0];
  if (typeof first === "string") return first;
  return first?.$id || first?.fileId || "";
}

const DIFFERENCE = [
  {
    icon: Sparkles,
    title: "Standout Designs",
    copy: "Watches, bracelets, chains, and rings chosen for people who want a piece with presence. The point is a look that feels personal, not interchangeable.",
  },
  {
    icon: Gem,
    title: "Details That Matter",
    copy: "Options, sizes, and materials are listed on the individual product page. They are not the same for every piece, so the product page is the place to confirm what you are buying.",
  },
  {
    icon: ShoppingBag,
    title: "A Straightforward Way to Shop",
    copy: "Choose a product, select the options shown for it, and review the price on screen. Checkout asks for a shipping address, then opens PayPal.",
  },
  {
    icon: Headset,
    title: "A Real Person to Reach",
    copy: "Questions about a piece or an order can go to the contact page, Instagram, or WhatsApp. Those are the support channels already on the site.",
  },
];

export default function About() {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    let cancelled = false;
    productService
      .listProducts({ limit: 60 })
      .then((res) => {
        if (cancelled) return;
        const candidates = [];
        for (const product of res?.documents || []) {
          const fileId = imageFileId(product);
          if (!fileId || !product?.$id) continue;
          const rawCategory = Array.isArray(product?.categories)
            ? product.categories[0]
            : product?.categories;
          let src = "";
          try {
            src = productService.getFileView(fileId);
          } catch {
            src = "";
          }
          if (!src) continue;
          candidates.push({
            id: product.$id,
            name: product.name || "ICEYOUT piece",
            category: String(rawCategory || "Piece"),
            src,
          });
        }
        const wanted = ["bracelet", "chain", "watch"];
        const picked = [];
        for (const word of wanted) {
          const match = candidates.find(
            (item) =>
              item.category.toLowerCase().includes(word) &&
              !picked.some((piece) => piece.id === item.id)
          );
          if (match) picked.push(match);
        }
        for (const item of candidates) {
          if (picked.length === 3) break;
          if (picked.some((piece) => piece.id === item.id)) continue;
          picked.push(item);
        }
        setPieces(picked);
      })
      .catch(() => {
        if (!cancelled) setPieces([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToStory = (event) => {
    event.preventDefault();
    document.getElementById("our-story")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="about-page bg-[#070707] text-[#f5f1ea]">
      <SEO
        title="About ICEYOUT | Iced-Out Watches & Jewellery"
        description="ICEYOUT designs statement iced-out watches and jewellery. Review shipping, 7-day returns, and PayPal checkout before you buy."
        canonical="https://www.iceyout.com/about"
        image="https://www.iceyout.com/img_3084.jpg"
        tags={ABOUT_TAGS}
        schema={ABOUT_SCHEMA}
      />

      <style>{`
        .about-page { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .about-page .font-serif { font-family: Palatino, "Palatino Linotype", "Iowan Old Style", Georgia, serif; }
        .about-reveal { opacity: 0; transform: translateY(16px); transition: opacity 700ms ease, transform 700ms ease; }
        .about-reveal-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .about-reveal { opacity: 1; transform: none; transition: none; }
          .about-zoom { transform: none !important; transition: none !important; }
        }
      `}</style>

      <section className="relative isolate overflow-hidden">
        <img
          src="/img_3084.jpg"
          alt="ICEYOUT watches, chains, bracelets, and pendants arranged on black"
          className="absolute inset-0 h-full w-full object-cover"
          width="1600"
          height="900"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,0.92)_0%,rgba(7,7,7,0.72)_46%,rgba(7,7,7,0.28)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,7,0.15)_0%,rgba(7,7,7,0.72)_100%)]" />

        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-5 pb-28 pt-24 sm:px-8 lg:pb-20 lg:pt-24">
          <div className="max-w-2xl border border-[#c6a15b]/30 bg-black/35 p-6 backdrop-blur-[2px] sm:p-10">
            <Eyebrow>ICEYOUT</Eyebrow>
            <h1 className="font-serif text-4xl leading-[1.05] text-white sm:text-6xl">
              The art of standing out.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#efe7d8] sm:text-lg">
              Discover distinctive iced-out watches and jewellery designed for
              those who make their own statement.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#d9d0c3] sm:text-base">
              ICEYOUT is a jewellery and watch house for people who want a
              piece with weight, shine, and a point of view.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <GoldButton to="/shop">Explore the Collection</GoldButton>
              <GoldButton href="#our-story" variant="line" onClick={scrollToStory}>
                Discover Our Story
              </GoldButton>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Shopping assurances" className="border-y border-[#c6a15b]/25 bg-[#0c0c0c]">
        <ul className="mx-auto grid max-w-6xl gap-4 px-5 py-5 text-sm text-[#f6ead0] sm:grid-cols-3 sm:px-8">
          <li className="flex items-center gap-3">
            <Truck className="h-4 w-4 shrink-0 text-[#c6a15b]" aria-hidden="true" />
            Free worldwide shipping
          </li>
          <li className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#c6a15b]" aria-hidden="true" />
            PayPal checkout, including cards
          </li>
          <li className="flex items-center gap-3">
            <RotateCcw className="h-4 w-4 shrink-0 text-[#c6a15b]" aria-hidden="true" />
            7-day easy returns
          </li>
        </ul>
      </section>

      <section id="our-story" className="scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>Our story</Eyebrow>
            <SectionTitle>Style, worn as a statement.</SectionTitle>
            <p className="mt-6 text-base leading-relaxed text-[#d9d0c3] sm:text-lg">
              ICEYOUT was created for people who see style as a statement. From
              bold iced-out watches to distinctive jewellery, the collection
              brings together standout designs for those who prefer to be
              remembered.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#bdb6ab]">
              The pieces are meant to be noticed: a watch that catches the
              light, a chain with presence, a bracelet chosen because it feels
              like yours. Before you buy, the product page is where the photos,
              options, and price for that exact item live.
            </p>
          </div>
          <figure className="relative border border-[#c6a15b]/30 bg-[#101010] p-8 sm:p-12">
            <div className="absolute -left-3 -top-3 h-16 w-16 border-l border-t border-[#c6a15b]/70" aria-hidden="true" />
            <p className="font-serif text-3xl leading-snug text-white sm:text-4xl">
              Noticed for the piece. Remembered for the person wearing it.
            </p>
            <figcaption className="mt-8 text-[11px] uppercase tracking-[0.28em] text-[#d4bc86]">
              ICEYOUT
            </figcaption>
            <div className="absolute -bottom-3 -right-3 h-16 w-16 border-b border-r border-[#c6a15b]/70" aria-hidden="true" />
          </figure>
        </Reveal>
      </section>

      <section className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>The difference</Eyebrow>
            <SectionTitle>What makes ICEYOUT different?</SectionTitle>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {DIFFERENCE.map((item) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title}>
                  <article className="h-full border border-white/10 bg-[#111111] p-6 transition duration-300 hover:border-[#c6a15b]/70 sm:p-8">
                    <Icon className="h-6 w-6 text-[#c6a15b]" aria-hidden="true" />
                    <h3 className="mt-5 font-serif text-2xl text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#cfc8be] sm:text-base">
                      {item.copy}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
          <p className="mt-8 text-sm text-[#bdb6ab]">
            Reach the team on{" "}
            <Link to="/contact" className="text-[#f6ead0] underline decoration-[#c6a15b]/70 underline-offset-4">
              the contact page
            </Link>
            ,{" "}
            <a href={INSTAGRAM_URL} className="text-[#f6ead0] underline decoration-[#c6a15b]/70 underline-offset-4">
              Instagram
            </a>
            , or{" "}
            <a href={SUPPORT_WHATSAPP} className="text-[#f6ead0] underline decoration-[#c6a15b]/70 underline-offset-4">
              WhatsApp
            </a>
            .
          </p>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mx-auto grid max-w-6xl gap-10 border border-[#c6a15b]/25 bg-[#101010] p-6 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex h-16 w-16 items-center justify-center border border-[#c6a15b]/50 text-[#c6a15b]">
            <Truck className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <Eyebrow>Shipping & delivery</Eyebrow>
            <SectionTitle>Sent with care, timed as an estimate.</SectionTitle>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#d9d0c3]">
              The site offers free worldwide shipping. On product pages,
              shipping information says orders are processed within 1–2
              business days and delivery typically takes 4–5 business days
              worldwide, using FedEx Express. That timing is a typical
              estimate, not a guaranteed delivery date.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#bdb6ab]">
              The same product pages also describe insured shipping and secure
              packaging. There is no separate shipping-policy page, so the
              product page remains the place to read those details before you
              order.
            </p>
            <div className="mt-8">
              <GoldButton to="/shop">View pieces and shipping details</GoldButton>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Returns</Eyebrow>
            <SectionTitle>Seven days to reconsider.</SectionTitle>
            <p className="mt-5 text-base leading-relaxed text-[#d9d0c3]">
              ICEYOUT advertises 7-day easy returns in the site header, on the
              home page, and at checkout. A separate returns page with the full
              written conditions is not published yet.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#bdb6ab]">
              If you need to start a return, contact the team inside that
              window. They can confirm what applies to your order. This page
              does not promise an unconditional or no-questions refund.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <GoldButton to="/contact">Contact us about a return</GoldButton>
              <GoldButton href={SUPPORT_WHATSAPP} variant="line">
                Message on WhatsApp
              </GoldButton>
            </div>
          </div>
          <div className="border border-white/10 p-8">
            <RotateCcw className="h-7 w-7 text-[#c6a15b]" aria-hidden="true" />
            <p className="mt-6 font-serif text-3xl text-white">7-day easy returns</p>
            <p className="mt-3 text-sm leading-relaxed text-[#cfc8be]">
              The offer is the one already shown across the store. Ask before
              you assume a return is accepted, especially if the piece has been
              worn or altered.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mx-auto max-w-6xl border border-[#c6a15b]/30 bg-[radial-gradient(circle_at_top_right,rgba(198,161,91,0.16),transparent_36%),#0b0b0b] p-6 sm:p-12">
          <ShieldCheck className="h-7 w-7 text-[#c6a15b]" aria-hidden="true" />
          <Eyebrow>Secure payments</Eyebrow>
          <SectionTitle>Pay through PayPal.</SectionTitle>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#d9d0c3]">
            After you choose a piece and enter a shipping address, checkout
            opens PayPal. You can pay with a PayPal account or with a debit or
            credit card inside that PayPal window. Payment details are handled
            by PayPal, the third-party processor described in the privacy
            policy.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#bdb6ab]">
            A payment can still be declined. Nothing on this page means a card
            will always be accepted.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <GoldButton to="/shop">Shop the Collection</GoldButton>
            <GoldButton to="/privacy" variant="line">
              Read the privacy policy
            </GoldButton>
          </div>
        </Reveal>
      </section>

      <section className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-3xl">
            <Eyebrow>Before you buy</Eyebrow>
            <SectionTitle>Look closely, then decide.</SectionTitle>
            <p className="mt-5 text-base leading-relaxed text-[#d9d0c3]">
              Confidence starts on the product page. Review the photos, the
              listed materials, the sizes, and the options for that item. Those
              details belong to the piece you are viewing. They are not a
              blanket promise for the whole collection.
            </p>
          </Reveal>
          {pieces.length > 0 ? (
            <ul className="mt-12 grid gap-4 sm:grid-cols-3">
              {pieces.map((piece) => (
                <li key={piece.id}>
                  <Link
                    to={`/product/${piece.id}`}
                    className="group block border border-white/10 bg-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3e6c4]"
                  >
                    <img
                      src={piece.src}
                      alt={piece.name}
                      className="about-zoom aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                      width="640"
                      height="640"
                    />
                    <span className="block p-4">
                      <span className="block text-[11px] uppercase tracking-[0.22em] text-[#d4bc86]">
                        {piece.category}
                      </span>
                      <span className="mt-2 block text-sm text-white">{piece.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Reveal className="mt-12">
              <Link to="/shop" className="inline-block border border-[#c6a15b]/40">
                <img
                  src="/img_3084.jpg"
                  alt="The ICEYOUT collection, ready to browse in the shop"
                  className="max-h-[420px] w-full object-cover"
                  loading="lazy"
                />
              </Link>
            </Reveal>
          )}
          <div className="mt-8 flex items-start gap-3 text-sm text-[#cfc8be]">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[#c6a15b]" aria-hidden="true" />
            <p>
              Open any piece to see its own specifications. If a warranty is
              offered, it is described on that product, not here.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-8 border border-white/10 p-6 sm:p-12 md:flex-row md:items-center">
          <Globe className="h-12 w-12 shrink-0 text-[#c6a15b]" strokeWidth={1.25} aria-hidden="true" />
          <div>
            <Eyebrow>A wider reach</Eyebrow>
            <SectionTitle>Ordered from more than one place.</SectionTitle>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#d9d0c3]">
              Checkout accepts an international shipping address, and the site
              offers free worldwide shipping. How long a parcel takes still
              depends on the destination. Treat the 4–5 business day figure as
              the typical estimate already published on product pages.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <Reveal className="mx-auto max-w-6xl bg-[#050505] px-6 py-16 text-center sm:px-12">
          <div className="mx-auto mb-8 h-px w-24 bg-[linear-gradient(90deg,transparent,#c6a15b,transparent)]" />
          <h2 className="font-serif text-3xl text-white sm:text-5xl">
            Your next statement piece starts here.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#d9d0c3]">
            Explore distinctive watches and jewellery and find a style that
            feels unmistakably yours.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <GoldButton to="/shop">Shop the Collection</GoldButton>
            <GoldButton to="/contact" variant="line">
              Contact Us
            </GoldButton>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
