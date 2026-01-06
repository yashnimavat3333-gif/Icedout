// components/Loader.jsx
import { motion } from "framer-motion";

const SpinnerLoader = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <motion.div
        className="w-24 h-24 border-4 border-teal-600 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      >
        <div className="flex items-center justify-center h-full">
          <span className="text-xs font-semibold text-teal-600">Icey Out</span>
        </div>
      </motion.div>
    </div>
  );
};

export default SpinnerLoader;
