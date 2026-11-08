export const EPHINTA_MUSIC = {
  priorityTracks: [
    "/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3",
    "/audio/Here%20we%20are-2%20-Wale%20Waves_ESS_Wedding.mp3",
    "/audio/Welcome,%20Little%20One-1-Wale%20Waves_ESS_Naming.mp3",
    "/audio/Welcome,%20Little%20One-2-Wale%20Waves_ESS_Naming.mp3",
    "/audio/You%20Will%20Live%20in%20Our%20Hearts-1-Wale%20Waves_ESS_Burials.mp3",
    "/audio/You%20Will%20Live%20in%20Our%20Hearts-2-Wale%20Waves_ESS_Burials.mp3",
  ],
  categoryTracks: {
    wedding: ["/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3", "/audio/Here%20we%20are-2%20-Wale%20Waves_ESS_Wedding.mp3"],
    naming: ["/audio/Welcome,%20Little%20One-1-Wale%20Waves_ESS_Naming.mp3", "/audio/Welcome,%20Little%20One-2-Wale%20Waves_ESS_Naming.mp3"],
    burial: ["/audio/You%20Will%20Live%20in%20Our%20Hearts-1-Wale%20Waves_ESS_Burials.mp3", "/audio/You%20Will%20Live%20in%20Our%20Hearts-2-Wale%20Waves_ESS_Burials.mp3"],
  },
} as const;
export function safeEphintaPlaylistUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "music.youtube.com" &&
      url.pathname === "/playlist" && url.searchParams.has("list") ? url.toString() : null;
  } catch { return null; }
}
