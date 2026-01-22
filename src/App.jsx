import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import "./App.css";
import authService from "./appwrite/auth";
import { login, logout } from "./store/authSlice";
import { Footer, Header } from "./components";
import { Outlet } from "react-router-dom";
// ReactLenis disabled to prevent performance issues and periodic freezes

function App() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();


  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [loading]);

  // ✅ Handle login/logout with timeout and error handling
  useEffect(() => {
    let mounted = true;
    let timeoutId;

    // Set a maximum timeout to prevent indefinite loading
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Auth check timeout - proceeding without user data");
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Attempt to get current user
    authService
      .getCurrentUser()
      .then((userData) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        if (userData) {
          dispatch(login({ userData }));
        } else {
          dispatch(logout());
        }
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        console.error("Auth check failed:", error);
        // Continue without user data - don't block the app
        dispatch(logout());
        setLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [dispatch]);

  // ✅ Smooth layout with better loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Completely disable ReactLenis to prevent periodic freezes
  // Smooth scroll libraries can cause performance issues, especially on mobile
  // Native browser scrolling is more performant and reliable
  return (
    <div className="min-h-screen flex flex-col justify-between">
      <Header />
      <main className="bg-white min-h-screen">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default App;
