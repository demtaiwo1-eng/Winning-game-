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
  const [volume, setVolume] = useState(0.35);
  const [trackIndex, setTrackIndex] = useState(0);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);
  const currentTrack = TRACKS[trackIndex];

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
    const syncAuthDialogState = () => setAuthDialogOpen(Boolean(document.querySelector(".ess-auth-modal, .eph-modal")));
    syncAuthDialogState();
    const observer = new MutationObserver(syncAuthDialogState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { if (audioRef.current) audioRef.current.muted = isMuted; }, [isMuted]);

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
      audio.muted = isMuted;
      await audio.play();
      setStatus("Background music is playing.");
    } catch (error) {
      setIsPlaying(false);
      console.warn("EPHINTA background music could not start.", error);
      setStatus("Playback was blocked. Press Play to start the music.");
    }
  }

  function chooseConsent(accepted: boolean) {
    setConsent(accepted);
    setStatus(accepted ? "Background music is starting." : "Background music is off.");
    try { localStorage.setItem("ephinta:sound", accepted ? "on" : "off"); } catch { /* Consent remains in memory for this visit. */ }
    if (!accepted) { audioRef.current?.pause(); setIsPlaying(false); return; }
    if (audioRef.current) { skipNextAutoPlay.current = true; void startPlayback(audioRef.current); }
  }

  function changeTrack(direction: -1 | 1) { setTrackIndex((current) => (current + direction + TRACKS.length) % TRACKS.length); }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); setIsPlaying(false); setStatus("Background music paused."); return; }
    await startPlayback(audio);
  }

  return (
    <>
      <audio ref={audioRef} src={audioUrl || currentTrack.src} preload="metadata"
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => changeTrack(1)}
        onError={() => { setIsPlaying(false); console.error("An EPHINTA background music track could not be loaded.", audioRef.current?.error); setStatus("This music track could not be loaded. Try the next track."); }}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>
      {showPrompt && preferencesLoaded && consent === null && !authDialogOpen && (
        <div className="eph-audio__backdrop"><section className="eph-audio__prompt" role="dialog" aria-labelledby="eph-audio-title">
          <span className="eph-audio__prompt-icon" aria-hidden="true">♫</span>
          <p className="eph-audio__eyebrow">A little atmosphere</p><h2 id="eph-audio-title">Enjoy background music?</h2>
          <p>May EPHINTA play its original event music while you browse? Your choice is saved on this device.</p>
          <div className="eph-audio__choices">
            <button type="button" className="eph-audio__accept" onClick={() => chooseConsent(true)}>Yes, play music</button>
            <button type="button" className="eph-audio__decline" onClick={() => chooseConsent(false)}>No, thanks</button>
          </div>
        </section></div>
      )}
      {preferencesLoaded && consent === false && (\n        <button type="button" className="eph-audio__restore" onClick={() => chooseConsent(true)}>♫ Turn music on</button>\n      )}\n\n      {preferencesLoaded && consent === true && (
        <section className="eph-audio__player" aria-label="EPHINTA music player">
          <div className="eph-audio__player-heading">
            <span className="eph-audio__player-art" aria-hidden="true">♫</span>
            <div className="eph-audio__track-copy"><span className="eph-audio__player-label">{"NOW PLAYING · " + currentTrack.category}</span><strong title={currentTrack.title}>{currentTrack.title}</strong></div>
            <span className={"eph-audio__playing-indicator" + (isPlaying ? " is-playing" : "")} aria-label={isPlaying ? "Playing" : "Paused"} />
          </div>
          <div className="eph-audio__player-controls">
            <button type="button" className="eph-audio__control" aria-label="Previous track" title="Previous track" onClick={() => changeTrack(-1)}>◀|</button>
            <button type="button" className="eph-audio__control eph-audio__play" aria-label={isPlaying ? "Pause music" : "Play music"} onClick={() => void togglePlayback()}>{isPlaying ? "Ⅱ" : "▶"}</button>
            <button type="button" className="eph-audio__control" aria-label="Next track" title="Next track" onClick={() => changeTrack(1)}>▶|</button>
            <button type="button" className="eph-audio__control eph-audio__mute" aria-label={isMuted ? "Unmute music" : "Mute music"} onClick={() => setIsMuted((muted) => !muted)}>{isMuted ? "×" : "♪"}</button>
            <label className="eph-audio__volume"><span className="eph-audio__volume-label">Volume</span>
              <input aria-label="Music volume" type="range" min="0" max="0.7" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            </label>
          </div>
          <button type="button" className="eph-audio__dismiss" onClick={() => chooseConsent(false)}>Turn music off</button>
        </section>
      )}
    </>
  );
}