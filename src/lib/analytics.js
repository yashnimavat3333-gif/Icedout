// src/lib/analytics.js
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";

/**
 * Simple consent check. Replace with your consent banner integration.
 * If you need to wait for user consent, set localStorage.setItem('ga_consent','granted')
 */
function hasConsent() {
    // allow analytics in non-production for debugging if needed
    if (import.meta.env.MODE !== "production") return true;
    return localStorage.getItem("ga_consent") === "granted";
}

export function loadGtag(measurementId = MEASUREMENT_ID) {
    if (!measurementId) return;
    if (typeof window === "undefined") return;
    if (window.gtag) return;

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    window.gtag('js', new Date());
    // disable automatic page_view — we'll send from React on route change
    window.gtag('config', measurementId, { send_page_view: false });
}

export function pageview(path, title) {
    if (!window.gtag || !hasConsent()) return;
    window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
    });
}

export function event(name, params = {}) {
    if (!window.gtag || !hasConsent()) return;
    window.gtag('event', name, params);
}

/* Helpful GA4 e-commerce / actions */
export function trackAddToCart({ id, name, price = 0, quantity = 1, category }) {
    event('add_to_cart', {
        currency: 'INR',
        value: Number(price) * Number(quantity),
        items: [{ item_id: id, item_name: name, price: Number(price), quantity: Number(quantity), item_category: category }]
    });
}

export function trackPurchase({ id, value = 0, currency = 'INR', items = [] }) {
    event('purchase', {
        transaction_id: id,
        value: Number(value),
        currency,
        items: items.map(it => ({ item_id: it.id, item_name: it.name, price: Number(it.price), quantity: Number(it.quantity || 1), item_category: it.category }))
    });
}

export function trackReviewSubmitted({ productId, rating, verified = false }) {
    event('submit_review', { product_id: productId, rating: Number(rating), verified: verified ? 1 : 0 });
}
