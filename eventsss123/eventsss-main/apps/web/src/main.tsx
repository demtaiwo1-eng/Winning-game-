import './lib/nativeFetch';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './EnterpriseApp';
import AudioExperience from "./components/AudioExperience";
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

function EphintaStartupReadySignal(): React.ReactElement | null {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    let hideTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      markEphintaAppReady();
      // Keep the branded first-paint overlay briefly so the mounted app shell
      // is ready underneath it before users can interact with the screen.
      hideTimer = window.setTimeout(() => setVisible(false), 450);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);
  if (!visible) return null;
  return (
    <div
      data-ephinta-startup-splash
      role="status"
      aria-label="Loading EPHINTA"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "grid",
        placeContent: "center",
        justifyItems: "center",
        gap: 12,
        background: "#10002f",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        opacity: 1,
      }}
    >
      <img src="/brand/ephinta_logo2.png" alt="" width="76" height="76" style={{ objectFit: "contain" }} />
      <strong style={{ fontSize: 24, letterSpacing: 1 }}>EPHINTA</strong>
      <span style={{ color: "#c4b5fd", fontSize: 13 }}>Preparing your workspace…</span>
    </div>
  );
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
      <strong style={{ fontSize: 24, letterSpacing: 1 }}>EPHINTA</strong>
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
          <EphintaStartupReadySignal />
          <Suspense fallback={<StartupLoadingScreen />}>
            <App />
          </Suspense>
          <AudioExperience showPrompt={false} autoPlay />
          <OfflineStatus />
          <SyncConflictList />
        </>
      </AppRouter>
    </StartupErrorBoundary>
  </React.StrictMode>,
);

initLiveUpdate();
initOfflineSync();
import "./styles/ephinta-polish.css";
import "./styles/ephinta-audio.css";
import "./ephinta-product-excellence.css";
import "./ephinta-screen-refinement.css";
