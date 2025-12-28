import { Plus, Upload } from "lucide-react";

export function WorkflowsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Workflows</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
          <Upload className="h-4 w-4" />
          Upload Workflow
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search workflows..."
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
          <option value="">All folders</option>
        </select>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Plus className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No workflows yet
        </h3>
        <p className="text-gray-500 mb-4">
          Upload a .swwf workflow file to get started
        </p>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors mx-auto">
          <Upload className="h-4 w-4" />
          Upload Workflow
        </button>
      </div>
    </div>
  );
}
