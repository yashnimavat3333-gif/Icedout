// pages/Contact.jsx
import React from "react";

const Contact = () => {
  return (
    <div className="w-full bg-white py-16 px-4 sm:px-8 md:px-16 text-gray-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Contact Us</h1>
        <p className="text-lg text-center mb-12">
          We'd love to hear from you. Whether you have a question about a
          product, an order, or anything else — our team is ready to help.
        </p>

        <form className="grid grid-cols-1 gap-6">
          <div>
            <label className="block mb-2 font-medium">Name</label>
            <input
              type="text"
              placeholder="Your name"
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block mb-2 font-medium">Message</label>
            <textarea
              rows="5"
              placeholder="Your message"
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            ></textarea>
          </div>
          <button
            type="submit"
            className="w-full bg-teal-600 text-white font-semibold py-3 rounded-lg hover:bg-teal-700 transition"
          >
            Send Message
          </button>
        </form>

        {/* <div className="mt-12 text-center">
          <p className="text-md">Email: support@yourbrand.com</p>
          <p className="text-md">Phone: +91 98765 43210</p>
          <p className="text-md">Location: Mumbai, India</p>
        </div> */}
      </div>
    </div>
  );
};

export default Contact;
