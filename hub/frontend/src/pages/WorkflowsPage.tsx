/**
 * Workflows page for Hub
 *
 * Lists, uploads, and manages stored workflow files.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus,
  Upload,
  Search,
  Folder,
  FolderOpen,
  Tag,
  Trash2,
  Download,
  MoreVertical,
  FileText,
  Loader2,
  X,
  AlertCircle,
  ChevronRight,
  Pencil,
  Home,
  Calendar,
  User,
  Hash,
  Clock,
  Eye,
  Info,
} from "lucide-react";
import {
  listWorkflows,
  uploadWorkflow,
  deleteWorkflow,
  updateWorkflowMetadata,
  getWorkflowDownloadUrl,
  getWorkflowContent,
  type WorkflowMetadata,
  type WorkflowContent,
} from "@api/client";
import { getAuthToken } from "@state/authStore";

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Fuzzy subsequence match - checks if query letters appear in order in target.
 * Returns a score based on match quality, 0 if no match.
 * 
 * Examples:
 *   fuzzyMatch("fltr", "filter") -> high score (consecutive-ish letters)
 *   fuzzyMatch("sls", "sales") -> matches
 *   fuzzyMatch("abc", "aXbXc") -> matches but lower score
 */
function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  
  if (q.length === 0) return 1;
  if (q.length > t.length) return 0;
  
  // Exact match is best
  if (t === q) return 100;
  
  // Prefix match is very good
  if (t.startsWith(q)) return 90;
  
  // Contains as substring is good
  if (t.includes(q)) {
    // Bonus for word boundary match
    const wordBoundary = new RegExp(`\\b${q}`).test(t);
    return wordBoundary ? 75 : 60;
  }
  
  // Subsequence match - letters appear in order
  let qIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -2;
  
  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      // Base points for each match
      score += 10;
      
      // Bonus for consecutive matches (rewards "fltr" in "filter")
      if (tIdx === lastMatchIdx + 1) {
        consecutiveBonus += 5;
      }
      
      // Bonus for matching at word boundaries or after separators
      const prevChar = t[tIdx - 1];
      if (tIdx === 0 || (prevChar && /[\s_\-./]/.test(prevChar))) {
        score += 8;
      }
      
      // Bonus for matching uppercase in camelCase
      const currChar = t[tIdx];
      const prevTargetChar = target[tIdx - 1];
      if (tIdx > 0 && currChar && currChar === currChar.toUpperCase() && prevTargetChar && /[a-z]/.test(prevTargetChar)) {
        score += 5;
      }
      
      lastMatchIdx = tIdx;
      qIdx++;
    }
  }
  
  // All query chars must be found
  if (qIdx < q.length) return 0;
  
  // Add consecutive bonus and normalize
  score += consecutiveBonus;
  
  // Penalize if match is spread out (prefer compact matches)
  const spread = lastMatchIdx - (lastMatchIdx - qIdx + 1);
  const compactness = Math.max(0, 20 - spread);
  score += compactness;
  
  // Normalize to 0-50 range for subsequence matches (below substring matches)
  return Math.min(50, score * 0.5);
}

/**
 * Fuzzy search scoring for workflows.
 * Returns a score > 0 if the query matches, 0 if no match.
 * Higher scores = better matches.
 */
function fuzzyScore(workflow: WorkflowMetadata, query: string): number {
  if (!query) return 1; // No query = everything matches
  
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  
  let totalScore = 0;
  
  for (const term of terms) {
    let termScore = 0;
    
    // Name matches (highest weight)
    const nameScore = fuzzyMatch(term, workflow.name);
    termScore = Math.max(termScore, nameScore * 1.5);
    
    // Description matches (medium weight)
    if (workflow.description) {
      const descScore = fuzzyMatch(term, workflow.description);
      termScore = Math.max(termScore, descScore * 0.6);
    }
    
    // Author matches (medium weight)
    if (workflow.author) {
      const authorScore = fuzzyMatch(term, workflow.author);
      termScore = Math.max(termScore, authorScore * 0.8);
    }
    
    // Tag matches (high weight - tags are important)
    for (const tag of workflow.tags) {
      const tagScore = fuzzyMatch(term, tag);
      termScore = Math.max(termScore, tagScore * 1.2);
    }
    
    // Folder path matches (lower weight)
    const folderScore = fuzzyMatch(term, workflow.folder_path);
    termScore = Math.max(termScore, folderScore * 0.4);
    
    // If any term doesn't match at all, exclude the workflow
    if (termScore === 0) return 0;
    
    totalScore += termScore;
  }
  
  return totalScore;
}

