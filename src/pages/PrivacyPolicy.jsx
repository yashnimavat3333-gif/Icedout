import React from "react";

const PrivacyPolicy = () => {
  return (
    <div className="bg-white text-gray-800 px-4 py-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-teal-700 mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Last Updated: 20-05-25. This Privacy Policy outlines how IceYout.com
            collects, uses, and protects your information in accordance with
            U.S. and U.K. laws.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10 text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              1. Information We Collect
            </h2>
            <p>
              <strong>a. Information You Provide:</strong>
              <br />
              - Name
              <br />
              - Email address
              <br />
              - Shipping/billing address
              <br />
              - Phone number
              <br />
              - Payment details (processed securely via third-party processors)
              <br />- Account credentials (if you create an account)
            </p>
            <p className="mt-4">
              <strong>b. Information Automatically Collected:</strong>
              <br />
              - IP address
              <br />
              - Browser type
              <br />
              - Device identifiers
              <br />- Cookies and tracking data (see “Cookies” below)
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              2. How We Use Your Information
            </h2>
            <p>
              We use your personal information to:
              <ul className="list-disc ml-6 mt-2">
                <li>Process and fulfill orders</li>
                <li>Send order confirmations and updates</li>
                <li>Provide customer service</li>
                <li>Improve our website and services</li>
                <li>Send marketing communications (you can opt-out anytime)</li>
                <li>Comply with legal obligations</li>
              </ul>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              3. Sharing Your Information
            </h2>
            <p>
              We do <strong>not</strong> sell your personal data. We may share
              it with:
              <ul className="list-disc ml-6 mt-2">
                <li>
                  Service providers (e.g., payment processors, shipping
                  companies)
                </li>
                <li>Legal authorities, if required to comply with law</li>
                <li>
                  Marketing platforms (like Google/Facebook, only with your
                  consent)
                </li>
              </ul>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              4. Cookies & Tracking Technologies
            </h2>
            <p>
              We use cookies to:
              <ul className="list-disc ml-6 mt-2">
                <li>Keep you logged in</li>
                <li>Remember your cart</li>
                <li>Understand site usage and improve performance</li>
              </ul>
              You can disable cookies in your browser settings, but some
              features may be limited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              5. Your Rights (UK & EU Residents)
            </h2>
            <p>
              Under the UK GDPR, you have the right to:
              <ul className="list-disc ml-6 mt-2">
                <li>Access your data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion</li>
                <li>Object to processing</li>
                <li>Request data portability</li>
              </ul>
              Contact us at{" "}
              <a
                href="mailto:alechsantoki@gmail.com"
                className="text-teal-600 underline"
              >
                alechsantoki@gmail.com
              </a>{" "}
              to exercise your rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              6. California Privacy Rights (CCPA)
            </h2>
            <p>
              If you're a California resident, you may request:
              <ul className="list-disc ml-6 mt-2">
                <li>A list of personal data we’ve collected about you</li>
                <li>The categories of third parties we shared it with</li>
                <li>Deletion of your personal data</li>
                <li>
                  To opt out of the “sale” of personal data (we don’t sell your
                  data)
                </li>
              </ul>
              Requests can be made via{" "}
              <a
                href="mailto:alechsantoki@gmail.com"
                className="text-teal-600 underline"
              >
                alechsantoki@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              7. Data Retention
            </h2>
            <p>
              We retain your data as long as needed to provide services and meet
              legal obligations. You may request deletion anytime.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              8. Security
            </h2>
            <p>
              We use SSL/TLS encryption and other secure protocols to safeguard
              your data. While no system is 100% secure, we follow best
              practices to minimize risks.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              9. Children’s Privacy
            </h2>
            <p>
              Our services are not intended for children under 13 (US) or under
              16 (UK). We do not knowingly collect information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              10. International Data Transfers
            </h2>
            <p>
              If you reside in the UK or EU, your data may be transferred to the
              U.S. We ensure such transfers comply with GDPR requirements for
              data protection.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy occasionally. Any revisions will
              be posted here with the latest "Last Updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-teal-600 mb-2">
              12. Contact Us
            </h2>
            <p>
              For privacy-related concerns, please contact us at:
              <br />
              📧{" "}
              <a
                href="mailto:alechsantoki@gmail.com"
                className="text-teal-600 underline"
              >
                alechsantoki@gmail.com
              </a>
              <br />
              🌐{" "}
              <a
                href="https://www.iceyout.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 underline"
              >
                www.iceyout.com
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} IceYout.com. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
