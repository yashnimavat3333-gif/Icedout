import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { Provider } from "react-redux";
import store from "./store/store.js";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { CartProvider } from "./context/CartContext.jsx";
import { AuthLayout, Login } from "./components/index.js";
import SpinnerLoader from "./components/SpinnerLoader.jsx";
import { loadGtag } from "./lib/analytics.js";

// Critical routes - eagerly loaded (core e-commerce functionality)
import Home from "./pages/Home.jsx";
import Signup from "./pages/Signup.jsx";
import ProductDetail from "./components/products/ProductDetail.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import ProductList from "./components/products/ProductList.jsx";
import CartPage from "./pages/CartPage.jsx";
import SearchResults from "./components/SearchBar.jsx";
import CheckoutPage from "./pages/Checkout.jsx";
import ProfilePage from "./pages/Profile.jsx";
import OrderDetail from "./pages/OrderDetail.jsx";
import ProductForm from "./components/form/ProductForm.jsx";

// Non-critical routes - lazy loaded (admin, static pages, blog)
const About = lazy(() => import("./pages/About.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const AdminProductPanel = lazy(() => import("./components/Admin/AdminProductPanel.jsx"));
const AdminOrders = lazy(() => import("./pages/AdminOrders.jsx"));
const AdminReviewPanel = lazy(() => import("./pages/AdminReviews.jsx"));
const EditProduct = lazy(() => import("./pages/EditProduct.jsx"));
const CreateCategoryForm = lazy(() => import("./pages/CreateCategoryForm.jsx"));
const AddPost = lazy(() => import("./pages/AddPost.jsx"));
const EditPost = lazy(() => import("./pages/EditPost.jsx"));
const Post = lazy(() => import("./pages/Post.jsx"));
const AllPosts = lazy(() => import("./pages/AllPosts.jsx"));

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
            <Suspense fallback={<SpinnerLoader />}>
              <AllPosts />
            </Suspense>
          </AuthLayout>
        ),
      },
      {
        path: "/add-post",
        element: (
          <AuthLayout authentication>
            <Suspense fallback={<SpinnerLoader />}>
              <AddPost />
            </Suspense>
          </AuthLayout>
        ),
      },
      {
        path: "/post/:slug",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <Post />
          </Suspense>
        ),
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
            <Suspense fallback={<SpinnerLoader />}>
              <EditPost />
            </Suspense>
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
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <About />
          </Suspense>
        ),
      },
      {
        path: "/contact",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <Contact />
          </Suspense>
        ),
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
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      {
        path: "/add-category",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <CreateCategoryForm />
          </Suspense>
        ),
      },
      {
        path: "/admin",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <AdminProductPanel />
          </Suspense>
        ),
      },
      {
        path: "/edit/:id",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <EditProduct />
          </Suspense>
        ),
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
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <AdminOrders />
          </Suspense>
        ),
      },
      {
        path: "/admin-reviews",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <AdminReviewPanel />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: (
          <Suspense fallback={<SpinnerLoader />}>
            <NotFound />
          </Suspense>
        ),
      },
    ],
  },
]);

loadGtag();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </Provider>
  </React.StrictMode>
);
