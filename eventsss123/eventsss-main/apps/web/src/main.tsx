import './lib/nativeFetch';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './EnterpriseApp';
import EphintaIntro from './components/branding/EphintaIntro';
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
import "./styles/ephinta-unified-design-system.css";
import "./styles/ephinta-theme-text-contrast.css";
import "./styles/ephinta-operations-experience.css";
import "./styles/ephinta-global-navigation-fix.css";
import "./styles/ephinta-parent-design-system.css";
