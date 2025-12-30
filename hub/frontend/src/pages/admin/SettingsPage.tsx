/**
 * Settings page for admin area
 *
 * System configuration and settings management.
 */

import { Settings } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="p-8">
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Settings</h3>
        <p className="text-gray-500">System settings will be available here in a future update.</p>
      </div>
    </div>
  );
}
