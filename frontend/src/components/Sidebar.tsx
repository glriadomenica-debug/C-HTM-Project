import { NavLink } from "react-router-dom";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const menus = [
    { name: "Dashboard", path: "/superadmin/dashboard", icon: "🏠" },
    { name: "Users", path: "/superadmin/users", icon: "👥" },
    { name: "Roles & Permissions", path: "/superadmin/roles", icon: "🔐" },
    { name: "Settings", path: "/superadmin/settings", icon: "⚙️" },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col
        bg-blue-950 text-white transition-transform duration-300
        md:translate-x-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      {/* Logo */}
      <div className="border-b border-white/10 px-6 py-6">
        <h1 className="text-2xl font-bold">C-HTM</h1>
        <p className="mt-1 text-xs text-blue-200">Management System</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-blue-300">
          Main Menu
        </p>

        {menus.map((menu) => (
          <NavLink
            key={menu.path}
            to={menu.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                isActive
                  ? "bg-blue-800 font-semibold text-white"
                  : "text-blue-100 hover:bg-blue-900"
              }`
            }
          >
            <span aria-hidden="true">{menu.icon}</span>
            <span>{menu.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-4">
        <p className="text-xs text-blue-300">Current module</p>
        <p className="mt-1 font-medium">Administrator</p>
      </div>
    </aside>
  );
}
