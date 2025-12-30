import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@components/Layout";
import { ProtectedRoute } from "@components/ProtectedRoute";
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
        <Route index element={<HomePage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="executions" element={<ExecutionsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
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
