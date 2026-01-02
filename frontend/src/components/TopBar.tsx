import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, User } from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lastScroll, setLastScroll] = useState(0);

  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("");

  const location = useLocation();
  const navigate = useNavigate();

  /* ================= AUTH STATE ================= */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole("");
        return;
      }

      setUser(u);

      const snap = await get(ref(db, `users/${u.uid}`));
      if (snap.exists()) setRole(snap.val().role);
    });
  }, []);

  /* ================= SCROLL HIDE / SHOW ================= */
  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setVisible(current < lastScroll || current < 50);
      setLastScroll(current);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScroll]);

  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/services", label: "Services" },
    { to: "/contact", label: "Contact" }
  ];

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-transform duration-300
      ${visible ? "translate-y-0" : "-translate-y-full"}
      backdrop-blur-xl bg-white/80 dark:bg-[#0f172a]/80
      border-b border-gray-200 dark:border-gray-800`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* LOGO */}
        <Link
          to="/"
          className="text-xl font-bold tracking-wide text-teal-600 dark:text-teal-400"
        >
          GrowthOS
        </Link>

        {/* DESKTOP */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`font-medium transition-colors ${
                location.pathname === l.to
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-gray-700 dark:text-gray-300 hover:text-teal-500"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {/* ===== AUTH SWITCH ===== */}
          {!user ? (
            <Link
              to="/login"
              className="px-4 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white transition"
            >
              Login
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              {/* ROLE BADGE */}
              <span className="text-xs px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">
                {role}
              </span>

              {/* AVATAR */}
              <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white font-semibold">
                {user.email?.[0]?.toUpperCase()}
              </div>

              <button
                onClick={() =>
                  navigate(role === "HR" ? "/hr/dashboard" : "/employee/dashboard")
                }
                className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>

              <button
                onClick={logout}
                className="text-red-500 hover:text-red-600"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </nav>

        {/* MOBILE MENU BUTTON */}
        <button
          className="md:hidden text-gray-700 dark:text-gray-300"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-4 bg-white dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="font-medium text-gray-700 dark:text-gray-300"
            >
              {l.label}
            </Link>
          ))}

          {!user ? (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2 rounded-full bg-teal-600 text-white text-center"
            >
              Login
            </Link>
          ) : (
            <>
              <button
                onClick={() => {
                  setOpen(false);
                  navigate(role === "HR" ? "/hr/dashboard" : "/employee/dashboard");
                }}
                className="flex items-center gap-2 text-teal-600"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>

              <button
                onClick={logout}
                className="flex items-center gap-2 text-red-500"
              >
                <LogOut size={16} />
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
