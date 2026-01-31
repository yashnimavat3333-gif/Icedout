import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { Provider } from "react-redux";
import store from "./store/store.js";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { CartProvider } from "./context/CartContext.jsx";
import { loadGtag } from "./lib/analytics.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Lazy load all routes for code splitting - reduces initial bundle size
const Home = lazy(() => import("./pages/Home.jsx"));
const AddPost = lazy(() => import("./pages/AddPost"));
const Signup = lazy(() => import("./pages/Signup"));
const EditPost = lazy(() => import("./pages/EditPost"));
const Post = lazy(() => import("./pages/Post"));
const AllPosts = lazy(() => import("./pages/AllPosts"));
const ProductDetail = lazy(() => import("./components/products/ProductDetail.jsx"));
const ProductForm = lazy(() => import("./components/form/ProductForm.jsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.jsx"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage.jsx"));
const ProductList = lazy(() => import("./components/products/ProductList.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const CartPage = lazy(() => import("./pages/CartPage.jsx"));
const SearchResults = lazy(() => import("./components/SearchResults.jsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.jsx"));
const CreateCategoryForm = lazy(() => import("./pages/CreateCategoryForm.jsx"));
const AdminProductPanel = lazy(() => import("./components/Admin/AdminProductPanel.jsx"));
const EditProduct = lazy(() => import("./pages/EditProduct.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const CheckoutPage = lazy(() => import("./pages/Checkout.jsx"));
const ProfilePage = lazy(() => import("./pages/Profile.jsx"));
const OrderDetail = lazy(() => import("./pages/OrderDetail.jsx"));
const AdminOrders = lazy(() => import("./pages/AdminOrders.jsx"));
const AdminReviewPanel = lazy(() => import("./pages/AdminReviews.jsx"));

// Import AuthLayout and Login normally (they're small and used frequently)
import { AuthLayout, Login } from "./components/index.js";

// Loading fallback component
const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="animate-pulse text-center">
      <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4"></div>
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <Home />
          </Suspense>
        ),
      },
      {
        path: "/login",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AuthLayout authentication={false}>
              <Login />
            </AuthLayout>
          </Suspense>
        ),
      },
      {
        path: "/signup",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AuthLayout authentication={false}>
              <Signup />
            </AuthLayout>
          </Suspense>
        ),
      },
      {
        path: "/all-posts",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AuthLayout authentication>
              <AllPosts />
            </AuthLayout>
          </Suspense>
        ),
      },
      {
        path: "/add-post",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AuthLayout authentication>
              <AddPost />
            </AuthLayout>
          </Suspense>
        ),
      },
      {
        path: "/post/:slug",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <Post />
          </Suspense>
        ),
      },
      {
        path: "/add-product",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <ProductForm />
          </Suspense>
        ),
      },
      {
        path: "/product/:id",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <ProductDetail />
          </Suspense>
        ),
      },
      {
        path: "/edit-post/:slug",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AuthLayout authentication>
              <EditPost />
            </AuthLayout>
          </Suspense>
        ),
      },
      {
        path: "/categories",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <CategoriesPage />
          </Suspense>
        ),
      },
      {
        path: "/category/:categoryName",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <CategoryPage />
          </Suspense>
        ),
      },
      {
        path: "/shop",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <ProductList />
          </Suspense>
        ),
      },
      {
        path: "/collections",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <CategoriesPage />
          </Suspense>
        ),
      },
      {
        path: "/about",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <About />
          </Suspense>
        ),
      },
      {
        path: "/contact",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <Contact />
          </Suspense>
        ),
      },
      {
        path: "/cart",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <CartPage />
          </Suspense>
        ),
      },
      {
        path: "/search",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <SearchResults />
          </Suspense>
        ),
      },
      {
        path: "/privacy",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      {
        path: "/add-category",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <CreateCategoryForm />
          </Suspense>
        ),
      },
      {
        path: "/admin",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AdminProductPanel />
          </Suspense>
        ),
      },
      {
        path: "/edit/:id",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <EditProduct />
          </Suspense>
        ),
      },
      {
        path: "/checkout",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <CheckoutPage />
          </Suspense>
        ),
      },
      {
        path: "/profile",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <ProfilePage />
          </Suspense>
        ),
      },
      {
        path: "/order/:id",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <OrderDetail />
          </Suspense>
        ),
      },
      {
        path: "/admin-orders",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AdminOrders />
          </Suspense>
        ),
      },
      {
        path: "/admin-reviews",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AdminReviewPanel />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <NotFound />
          </Suspense>
        ),
      },
    ],
  },
]);

// Load analytics in a non-blocking way after first interaction (mobile-safe)
if (typeof window !== "undefined" && typeof document !== "undefined") {
  try {
    let analyticsLoaded = false;

    const loadAnalyticsOnce = () => {
      if (analyticsLoaded) return;
      analyticsLoaded = true;
      try {
        loadGtag();
      } catch (error) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.warn("Failed to load analytics:", error);
        }
      }
    };

    // Defer until first interaction or 5s timeout
    ["click", "touchstart", "scroll", "keydown"].forEach((evt) => {
      document.addEventListener(evt, loadAnalyticsOnce, {
        passive: true,
        once: true,
      });
    });

    setTimeout(() => {
      loadAnalyticsOnce();
    }, 5000);
  } catch (e) {
    // Only log in development
    if (import.meta.env.DEV) {
      console.warn("Analytics init skipped:", e);
    }
  }
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
