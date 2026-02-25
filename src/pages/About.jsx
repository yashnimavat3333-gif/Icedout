import React from "react";

const SectionHeading = ({ children }) => (
  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
    {children}
  </h2>
);

const About = () => {
  return (
    <div className="w-full bg-white text-gray-800 py-20 px-4 sm:px-8">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 tracking-tight text-center">
          About Icey Out
        </h1>

        {/* Section 1 */}
        <section className="mb-16">
          <p className="text-xl sm:text-2xl font-medium text-gray-900 mb-6 leading-relaxed">
            Luxury isn't just worn — it's crafted.
          </p>
          <p className="text-lg leading-relaxed text-gray-700 mb-5">
            Icey Out was built on one simple belief: premium jewelry should
            command presence, precision, and power. We are not just an online
            store — we are a manufacturer of high-quality jewelry pieces
            supplied to various retail partners across the United States.
          </p>
          <p className="text-lg leading-relaxed text-gray-700">
            Behind every piece is a team of skilled craftsmen, designers, and
            quality specialists dedicated to producing bold, statement-making
            jewelry that meets the highest standards.
          </p>
        </section>

        {/* Section 2 */}
        <section className="mb-16">
          <SectionHeading>From Manufacturing to Market</SectionHeading>
          <p className="text-lg leading-relaxed text-gray-700 mb-5">
            Unlike many online brands, Icey Out works directly from production.
          </p>
          <p className="text-lg leading-relaxed text-gray-700 mb-6">
            We manufacture high-quality jewelry and iced-out designs supplied to
            select retail stores throughout the USA — particularly in key
            fashion-forward markets.
          </p>
          <p className="text-lg leading-relaxed text-gray-700 mb-4">
            By operating at the manufacturing level, we are able to:
          </p>
          <ul className="space-y-3 mb-6 pl-1">
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Maintain strict quality control
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Use premium-grade materials
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Ensure precise stone setting and finishing
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Offer competitive pricing without compromising luxury
            </li>
          </ul>
          <p className="text-lg leading-relaxed text-gray-700">
            This direct structure allows us to deliver retail-level quality
            directly to our customers online.
          </p>
        </section>

        {/* Section 3 */}
        <section className="mb-16">
          <SectionHeading>Designed for Confidence</SectionHeading>
          <p className="text-lg leading-relaxed text-gray-700 mb-6">
            Our collections are inspired by modern luxury culture — bold
            watches, iced-out statement pieces, and refined jewelry that
            elevates everyday presence.
          </p>
          <p className="text-lg leading-relaxed text-gray-700 mb-4">
            Each design goes through:
          </p>
          <ul className="space-y-3 mb-6 pl-1">
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Precision setting
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Structural reinforcement
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Quality inspection
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Final polishing and finishing
            </li>
          </ul>
          <p className="text-lg leading-relaxed text-gray-700">
            Every piece is made to look exceptional and built to last.
          </p>
        </section>

        {/* Section 4 */}
        <section className="mb-16">
          <SectionHeading>Trusted by Retailers. Chosen by Customers.</SectionHeading>
          <p className="text-lg leading-relaxed text-gray-700 mb-5">
            Our manufacturing network supplies independent stores across the
            United States. That experience gives us insight into what customers
            truly expect: quality, consistency, and reliability.
          </p>
          <p className="text-lg leading-relaxed text-gray-700">
            When you order from Icey Out, you're receiving a product crafted
            with the same standards as pieces sold in physical retail jewelry
            environments.
          </p>
        </section>

        {/* Section 5 */}
        <section className="mb-16">
          <SectionHeading>Secure and Reliable Shopping</SectionHeading>
          <p className="text-lg leading-relaxed text-gray-700 mb-4">
            We offer:
          </p>
          <ul className="space-y-3 mb-6 pl-1">
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Secure checkout
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              International shipping
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Responsive customer support
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Careful packaging
            </li>
            <li className="flex items-start gap-3 text-lg text-gray-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
              Quality assurance standards
            </li>
          </ul>
          <p className="text-lg leading-relaxed text-gray-700">
            Your confidence in every purchase is our priority.
          </p>
        </section>

        {/* Mission */}
        <section>
          <SectionHeading>Our Mission</SectionHeading>
          <p className="text-lg leading-relaxed text-gray-700 mb-5">
            To deliver bold, high-quality jewelry that blends craftsmanship
            with modern luxury — while giving customers direct access to
            manufacturer-level standards.
          </p>
          <p className="text-lg leading-relaxed text-gray-700">
            Icey Out exists for those who understand that jewelry is not just
            an accessory — it's identity.
          </p>
        </section>
      </div>
    </div>
  );
};

export default About;
