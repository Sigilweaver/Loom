import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { logout } from "@api";
import { useAuthStore } from "@state/authStore";
import { ErrorBoundary } from "@components/ErrorBoundary";
import { EditProfileDialog } from "./EditProfileDialog";
import { UserMenu } from "./UserMenu";
import { navigationFor, type NavSection } from "./navigation";

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img src="/sigilweaver-logo.svg" alt="" className="h-8 w-8 shrink-0" />
      {!collapsed && <span className="truncate text-lg font-semibold text-ink">Loom Hub</span>}
    </div>
  );
}

interface SidebarNavProps {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
}

function SidebarNav({ sections, collapsed = false, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
      {sections.map((section, index) => (
        <div key={section.label ?? index} className={clsx(index > 0 && "mt-4")}>
          {section.label && !collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
              {section.label}
            </p>
          )}
          {section.label && collapsed && index > 0 && <div className="mx-3 mb-2 h-px bg-line" />}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center",
                      isActive
                        ? "bg-accent-soft text-accent-ink"
                        : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Application shell: a fixed sidebar on wide screens, a slide-in drawer with a
 * top bar on narrow ones.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, clearAuth, setAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const sections = navigationFor(user?.role);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The server session may already be gone; we are signing out either way.
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  const userMenu = (isCollapsed: boolean) => (
    <div className="border-t border-line p-2">
      <UserMenu
        user={user}
        collapsed={isCollapsed}
        signingOut={signingOut}
        onEditProfile={() => setEditingProfile(true)}
        onSignOut={handleSignOut}
      />
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-surface-sunken md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="-ml-2 rounded-lg p-2 text-ink-muted hover:bg-surface-hover hover:text-ink"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand />
      </header>

      {/* Mobile drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 md:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface-raised shadow-xl md:hidden"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Dialog.Title asChild>
                <span>
                  <Brand />
                </span>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="-mr-2 rounded-lg p-2 text-ink-subtle hover:bg-surface-hover hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
            {userMenu(false)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "hidden shrink-0 flex-col border-r border-line bg-surface-raised transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Brand collapsed={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={clsx(
              "shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink-muted",
              collapsed && "hidden"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mx-auto mt-2 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <SidebarNav sections={sections} collapsed={collapsed} />
        {userMenu(collapsed)}
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-auto focus:outline-none">
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {editingProfile && user && token && (
        <EditProfileDialog
          username={user.username}
          onClose={() => setEditingProfile(false)}
          onUpdated={(newUsername) => {
            setAuth(token, { ...user, username: newUsername });
            setEditingProfile(false);
          }}
        />
      )}
    </div>
  );
}
