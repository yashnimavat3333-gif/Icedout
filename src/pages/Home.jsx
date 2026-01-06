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
      {/* Hero/Carousel */}
      <ImageCarousel />
      <ShopByCategory />
      <MostLovedWatches />
      {/* <ProductsByCategory /> */}
      {/* <ProductList /> */}
      {/* <Container> */}
      {/* {products.length === 0 ? (
          <div className="text-center mt-10">
            <h1 className="text-2xl font-semibold text-gray-600">
              No products available. Please check back later.
            </h1>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
              Featured Watches
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.$id} {...product} />
              ))}
            </div>
          </>
        )} */}

      {/* </Container> */}
    </div>
  );
}

export default Home;
