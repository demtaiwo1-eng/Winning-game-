/**
 * Audio may only be enabled when the platform owner configures a source that
 * EPHINTA has permission to stream commercially. No third-party recordings are
 * bundled or selected by default.
 */
export function safeLicensedAudioUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.startsWith("//")) return null;
  try {
    const url = new URL(candidate, "https://ephinta.invalid");
    if (url.protocol !== "https:") return null;
    if (url.origin === "https://ephinta.invalid") {
      return url.pathname.startsWith("/") ? url.pathname + url.search + url.hash : null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

const configuredAudioUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_EPHINTA_LICENSED_AUDIO_URL || ""
    : "";

export const EPHINTA_MUSIC = {
  licensedAudioUrl: safeLicensedAudioUrl(configuredAudioUrl),
} as const;
