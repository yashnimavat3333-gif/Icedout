import React, { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import "./App.css";
import authService from "./appwrite/auth";
import { login, logout } from "./store/authSlice";
import { Footer, Header } from "./components";
import { Outlet } from "react-router-dom";
import { ReactLenis } from "lenis/react";
import gsap from "gsap";

function App() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const lenisRef = useRef();

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

  // ✅ Handle login/logout
  useEffect(() => {
    authService
      .getCurrentUser()
      .then((userData) => {
        if (userData) dispatch(login({ userData }));
        else dispatch(logout());
      })
      .finally(() => setLoading(false));
  }, []);

  // ✅ Smooth layout
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <ReactLenis
      root
      // ref={lenisRef}
      // options={{ duration: 1.2, smoothTouch: true }}
    >
      <div className="min-h-screen flex flex-col justify-between">
        <Header />
        <main className="bg-white min-h-screen">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ReactLenis>
  );
}

export default App;
