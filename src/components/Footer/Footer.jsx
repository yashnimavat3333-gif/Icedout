import React from "react";
import { Link } from "react-router-dom";
import { FaTwitter, FaFacebookF, FaInstagram } from "react-icons/fa";

function Footer() {
  return (
    <footer className="bg-black  bottom-0 text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company description */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-light mb-4">Icey Out</h3>
            <p className="text-gray-400 mb-4">
              We also specialize in{" "}
              <span className="font-medium">
                iced-out custom jewelry watches
              </span>
              , where precision meets personalization—each timepiece reimagined
              to reflect bold elegance and your unique identity.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://www.instagram.com/iceyoutnyc?utm_source=ig_web_button_share_sheet&igsh=dTI2eGRldm8xZnRl"
                className="text-gray-400 hover:text-white transition"
              >
                <FaInstagram size={18} />
              </a>
            </div>
          </div>

          {/* Navigation links */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider mb-4">
              Navigation
            </h3>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link to="/" className="hover:text-white transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-white transition">
                  Shop
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider mb-4">
              Information
            </h3>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link to="/privacy" className="hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
          <p>©2025. Icey Out. All Rights Reserved. Designed By Greens Media</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
