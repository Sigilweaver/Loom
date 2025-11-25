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

      {/* Credits */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Built With</h3>
        <div className="text-xs opacity-70 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <strong>Frontend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5">
                <li>* React - UI framework</li>
                <li>* Electron - Desktop wrapper</li>
                <li>* Zustand - State management</li>
                <li>* Xyflow - Canvas/graph rendering</li>
                <li>* Vite - Build tooling</li>
                <li>* TailwindCSS - Styling</li>
              </ul>
            </div>
            <div>
              <strong>Backend:</strong>
              <ul className="ml-4 mt-1 space-y-0.5">
                <li>* Python 3.11+</li>
                <li>* FastAPI - REST API</li>
                <li>* Polars - Data processing</li>
                <li>* Pydantic - Validation</li>
                <li>* Uvicorn - ASGI server</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* License */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>License</h3>
        <p className="text-xs opacity-70">
          Sigilweaver is open source software. Check the GitHub repository for license details.
        </p>
      </div>

      {/* Author */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-modal-content-text)' }}>Author</h3>
        <p className="text-xs opacity-70">
          Created by the Sigilweaver Development Team
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
