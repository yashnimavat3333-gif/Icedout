import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import "./App.css";
import authService from "./appwrite/auth";
import { login, logout } from "./store/authSlice";
import { Footer, Header } from "./components";
import { Outlet } from "react-router-dom";
// ReactLenis disabled to prevent performance issues and periodic freezes

function App() {
  // Keep a lightweight auth loading state, but don't block initial UI render
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  // ✅ Handle login/logout with timeout and error handling
  useEffect(() => {
    let mounted = true;
    let timeoutId;

    // Set a maximum timeout to prevent indefinite loading
    timeoutId = setTimeout(() => {
      if (mounted) {
        if (import.meta.env.DEV) {
          console.warn("Auth check timeout - proceeding without user data");
        }
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
        if (import.meta.env.DEV) {
          console.error("Auth check failed:", error);
        }
        // Continue without user data - don't block the app
        dispatch(logout());
        setLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [dispatch]);

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
