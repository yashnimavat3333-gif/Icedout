import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate("/");
    }, 3000); // 3 seconds

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 text-center px-4">
      <div>
        <h1 className="text-6xl font-bold text-teal-600 mb-4">404</h1>
        <p className="text-2xl font-semibold mb-2">Page Not Found</p>
        <p className="text-gray-600 mb-6">
          Redirecting to the homepage in 3 seconds...
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition"
        >
          Go Home Now
        </button>
      </div>
    </div>
  );
};

export default NotFound;
