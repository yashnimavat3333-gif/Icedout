import TrustedReviews from "../components/TrustedReviews";
import React, { useEffect, useState } from "react";
import appwriteService from "../appwrite/config";
import {
  Container,
  // ProductCard
} from "../components";
import ImageCarousel from "../components/ImageCarousel";
import ShopByCategory from "../components/ShopByCategory";
import MostLovedWatches from "../components/MostLovedWatches";
import ProductsByCategory from "./ProductsByCategory";

function Home() {
  const [products, setProducts] = useState([]);

  // useEffect(() => {
  //   appwriteService.getPosts().then((response) => {
  //     if (response && response.documents) {
  //       setProducts(response.documents);
  //     }
  //   });
  // }, []);

  return (
    <div className="w-full min-h-screen bg-white">
  
      {/* Hero / Video */}
      <ImageCarousel />
  
      {/* ⭐ Trusted Reviews (NEW) */}
      <TrustedReviews />
  
      {/* Categories */}
      <ShopByCategory />
  
      {/* Most Loved */}
      <MostLovedWatches />
  
    </div>
  );
}

export default Home;
