import React, { useEffect, useRef, useState } from "react";
import { EPHINTA_MUSIC } from "../lib/music/ephinta-config";

type Props = { audioUrl?: string; showPrompt?: boolean; autoPlay?: boolean };
const TRACKS = [
  { src: EPHINTA_MUSIC.categoryTracks.wedding[0], title: "Here We Are — Wedding 1", category: "general" },
  { src: EPHINTA_MUSIC.categoryTracks.wedding[1], title: "Here We Are — Wedding 2", category: "general" },
  { src: EPHINTA_MUSIC.categoryTracks.naming[0], title: "Welcome, Little One — Naming 1", category: "general" },
  { src: EPHINTA_MUSIC.categoryTracks.naming[1], title: "Welcome, Little One — Naming 2", category: "general" },
  { src: EPHINTA_MUSIC.categoryTracks.burial[0], title: "You Will Live in Our Hearts — Burial 1", category: "burial" },
  { src: EPHINTA_MUSIC.categoryTracks.burial[1], title: "You Will Live in Our Hearts — Burial 2", category: "burial" },
] as const;

type MusicCategory = "general" | "burial";

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const [volume, setVolume] = useState(0.35);
  const [musicCategory, setMusicCategory] = useState<MusicCategory>("general");
  const [trackIndex, setTrackIndex] = useState(0);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);
  const currentTrack = TRACKS[trackIndex];

  useEffect(() => {
    try {
      const savedVolume = Number(localStorage.getItem("ephinta:sound-volume"));
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 0.7) setVolume(savedVolume);
      const savedSound = localStorage.getItem("ephinta:sound");
      if (savedSound === "off") setConsent(false);
      if (savedSound === "on") setConsent(true);
      const sessionCategory = sessionStorage.getItem("ephinta:music-category");
      if (sessionCategory === "burial") {
        setMusicCategory("burial");
        setTrackIndex(4);
      } else {
        // A new browsing session always opens with the first Wale Waves track.
        sessionStorage.removeItem("ephinta:music-category");
        setMusicCategory("general");
        setTrackIndex(0);
      }
    } catch { /* Storage may be unavailable in private browsing. */ }
    finally { setPreferencesLoaded(true); }
  }, []);

  useEffect(() => {
    const syncAuthDialogState = () => setAuthDialogOpen(Boolean(document.querySelector(".ess-auth-modal, .eph-modal")));
    syncAuthDialogState();
    const observer = new MutationObserver(syncAuthDialogState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    if (!preferencesLoaded || consent !== true || !autoPlay) return;
    if (skipNextAutoPlay.current) { skipNextAutoPlay.current = false; return; }
    if (audioRef.current) void startPlayback(audioRef.current);
  }, [audioUrl, autoPlay, consent, preferencesLoaded, trackIndex]);

  useEffect(() => {
    try { localStorage.setItem("ephinta:sound-volume", String(volume)); }
    catch { /* Optional preference only. */ }
  }, [volume]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function startPlayback(audio: HTMLAudioElement) {
    try {
      audio.volume = volume;
      await audio.play();
      setStatus("Background music is playing.");
    } catch (error) {
      console.warn("EPHINTA background music could not start.", error);
      setStatus("Playback was blocked. Use the music permission prompt or your browser's play control.");
    }
  }

  function selectBurialPlaylist() {
    setMusicCategory("burial");
    setTrackIndex(4);
    try { sessionStorage.setItem("ephinta:music-category", "burial"); }
    catch { /* The selected playlist remains active for this page visit. */ }
    if (consent === true && audioRef.current) {
      // Start from the click gesture so browsers that require user interaction allow playback.
      skipNextAutoPlay.current = true;
      audioRef.current.src = audioUrl || TRACKS[4].src;
      audioRef.current.load();
      void startPlayback(audioRef.current);
    } else {
      setStatus("The burial playlist is selected. Allow background music to start playback.");
    }
  }

  useEffect(() => {
    const handlePlanSelection = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("button, a, [role='button']");
      const label = control?.textContent?.replace(/\\s+/g, " ").trim().toLowerCase() ?? "";
      if (label.includes("plan a burial")) selectBurialPlaylist();
    };
    document.addEventListener("click", handlePlanSelection, true);
    return () => document.removeEventListener("click", handlePlanSelection, true);
  }, [consent, audioUrl]);

  function chooseConsent(accepted: boolean) {
    setConsent(accepted);
    setStatus(accepted ? "Background music is starting." : "Background music is off.");
    try { localStorage.setItem("ephinta:sound", accepted ? "on" : "off"); }
    catch { /* Consent remains in memory for this visit. */ }
    if (!accepted) { audioRef.current?.pause(); return; }
    if (audioRef.current) {
      skipNextAutoPlay.current = true;
      void startPlayback(audioRef.current);
    }
  }

  function advanceTrack() {
    setTrackIndex((current) => {
      if (musicCategory === "burial") return current === 4 ? 5 : 4;
      return current >= 3 ? 0 : current + 1;
    });
  }

  return (
    <>
      <audio ref={audioRef} src={audioUrl || currentTrack.src} preload="metadata" onEnded={advanceTrack}
        onError={() => {
          console.error("An EPHINTA background music track could not be loaded.", audioRef.current?.error);
          setStatus("The selected background music could not be loaded.");
        }}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>
      {showPrompt && preferencesLoaded && consent === null && !authDialogOpen && (
        <div className="eph-audio__backdrop">
          <section className="eph-audio__prompt" role="dialog" aria-labelledby="eph-audio-title">
            <span className="eph-audio__prompt-icon" aria-hidden="true">♫</span>
            <p className="eph-audio__eyebrow">A little atmosphere</p>
            <h2 id="eph-audio-title">Enjoy background music?</h2>
            <p>May EPHINTA play Wale Waves event music while you browse? Your choice is saved on this device. The first track is “Here We Are”. A burial playlist is selected automatically when you choose “Plan a Burial”.</p>
            <div className="eph-audio__choices">
              <button type="button" className="eph-audio__accept" onClick={() => chooseConsent(true)}>Yes, play music</button>
              <button type="button" className="eph-audio__decline" onClick={() => chooseConsent(false)}>No, thanks</button>
            </div>
            <a href={EPHINTA_MUSIC.playlistUrl} target="_blank" rel="noopener noreferrer">Open the live Wale Waves playlist on YouTube</a>
          </section>
        </div>
      )}
    </>
  );
}
