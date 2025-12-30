/**
 * Admin panel page
 *
 * Accessible only to owners and admins.
 * Provides management interfaces for users, servers, connections, and settings.
 */

import { useState } from "react";
import { LayoutDashboard, Users, Server, Settings, Shield, Database, UsersRound, Activity } from "lucide-react";
import { DashboardTab } from "./admin/DashboardTab";
import { UsersTab } from "./admin/UsersTab";
import { ServersTab } from "./admin/ServersTab";
import { ConnectionsTab } from "./admin/ConnectionsTab";
import { GroupsTab } from "./admin/GroupsTab";
import { ActivityTab } from "./admin/ActivityTab";

type AdminTab = "dashboard" | "activity" | "settings" | "users" | "groups" | "servers" | "connections";

const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "servers", label: "Servers", icon: Server },
  { id: "connections", label: "Connections", icon: Database },
  { id: "groups", label: "Groups", icon: UsersRound },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-brand-100">
          <Shield className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500">Manage users, servers, connections, and system configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "activity" && <ActivityTab />}
      {activeTab === "connections" && <ConnectionsTab />}
      {activeTab === "groups" && <GroupsTab />}
      {activeTab === "servers" && <ServersTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "settings" && <SettingsPlaceholder />}
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Settings</h3>
      <p className="text-gray-500">System settings will be available here in a future update.</p>
    </div>
  );
}
