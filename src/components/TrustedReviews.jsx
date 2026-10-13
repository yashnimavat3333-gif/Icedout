import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import productService from "../appwrite/config";
import { whatsAppHref } from "./WhatsAppFloatingButton";

const WANTED = [
  { key: "luxury watch", label: "Watches" },
  { key: "bracelet", label: "Bracelets" },
  { key: "chains", label: "Chains" },
];

function TrustedReviews() {
  const [cards, setCards] = useState(
    WANTED.map((item) => ({ ...item, to: `/category/${encodeURIComponent(item.key)}`, image: "" }))
  );

  useEffect(() => {
    let cancelled = false;
    productService
      .listCategories()
      .then((res) => {
        if (cancelled) return;
        const categories = res?.documents || [];
        setCards(
          WANTED.map((item) => {
            const match = categories.find(
              (cat) => String(cat?.name || "").trim().toLowerCase() === item.key
            );
            const name = match?.name || item.key;
            return {
              ...item,
              to: `/category/${encodeURIComponent(String(name).toLowerCase())}`,
              image: match?.image || "",
            };
          })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-light text-gray-900 sm:text-4xl">
          Find the piece, then check out.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          Start with a category. Each product page shows the price, options, and size before PayPal opens.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {cards.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="group relative block min-h-72 overflow-hidden bg-neutral-900"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
              <span className="absolute inset-x-0 bottom-0 p-5 text-xl text-white">
                Shop {item.label}
              </span>
            </Link>
          ))}
        </div>
        <ul className="mt-8 flex flex-col items-center gap-2 text-sm text-gray-700 sm:flex-row sm:justify-center sm:gap-8">
          <li>Free worldwide shipping</li>
          <li>PayPal or debit/credit card</li>
          <li>7-day easy returns</li>
        </ul>
        <p className="mt-6 text-center text-sm">
          <a
            href={whatsAppHref("Hi Iceyout, I want help choosing a piece.")}
            className="text-gray-900 underline underline-offset-4"
          >
            Not sure which piece? Message us on WhatsApp
          </a>
        </p>
      </div>
    </section>
  );
}

export default TrustedReviews;
