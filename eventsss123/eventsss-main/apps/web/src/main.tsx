import './lib/nativeFetch';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './EnterpriseApp';
import EphintaHelpAssistant from "./components/EphintaHelpAssistant";
import './styles/ephinta-global.css';
import EphintaIntro from './components/branding/EphintaIntro';
import AudioExperience from "./components/AudioExperience";
import OfflineStatus from './components/OfflineStatus';
import SyncConflictList from './components/SyncConflictList';
import RemoteUpdateNotice from './components/RemoteUpdateNotice';

import { initLiveUpdate } from "./lib/liveUpdate";
import { initOfflineSync } from './lib/offline/sync';

import { installEphintaIntroWatchdog, markEphintaAppReady } from "./lib/ephintaStartup";

/* ---------- Platform setup ---------- */
const capacitor = (window as unknown as {
  Capacitor?: { isNativePlatform?: () => boolean };
}).Capacitor;
const isNative = !!capacitor?.isNativePlatform?.();
const AppRouter = isNative ? HashRouter : BrowserRouter;

installEphintaIntroWatchdog();

if (!isNative) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Unable to register EPHINTA service worker.', error);
    },
  });
}

function EphintaStartupReadySignal(): null {
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      markEphintaAppReady();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

class StartupErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('EPHINTA could not render its application screen.', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main role="alert" className="eph-startup-screen eph-startup-screen--error">
          <h1 style={{ margin: 0 }}>EPHINTA needs to reload</h1>
          <p style={{ maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
            Something interrupted this screen. Your saved account and planning data have not been cleared.
          </p>
          <button type="button" className="eph-startup-screen__action" onClick={() => window.location.reload()}>
            Reload EPHINTA
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

function StartupLoadingScreen(): React.ReactElement {
  return (
    <main role="status" aria-live="polite" className="eph-startup-screen">
      <img
        src={`${import.meta.env.BASE_URL}brand/ephinta_logo2.png`}
        alt="EPHINTA"
        width={112}
        height={112}
        fetchPriority="high"
        className="eph-startup-screen__logo"
      />
      <strong className="eph-startup-screen__brand">EPHINTA</strong>
      <span className="eph-startup-screen__message">Preparing your workspace…</span>
    </main>
  );
}

/* ---------- Render ---------- */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      <AppRouter>
        <>
          <EphintaIntro />
          <Suspense fallback={<StartupLoadingScreen />}>
            <>
              <App />
              <EphintaStartupReadySignal />
            </>
          </Suspense>
          <AudioExperience showPrompt autoPlay />
          <OfflineStatus />
          <SyncConflictList />
          <RemoteUpdateNotice />
          <EphintaHelpAssistant />
        </>
      </AppRouter>
    </StartupErrorBoundary>
  </React.StrictMode>,
);

initLiveUpdate();
initOfflineSync();

