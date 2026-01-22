import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { Provider } from "react-redux";
import store from "./store/store.js";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Home from "./pages/Home.jsx";
import { AuthLayout, Login } from "./components/index.js";

import AddPost from "./pages/AddPost";
import Signup from "./pages/Signup";
import EditPost from "./pages/EditPost";

import Post from "./pages/Post";

import AllPosts from "./pages/AllPosts";
import ProductDetail from "./components/products/ProductDetail.jsx";
import ProductForm from "./components/form/ProductForm.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import ProductList from "./components/products/ProductList.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import CartPage from "./pages/CartPage.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import SearchResults from "./components/SearchResults.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import CreateCategoryForm from "./pages/CreateCategoryForm.jsx";
import AdminProductPanel from "./components/Admin/AdminProductPanel.jsx";
import EditProduct from "./pages/EditProduct.jsx";
import NotFound from "./pages/NotFound.jsx";
import CheckoutPage from "./pages/Checkout.jsx";
import ProfilePage from "./pages/Profile.jsx";
import OrderDetail from "./pages/OrderDetail.jsx";
import AdminOrders from "./pages/AdminOrders.jsx";
import AdminReviewPanel from "./pages/AdminReviews.jsx";
import { loadGtag } from "./lib/analytics.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/login",
        element: (
          <AuthLayout authentication={false}>
            <Login />
          </AuthLayout>
        ),
      },
      {
        path: "/signup",
        element: (
          <AuthLayout authentication={false}>
            <Signup />
          </AuthLayout>
        ),
      },
      {
        path: "/all-posts",
        element: (
          <AuthLayout authentication>
            {" "}
            <AllPosts />
          </AuthLayout>
        ),
      },
      {
        path: "/add-post",
        element: (
          <AuthLayout authentication>
            {" "}
            <AddPost />
          </AuthLayout>
        ),
      },
      {
        path: "/post/:slug",
        element: <Post />,
      },
      {
        path: "/add-product",
        element: <ProductForm />,
      },
      {
        path: "/product/:id",
        element: <ProductDetail />,
      },

      {
        path: "/edit-post/:slug",
        element: (
          <AuthLayout authentication>
            {" "}
            <EditPost />
          </AuthLayout>
        ),
      },
      {
        path: "/categories",
        element: <CategoriesPage />,
      },
      {
        path: "/category/:categoryName",
        element: <CategoryPage />,
      },
      {
        path: "/shop",
        element: <ProductList />,
      },
      {
        path: "/collections",
        element: <CategoriesPage />,
      },
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/contact",
        element: <Contact />,
      },
      {
        path: "/cart",
        element: <CartPage />,
      },
      {
        path: "/search",
        element: <SearchResults />,
      },
      {
        path: "/privacy",
        element: <PrivacyPolicy />,
      },
      {
        path: "/add-category",
        element: <CreateCategoryForm />,
      },
      {
        path: "/admin",
        element: <AdminProductPanel />,
      },
      {
        path: "/edit/:id",
        element: <EditProduct />,
      },
      {
        path: "/checkout",
        element: <CheckoutPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/order/:id",
        element: <OrderDetail />,
      },
      {
        path: "/admin-orders",
        element: <AdminOrders />,
      },
      {
        path: "/admin-reviews",
        element: <AdminReviewPanel />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

// Load analytics asynchronously to prevent blocking
try {
  loadGtag();
} catch (error) {
  console.warn("Failed to load analytics:", error);
  // Continue anyway - analytics failure shouldn't block the app
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
