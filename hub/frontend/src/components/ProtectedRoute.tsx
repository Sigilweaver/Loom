/**
 * Route guards.
 *
 * - ProtectedRoute: signed-in users only; optionally a minimum role.
 * - UserRoute: the regular-user area (admins, owners and auditors are sent to /admin).
 * - RoleBasedRedirect: the "/" landing route.
 *
 * Each renders its children, or the matched child route when used as a layout route.
 */

import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore, hasMinRole } from "@state/authStore";
import type { UserRole } from "@state/authStore";
import { isAdminRole } from "@components/layout/navigation";
import { LoadingState } from "@components/ui";

interface GuardProps {
  children?: ReactNode;
}

interface ProtectedRouteProps extends GuardProps {
  minRole?: UserRole;
}

export function ProtectedRoute({ children, minRole }: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-sunken">
        <LoadingState label="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where the user was going so login can send them back.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (minRole && !hasMinRole(minRole)) {
    // Signed in, but not allowed here: send them to their own area.
    return <Navigate to="/" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

export function UserRoute({ children }: GuardProps) {
  const user = useAuthStore((state) => state.user);

  if (!user) return <Navigate to="/login" replace />;
  if (isAdminRole(user.role)) return <Navigate to="/admin" replace />;

  return <>{children ?? <Outlet />}</>;
}

export function RoleBasedRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAdminRole(user.role) ? "/admin" : "/home"} replace />;
}
