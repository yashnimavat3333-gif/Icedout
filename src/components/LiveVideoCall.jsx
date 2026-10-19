import { useLocation } from "react-router-dom";
import { whatsAppHref } from "./WhatsAppFloatingButton";

function CameraIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <rect x="2.5" y="6.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M15.5 10.2 21 7.2v9.6l-5.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function liveVideoCallMessage({ productName = "", productUrl = "", itemNames = [] } = {}) {
  const lines = [
    "Hi ICEYOUT, I would like to arrange a live video call to view products, explore details, and check current stock availability.",
  ];
  const name = String(productName || "").trim();
  const url = String(productUrl || "").trim();
  const names = (Array.isArray(itemNames) ? itemNames : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (name) lines.push(`Product: ${name}`);
  if (url) lines.push(url);
  if (names.length) lines.push(`Pieces: ${names.join(", ")}`);
  return lines.join("\n");
}

function ConnectLink({ href, className }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      Connect on WhatsApp
    </a>
  );
}

export default function LiveVideoCall({ variant = "product", productName = "", itemNames = [] }) {
  const { pathname, search } = useLocation();
  const productUrl =
    variant === "product" && typeof window !== "undefined"
      ? `${window.location.origin}${pathname}${search}`
      : "";
  const href = whatsAppHref(
    liveVideoCallMessage({
      productName: variant === "product" ? productName : "",
      productUrl,
      itemNames: variant === "checkout" ? itemNames : [],
    })
  );

  if (variant === "home") {
    return (
      <div className="mt-3 flex flex-col gap-3 border-t border-gray-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-[#8d6b32]">
            <CameraIcon />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-900">
              Live video call available
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-600">
              Want a closer look? Connect with our team on a live video call to view products, explore details, and check current stock availability.
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Optional assistance from our team, whenever you need it.
            </p>
          </div>
        </div>
        <ConnectLink
          href={href}
          className="shrink-0 text-sm text-gray-900 underline decoration-[#c6a15b] underline-offset-4"
        />
      </div>
    );
  }

  if (variant === "checkout") {
    return (
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-[#8d6b32]">
            <CameraIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-800">
              Live video call available
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Want a closer look? Connect with our team on a live video call to view products, explore details, and check current stock availability.
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              Optional assistance from our team, whenever you need it.
            </p>
            <ConnectLink
              href={href}
              className="mt-2 inline-block text-xs text-gray-800 underline decoration-[#c6a15b] underline-offset-4"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="border border-[#c6a15b]/45 bg-[#111] p-4 text-white" aria-label="Live video call available">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[#d4bc86]">
          <CameraIcon />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#d4bc86]">
            Live video call available
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#f6ead0]">
            Want a closer look? Connect with our team on a live video call to view products, explore details, and check current stock availability.
          </p>
          <p className="mt-2 text-xs text-[#d9d0c3]">
            Optional assistance from our team, whenever you need it.
          </p>
          <ConnectLink
            href={href}
            className="mt-3 inline-flex text-sm text-[#f6ead0] underline decoration-[#c6a15b] underline-offset-4"
          />
        </div>
      </div>
    </aside>
  );
}
