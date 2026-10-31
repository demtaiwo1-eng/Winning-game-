import { apiUrl } from "./api";

let registrationListenerAdded = false;

/**
 * Capacitor push registration — no-op on pure web.
 * When the app runs inside the Capacitor shell with @capacitor/push-notifications
 * installed, registers the device token with POST /api/v1/notifications/push-token.
 */
export async function registerPushIfNative(): Promise<void> {
  if ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ENABLE_PUSH !== "true" || registrationListenerAdded) return;
  try {
    // Dynamic import so web builds without native deps still work
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core: any = await import("@capacitor/core").catch(() => null);
    if (!core?.Capacitor?.isNativePlatform?.()) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pushMod: any = await import("@capacitor/push-notifications").catch(() => null);
    if (!pushMod?.PushNotifications) return;

    const { PushNotifications } = pushMod;
    const { Capacitor } = core;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    await PushNotifications.register();

    registrationListenerAdded = true;
    PushNotifications.addListener("registration", async (token: { value: string }) => {
      try {
        const t = localStorage.getItem("ess_access_token");
        await fetch(apiUrl("/notifications/push-token"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
          body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
        });
      } catch {
        /* offline */
      }
    });
  } catch {
    /* web or missing plugin */
  }
}
