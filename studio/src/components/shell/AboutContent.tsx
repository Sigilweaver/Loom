/**
 * About Content Component
 * 
 * Displays application information for use in Settings pane.
 * Uses theme tokens for consistent styling across themes.
 */

import React from 'react';

const AboutContent: React.FC = () => {
  const version = '0.0.0-dev';

  return (
    <div className="space-y-6 text-theme-text-primary">
      {/* Version */}
      <div>
        <h3 className="text-base font-bold text-theme-text-primary">
          Sigilweaver
        </h3>
        <p className="text-sm text-theme-text-tertiary mt-1">Version {version}</p>
      </div>

      {/* Description */}
      <div>
        <p className="text-sm text-theme-text-primary">
          The visual data pipeline tool you always wished existed.
        </p>
        <p className="text-sm text-theme-text-tertiary mt-2">
          A visual workflow designer for building and executing data processing pipelines
          through an intuitive drag-and-drop interface.
        </p>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-theme-text-primary">Links</h3>
        <div className="text-sm space-y-1">
          <div>
            <a
              href="https://sigilweaver.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-interactive-accent font-medium hover:underline"
              title="https://sigilweaver.app"
            >
              Website
            </a>
          </div>
          <div>
            <a
              href="https://docs.sigilweaver.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-interactive-accent font-medium hover:underline"
              title="https://docs.sigilweaver.app"
            >
              Documentation
            </a>
          </div>
          <div>
            <a
              href="https://github.com/sigilweaver/sigilweaver"
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-interactive-accent font-medium hover:underline"
              title="https://github.com/sigilweaver/sigilweaver"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-theme-text-primary">Legal</h3>
        <div className="text-sm space-y-1">
          <div>
            <a
              href="https://sigilweaver.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-interactive-accent font-medium hover:underline"
              title="https://sigilweaver.app/privacy"
            >
              Privacy Policy
            </a>
          </div>
          <div>
            <a
              href="https://sigilweaver.app/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-interactive-accent font-medium hover:underline"
              title="https://sigilweaver.app/terms"
            >
              Terms of Use
            </a>
          </div>
          <div>
            <a
              href="https://github.com/sigilweaver/sigilweaver/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-interactive-accent font-medium hover:underline"
              title="https://github.com/sigilweaver/sigilweaver/blob/main/LICENSE"
            >
              License (AGPL v3)
            </a>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-theme-text-primary">Built With</h3>
        <div className="text-sm space-y-1 text-theme-text-primary">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <strong>Frontend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5 text-theme-text-secondary">
                <li><a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://react.dev">React</a> - UI framework</li>
                <li><a href="https://www.electronjs.org" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://www.electronjs.org">Electron</a> - Desktop wrapper</li>
                <li><a href="https://zustand-demo.pmnd.rs" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://zustand-demo.pmnd.rs">Zustand</a> - State management</li>
                <li><a href="https://reactflow.dev" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://reactflow.dev">Xyflow</a> - Canvas/graph rendering</li>
                <li><a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://vitejs.dev">Vite</a> - Build tooling</li>
                <li><a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://tailwindcss.com">TailwindCSS</a> - Styling</li>
                <li><a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://lucide.dev">Lucide</a> - Icons</li>
              </ul>
            </div>
            <div>
              <strong>Backend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5 text-theme-text-secondary">
                <li><a href="https://www.python.org" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://www.python.org">Python</a> - Language runtime</li>
                <li><a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://fastapi.tiangolo.com">FastAPI</a> - REST API framework</li>
                <li><a href="https://pola.rs" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://pola.rs">Polars</a> - Data processing</li>
                <li><a href="https://docs.pydantic.dev" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://docs.pydantic.dev">Pydantic</a> - Data validation</li>
                <li><a href="https://www.uvicorn.org" target="_blank" rel="noopener noreferrer" className="text-theme-interactive-accent font-medium hover:underline" title="https://www.uvicorn.org">Uvicorn</a> - ASGI server</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div className="pt-4 border-t border-theme-border-primary">
        <p className="text-sm text-theme-text-tertiary">
          Sigilweaver is open source software. See package.json and requirements.txt
          for full dependency lists.
        </p>
        <p className="text-xs text-theme-text-tertiary mt-2">
          &copy; {new Date().getFullYear()} Sigilweaver Holdings LLC.
        </p>
      </div>
    </div>
  );
};

export default AboutContent;
