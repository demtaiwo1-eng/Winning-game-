import React, { useEffect, useRef, useState } from "react";
import { EPHINTA_MUSIC } from "../lib/music/ephinta-config";

type Props = {
  /** Optional override; by default the bundled, licensed EPHINTA tracks are used. */
  audioUrl?: string;
  /** Show a one-time consent dialog when the user has not chosen yet. */
  showPrompt?: boolean;
  /** Resume playback on later visits after the user has consented. */
  autoPlay?: boolean;
};

const TRACKS = [
  ...EPHINTA_MUSIC.categoryTracks.wedding,
  ...EPHINTA_MUSIC.categoryTracks.naming,
  ...EPHINTA_MUSIC.categoryTracks.burial,
] as const;

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const [volume, setVolume] = useState(0.35);
  const [trackIndex, setTrackIndex] = useState(0);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);

  useEffect(() => {
    try {
      const savedVolume = Number(localStorage.getItem("ephinta:sound-volume"));
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 0.7) setVolume(savedVolume);
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
      setAuthDialogOpen(Boolean(document.querySelector(".ess-auth-modal")));
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
    if (skipNextAutoPlay.current) {
      skipNextAutoPlay.current = false;
      return;
    }
    void startPlayback(audio);
  }, [audioUrl, autoPlay, consent, preferencesLoaded, trackIndex, volume]);

  useEffect(() => {
    try {
      localStorage.setItem("ephinta:sound-volume", String(volume));
      localStorage.setItem("ephinta:music-track", String(trackIndex));
    } catch { /* Optional preference only. */ }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, trackIndex]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  async function startPlayback(audio: HTMLAudioElement) {
    try {
      audio.volume = volume;
      await audio.play();
      setStatus("Background music is playing.");
    } catch (error) {
      console.error("EPHINTA background music could not start.", error);
      setStatus("Background music could not start. Check your browser's audio settings and connection.");
    }
  }

  function chooseConsent(accepted: boolean) {
    setConsent(accepted);
    setStatus(accepted ? "Background music is starting." : "Background music is off.");
    try { localStorage.setItem("ephinta:sound", accepted ? "on" : "off"); } catch { /* Consent remains in memory for this visit. */ }
    if (!accepted) {
      audioRef.current?.pause();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    skipNextAutoPlay.current = true;
    void startPlayback(audio);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl || TRACKS[trackIndex]}
        preload="metadata"
        onEnded={() => {
          setTrackIndex((current) => (current + 1) % TRACKS.length);
        }}
        onError={() => {
          const error = audioRef.current?.error;
          console.error("An EPHINTA background music track could not be loaded.", error);
          setStatus("A music track could not be loaded.");
        }}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>
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
