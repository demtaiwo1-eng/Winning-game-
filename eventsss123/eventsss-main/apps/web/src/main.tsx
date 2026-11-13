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
        <main
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: '#10002f',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ margin: 0 }}>EPHINTA needs to reload</h1>
          <p style={{ maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
            Something interrupted this screen. Your saved account and planning data have not been cleared.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              padding: '12px 20px',
              border: 0,
              borderRadius: 12,
              background: '#f97316',
              color: '#16052c',
              fontWeight: 700,
            }}
          >
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
    <main
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        background: '#10002f',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}brand/ephinta_logo2.png`}
        alt="EPHINTA"
        width={112}
        height={112}
        fetchPriority="high"
        style={{ width: 112, height: 112, objectFit: "contain", margin: "0 auto 8px", filter: "drop-shadow(0 10px 28px rgba(124, 77, 255, .28))" }}
      />
      <strong style={{ fontSize: 24, letterSpacing: 2, fontWeight: 900 }}>EPHINTA</strong>
      <span>Preparing your workspace…</span>
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

