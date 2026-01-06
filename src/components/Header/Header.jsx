import { Menu, Search, ShoppingBag, User, X, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import authService from "../../appwrite/auth";
import conf from "../../conf/conf";
import { Client, Databases, Query } from "appwrite";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Refs
  const desktopSearchRef = useRef(null); // wraps the desktop overlay
  const mobileSearchRef = useRef(null); // wraps the mobile search bar
  const menuRef = useRef(null); // wraps the mobile menu panel

  const navigate = useNavigate();
  const DATABASE_ID = conf.appwriteDatabaseId;
  const COLLECTION_ID = conf.appwriteProductCollectionId;

  const colors = {
    darkGreen: "#0b2706",
    lightGreen: "#afd494",
    mediumGreen: "#1a893a",
    white: "#ffffff",
  };

  // Appwrite client (kept for search usage)
  const client = new Client();
  client.setEndpoint(conf.appwriteUrl).setProject(conf.appwriteProjectId);
  const databases = new Databases(client);

  // Fetch current user once
  useEffect(() => {
    let mounted = true;
    authService
      .getCurrentUser()
      .then((userData) => {
        if (!mounted) return;
        setUser(userData);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Close on outside click (robust)
  useEffect(() => {
    const onDocMouseDown = (e) => {
      // If search is open, close only when clicking outside BOTH search containers (desktop & mobile)
      if (isSearchOpen) {
        const inDesktop = desktopSearchRef.current?.contains(e.target);
        const inMobile = mobileSearchRef.current?.contains(e.target);
        if (!inDesktop && !inMobile) {
          setIsSearchOpen(false);
        }
      }

      // If mobile menu is open, close when clicking outside it
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSearchOpen, isMenuOpen]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [
          Query.or([
            Query.startsWith("name", q),
            Query.startsWith("categories", q),
            Query.startsWith("type", q),
          ]),
        ]
      );

      navigate(`/search?q=${encodeURIComponent(q)}`, {
        state: { results: response.documents },
      });
      setIsSearchOpen(false);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      // keep user on same page but you can also navigate to home/login if desired
      navigate("/");
    } catch (e) {
      console.error(e);
    }
  };

  // When clicking on the user area: go to /profile if logged in, otherwise /login
  const handleAccountClick = () => {
    if (user) navigate("/profile");
    else navigate("/login");
  };

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    { name: "Collections", path: "/collections" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
  ];

  // helper to extract first name safely
  const firstName = (u) => {
    if (!u) return null;
    const n = u.name || u.displayName || u.email || "";
    return n.split?.(" ")[0] || n;
  };

  return (
    <>
      <header
        className="w-full bg-white sticky top-0 z-50 border-b">
        <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '10px', fontWeight: 'bold' }}>
  FREE WORLDWIDE SHIPPING / EASY PAYPAL PAYMENT PLANS AVAILABLE
</div>
        
     
        {/* Desktop Header */}
        <div className="hidden lg:block">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between relative h-[84px]">
            <Link to="/" className="flex items-center group">
              <img
                src="https://fra.cloud.appwrite.io/v1/storage/buckets/6876009e002e889ffa51/files/687a764a0016b0c7a149/view?project=6875fd9e000f3ec8a910"
                className="h-[4.5rem]"
                alt="Logo"
              />
            </Link>

            <nav className="flex space-x-8">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="text-sm font-medium tracking-wide transition-colors duration-200"
                  style={({ isActive }) => ({
                    color: isActive ? colors.mediumGreen : colors.darkGreen,
                  })}
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center space-x-6">
              <button
                onClick={() => setIsSearchOpen((v) => !v)}
                aria-label="Open search"
                style={{ color: colors.darkGreen }}
                data-search-trigger
              >
                <Search className="w-5 h-5 hover:text-[#1a893a]" />
              </button>

              {/* Account area: show name and navigate to /profile when logged in */}
              {user ? (
                <div className="flex items-center space-x-3 text-sm font-medium">
                  <button
                    onClick={handleAccountClick}
                    title="My profile"
                    className="text-sm text-gray-800 hover:text-[#1a893a] flex items-center gap-2"
                    aria-label="Open profile"
                  >
                    <User className="w-5 h-5" />
                    <span style={{ color: colors.darkGreen }}>
                      Hi, {firstName(user)}
                    </span>
                  </button>

                  <button onClick={handleLogout} title="Logout">
                    <LogOut className="w-5 h-5 text-red-600 hover:text-red-800" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAccountClick}
                  aria-label="Account"
                  className="flex items-center"
                >
                  <User className="w-5 h-5 hover:text-[#1a893a]" />
                </button>
              )}

              <Link to="/cart" className="relative" aria-label="Cart">
                <ShoppingBag className="w-5 h-5 hover:text-[#1a893a]" />
              </Link>
            </div>

            {isSearchOpen && (
              <div
                className="absolute inset-0 w-full h-full bg-white flex items-center justify-center px-6 z-50"
                ref={desktopSearchRef}
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Search overlay"
              >
                <form
                  onSubmit={handleSearch}
                  className="w-full max-w-2xl relative"
                >
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full text-lg outline-none border-b py-3 pr-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-3"
                    style={{ color: colors.mediumGreen }}
                    aria-label="Submit search"
                  >
                    <Search className="w-6 h-6" />
                  </button>
                </form>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute right-6 top-6"
                  aria-label="Close search"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="lg:hidden">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
              <Link to="/">
                <img
                  src="https://fra.cloud.appwrite.io/v1/storage/buckets/6876009e002e889ffa51/files/687a764a0016b0c7a149/view?project=6875fd9e000f3ec8a910"
                  className="h-[3rem]"
                  alt="Logo"
                />
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSearchOpen((v) => !v)}
                aria-label="Open search"
              >
                <Search className="w-5 h-5" />
              </button>

              <Link to="/cart" className="relative" aria-label="Cart">
                <ShoppingBag className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {isSearchOpen && (
            <div
              className="absolute top-0 left-0 w-full bg-white shadow-md z-50 border-b"
              ref={mobileSearchRef}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Search bar"
            >
              <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <form
                  onSubmit={handleSearch}
                  className="flex-grow relative max-w-3xl"
                >
                  <input
                    type="text"
                    placeholder="Search for products..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-green-700"
                    aria-label="Submit search"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </form>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="ml-4 text-gray-600 hover:text-red-600"
                  title="Close Search"
                  aria-label="Close search"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {isMenuOpen && (
            <div
              className="bg-white px-4 py-6 border-t"
              ref={menuRef}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <nav className="flex flex-col space-y-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    style={({ isActive }) => ({
                      color: isActive ? colors.mediumGreen : colors.darkGreen,
                    })}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </NavLink>
                ))}
              </nav>

              <div
                className="mt-8 pt-6 border-t"
                style={{ borderColor: colors.lightGreen }}
              >
                {user ? (
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate("/profile");
                      }}
                      className="text-left text-sm font-medium"
                    >
                      Hi, {firstName(user)}
                    </button>

                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 text-red-600 hover:text-red-800 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/login");
                    }}
                    className="flex items-center space-x-2 text-sm"
                  >
                    <User className="w-5 h-5" />
                    <span>Account</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* WhatsApp Floating Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <a
          href="https://wa.me/+917700921541" // Your WhatsApp number
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 hover:bg-green-600 text-white rounded-full p-3 shadow-lg transition-all duration-300 flex items-center justify-center"
          style={{ width: "56px", height: "56px" }}
          aria-label="Chat on WhatsApp"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-6.29-3.63c.545 1.379 1.573 2.381 2.991 2.447l-.006.006z" />
            <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
        </a>
      </div>
    </>
  );
};

export default Header;
