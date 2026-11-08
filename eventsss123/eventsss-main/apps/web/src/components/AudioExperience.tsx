import React, { useEffect, useMemo, useRef, useState } from "react";
import { EPHINTA_MUSIC } from "../lib/music/ephinta-config";

type Props = {
  /** Optional override; by default the bundled, licensed EPHINTA tracks are used. */
  audioUrl?: string;
  /** Show a one-time consent dialog when the user has not chosen yet. */
  showPrompt?: boolean;
  /** Resume playback on later visits after the user has consented. */
  autoPlay?: boolean;
};
type MusicCategory = keyof typeof EPHINTA_MUSIC.categoryTracks;
type SyncedTrack = {
  videoId: string;
  playlistId: string;
  categorySource: string;
  title: string;
};
type PlaylistCatalog = {
  categories?: Partial<Record<MusicCategory, SyncedTrack[]>>;
};

function readCategory(): MusicCategory {
  try {
    const saved = localStorage.getItem("ephinta:music-category");
    if (saved === "wedding" || saved === "naming" || saved === "burial") return saved;
  } catch { /* local storage is optional */ }
  return "wedding";
}

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const [volume, setVolume] = useState(0.35);
  const [trackIndex, setTrackIndex] = useState(0);
  const [category, setCategory] = useState<MusicCategory>(readCategory);
  const [catalog, setCatalog] = useState<PlaylistCatalog | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);
  const categoryTracks = EPHINTA_MUSIC.categoryTracks[category];
  const syncedTrack = catalog?.categories?.[category]?.[0];
  const youtubeEmbedUrl = useMemo(() => {
    if (!syncedTrack) return null;
    if (syncedTrack.categorySource === "playlist-title-tag" && syncedTrack.playlistId) {
      return "https://www.youtube.com/embed/videoseries?list=" + encodeURIComponent(syncedTrack.playlistId) + "&autoplay=1&rel=0";
    }
    return "https://www.youtube.com/embed/" + encodeURIComponent(syncedTrack.videoId) + "?autoplay=1&rel=0";
  }, [syncedTrack]);

  useEffect(() => {
    try {
      const savedVolume = Number(localStorage.getItem("ephinta:sound-volume"));
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 0.7) setVolume(savedVolume);
      const savedTrack = Number(localStorage.getItem("ephinta:music-track"));
      if (Number.isInteger(savedTrack) && savedTrack >= 0 && savedTrack < categoryTracks.length) setTrackIndex(savedTrack);
      const savedSound = localStorage.getItem("ephinta:sound");
      if (savedSound === "off") setConsent(false);
      if (savedSound === "on") setConsent(true);
    } catch { /* Storage may be unavailable in private browsing. */ }
    finally { setPreferencesLoaded(true); }
  }, []);

  useEffect(() => {
    if (trackIndex >= categoryTracks.length) setTrackIndex(0);
  }, [category, categoryTracks.length, trackIndex]);

  useEffect(() => {
    let active = true;
    fetch("/data/wale-waves-playlists.json", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result: PlaylistCatalog | null) => { if (active && result) setCatalog(result); })
      .catch(() => { /* Bundled EPHINTA tracks remain the fallback. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const updateCategory = (value: unknown) => {
      if (value === "wedding" || value === "naming" || value === "burial") {
        setCategory(value);
        setTrackIndex(0);
        try { localStorage.setItem("ephinta:music-category", value); } catch { /* optional */ }
      }
    };
    const onCustomChange = (event: Event) => updateCategory((event as CustomEvent).detail);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "ephinta:music-category") updateCategory(event.newValue);
    };
    window.addEventListener("ephinta:music-category-change", onCustomChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ephinta:music-category-change", onCustomChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const syncAuthDialogState = () => {
      setAuthDialogOpen(Boolean(document.querySelector(".ess-auth-modal, .eph-modal")));
    };
    syncAuthDialogState();
    const observer = new MutationObserver(syncAuthDialogState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    if (!preferencesLoaded || consent !== true || !autoPlay) return;
    if (youtubeEmbedUrl) {
      audio.pause();
      setStatus("Your " + category + " YouTube music is ready in the player below.");
      return;
    }
    if (skipNextAutoPlay.current) {
      skipNextAutoPlay.current = false;
      return;
    }
    void startPlayback(audio);
  }, [audioUrl, autoPlay, category, consent, preferencesLoaded, trackIndex, volume, youtubeEmbedUrl]);

  useEffect(() => {
    try {
      localStorage.setItem("ephinta:sound-volume", String(volume));
      localStorage.setItem("ephinta:music-track", String(trackIndex));
    } catch { /* Optional preference only. */ }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, trackIndex]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function startPlayback(audio: HTMLAudioElement) {
    try {
      audio.volume = volume;
      await audio.play();
      setStatus("Background music is playing.");
    } catch (error) {
      console.warn("EPHINTA background music could not start.", error);
      setStatus("Press play in the music controls if your browser blocked automatic playback.");
    }
  }

  function chooseConsent(accepted: boolean) {
    setConsent(accepted);
    setStatus(accepted
      ? youtubeEmbedUrl ? "Your YouTube music player is ready below." : "Background music is starting."
      : "Background music is off.");
    try { localStorage.setItem("ephinta:sound", accepted ? "on" : "off"); } catch { /* Consent remains in memory for this visit. */ }
    if (!accepted) {
      audioRef.current?.pause();
      return;
    }
    if (youtubeEmbedUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    skipNextAutoPlay.current = true;
    void startPlayback(audio);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl || categoryTracks[trackIndex] || categoryTracks[0]}
        preload="metadata"
        onEnded={() => setTrackIndex((current) => (current + 1) % categoryTracks.length)}
        onError={() => {
          const error = audioRef.current?.error;
          console.error("An EPHINTA background music track could not be loaded.", error);
          setStatus("A music track could not be loaded. Check your connection.");
        }}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>
      {consent === true && youtubeEmbedUrl && (
        <section className="eph-audio__youtube" aria-label={"Wale Waves " + category + " playlist"}>
          <p className="eph-audio__eyebrow">Wale Waves · {category}</p>
          <iframe
            title={"Wale Waves " + category + " music"}
            src={youtubeEmbedUrl}
            width="320"
            height="200"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            style={{ display: "block", width: "min(100%, 360px)", minHeight: 200, border: 0, borderRadius: 14 }}
          />
          <p className="eph-audio__status">Use the YouTube player controls to start or pause this playlist.</p>
        </section>
      )}
      {showPrompt && preferencesLoaded && consent === null && !authDialogOpen && (
        <div className="eph-audio__backdrop">
          <section className="eph-audio__prompt" role="dialog" aria-labelledby="eph-audio-title">
            <span className="eph-audio__prompt-icon" aria-hidden="true">♫</span>
            <p className="eph-audio__eyebrow">A little atmosphere</p>
            <h2 id="eph-audio-title">Enjoy background music?</h2>
            <p>May EPHINTA play its original event music while you browse? Your choice is saved on this device.</p>
            <div className="eph-audio__choices">
              <button type="button" className="eph-audio__accept" onClick={() => chooseConsent(true)}>Yes, play music</button>
              <button type="button" className="eph-audio__decline" onClick={() => chooseConsent(false)}>No, thanks</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
