import { NavLink } from "react-router-dom";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const menuGroups = [
    {
      title: "Main Menu",
      menus: [
        {
          name: "Dashboard",
          path: "/superadmin/dashboard",
          icon: "🏠",
        },
      ],
    },
    {
      title: "User Management",
      menus: [
        {
          name: "Users",
          path: "/superadmin/users",
          icon: "👥",
        },
        {
          name: "Roles & Permissions",
          path: "/superadmin/roles",
          icon: "🔐",
        },
        {
          name: "Settings",
          path: "/superadmin/settings",
          icon: "⚙️",
        },
      ],
    },
    {
      title: "Member Management",
      menus: [
        {
          name: "Members",
          path: "/superadmin/members",
          icon: "🧑",
        },
        {
          name: "Non-Members",
          path: "/superadmin/nonmembers",
          icon: "👤",
        },
      ],
    },
    {
      title: "Financial Management",
      menus: [
        {
          name: "Deposits",
          path: "/superadmin/deposits",
          icon: "💰",
        },
        {
          name: "Loans",
          path: "/superadmin/loans",
          icon: "💳",
        },
        {
          name: "Loan Payments",
          path: "/superadmin/loanpayments",
          icon: "🧾",
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col
          bg-blue-950 text-white shadow-xl
          transition-transform duration-300
          md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo */}
        <div className="border-b border-white/10 px-6 py-6">
          <h1 className="text-2xl font-bold tracking-wide">C-HTM</h1>
          <p className="mt-1 text-xs text-blue-200">Management System</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto p-4">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-blue-300">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.menus.map((menu) => (
                  <NavLink
                    key={menu.path}
                    to={menu.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                        isActive
                          ? "bg-blue-800 font-semibold text-white shadow-sm"
                          : "text-blue-100 hover:bg-blue-900 hover:text-white"
                      }`
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="w-5 text-center text-base"
                    >
                      {menu.icon}
                    </span>

                    <span>{menu.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <p className="text-xs text-blue-300">Current module</p>
          <p className="mt-1 font-medium">Administrator</p>
        </div>
      </aside>
    </>
  );
}
