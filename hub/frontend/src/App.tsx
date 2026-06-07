import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@components/Layout";
import { ProtectedRoute } from "@components/ProtectedRoute";
import { UserRoute } from "@components/UserRoute";
import { RoleBasedRedirect } from "@components/RoleBasedRedirect";
import { AdminPageWrapper } from "@components/AdminPageWrapper";
import { LoginPage } from "@pages/LoginPage";
import { HomePage } from "@pages/HomePage";
import { WorkflowsPage } from "@pages/WorkflowsPage";
import { ExecutionsPage } from "@pages/ExecutionsPage";
import { SchedulesPage } from "@pages/SchedulesPage";
// Admin pages
import { DashboardTab } from "@pages/admin/DashboardTab";
import { ActivityTab } from "@pages/admin/ActivityTab";
import { AuditTab } from "@pages/admin/AuditTab";
import { ServersTab } from "@pages/admin/ServersTab";
import { ConnectionsTab } from "@pages/admin/ConnectionsTab";
import { GroupsTab } from "@pages/admin/GroupsTab";
import { GrantGroupsTab } from "@pages/admin/GrantGroupsTab";
import { UsersTab } from "@pages/admin/UsersTab";
import { SettingsPage } from "@pages/admin/SettingsPage";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Role-based redirect at root */}
        <Route index element={<RoleBasedRedirect />} />

        {/* User routes - only for regular users */}
        <Route
          path="home"
          element={
            <UserRoute>
              <HomePage />
            </UserRoute>
          }
        />
        <Route
          path="workflows"
          element={
            <UserRoute>
              <WorkflowsPage />
            </UserRoute>
          }
        />
        <Route
          path="executions"
          element={
            <UserRoute>
              <ExecutionsPage />
            </UserRoute>
          }
        />
        <Route
          path="schedules"
          element={
            <UserRoute>
              <SchedulesPage />
            </UserRoute>
          }
        />

        {/* Admin routes - for admins, owners, and auditors */}
        <Route
          path="admin"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <DashboardTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/activity"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <ActivityTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/audit"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <AuditTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/servers"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <ServersTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/connections"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <ConnectionsTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/groups"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <GroupsTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/grant-groups"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <GrantGroupsTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute minRole="auditor">
              <AdminPageWrapper>
                <UsersTab />
              </AdminPageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute minRole="auditor">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
