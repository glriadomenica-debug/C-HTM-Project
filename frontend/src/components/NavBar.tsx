import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();

  const userString = localStorage.getItem("user");

  let user: {
    name?: string;
    email?: string;
    role?: { role_name?: string; name?: string };
  } = {};

  try {
    user = userString ? JSON.parse(userString) : {};
  } catch {
    user = {};
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    toast.success("Logout success");
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Tombol menu hanya pada mobile */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-xl text-gray-700 hover:bg-gray-100 md:hidden"
        >
          ☰
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-800 sm:text-lg">
            Admin Panel
          </h2>
          <p className="hidden text-xs text-gray-500 sm:block">
            Manage your application
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="hidden max-w-48 text-right sm:block">
          <p className="truncate text-sm font-semibold text-gray-800">
            {user.name || user.email || "Administrator"}
          </p>
          <p className="truncate text-xs capitalize text-gray-500">
            {user.role?.role_name || user.role?.name || "Admin"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-4"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
