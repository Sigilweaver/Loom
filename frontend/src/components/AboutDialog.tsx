/**
 * About Dialog
 * 
 * Displays application information, credits, and open source licenses.
 */

import React from 'react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose, version }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-surface-overlay">
      <div className="bg-theme-surface-elevated border border-theme-border-primary rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-border-primary">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">
              Sigilweaver
            </h2>
            <p className="text-sm text-theme-text-secondary mt-1">Version {version}</p>
          </div>
          <button
            onClick={onClose}
            className="text-theme-text-secondary hover:text-theme-text-primary transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <p className="text-theme-text-primary">
              The visual data pipeline tool you always wished existed.
            </p>
            <p className="text-sm text-theme-text-secondary mt-2">
              A visual workflow designer for building and executing data processing pipelines 
              through an intuitive drag-and-drop interface.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-theme-text-primary">Links</h3>
            <div className="text-sm text-theme-text-secondary space-y-1">
              <div>
                <strong>Website:</strong>{' '}
                <a
                  href="https://sigilweaver.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-theme-interactive-accent hover:underline"
                >
                  sigilweaver.app
                </a>
              </div>
              <div>
                <strong>Documentation:</strong>{' '}
                <a
                  href="https://docs.sigilweaver.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-theme-interactive-accent hover:underline"
                >
                  docs.sigilweaver.app
                </a>
              </div>
              <div>
                <strong>GitHub:</strong>{' '}
                <a
                  href="https://github.com/sigilweaver/sigilweaver-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-theme-interactive-accent hover:underline"
                >
                  github.com/sigilweaver/sigilweaver-app
                </a>
              </div>
            </div>
          </div>

          {/* Credits */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-theme-text-primary">Built With</h3>
            <div className="text-xs text-theme-text-secondary space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong>Frontend:</strong>
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li>• React - UI framework</li>
                    <li>• Electron - Desktop wrapper</li>
                    <li>• Zustand - State management</li>
                    <li>• Xyflow - Canvas/graph rendering</li>
                    <li>• Vite - Build tooling</li>
                    <li>• TailwindCSS - Styling</li>
                  </ul>
                </div>
                <div>
                  <strong>Backend:</strong>
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li>• Python 3.11+</li>
                    <li>• FastAPI - REST API</li>
                    <li>• Polars - Data processing</li>
                    <li>• Pydantic - Validation</li>
                    <li>• Uvicorn - ASGI server</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* License */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-theme-text-primary">License</h3>
            <p className="text-xs text-theme-text-secondary">
              Sigilweaver is open source software. Check the GitHub repository for license details.
            </p>
          </div>

          {/* Author */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-theme-text-primary">Author</h3>
            <p className="text-xs text-theme-text-secondary">
              Created by the Sigilweaver Development Team
            </p>
          </div>

          {/* Attribution */}
          <div className="pt-4 border-t border-theme-border-primary">
            <p className="text-xs text-theme-text-tertiary">
              Sigilweaver uses open source software. See package.json and requirements.txt 
              for full dependency lists and their respective licenses.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-theme-border-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-interactive-accent text-theme-text-inverse rounded hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;
