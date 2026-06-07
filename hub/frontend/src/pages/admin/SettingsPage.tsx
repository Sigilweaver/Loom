/**
 * Settings page for admin area
 *
 * System configuration and settings management.
 */

import { Settings } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="p-8">
      <div className="bg-surface-raised rounded-lg border border-line p-8 text-center">
        <Settings className="h-12 w-12 text-ink-faint mx-auto mb-4" />
        <h3 className="text-lg font-medium text-ink mb-2">Settings</h3>
        <p className="text-ink-subtle">System settings will be available here in a future update.</p>
      </div>
    </div>
  );
}
