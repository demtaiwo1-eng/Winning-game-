export const EPHINTA_MUSIC = {
  // The opening queue is the three original Wale Waves tracks bundled in
  // this repository, one for each event type. Category playlists remain below.
  featuredTracks: [
    { key: "here-we-are-1", title: "Here We Are — Wale Waves (Wedding)", src: "/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3" },
    { key: "welcome-little-one-1", title: "Welcome, Little One — Wale Waves (Naming)", src: "/audio/Welcome,%20Little%20One-1-Wale%20Waves_ESS_Naming.mp3" },
    { key: "you-will-live-1", title: "You Will Live in Our Hearts — Wale Waves (Burial)", src: "/audio/You%20Will%20Live%20in%20Our%20Hearts-1-Wale%20Waves_ESS_Burials.mp3" },
  ],
  categoryTracks: {
    wedding: [
      { key: "here-we-are-1", title: "Here We Are — 1", src: "/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3" },
      { key: "here-we-are-2", title: "Here We Are — 2", src: "/audio/Here%20we%20are-2%20-Wale%20Waves_ESS_Wedding.mp3" },
    ],
    naming: [
      { key: "welcome-little-one-1", title: "Welcome, Little One — 1", src: "/audio/Welcome,%20Little%20One-1-Wale%20Waves_ESS_Naming.mp3" },
      { key: "welcome-little-one-2", title: "Welcome, Little One — 2", src: "/audio/Welcome,%20Little%20One-2-Wale%20Waves_ESS_Naming.mp3" },
    ],
    burial: [
      { key: "you-will-live-1", title: "You Will Live in Our Hearts — 1", src: "/audio/You%20Will%20Live%20in%20Our%20Hearts-1-Wale%20Waves_ESS_Burials.mp3" },
      { key: "you-will-live-2", title: "You Will Live in Our Hearts — 2", src: "/audio/You%20Will%20Live%20in%20Our%20Hearts-2-Wale%20Waves_ESS_Burials.mp3" },
    ],
  },
} as const;
