import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function SimpleApp() {
  return (
    <div className="p-8 bg-blue-100 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-800">
        Simple Test App - React is Working!
      </h1>
      <p className="mt-4 text-blue-700">
        If you can see this, React and Tailwind are working correctly.
      </p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>,
)
