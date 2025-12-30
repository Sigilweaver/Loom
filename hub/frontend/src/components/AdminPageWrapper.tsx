/**
 * Admin page wrapper
 *
 * Provides consistent padding for admin route pages.
 */

import { ReactNode } from "react";

interface AdminPageWrapperProps {
  children: ReactNode;
}

export function AdminPageWrapper({ children }: AdminPageWrapperProps) {
  return <div className="p-8">{children}</div>;
}
