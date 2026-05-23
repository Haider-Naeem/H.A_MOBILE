import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ✅ Force the browser engine to re-process input after any focus event.
// This recovers from Electron's "frozen input" state without needing minimize/restore.
window.addEventListener('focus', () => {
  document.activeElement?.blur();
  document.body.focus();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)