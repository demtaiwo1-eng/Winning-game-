// Acknowledge a successfully booted native bundle so Capgo can retain
// rollback protection. Remote patch discovery and user notification live in
// RemoteUpdateNotice, which is shared by native, PWA and browser installs.

export async function initLiveUpdate(): Promise<void> {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch (err) {
    console.warn("live update readiness check skipped", err);
  }
}
