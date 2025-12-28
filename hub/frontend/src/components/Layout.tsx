import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  FileCode2,
  Play,
  Clock,
  Shield,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@state/authStore";
import { logout } from "@api/client";

const navItems = [
  { to: "/workflows", label: "Workflows", icon: FileCode2 },
  { to: "/executions", label: "Executions", icon: Play },
  { to: "/schedules", label: "Schedules", icon: Clock },
];

const adminNavItems = [
  { to: "/admin", label: "Admin", icon: Shield },
];

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  auditor: "Auditor",
  user: "User",
};

export function Layout() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Ignore errors - we're logging out anyway
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  const userInitial = user?.username?.charAt(0).toUpperCase() || "?";
  const roleLabel = user?.role ? roleLabels[user.role] || user.role : "";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-xl font-semibold text-gray-900">
            Sigilweaver Hub
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}

          {/* Admin section - only visible to admins and owners */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="h-px bg-gray-200" />
              </div>
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-200 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-brand-700">
                {userInitial}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.username || "Unknown"}
              </p>
              <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                showUserMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* User dropdown menu */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              {/* Menu */}
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg border border-gray-200 shadow-lg z-20 overflow-hidden">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
