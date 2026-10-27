// Live updates for the web layer inside the native Capacitor shell.
// Native APK code still requires a new signed APK/store update; this mechanism
// safely updates the bundled web UI without reinstalling the APK.

type RemoteVersion = { version: string; url: string };

const BASE = (
  ((import.meta as unknown as { env?: { VITE_UPDATE_URL?: string } }).env?.VITE_UPDATE_URL) || ""
).replace(/\/+$/, "");

let checking = false;

async function checkForUpdate(): Promise<void> {
  if (checking || !BASE) return;
  checking = true;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    const res = await fetch(`${BASE}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;

    const remote = (await res.json()) as RemoteVersion;
    if (!remote?.version || !remote?.url) return;

    const current = await CapacitorUpdater.current();
    if (current?.bundle?.version === remote.version) return;

    const bundle = await CapacitorUpdater.download({
      version: remote.version,
      url: new URL(remote.url, `${BASE}/`).toString(),
    });

    // Apply while the app is not visible. This avoids interrupting an active
    // session; the new bundle becomes active when the native shell resumes.
    const apply = async () => {
      if (document.visibilityState !== "hidden") return;
      document.removeEventListener("visibilitychange", apply);
      try {
        await CapacitorUpdater.set(bundle);
      } catch (err) {
        console.warn("live update: could not apply", err);
      }
    };
    document.addEventListener("visibilitychange", apply, { once: true });
  } catch (err) {
    console.warn("live update check skipped", err);
  } finally {
    checking = false;
  }
}

export async function initLiveUpdate(): Promise<void> {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    // Must run on every successful start so the updater can confirm the current
    // bundle is healthy and retain its rollback protection.
    await CapacitorUpdater.notifyAppReady();
    await checkForUpdate();

    // Also check whenever the user returns to the app. This makes published
    // web-layer updates available without requiring an APK reinstall.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    });
  } catch (err) {
    console.warn("live update skipped", err);
  }
}
