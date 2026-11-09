import { useCallback, useEffect, useState } from "react";

type UpdateManifest = {
  version: string;
  url: string;
  title?: string;
  message?: string;
};

type ViteUpdateEnv = {
  VITE_API_URL?: string;
  VITE_UPDATE_URL?: string;
  VITE_APP_VERSION?: string;
  DEV?: boolean;
};

const env = (import.meta as unknown as { env?: ViteUpdateEnv }).env ?? {};
const API_BASE = (env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");
const UPDATE_BASE = (env.VITE_UPDATE_URL || `${API_BASE}/app-updates`).replace(/\/+$/, "");
const BUILT_VERSION = env.VITE_APP_VERSION || "bundled";
const DISMISSED_PREFIX = "ephinta:update-dismissed:";

function isNativeApp(): boolean {
  return Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}

export default function RemoteUpdateNotice() {
  const [update, setUpdate] = useState<UpdateManifest | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const checkForPatch = useCallback(async () => {
    // Never interrupt local development or browser tests with a remote
    // release banner unless the developer explicitly opts into this experience.
    if (env.DEV && localStorage.getItem("ephinta:dev-update-notice") !== "enabled") return;
    if (document.visibilityState === "hidden" || !navigator.onLine) return;
    try {
      const response = await fetch(`${UPDATE_BASE}/version.json?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const manifest = (await response.json()) as UpdateManifest;
      if (
        typeof manifest.version !== "string" ||
        !/^[a-zA-Z0-9._-]{1,64}$/.test(manifest.version) ||
        typeof manifest.url !== "string" ||
        !manifest.url
      ) return;

      const savedInstalledVersion = localStorage.getItem("ephinta:installed-version");
      let installedVersion = savedInstalledVersion === manifest.version
        ? savedInstalledVersion
        : BUILT_VERSION;
      if (installedVersion === "bundled") {
        installedVersion = savedInstalledVersion || installedVersion;
      }
      if (isNativeApp()) {
        try {
          const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
          const current = await CapacitorUpdater.current();
          installedVersion = current?.bundle?.version || installedVersion;
        } catch {
          // The embedded/saved version remains a safe comparison fallback.
        }
      }
      if (manifest.version === installedVersion) {
        setUpdate(null);
        setError("");
        return;
      }
      if (localStorage.getItem(`${DISMISSED_PREFIX}${manifest.version}`) === "1") return;
      setUpdate(manifest);
      setError("");
    } catch {
      // Offline, older API, or temporarily unavailable update service: keep the app usable.
    }
  }, []);

  useEffect(() => {
    void checkForPatch();
    const interval = window.setInterval(() => void checkForPatch(), 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkForPatch(); };
    const onOnline = () => void checkForPatch();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [checkForPatch]);

  const dismiss = () => {
    if (update) localStorage.setItem(`${DISMISSED_PREFIX}${update.version}`, "1");
    setUpdate(null);
    setError("");
  };

  const applyUpdate = async () => {
    if (!update || applying) return;
    setApplying(true);
    setError("");
    try {
      if (isNativeApp()) {
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        const bundleUrl = new URL(update.url, `${UPDATE_BASE}/`).toString();
        const bundle = await CapacitorUpdater.download({ version: update.version, url: bundleUrl });
        await CapacitorUpdater.set(bundle);
        localStorage.setItem("ephinta:installed-version", update.version);
        setUpdate(null);
        return;
      }

      // Web/PWA installations fetch the newly deployed origin bundle. The
      // service worker is asked to check first, then the page reloads safely.
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) await registration.update();
      localStorage.setItem("ephinta:installed-version", update.version);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The update could not be installed. Please try again.");
      setApplying(false);
    }
  };

  if (!update) return null;

  return (
    <aside className="ephinta-update-notice" role="status" aria-live="polite" aria-label="EPHINTA update available">
      <div className="ephinta-update-notice__copy">
        <span className="ephinta-update-notice__eyebrow">EPHINTA update available</span>
        <strong>{update.title || "A new EPHINTA patch is ready"}</strong>
        <p>{update.message || "A new version is available. Connect to the internet to install the latest improvements."}</p>
        {error && <span className="ephinta-update-notice__error" role="alert">{error}</span>}
      </div>
      <div className="ephinta-update-notice__actions">
        <button type="button" className="ephinta-update-notice__apply" onClick={() => void applyUpdate()} disabled={applying}>
          {applying ? "Installing…" : "Install update"}
        </button>
        <button type="button" className="ephinta-update-notice__dismiss" onClick={dismiss} disabled={applying}>
          Later
        </button>
      </div>
    </aside>
  );
}
