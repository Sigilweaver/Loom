import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@components/layout/AppLayout";
import { ProtectedRoute, RoleBasedRedirect, UserRoute } from "@components/ProtectedRoute";
import { LoadingState } from "@components/ui";
import { LoginPage } from "@pages/LoginPage";

// Pages are loaded on demand so the first paint only ships the shell.
const HomePage = lazy(() => import("@pages/HomePage").then((m) => ({ default: m.HomePage })));
const WorkflowsPage = lazy(() =>
  import("@pages/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage }))
);
const ExecutionsPage = lazy(() =>
  import("@pages/ExecutionsPage").then((m) => ({ default: m.ExecutionsPage }))
);
const SchedulesPage = lazy(() =>
  import("@pages/SchedulesPage").then((m) => ({ default: m.SchedulesPage }))
);

const DashboardTab = lazy(() =>
  import("@pages/admin/DashboardTab").then((m) => ({ default: m.DashboardTab }))
);
const ActivityTab = lazy(() =>
  import("@pages/admin/ActivityTab").then((m) => ({ default: m.ActivityTab }))
);
const AuditTab = lazy(() => import("@pages/admin/AuditTab").then((m) => ({ default: m.AuditTab })));
const ServersTab = lazy(() =>
  import("@pages/admin/ServersTab").then((m) => ({ default: m.ServersTab }))
);
const ConnectionsTab = lazy(() =>
  import("@pages/admin/ConnectionsTab").then((m) => ({ default: m.ConnectionsTab }))
);
const GroupsTab = lazy(() =>
  import("@pages/admin/GroupsTab").then((m) => ({ default: m.GroupsTab }))
);
const GrantGroupsTab = lazy(() =>
  import("@pages/admin/GrantGroupsTab").then((m) => ({ default: m.GrantGroupsTab }))
);
const UsersTab = lazy(() => import("@pages/admin/UsersTab").then((m) => ({ default: m.UsersTab })));
const SettingsPage = lazy(() =>
  import("@pages/admin/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleBasedRedirect />} />

        {/* Regular users */}
        <Route element={<UserRoute />}>
          <Route path="home" element={<Lazy><HomePage /></Lazy>} />
          <Route path="workflows" element={<Lazy><WorkflowsPage /></Lazy>} />
          <Route path="executions" element={<Lazy><ExecutionsPage /></Lazy>} />
          <Route path="schedules" element={<Lazy><SchedulesPage /></Lazy>} />
        </Route>

        {/* Admins, owners and auditors */}
        <Route path="admin" element={<ProtectedRoute minRole="auditor" />}>
          <Route index element={<Lazy><DashboardTab /></Lazy>} />
          <Route path="activity" element={<Lazy><ActivityTab /></Lazy>} />
          <Route path="audit" element={<Lazy><AuditTab /></Lazy>} />
          <Route path="servers" element={<Lazy><ServersTab /></Lazy>} />
          <Route path="connections" element={<Lazy><ConnectionsTab /></Lazy>} />
          <Route path="groups" element={<Lazy><GroupsTab /></Lazy>} />
          <Route path="grant-groups" element={<Lazy><GrantGroupsTab /></Lazy>} />
          <Route path="users" element={<Lazy><UsersTab /></Lazy>} />
          <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Suspense boundary for lazily loaded pages. */
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState className="h-full min-h-64" />}>{children}</Suspense>;
}

export default App;
