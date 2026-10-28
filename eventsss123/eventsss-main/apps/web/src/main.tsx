import './lib/nativeFetch';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './EnterpriseApp';
import OfflineStatus from './components/OfflineStatus';
import SyncConflictList from './components/SyncConflictList';
import './index.css';
import './ephinta-accessible-contrast.css';
import "./styles/ephinta-design4.css";
import './ess-bright-orange-theme.css';
import './theme/tokens.css';
import './ephinta-intro-refinement.css';
import "./styles/ephinta-design4-enforced.css";
import "./styles/ephinta-responsive-polish.css";
import { initLiveUpdate } from "./lib/liveUpdate";
import { initOfflineSync } from './lib/offline/sync';
import "./styles/ephinta-landing-repair.css";
import "./styles/ephinta-current-ui-repair.css";

/* ---------- Platform setup ---------- */
const capacitor = (window as unknown as {
  Capacitor?: { isNativePlatform?: () => boolean };
}).Capacitor;
const isNative = !!capacitor?.isNativePlatform?.();
const AppRouter = isNative ? HashRouter : BrowserRouter;

if (!isNative) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Unable to register ESS service worker.', error);
    },
  });
}

/* ---------- Render ---------- */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter>
      <>
        <Suspense fallback={null}>
          <App />
        </Suspense>
        <OfflineStatus />
        <SyncConflictList />
      </>
    </AppRouter>
  </React.StrictMode>,
);

initLiveUpdate();

initOfflineSync();
import "./styles/ephinta-polish.css";

import "./styles/ephinta-audio.css";

import { installEphintaIntroWatchdog, markEphintaAppReady } from "./lib/ephintaStartup";