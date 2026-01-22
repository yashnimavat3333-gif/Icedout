import React, { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import "./App.css";
import authService from "./appwrite/auth";
import { login, logout } from "./store/authSlice";
import { Footer, Header } from "./components";
import { Outlet } from "react-router-dom";
import { ReactLenis } from "lenis/react";

function App() {
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const dispatch = useDispatch();
  const lenisRef = useRef();

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // // ✅ Sync Lenis with GSAP properly
  // useEffect(() => {
  //   const raf = (time) => {
  //     lenisRef.current?.lenis?.raf(time);
  //   };
  //   gsap.ticker.add(raf);
  //   return () => gsap.ticker.remove(raf);
  // }, []);

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

  const content = (
    <div className="min-h-screen flex flex-col justify-between">
      <Header />
      <main className="bg-white min-h-screen">
        <Outlet />
      </main>
      <Footer />
    </div>
  );

  // Disable Lenis smooth scroll on mobile to prevent freezes on iPhones
  if (isMobile) {
    return content;
  }

  return (
    <ReactLenis
      root
      options={{ 
        duration: 1.2, 
        smoothTouch: false, // Disable on touch devices
        smoothWheel: true,
        wheelMultiplier: 0.8
      }}
    >
      {content}
    </ReactLenis>
  );
}

export default App;
