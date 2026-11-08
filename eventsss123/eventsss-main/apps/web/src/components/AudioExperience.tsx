import React, { useEffect, useRef, useState } from "react";
import { EPHINTA_MUSIC } from "../lib/music/ephinta-config";

type Props = { audioUrl?: string; showPrompt?: boolean; autoPlay?: boolean };
const TRACKS = [
  { src: EPHINTA_MUSIC.categoryTracks.wedding[0], title: "Here We Are — Wedding 1", category: "Wedding" },
  { src: EPHINTA_MUSIC.categoryTracks.wedding[1], title: "Here We Are — Wedding 2", category: "Wedding" },
  { src: EPHINTA_MUSIC.categoryTracks.naming[0], title: "Welcome, Little One — Naming 1", category: "Naming" },
  { src: EPHINTA_MUSIC.categoryTracks.naming[1], title: "Welcome, Little One — Naming 2", category: "Naming" },
  { src: EPHINTA_MUSIC.categoryTracks.burial[0], title: "You Will Live in Our Hearts — 1", category: "Memorial" },
  { src: EPHINTA_MUSIC.categoryTracks.burial[1], title: "You Will Live in Our Hearts — 2", category: "Memorial" },
] as const;

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const [volume] = useState(0.35);
  const [trackIndex, setTrackIndex] = useState(0);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);
  const currentTrack = TRACKS[trackIndex];

  useEffect(() => {
    try {
      const savedVolume = Number(localStorage.getItem("ephinta:sound-volume"));
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 0.7) {
        // Restore the saved preference without displaying a persistent player.
        if (audioRef.current) audioRef.current.volume = savedVolume;
      }
      const savedTrack = Number(localStorage.getItem("ephinta:music-track"));
      if (Number.isInteger(savedTrack) && savedTrack >= 0 && savedTrack < TRACKS.length) setTrackIndex(savedTrack);
      const savedSound = localStorage.getItem("ephinta:sound");
      if (savedSound === "off") setConsent(false);
      if (savedSound === "on") setConsent(true);
    } catch { /* Storage may be unavailable in private browsing. */ }
    finally { setPreferencesLoaded(true); }
  }, []);

  useEffect(() => {
    const syncAuthDialogState = () => {
      // Keep the permission prompt out of the way of authentication dialogs.
      document.documentElement.dataset.ephintaAuthDialog = String(
        Boolean(document.querySelector(".ess-auth-modal, .eph-modal")),
      );
    };
    syncAuthDialogState();
    const observer = new MutationObserver(syncAuthDialogState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || consent !== true || !autoPlay) return;
    if (skipNextAutoPlay.current) { skipNextAutoPlay.current = false; return; }
    if (audioRef.current) void startPlayback(audioRef.current);
  }, [audioUrl, autoPlay, consent, preferencesLoaded, trackIndex]);

  useEffect(() => {
    try {
      localStorage.setItem("ephinta:sound-volume", String(volume));
      localStorage.setItem("ephinta:music-track", String(trackIndex));
    } catch { /* Optional preference only. */ }
  }, [volume, trackIndex]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function startPlayback(audio: HTMLAudioElement) {
    try {
      audio.volume = volume;
      await audio.play();
      setStatus("Background music is playing.");
    } catch (error) {
      console.warn("EPHINTA background music could not start.", error);
      setStatus("Playback was blocked. Music can be started after permission is granted.");
    }
  }

  function chooseConsent(accepted: boolean) {
    setConsent(accepted);
    setStatus(accepted ? "Background music is starting." : "Background music is off.");
    try {
      localStorage.setItem("ephinta:sound", accepted ? "on" : "off");
    } catch { /* Consent remains in memory for this visit. */ }
    if (!accepted) {
      audioRef.current?.pause();
      return;
    }
    if (audioRef.current) {
      skipNextAutoPlay.current = true;
      void startPlayback(audioRef.current);
    }
  }

  function advanceTrack() {
    setTrackIndex((current) => (current + 1) % TRACKS.length);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl || currentTrack.src}
        preload="metadata"
        onEnded={advanceTrack}
        onError={() => {
          console.error("An EPHINTA background music track could not be loaded.", audioRef.current?.error);
          setStatus("The selected background music could not be loaded.");
        }}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>
      {showPrompt && preferencesLoaded && consent === null && document.documentElement.dataset.ephintaAuthDialog !== "true" && (
        <div className="eph-audio__backdrop">
          <section className="eph-audio__prompt" role="dialog" aria-labelledby="eph-audio-title">
            <span className="eph-audio__prompt-icon" aria-hidden="true">♫</span>
            <p className="eph-audio__eyebrow">A little atmosphere</p>
            <h2 id="eph-audio-title">Enjoy background music?</h2>
            <p>May EPHINTA play its original event music while you browse? Your choice is saved on this device. The player controls will stay out of your way.</p>
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
