import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@components/Layout";
import { DashboardPage } from "@pages/DashboardPage";
import { WorkflowsPage } from "@pages/WorkflowsPage";
import { ServersPage } from "@pages/ServersPage";
import { ExecutionsPage } from "@pages/ExecutionsPage";
import { SchedulesPage } from "@pages/SchedulesPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="executions" element={<ExecutionsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
