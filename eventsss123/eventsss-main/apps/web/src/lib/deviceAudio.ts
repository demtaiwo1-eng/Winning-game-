/**
 * EPHINTA device audio helper.
 *
 * Browsers cannot override system silent mode or physical volume.
 * Audio playback must be initiated by a user gesture when required.
 */
export type AudioReadiness = {
  supported: boolean;
  visiblePage: boolean;
  message: string;
};

export function getAudioReadiness(): AudioReadiness {
  const supported =
    typeof window !== "undefined" &&
    typeof window.AudioContext !== "undefined";

  const visiblePage =
    typeof document !== "undefined" &&
    document.visibilityState === "visible";

  return {
    supported,
    visiblePage,
    message: !supported
      ? "Audio testing is unavailable in this browser."
      : !visiblePage
        ? "Return to EPHINTA to enable sound."
        : "Tap Enable Sound and check your device volume if needed.",
  };
}

/**
 * Call only in response to a user's tap/click.
 * Returns false when the browser refuses playback.
 */
export async function playAudioTest(): Promise<boolean> {
  const AudioContextClass =
    typeof window !== "undefined"
      ? window.AudioContext
      : undefined;

  if (!AudioContextClass) return false;

  let context: AudioContext | undefined;

  try {
    context = new AudioContextClass();

    if (context.state === "suspended") {
      await context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 660;

    // A short, quiet test tone; never blast audio unexpectedly.
    gain.gain.setValueAtTime(0.04, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.35
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);

    await new Promise<void>((resolve) => {
      oscillator.onended = () => resolve();
    });

    return true;
  } catch {
    return false;
  } finally {
    if (context && context.state !== "closed") {
      await context.close().catch(() => undefined);
    }
  }
}

/**
 * Returns the Capacitor native platform when available.
 * This detects platform only; it does not change silent mode.
 */
export function getDevicePlatform(): "ios" | "android" | "web" {
  const cap = (window as Window & {
    Capacitor?: {
      getPlatform?: () => string;
    };
  }).Capacitor;

  const platform = cap?.getPlatform?.();

  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "web";
}
