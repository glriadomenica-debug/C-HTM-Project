import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Settings,
  UserRound,
  UserRoundX,
  Wallet,
  CreditCard,
  ReceiptText,
  ArrowLeftRight,
  X,
  Building2,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuGroups = [
  {
    title: "Menu Prinsipal",
    menus: [
      {
        name: "Dashboard",
        path: "/manager/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Jestaun Membru",
    menus: [
      { name: "Members", path: "/manager/members", icon: UserRound },
      { name: "Non-Members", path: "/manager/nonmembers", icon: UserRoundX },
    ],
  },
  {
    title: "Jestaun Finanseira",
    menus: [
      { name: "Depositu", path: "/manager/deposits", icon: Wallet },
      { name: "Loans", path: "/manager/loans", icon: CreditCard },
      {
        name: "Emprestimu",
        path: "/manager/loanpayments",
        icon: ReceiptText,
      },
      {
        name: "Konta Transkasaun",
        path: "/manager/transactions",
        icon: ArrowLeftRight,
      },
    ],
  },
    {
    title: "Jestaun Utilizador",
    menus: [
      { name: "Utilizador", path: "/manager/users", icon: Users },
      {
        name: "Role",
        path: "/manager/roles",
        icon: ShieldCheck,
      },
      { name: "Settings", path: "/manager/settings", icon: Settings },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile/tablet backdrop */}
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        tabIndex={isOpen ? 0 : -1}
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px]
          transition-opacity duration-200 lg:hidden
          ${
            isOpen
              ? "visible opacity-100"
              : "invisible pointer-events-none opacity-0"
          }`}
      />

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex
          w-[min(272px,85vw)] flex-col overflow-hidden
          border-r border-white/10
          bg-gradient-to-b from-slate-950 via-blue-950 to-blue-950
          text-white shadow-xl transition-transform duration-300 ease-in-out
          lg:w-60 lg:translate-x-0 lg:shadow-none
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 ring-1 ring-blue-300/20">
              <Building2 size={21} className="text-blue-300" />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-5 tracking-wide">
                C-HTM
              </h1>
              <p className="mt-0.5 text-[11px] text-blue-200/75">
                Management System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
              text-blue-100 transition hover:bg-white/10 hover:text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300
              lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable navigation */}
        <nav
          aria-label="Sidebar navigation"
          className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto
            overscroll-contain px-2.5 py-3
            [scrollbar-width:thin]
            [scrollbar-color:rgba(147,197,253,0.35)_transparent]"
        >
          {menuGroups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-300/70 sm:text-[11px]">
                {group.title}
              </h2>

              <div className="space-y-0.5">
                {group.menus.map((menu) => {
                  const Icon = menu.icon;

                  return (
                    <NavLink
                      key={menu.path}
                      to={menu.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group relative flex min-h-9 items-center gap-2.5
                        rounded-lg px-2.5 py-1.5 text-[13px]
                        transition-colors duration-150
                        focus:outline-none focus-visible:ring-2
                        focus-visible:ring-inset focus-visible:ring-blue-300
                        ${
                          isActive
                            ? "bg-blue-500/20 font-semibold text-white ring-1 ring-inset ring-blue-400/25"
                            : "text-blue-100/80 hover:bg-white/[0.07] hover:text-white"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full bg-sky-300" />
                          )}

                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                              isActive
                                ? "bg-blue-400/20 text-sky-200"
                                : "text-blue-200/80 group-hover:bg-white/10 group-hover:text-white"
                            }`}
                          >
                            <Icon size={17} strokeWidth={1.9} />
                          </span>

                          <span className="min-w-0 flex-1 leading-5">
                            {menu.name}
                          </span>

                          {isActive && (
                            <ChevronRight
                              size={14}
                              className="shrink-0 text-sky-200"
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        {/* Fixed footer */}
        <div className="shrink-0 border-t border-white/10 px-3 py-2">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-2.5 py-2">
            {/* <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-400/20 text-xs font-bold text-blue-100 ring-1 ring-white/10">
              SA
            </div> */}

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Manager</p>
              <p className="truncate text-[10px] text-blue-200/70">
                C-HTM Workspace
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
