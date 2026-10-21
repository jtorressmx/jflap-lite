import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/App';
import { restoreSettings } from '@/lib/settings';
import '@/styles.css';

/**
 * Restores the workspace and mounts the application in its current runtime.
 * Takes no input.
 * @returns A promise resolved after mounting the renderer.
 */
async function start() {
   if (import.meta.env.DEV && !window.desktop) {
      const { createBrowserPreview } = await import('@/lib/browserPreview');
      window.desktop = createBrowserPreview();
   }
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
