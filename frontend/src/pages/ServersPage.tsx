import { Plus, Server } from "lucide-react";

export function ServersPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Servers</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
          <Plus className="h-4 w-4" />
          Add Server
        </button>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Server className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No servers registered
        </h3>
        <p className="text-gray-500 mb-4">
          Register a Sigilweaver Server instance to start executing workflows
        </p>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors mx-auto">
          <Plus className="h-4 w-4" />
          Add Server
        </button>
      </div>
    </div>
  );
}
