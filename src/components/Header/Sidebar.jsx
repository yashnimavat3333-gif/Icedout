import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../../store/authSlice"; // Adjust path if needed

const Sidebar = ({ onClose }) => {
  const links = [
    "ALL WATCHES",
    "MEN",
    "WOMEN",
    "SMART",
    "BRANDS",
    "STORES",
    "OFFERS",
    "CORPORATE SALE",
  ];

  const authStatus = useSelector((state) => state.auth.status);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
    onClose();
  };

  const handleLogin = () => {
    navigate("/login");
    onClose();
  };

  const handleMenuClick = (slug) => {
    navigate(slug);
    onClose();
  };

  return (
    <div className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg z-50 p-6">
      {/* Close Button */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onClose} className="text-xl font-bold">
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex justify-between border-b pb-2 mb-4">
        <span className="text-teal-600 font-semibold border-b-2 border-teal-500">
          MENU
        </span>
        <span className="text-gray-700 font-medium">ACCOUNT</span>
      </div>

      {/* MENU Section */}
      <ul className="space-y-3 mb-6">
        {links.map((link) => (
          <li
            key={link}
            className="text-sm text-gray-800 border-b py-1 cursor-pointer hover:text-teal-600"
            onClick={() =>
              handleMenuClick("/" + link.toLowerCase().replace(/\s+/g, "-"))
            }
          >
            {link}
          </li>
        ))}
      </ul>

      {/* ACCOUNT Section */}
      <div className="border-t pt-4">
        <ul className="space-y-2">
          {authStatus ? (
            <li
              onClick={handleLogout}
              className="text-sm text-gray-800 cursor-pointer hover:text-red-600"
            >
              LOGOUT
            </li>
          ) : (
            <>
              <li
                onClick={handleLogin}
                className="text-sm text-gray-800 cursor-pointer hover:text-teal-600"
              >
                LOGIN
              </li>
              <li
                onClick={() => {
                  navigate("/signup");
                  onClose();
                }}
                className="text-sm text-gray-800 cursor-pointer hover:text-teal-600"
              >
                SIGNUP
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
