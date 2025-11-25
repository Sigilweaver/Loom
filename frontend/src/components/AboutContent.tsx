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
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-modal-content-text)' }}>
          Sigilweaver
        </h3>
        <p className="text-sm opacity-70 mt-1">Version {version}</p>
      </div>

      {/* Description */}
      <div>
        <p style={{ color: 'var(--color-modal-content-text)' }}>
          The visual data pipeline tool you always wished existed.
        </p>
        <p className="text-sm opacity-70 mt-2">
          A visual workflow designer for building and executing data processing pipelines 
          through an intuitive drag-and-drop interface.
        </p>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Links</h3>
        <div className="text-sm opacity-70 space-y-1">
          <div>
            <strong>Website:</strong>{' '}
            <a
              href="https://sigilweaver.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-modal-btn-primary-bg)' }}
              className="hover:underline"
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
              style={{ color: 'var(--color-modal-btn-primary-bg)' }}
              className="hover:underline"
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
              style={{ color: 'var(--color-modal-btn-primary-bg)' }}
              className="hover:underline"
            >
              github.com/sigilweaver/sigilweaver-app
            </a>
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Legal</h3>
        <div className="text-sm opacity-70 space-y-1">
          <div>
            <a
              href="https://sigilweaver.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-modal-btn-primary-bg)' }}
              className="hover:underline"
            >
              Privacy Policy
            </a>
          </div>
          <div>
            <a
              href="https://sigilweaver.app/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-modal-btn-primary-bg)' }}
              className="hover:underline"
            >
              Terms of Use
            </a>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Built With</h3>
        <div className="text-xs opacity-70 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <strong>Frontend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5">
                <li>* <a href="https://react.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">React</a> - UI framework</li>
                <li>* <a href="https://www.electronjs.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Electron</a> - Desktop wrapper</li>
                <li>* <a href="https://zustand-demo.pmnd.rs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Zustand</a> - State management</li>
                <li>* <a href="https://reactflow.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Xyflow</a> - Canvas/graph rendering</li>
                <li>* <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Vite</a> - Build tooling</li>
                <li>* <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">TailwindCSS</a> - Styling</li>
              </ul>
            </div>
            <div>
              <strong>Backend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5">
                <li>* <a href="https://www.python.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Python 3.11+</a></li>
                <li>* <a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">FastAPI</a> - REST API</li>
                <li>* <a href="https://pola.rs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Polars</a> - Data processing</li>
                <li>* <a href="https://docs.pydantic.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Pydantic</a> - Validation</li>
                <li>* <a href="https://www.uvicorn.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-modal-btn-primary-bg)' }} className="hover:underline">Uvicorn</a> - ASGI server</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* License */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>License</h3>
        <p className="text-xs opacity-70">
          Sigilweaver is open source software. See{' '}
          <a
            href="https://github.com/sigilweaver/sigilweaver-app/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-modal-btn-primary-bg)' }}
            className="hover:underline"
          >
            LICENSE
          </a>
          {' '}in the project root for details.
        </p>
      </div>

      {/* Author */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Author</h3>
        <p className="text-xs opacity-70">
          Created by Nathan Riley
        </p>
      </div>

      {/* Attribution */}
      <div 
        className="pt-4"
        style={{ borderTop: '1px solid var(--color-modal-container-border)' }}
      >
        <p className="text-xs opacity-60">
          Sigilweaver uses open source software. See package.json and requirements.txt 
          for full dependency lists and their respective licenses.
        </p>
      </div>
    </div>
  );
};

export default AboutContent;
