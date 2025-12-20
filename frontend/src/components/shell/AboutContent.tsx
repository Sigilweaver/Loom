/**
 * About Content Component
 * 
 * Displays application information for use in Settings dialog.
 * Extracted from AboutDialog for reusability.
 */

import React from 'react';

const AboutContent: React.FC = () => {
  const version = '0.0.0-dev';

  return (
    <div className="space-y-6">
      {/* Version */}
      <div>
        <h3 className="text-base font-bold" style={{ color: 'var(--color-modal-content-text)' }}>
          Sigilweaver
        </h3>
        <p className="text-sm opacity-70 mt-1">Version {version}</p>
      </div>

      {/* Description */}
      <div>
        <p className="text-sm" style={{ color: 'var(--color-modal-content-text)' }}>
          The visual data pipeline tool you always wished existed.
        </p>
        <p className="text-sm opacity-70 mt-2">
          A visual workflow designer for building and executing data processing pipelines 
          through an intuitive drag-and-drop interface.
        </p>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Links</h3>
        <div className="text-sm space-y-1">
          <div>
            <a
              href="https://sigilweaver.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }}
              className="hover:underline"
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
              style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }}
              className="hover:underline"
              title="https://docs.sigilweaver.app"
            >
              Documentation
            </a>
          </div>
          <div>
            <a
              href="https://github.com/sigilweaver/sigilweaver-app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }}
              className="hover:underline"
              title="https://github.com/sigilweaver/sigilweaver-app"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Legal</h3>
        <div className="text-sm space-y-1">
          <div>
            <a
              href="https://sigilweaver.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }}
              className="hover:underline"
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
              style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }}
              className="hover:underline"
              title="https://sigilweaver.app/terms"
            >
              Terms of Use
            </a>
          </div>
          <div>
            <a
              href="https://github.com/sigilweaver/sigilweaver-app/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }}
              className="hover:underline"
              title="https://github.com/sigilweaver/sigilweaver-app/blob/main/LICENSE"
            >
              License (AGPL v3)
            </a>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Built With</h3>
        <div className="text-sm space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <strong>Frontend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5">
                <li><a href="https://react.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://react.dev">React</a> - UI framework</li>
                <li><a href="https://www.electronjs.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://www.electronjs.org">Electron</a> - Desktop wrapper</li>
                <li><a href="https://zustand-demo.pmnd.rs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://zustand-demo.pmnd.rs">Zustand</a> - State management</li>
                <li><a href="https://reactflow.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://reactflow.dev">Xyflow</a> - Canvas/graph rendering</li>
                <li><a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://vitejs.dev">Vite</a> - Build tooling</li>
                <li><a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://tailwindcss.com">TailwindCSS</a> - Styling</li>
                <li><a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://lucide.dev">Lucide</a> - Icons</li>
              </ul>
            </div>
            <div>
              <strong>Backend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5">
                <li><a href="https://www.python.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://www.python.org">Python</a> - Language runtime</li>
                <li><a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://fastapi.tiangolo.com">FastAPI</a> - REST API framework</li>
                <li><a href="https://pola.rs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://pola.rs">Polars</a> - Data processing</li>
                <li><a href="https://docs.pydantic.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://docs.pydantic.dev">Pydantic</a> - Data validation</li>
                <li><a href="https://www.uvicorn.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-border-focus)', fontWeight: 'bold' }} className="hover:underline" title="https://www.uvicorn.org">Uvicorn</a> - ASGI server</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Author */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Author</h3>
        <p className="text-sm">
          Created by Nathan Riley
        </p>
      </div>

      {/* Attribution */}
      <div 
        className="pt-4"
        style={{ borderTop: '1px solid var(--color-modal-container-border)' }}
      >
        <p className="text-sm opacity-70">
          Sigilweaver uses open source software. See package.json and requirements.txt 
          for full dependency lists and their respective licenses.
        </p>
      </div>
    </div>
  );
};

export default AboutContent;
