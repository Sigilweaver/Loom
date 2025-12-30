import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@components/Layout";
import { ProtectedRoute } from "@components/ProtectedRoute";
import { UserRoute } from "@components/UserRoute";
import { RoleBasedRedirect } from "@components/RoleBasedRedirect";
import { LoginPage } from "@pages/LoginPage";
import { AdminPage } from "@pages/AdminPage";
import { HomePage } from "@pages/HomePage";
import { WorkflowsPage } from "@pages/WorkflowsPage";
import { ExecutionsPage } from "@pages/ExecutionsPage";
import { SchedulesPage } from "@pages/SchedulesPage";

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
              <AdminPage />
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
