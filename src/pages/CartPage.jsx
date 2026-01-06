import React, { useEffect } from "react";
import { useCart } from "../context/CartContext";
import { Trash2 } from "react-feather";
import { Link, useNavigate } from "react-router-dom";

const CartPage = () => {
  const { cart, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  console.log(cart);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [cart]);

  const handleBuyNow = (item) => {
    // Optionally add form prefill data
    const prefill = {
      fullName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      zipCode: "",
      country: "",
    };

    navigate("/checkout", { state: { buyNow: true, item, prefill } });
  };

  if (cart.length === 0)
    return (
      <div className="min-h-screen flex flex-col justify-center items-center">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Your Cart is Empty
        </h2>
        <Link
          to="/"
          className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition"
        >
          Go Shopping
        </Link>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-light mb-8 text-gray-800">Shopping Cart</h1>
      <div className="space-y-6">
        {cart.map((item) => (
          <div
            key={item.$id ?? item.id}
            className="flex items-center justify-between border-b pb-4"
          >
            <div className="flex items-center gap-4">
              <img
                src={
                  item.processedImages?.[0] ||
                  item.image ||
                  "/placeholder-product.jpg"
                }
                alt={item.name}
                className="w-20 h-20 object-cover rounded-md"
              />
              <div>
                <h2 className="text-lg font-medium">{item.name}</h2>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                <p className="text-sm text-gray-500">${item.price}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Remove */}
              <button
                onClick={() => removeFromCart(item.$id ?? item.id)}
                className="text-red-500 hover:text-red-700"
                title="Remove"
              >
                <Trash2 />
              </button>

              {/* Buy Now */}
              <button
                onClick={() => handleBuyNow(item)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                title="Buy now"
              >
                Buy Now
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between items-center border-t pt-4">
        <div>
          <p className="text-lg text-gray-800 font-medium">
            Total: ${totalPrice.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={clearCart}
            className="px-4 py-2 border text-gray-700 rounded hover:bg-gray-50"
          >
            Clear Cart
          </button>

          {/* Link to checkout: cart data comes from CartContext */}
          <Link
            to="/checkout"
            className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
