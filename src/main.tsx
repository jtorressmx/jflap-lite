import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { restoreSettings } from './lib/settings';
async function start() {
   try {
      const stored = await window.desktop.readWorkspace();
      if (stored) {
         const parsed = JSON.parse(stored);
         restoreSettings(parsed.settings);
         localStorage.setItem('jflap-lite.workspace.v1', stored);
      }
   } catch {
      /* The persistent renderer workspace is also available as a fallback. */
   }
   ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
         <App />
      </React.StrictMode>
   );
}
void start();
