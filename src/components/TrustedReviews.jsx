import React from "react";

function TrustedReviews() {
  return (
    <section style={{ background: "#ffffff", padding: "80px 20px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
        
        <h2 style={{ fontSize: "36px", fontWeight: "600", marginBottom: "12px" }}>
          Trusted by Customers Worldwide
        </h2>

        <p style={{ color: "#666", maxWidth: "640px", margin: "0 auto 50px" }}>
          Real feedback from verified customers who chose Iceyout for premium timepieces.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "30px",
          }}
        >
          <div style={cardStyle}>
            <div style={stars}>★★★★★</div>
            <p style={text}>
              “The craftsmanship is outstanding. The watch feels premium and looks even better in person.”
            </p>
            <strong>Michael Johnson, USA</strong>
          </div>

          <div style={cardStyle}>
            <div style={stars}>★★★★★</div>
            <p style={text}>
              “Solid build, clean design, and fast delivery. Definitely worth the price.”
            </p>
            <strong>Daniel Carter, USA</strong>
          </div>

          <div style={cardStyle}>
            <div style={stars}>★★★★★</div>
            <p style={text}>
              “Exactly as shown on the website. Smooth buying experience and great customer support.”
            </p>
            <strong>Ethan Williams, USA</strong>
          </div>
        </div>

        <div style={{ marginTop: "50px" }}>
          <a
            href="mailto:support@iceyout.com?subject=Customer Review"
            style={{
              display: "inline-block",
              padding: "14px 36px",
              borderRadius: "30px",
              background: "#000",
              color: "#fff",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Write a Review
          </a>
        </div>
      </div>
    </section>
  );
}

const cardStyle = {
  background: "#fafafa",
  padding: "32px",
  borderRadius: "16px",
  textAlign: "left",
};

const stars = {
  color: "#f5b301",
  fontSize: "18px",
};

const text = {
  margin: "18px 0",
  color: "#333",
  lineHeight: "1.6",
};

export default TrustedReviews;