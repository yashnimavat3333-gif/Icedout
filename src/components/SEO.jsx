import { useEffect } from "react";

const SEO = ({
  title = "Iceyout | Premium Luxury Watches & Timepieces",
  description = "Discover exquisite premium watches from Iceyout. Luxury timepieces crafted with precision, featuring Swiss movements, premium materials, and timeless design.",
  canonical,
  image = "https://iceyout.com/images/og-image.jpg",
  type = "website",
  publishedTime,
  modifiedTime,
  author,
  tags = ["luxury watches", "premium watches", "Swiss watches"],
  schema = {},
}) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta tags
    const updateMetaTag = (name, content) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    const updatePropertyTag = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    // Update description
    updateMetaTag("description", description);

    // Update keywords
    updateMetaTag("keywords", tags.join(", "));

    // Update Open Graph
    updatePropertyTag("og:title", title);
    updatePropertyTag("og:description", description);
    updatePropertyTag("og:image", image);
    updatePropertyTag("og:type", type);
    updatePropertyTag("og:url", window.location.href);

    // Update Twitter
    updatePropertyTag("twitter:title", title);
    updatePropertyTag("twitter:description", description);
    updatePropertyTag("twitter:image", image);
    updateMetaTag("twitter:card", "summary_large_image");

    // Add canonical link
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    }

    // Add structured data
    const structuredData = {
      "@context": "https://schema.org",
      "@type": schema.type || "WebPage",
      name: title,
      description: description,
      url: canonical || window.location.href,
      ...schema,
    };

    // Remove existing structured data
    const existingScript = document.querySelector(
      'script[type="application/ld+json"]'
    );
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      if (script.parentNode === document.head) {
        document.head.removeChild(script);
      }
    };
  }, [title, description, canonical, image, type, tags, schema]);

  return null; // This component doesn't render anything
};

export default SEO;
