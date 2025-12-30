import { Navigate } from "react-router-dom";
import { useAuthStore } from "@state/authStore";
import type { UserRole } from "@state/authStore";

interface UserRouteProps {
  children: React.ReactNode;
}

const adminRoles: UserRole[] = ["owner", "admin", "auditor"];

/**
 * Route guard that only allows regular users (role="user").
 * Admin, owner, and auditor roles are redirected to /admin.
 */
export function UserRoute({ children }: UserRouteProps) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect admin roles to admin area
  if (adminRoles.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
