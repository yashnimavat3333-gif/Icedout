import React from "react";

// Primary WhatsApp configuration
const WHATSAPP_PHONE = "+918850840154";
const WHATSAPP_MESSAGE =
  "Hi Iceyout, I’m interested in your jewelry. I saw your website and want the 10% offer.";

// Normalize phone for wa.me (digits only) while keeping source readable
const WHATSAPP_PHONE_DIGITS = WHATSAPP_PHONE.replace(/[^\d]/g, "");
const WHATSAPP_ENCODED_MESSAGE = encodeURIComponent(WHATSAPP_MESSAGE);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE_DIGITS}?text=${WHATSAPP_ENCODED_MESSAGE}`;

function WhatsAppFloatingButton() {
  return (
    <>
      {/* Scoped, component-local styles (no global impact) */}
      <style>
        {`
          .iceyout-whatsapp-button {
            position: fixed;
            right: 18px;
            bottom: 28px;
            z-index: 50;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
            max-width: 260px;
            padding: 0.4rem 0.9rem;
            border-radius: 999px;
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.25);
            color: #ffffff;
            opacity: 0.9;
            box-shadow: 0 10px 22px rgba(15, 23, 42, 0.45);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
            cursor: pointer;
            text-decoration: none;
            -webkit-tap-highlight-color: transparent;
            contain: layout style paint;
            animation: iceyout-whatsapp-pulse 8s ease-out infinite;
            transform: translateZ(0);
          }

          .iceyout-whatsapp-button:hover,
          .iceyout-whatsapp-button:focus-visible {
            opacity: 1;
            box-shadow: 0 14px 30px rgba(15, 23, 42, 0.55);
            transform: translate3d(0, -2px, 0);
          }

          .iceyout-whatsapp-content {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            text-align: right;
          }

          .iceyout-whatsapp-line1 {
            font-weight: 700;
            font-size: 0.9rem;
            letter-spacing: 0.04em; /* slight tracking for premium feel */
            color: #ffffff;
          }

          .iceyout-whatsapp-line2 {
            font-weight: 600;
            font-size: 0.75rem;
            color: rgba(249, 250, 251, 0.9);
            white-space: nowrap;
          }

          @keyframes iceyout-whatsapp-pulse {
            0%, 88% {
              opacity: 0.9;
              box-shadow: 0 10px 22px rgba(15, 23, 42, 0.45);
            }
            92% {
              opacity: 1;
              box-shadow: 0 14px 30px rgba(15, 23, 42, 0.6);
            }
            100% {
              opacity: 0.9;
              box-shadow: 0 10px 22px rgba(15, 23, 42, 0.45);
            }
          }

          @media (max-width: 768px) {
            .iceyout-whatsapp-button {
              bottom: 90px; /* keep clear of mobile CTAs and product CTAs */
              right: 16px;
              max-width: 260px;
              padding: 0.35rem 0.85rem;
            }

            .iceyout-whatsapp-line2 {
              white-space: normal;
            }
          }
        `}
      </style>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp – Get 10% OFF Today"
        className="iceyout-whatsapp-button"
      >
        <div className="iceyout-whatsapp-content">
          <span className="iceyout-whatsapp-line1">Chat on WhatsApp</span>
          <span className="iceyout-whatsapp-line2">
            Founder Access · 10% OFF Today
          </span>
        </div>
      </a>
    </>
  );
}

export default WhatsAppFloatingButton;
