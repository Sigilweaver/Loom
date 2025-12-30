import { Navigate } from "react-router-dom";
import { useAuthStore } from "@state/authStore";
import type { UserRole } from "@state/authStore";

const adminRoles: UserRole[] = ["owner", "admin", "auditor"];

/**
 * Redirects users to their appropriate home page based on role.
 * - Regular users go to /home
 * - Admin, owner, and auditor go to /admin
 */
export function RoleBasedRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin roles go to admin area
  if (adminRoles.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  // Regular users go to home
  return <Navigate to="/home" replace />;
}
