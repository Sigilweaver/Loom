import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@components/Layout";
import { ProtectedRoute } from "@components/ProtectedRoute";
import { LoginPage } from "@pages/LoginPage";
import { AdminPage } from "@pages/AdminPage";
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
        <Route index element={<Navigate to="/workflows" replace />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="executions" element={<ExecutionsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute minRole="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/workflows" replace />} />
    </Routes>
  );
}

export default App;
