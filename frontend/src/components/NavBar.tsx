import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Menu, LogOut, UserRound, ShieldCheck } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
}

interface StoredUser {
  name?: string;
  email?: string;
  role?: {
    role_name?: string;
    name?: string;
  };
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "AD";

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();

  let user: StoredUser = {};

  try {
    const userString = localStorage.getItem("user");
    user = userString ? JSON.parse(userString) : {};
  } catch {
    user = {};
  }

  const displayName = user.name || user.email || "Administrator";
  const roleName = user.role?.role_name || user.role?.name || "Admin";
  const initials = getInitials(user.name || user.email || "Admin");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    toast.success("You have been logged out successfully.");
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="flex min-h-16 items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-7">
        {/* Left section */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            aria-controls="app-sidebar"
            aria-expanded={undefined}
            className="flex h-10 w-10 shrink-0 items-center justify-center
              rounded-xl border border-slate-200 bg-white text-slate-700
              shadow-sm transition hover:border-blue-200 hover:bg-blue-50
              hover:text-blue-700 focus:outline-none
              focus-visible:ring-2 focus-visible:ring-blue-500
              lg:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight text-slate-800 sm:text-lg">
              Admin Panel
            </h2>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
              Manage your C-HTM workspace
            </p>
          </div>
        </div>

        {/* Right section */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Full profile on larger screens */}
          <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-bold text-white shadow-sm sm:h-10 sm:w-10">
              {initials}
            </div>

            <div className="min-w-0">
              <p className="max-w-32 truncate text-sm font-semibold text-slate-800 md:max-w-48">
                {displayName}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs capitalize text-slate-500">
                <ShieldCheck size={12} className="shrink-0 text-blue-600" />
                <span className="truncate">{roleName}</span>
              </p>
            </div>
          </div>

          {/* Compact profile on very small screens */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
              bg-gradient-to-br from-blue-600 to-indigo-700
              text-xs font-bold text-white shadow-sm sm:hidden"
            aria-label={`Signed in as ${displayName}`}
            title={displayName}
          >
            {initials}
          </div>

          <div className="hidden h-9 w-px bg-slate-200 sm:block" />

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2
              rounded-xl border border-red-100 bg-red-50 px-2.5
              text-sm font-semibold text-red-600 transition
              hover:border-red-200 hover:bg-red-100 hover:text-red-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400
              active:scale-[0.98] sm:px-3.5"
          >
            <LogOut size={17} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* User information strip on mobile */}
      <div className="flex min-w-0 items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 sm:hidden">
        <UserRound size={13} className="shrink-0 text-slate-500" />

        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
          {displayName}
        </span>

        <span className="max-w-24 shrink-0 truncate rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-blue-700">
          {roleName}
        </span>
      </div>
    </header>
  );
}
