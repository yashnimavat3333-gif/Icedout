// components/Loader.jsx
import React from "react";

const SpinnerLoader = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="w-24 h-24 border-4 border-teal-600 border-t-transparent rounded-full animate-spin">
        <div className="flex items-center justify-center h-full">
          <span className="text-xs font-semibold text-teal-600">Icey Out</span>
        </div>
      </div>
    </div>
  );
};

export default SpinnerLoader;
