import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  FileCode2,
  Play,
  Clock,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCog,
  X,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Activity,
  ShieldCheck,
  Server,
  Database,
  UsersRound,
  Package,
  Users,
  Settings,
  Sparkles,
  Moon,
  Sun,
} from "lucide-react";
import { useAuthStore } from "@state/authStore";
import { useThemeStore, type Theme } from "@state/themeStore";
import { logout, updateProfile } from "@api/client";

const themeOptions: { value: Theme; label: string; icon: typeof Sparkles }[] = [
  { value: "sigilweaver", label: "Sigilweaver", icon: Sparkles },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

const userNavItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/workflows", label: "Workflows", icon: FileCode2 },
  { to: "/executions", label: "Executions", icon: Play },
  { to: "/schedules", label: "Schedules", icon: Clock },
];

const adminNavItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/activity", label: "Activity", icon: Activity },
  { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
  { to: "/admin/servers", label: "Servers", icon: Server },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/groups", label: "User Groups", icon: UsersRound },
  { to: "/admin/grant-groups", label: "Grant Groups", icon: Package },
  { to: "/admin/connections", label: "Connections", icon: Database },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  auditor: "Auditor",
  user: "User",
};

export function Layout() {
  const navigate = useNavigate();
  const { user, clearAuth, setAuth, token } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isAdminOrAuditor = user?.role === "admin" || user?.role === "owner" || user?.role === "auditor";

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
    <div className="flex h-screen bg-surface-sunken">
      {/* Sidebar */}
      <aside
        className={`bg-surface-raised border-r border-line flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-16" : "w-64"
          }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-line">
          <div className="flex items-center min-w-0 gap-2">
            <img
              src="/sigilweaver-logo.svg"
              alt="Sigilweaver Loom"
              className="flex-shrink-0 w-8 h-8"
            />
            {!sidebarCollapsed && (
              <span className="text-lg font-semibold text-ink truncate">
                Loom Hub
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-ink-faint hover:text-ink-muted hover:bg-surface-hover transition-colors flex-shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {/* User nav - only for regular users */}
          {!isAdminOrAuditor && userNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                } ${sidebarCollapsed ? "justify-center" : ""}`
              }
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="flex-shrink-0 w-5 h-5" />
              {!sidebarCollapsed && item.label}
            </NavLink>
          ))}

          {/* Admin nav - only for admins, owners, and auditors */}
          {isAdminOrAuditor && (
            <>
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                    } ${sidebarCollapsed ? "justify-center" : ""}`
                  }
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="flex-shrink-0 w-5 h-5" />
                  {!sidebarCollapsed && item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="relative p-2 border-t border-line">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`w-full flex items-center gap-3 hover:bg-surface-sunken rounded-lg p-2 transition-colors ${sidebarCollapsed ? "justify-center" : ""
              }`}
            title={sidebarCollapsed ? user?.username : undefined}
          >
            <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-brand-100">
              <span className="text-sm font-medium text-brand-700">
                {userInitial}
              </span>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-ink truncate">
                    {user?.username || "Unknown"}
                  </p>
                  <p className="text-xs text-ink-subtle truncate">{roleLabel}</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-ink-faint transition-transform ${showUserMenu ? "rotate-180" : ""
                    }`}
                />
              </>
            )}
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
              <div
                className={`absolute bottom-full mb-2 bg-surface-raised rounded-lg border border-line shadow-lg z-20 overflow-hidden ${sidebarCollapsed ? "left-2 w-48" : "left-2 right-2"
                  }`}
              >
                {/* Theme switcher */}
                <div className="px-4 pt-3 pb-2">
                  <p className="px-1 mb-1.5 text-xs font-medium text-ink-subtle">
                    Theme
                  </p>
                  <div className="flex gap-1 p-1 rounded-lg bg-surface-sunken">
                    {themeOptions.map((option) => {
                      const isActive = theme === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value)}
                          title={`${option.label} theme`}
                          aria-pressed={isActive}
                          className={`flex flex-1 flex-col items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${isActive
                            ? "bg-brand-600 text-white"
                            : "text-ink-muted hover:bg-surface-hover"
                            }`}
                        >
                          <option.icon className="w-4 h-4" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="h-px bg-line" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowEditProfile(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-muted hover:bg-surface-sunken"
                >
                  <UserCog className="w-4 h-4" />
                  Edit Profile
                </button>
                <div className="h-px bg-line" />
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-muted hover:bg-surface-sunken disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
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

      {/* Edit Profile Dialog */}
      {showEditProfile && user && token && (
        <EditProfileDialog
          username={user.username}
          onClose={() => setShowEditProfile(false)}
          onUpdated={(newUsername) => {
            setAuth(token, { ...user, username: newUsername });
            setShowEditProfile(false);
          }}
        />
      )}
    </div>
  );
}

interface EditProfileDialogProps {
  username: string;
  onClose: () => void;
  onUpdated: (newUsername: string) => void;
}

function EditProfileDialog({ username, onClose, onUpdated }: EditProfileDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = newUsername !== username || newPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      setError("Current password is required");
      return;
    }

    if (!hasChanges) {
      onClose();
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await updateProfile({
        current_password: currentPassword,
        username: newUsername !== username ? newUsername : undefined,
        new_password: newPassword || undefined,
      });
      onUpdated(newUsername);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-surface-raised rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">Edit Profile</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 border border-red-200 rounded-lg bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="p-3 border rounded-lg bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-700">
              Enter your current password to confirm your identity before making changes.
            </p>
          </div>

          {/* Current Password */}
          <div>
            <label className="block mb-1 text-sm font-medium text-ink-muted">
              Current Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="Enter current password"
            />
          </div>

          <div className="h-px my-4 bg-line" />

          {/* New Username */}
          <div>
            <label className="block mb-1 text-sm font-medium text-ink-muted">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              minLength={3}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* New Password */}
          <div>
            <label className="block mb-1 text-sm font-medium text-ink-muted">
              New Password
              <span className="ml-1 font-normal text-ink-faint">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="New password (min 8 characters)"
            />
          </div>

          {/* Confirm Password */}
          {newPassword && (
            <div>
              <label className="block mb-1 text-sm font-medium text-ink-muted">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Confirm new password"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 font-medium text-ink-muted border border-line-strong rounded-lg hover:bg-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !currentPassword || !hasChanges}
              className="flex items-center justify-center flex-1 gap-2 px-4 py-2 font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
