/**
 * Protected route wrapper component
 *
 * Redirects to login if user is not authenticated.
 * Optionally checks for minimum required role.
 */

import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore, hasMinRole } from "@state/authStore";
import type { UserRole } from "@state/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  minRole?: UserRole;
}

export function ProtectedRoute({ children, minRole }: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-sunken">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Save the attempted URL so we can redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role if required
  if (minRole && !hasMinRole(minRole)) {
    // User doesn't have required role - redirect to workflows
    return <Navigate to="/workflows" replace />;
  }

  return <>{children}</>;
}