/** Build a folder tree structure from flat paths */
interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  count: number;
}

function buildFolderTree(workflows: WorkflowMetadata[]): FolderNode {
  const root: FolderNode = { name: "All Workflows", path: "", children: [], count: workflows.length };
  
  // Count workflows per folder
  const folderCounts = new Map<string, number>();
  for (const w of workflows) {
    const path = w.folder_path;
    folderCounts.set(path, (folderCounts.get(path) || 0) + 1);
  }
  
  // Build tree structure
  const folders = Array.from(new Set(workflows.map((w) => w.folder_path))).sort();
  
  for (const folderPath of folders) {
    if (folderPath === "/") continue; // Root is handled separately
    
    const parts = folderPath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";
    
    for (const part of parts) {
      currentPath += "/" + part;
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: currentPath, children: [], count: 0 };
        current.children.push(child);
      }
      current = child;
    }
    current.count = folderCounts.get(folderPath) || 0;
  }
  
  return root;
}

/** Tag input with suggestions */
interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}

function TagInput({ value, onChange, suggestions, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return suggestions.filter((s) => !value.includes(s)).slice(0, 8);
    return suggestions
      .filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(s))
      .slice(0, 8);
  }, [inputValue, suggestions, value]);
  
  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
    inputRef.current?.focus();
  };
  
  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      const lastTag = value[value.length - 1];
      if (lastTag) removeTag(lastTag);
    }
  };
  
  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent bg-white min-h-[42px]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm bg-brand-100 text-brand-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-brand-900"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none text-sm"
        />
      </div>
      
      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
            Suggested tags
          </div>
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                addTag(suggestion);
                setShowSuggestions(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50"
            >
              <Tag className="h-3 w-3 text-gray-400" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Folder selector with existing folders and new folder input */
interface FolderSelectorProps {
  value: string;
  onChange: (path: string) => void;
  existingFolders: string[];
}

function FolderSelector({ value, onChange, existingFolders }: FolderSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const sortedFolders = useMemo(() => {
    return ["/", ...existingFolders.filter((f) => f !== "/")].sort();
  }, [existingFolders]);
  
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="/"
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
      
      {showDropdown && sortedFolders.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
            Existing folders
          </div>
          {sortedFolders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => {
                onChange(folder);
                setShowDropdown(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                value === folder ? "bg-brand-50 text-brand-700" : ""
              }`}
            >
              <Folder className="h-3 w-3 text-gray-400" />
              {folder}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (workflow: WorkflowMetadata) => void;
  existingFolders: string[];
  existingTags: string[];
  initialFolder?: string;
}

function UploadDialog({ open, onClose, onUpload, existingFolders, existingTags, initialFolder }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [folderPath, setFolderPath] = useState(initialFolder || "/");
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update folder when initialFolder changes
  useEffect(() => {
    if (open && initialFolder) {
      setFolderPath(initialFolder);
    }
  }, [open, initialFolder]);

  const resetForm = () => {
    setFile(null);
    setFolderPath(initialFolder || "/");
    setTags([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".swwf")) {
        setError("Please select a .swwf workflow file");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadWorkflow(file, folderPath, tags);

      // Fetch the full workflow metadata
      const response = await listWorkflows();
      const uploaded = response.workflows.find((w) => w.id === result.id);
      if (uploaded) {
        onUpload(uploaded);
      }
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Upload Workflow
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow File
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                file
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".swwf"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-brand-600">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="text-gray-500">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p>Click to select a .swwf file</p>
                </div>
              )}
            </div>
          </div>

          {/* Folder path with suggestions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder
            </label>
            <FolderSelector
              value={folderPath}
              onChange={setFolderPath}
              existingFolders={existingFolders}
            />
            <p className="text-xs text-gray-500 mt-1">
              Select existing or type new path (e.g., /projects/sales)
            </p>
          </div>

          {/* Tags with suggestions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={existingTags}
              placeholder="Add tags..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Press Enter or comma to add a tag
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Edit workflow metadata dialog */
interface EditDialogProps {
  workflow: WorkflowMetadata;
  open: boolean;
  onClose: () => void;
  onSave: (updated: WorkflowMetadata) => void;
  existingFolders: string[];
  existingTags: string[];
}

function EditDialog({ workflow, open, onClose, onSave, existingFolders, existingTags }: EditDialogProps) {
  const [folderPath, setFolderPath] = useState(workflow.folder_path);
  const [tags, setTags] = useState<string[]>(workflow.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when workflow changes
  useEffect(() => {
    setFolderPath(workflow.folder_path);
    setTags(workflow.tags);
    setError(null);
  }, [workflow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updated = await updateWorkflowMetadata(workflow.id, {
        folder_path: folderPath,
        tags,
      });
      onSave(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Workflow
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Workflow info (read-only) */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <FileText className="h-8 w-8 text-brand-600" />
            <div>
              <div className="font-medium text-gray-900">{workflow.name}</div>
              {workflow.author && (
                <div className="text-sm text-gray-500">by {workflow.author}</div>
              )}
            </div>
          </div>

          {/* Folder path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder
            </label>
            <FolderSelector
              value={folderPath}
              onChange={setFolderPath}
              existingFolders={existingFolders}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={existingTags}
              placeholder="Add tags..."
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Simple markdown-like renderer for workflow descriptions */
function renderDescription(text: string): React.ReactNode {
  if (!text) return null;
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  return paragraphs.map((para, i) => {
    // Handle headers
    if (para.startsWith("### ")) {
      return <h4 key={i} className="text-sm font-semibold text-gray-900 mt-3 mb-1">{para.slice(4)}</h4>;
    }
    if (para.startsWith("## ")) {
      return <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2">{para.slice(3)}</h3>;
    }
    if (para.startsWith("# ")) {
      return <h2 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">{para.slice(2)}</h2>;
    }
    
    // Handle bullet lists
    if (para.match(/^[-*] /m)) {
      const items = para.split(/\n/).filter(Boolean);
      return (
        <ul key={i} className="list-disc list-inside text-sm text-gray-600 space-y-1 my-2">
          {items.map((item, j) => (
            <li key={j}>{item.replace(/^[-*] /, "")}</li>
          ))}
        </ul>
      );
    }
    
    // Handle numbered lists
    if (para.match(/^\d+\. /m)) {
      const items = para.split(/\n/).filter(Boolean);
      return (
        <ol key={i} className="list-decimal list-inside text-sm text-gray-600 space-y-1 my-2">
          {items.map((item, j) => (
            <li key={j}>{item.replace(/^\d+\. /, "")}</li>
          ))}
        </ol>
      );
    }
    
    // Regular paragraph - handle inline formatting
    let content: React.ReactNode = para;
    
    // Bold
    const boldParts = para.split(/\*\*(.+?)\*\*/g);
    if (boldParts.length > 1) {
      content = boldParts.map((part, j) => 
        j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
      );
    }
    
    // Code
    const codeParts = para.split(/`(.+?)`/g);
    if (codeParts.length > 1) {
      content = codeParts.map((part, j) => 
        j % 2 === 1 ? <code key={j} className="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono">{part}</code> : part
      );
    }
    
    return <p key={i} className="text-sm text-gray-600 my-2">{content}</p>;
  });
}

/** Workflow detail dialog */
interface DetailDialogProps {
  workflow: WorkflowMetadata;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
}

function DetailDialog({ workflow, open, onClose, onEdit, onDownload }: DetailDialogProps) {
  const [content, setContent] = useState<WorkflowContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    
    setLoading(true);
    setError(null);
    
    getWorkflowContent(workflow.id)
      .then(setContent)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, workflow.id]);

  if (!open) return null;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{workflow.name}</h2>
              {workflow.author && (
                <p className="text-sm text-gray-500">by {workflow.author}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          {workflow.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Description
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {renderDescription(workflow.description)}
              </div>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <Folder className="h-3 w-3" />
                Folder
              </div>
              <div className="text-sm font-medium text-gray-900">{workflow.folder_path}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <User className="h-3 w-3" />
                Uploaded By
              </div>
              <div className="text-sm font-medium text-gray-900">{workflow.uploaded_by}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <Calendar className="h-3 w-3" />
                Created
              </div>
              <div className="text-sm font-medium text-gray-900">{formatDate(workflow.created_at)}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <Clock className="h-3 w-3" />
                Last Updated
              </div>
              <div className="text-sm font-medium text-gray-900">{formatDate(workflow.updated_at)}</div>
            </div>
          </div>

          {/* Tags */}
          {workflow.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {workflow.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-brand-100 text-brand-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Workflow stats */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : content && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Workflow Details
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-brand-600">{content.tools.length}</div>
                  <div className="text-xs text-gray-500">Tools</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-brand-600">{content.wires.length}</div>
                  <div className="text-xs text-gray-500">Connections</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-brand-600">v{content.version}</div>
                  <div className="text-xs text-gray-500">Format</div>
                </div>
              </div>
            </div>
          )}

          {/* Technical details (collapsible) */}
          <details className="group">
            <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-2">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
              Technical Details
            </summary>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Workflow ID</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{workflow.workflow_id}</code>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Storage ID</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{workflow.id}</code>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Checksum (SHA-256)</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono truncate max-w-[200px]" title={workflow.checksum}>
                  {workflow.checksum.slice(0, 16)}...
                </code>
              </div>
            </div>
          </details>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

/** Folder tree sidebar item */
interface FolderTreeItemProps {
  node: FolderNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

function FolderTreeItem({ node, selectedPath, onSelect, depth = 0 }: FolderTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children.length > 0;
  const Icon = hasChildren && expanded ? FolderOpen : Folder;

  const handleSelect = () => {
    onSelect(node.path);
    // Auto-expand when selecting a folder with children (but don't collapse)
    if (hasChildren && !expanded) {
      setExpanded(true);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div>
      <button
        onClick={handleSelect}
        className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg transition-colors ${
          isSelected
            ? "bg-brand-100 text-brand-700"
            : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={handleToggleExpand}
            className="p-0.5 -m-0.5 hover:bg-gray-200 rounded"
          >
            <ChevronRight
              className={`h-3 w-3 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </span>
        ) : (
          <span className="w-3" />
        )}
        {depth === 0 ? (
          <Home className="h-4 w-4 flex-shrink-0" />
        ) : (
          <Icon className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{node.name}</span>
        <span className="text-xs text-gray-400">{node.count}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkflowCardProps {
  workflow: WorkflowMetadata;
  onView: (workflow: WorkflowMetadata) => void;
  onEdit: (workflow: WorkflowMetadata) => void;
  onDelete: (id: string) => void;
}

function WorkflowCard({ workflow, onView, onEdit, onDelete }: WorkflowCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = async () => {
    setMenuOpen(false);
    const token = getAuthToken();
    const url = getWorkflowDownloadUrl(workflow.id);

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${workflow.name}.swwf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleEdit = () => {
    setMenuOpen(false);
    onEdit(workflow);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete workflow "${workflow.name}"?`)) return;

    setDeleting(true);
    setMenuOpen(false);

    try {
      await deleteWorkflow(workflow.id);
      onDelete(workflow.id);
    } catch (e) {
      console.error("Delete failed:", e);
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onView(workflow)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {workflow.name}
            </h3>
            {workflow.description && (
              <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                {workflow.description}
              </p>
            )}
          </div>
        </div>

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            disabled={deleting}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            {deleting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MoreVertical className="h-5 w-5" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onView(workflow);
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                View Details
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {workflow.author && <span>by {workflow.author}</span>}
        <span className="flex items-center gap-1">
          <Folder className="h-3 w-3" />
          {workflow.folder_path}
        </span>
        <span>Updated {formatRelativeTime(workflow.updated_at)}</span>
      </div>

      {/* Tags */}
      {workflow.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {workflow.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(""); // "" = all
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowMetadata | null>(null);
  const [viewingWorkflow, setViewingWorkflow] = useState<WorkflowMetadata | null>(null);

  // Compute existing folders and tags for suggestions
  const existingFolders = useMemo(() => {
    return Array.from(new Set(workflows.map((w) => w.folder_path))).sort();
  }, [workflows]);

  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const w of workflows) {
      for (const tag of w.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [workflows]);

  // Build folder tree
  const folderTree = useMemo(() => buildFolderTree(workflows), [workflows]);

  // Fetch all workflows once on mount
  const fetchWorkflows = useCallback(async () => {
    try {
      setError(null);
      const response = await listWorkflows();
      setWorkflows(response.workflows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleUpload = (workflow: WorkflowMetadata) => {
    setWorkflows((prev) => [workflow, ...prev]);
  };

  const handleView = (workflow: WorkflowMetadata) => {
    setViewingWorkflow(workflow);
  };

  const handleEdit = (workflow: WorkflowMetadata) => {
    setEditingWorkflow(workflow);
  };

  const handleSaveEdit = (updated: WorkflowMetadata) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );
    // Update viewing workflow if it's the one being edited
    if (viewingWorkflow?.id === updated.id) {
      setViewingWorkflow(updated);
    }
  };

  const handleDelete = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    if (viewingWorkflow?.id === id) {
      setViewingWorkflow(null);
    }
  };

  // Download handler for detail dialog
  const handleDownloadFromDetail = async () => {
    if (!viewingWorkflow) return;
    
    const token = getAuthToken();
    const url = getWorkflowDownloadUrl(viewingWorkflow.id);

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${viewingWorkflow.name}.swwf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  // Client-side filtering: folder + fuzzy search
  const filteredWorkflows = useMemo(() => {
    let results = workflows;
    
    // Filter by folder first
    if (selectedFolder) {
      results = results.filter((w) => w.folder_path.startsWith(selectedFolder));
    }
    
    // Apply fuzzy search
    if (searchQuery.trim()) {
      const scored = results
        .map((w) => ({ workflow: w, score: fuzzyScore(w, searchQuery) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
      results = scored.map((item) => item.workflow);
    }
    
    return results;
  }, [workflows, selectedFolder, searchQuery]);

  return (
    <div className="flex h-full">
      {/* Folder sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Folders
        </h2>
        <FolderTreeItem
          node={folderTree}
          selectedPath={selectedFolder}
          onSelect={setSelectedFolder}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Workflows</h1>
            {selectedFolder && (
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Home className="h-3 w-3" />
                <ChevronRight className="h-3 w-3" />
                {selectedFolder.split("/").filter(Boolean).map((part, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    {part}
                    {i < arr.length - 1 && <ChevronRight className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setUploadDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload Workflow
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredWorkflows.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || selectedFolder
                ? "No workflows found"
                : "No workflows yet"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || selectedFolder
                ? "Try adjusting your search or folder selection"
                : "Upload a .swwf workflow file to get started"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setUploadDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors mx-auto"
              >
                <Upload className="h-4 w-4" />
                Upload Workflow
              </button>
            )}
          </div>
        )}

        {/* Workflow grid */}
        {!loading && filteredWorkflows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Upload dialog */}
        <UploadDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onUpload={handleUpload}
          existingFolders={existingFolders}
          existingTags={existingTags}
          initialFolder={selectedFolder || "/"}
        />

        {/* Edit dialog */}
        {editingWorkflow && (
          <EditDialog
            workflow={editingWorkflow}
            open={true}
            onClose={() => setEditingWorkflow(null)}
            onSave={handleSaveEdit}
            existingFolders={existingFolders}
            existingTags={existingTags}
          />
        )}

        {/* Detail dialog */}
        {viewingWorkflow && (
          <DetailDialog
            workflow={viewingWorkflow}
            open={true}
            onClose={() => setViewingWorkflow(null)}
            onEdit={() => {
              setViewingWorkflow(null);
              setEditingWorkflow(viewingWorkflow);
            }}
            onDownload={handleDownloadFromDetail}
          />
        )}
      </div>
    </div>
  );
}
