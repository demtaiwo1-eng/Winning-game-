import React, { useEffect, useRef, useState } from "react";
import { EPHINTA_MUSIC, safeLicensedAudioUrl } from "../lib/music/ephinta-config";

type Props = {
  /** HTTPS URL or same-origin path to an audio recording cleared for EPHINTA commercial use. */
  audioUrl?: string;
  showPrompt?: boolean;
  autoPlay?: boolean;
};

function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePreference(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);
  const source = safeLicensedAudioUrl(audioUrl || EPHINTA_MUSIC.licensedAudioUrl || "");
  const [volume, setVolume] = useState(() => {
    const saved = Number(readPreference("ephinta:sound-volume"));
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.35;
  });
  const [consent, setConsent] = useState<boolean | null>(() => {
    const saved = readPreference("ephinta:sound");
    return saved === "on" ? true : saved === "off" ? false : null;
  });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useEffect(() => { setPreferencesLoaded(true); }, []);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    writePreference("ephinta:sound-volume", String(volume));
  }, [volume]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "ephinta:sound" && event.newValue === "off") {
        audioRef.current?.pause();
        setConsent(false);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const sync = () => {
      const deviceLocked = Boolean(document.querySelector(".ess-device-lock"));
      const authDialog = Boolean(document.querySelector(".ess-auth-modal, .eph-modal, #eph-auth-dialog"));
      setAuthDialogOpen(deviceLocked || authDialog);
      if (deviceLocked) {
        audioRef.current?.pause();
        setPlaying(false);
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!source || !autoPlay || consent !== true || !preferencesLoaded) return;
    if (skipNextAutoPlay.current) { skipNextAutoPlay.current = false; return; }
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play().catch(() => setStatus("Tap Play to start music; this browser requires a user gesture."));
  }, [autoPlay, consent, preferencesLoaded, source]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function play(): Promise<void> {
    const audio = audioRef.current;
    if (!audio || !source) return;
    try {
      audio.volume = volume;
      await audio.play();
      setStatus("Licensed event music is playing.");
    } catch (error) {
      console.warn("EPHINTA audio playback was blocked or unavailable.", error);
      setStatus("Music could not start. Check the configured audio source and tap Play again.");
    }
  }

  function chooseConsent(accepted: boolean): void {
    setConsent(accepted);
    writePreference("ephinta:sound", accepted ? "on" : "off");
    if (accepted) { skipNextAutoPlay.current = true; void play(); }
    else {
      audioRef.current?.pause();
      setPlaying(false);
      setStatus("Music is off.");
    }
  }

  // No source means no prompt, audio request, or misleading claim that EPHINTA
  // owns a recording. The player becomes available after a rights-cleared URL
  // is configured through VITE_EPHINTA_LICENSED_AUDIO_URL or the audioUrl prop.
  if (!source) return null;

  const trackTitle = (() => {
    try {
      const path = new URL(source, window.location.origin).pathname;
      const filename = path.split("/").pop() || "";
      return decodeURIComponent(filename).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "Licensed event music";
    } catch {
      return "Licensed event music";
    }
  })();

  return (
    <>
      <audio
        ref={audioRef}
        src={source}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => setPlaying(false)}
        onError={() => setStatus("The configured licensed audio source is unavailable.")}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>

      {showPrompt && preferencesLoaded && consent === null && !authDialogOpen && (
        <div className="eph-audio__backdrop">
          <section className="eph-audio__prompt" role="dialog" aria-modal="true" aria-labelledby="eph-audio-title">
            <span className="eph-audio__prompt-icon" aria-hidden="true">♫</span>
            <p className="eph-audio__eyebrow">Optional event atmosphere</p>
            <h2 id="eph-audio-title">Would you like background music?</h2>
            <p>EPHINTA will only play the audio source configured by the platform owner. Your choice is saved on this device.</p>
            <div className="eph-audio__choices">
              <button type="button" className="eph-audio__accept" onClick={() => chooseConsent(true)}>Yes, play music</button>
              <button type="button" className="eph-audio__decline" onClick={() => chooseConsent(false)}>No, thanks</button>
            </div>
          </section>
        </div>
      )}

      {consent === true && !authDialogOpen && (!expanded ? (
        <button type="button" className="eph-audio__restore" onClick={() => setExpanded(true)} aria-label="Open music player">
          ♫ Music {playing ? "playing" : "paused"}
        </button>
      ) : (
        <section className="eph-audio__player" aria-label="EPHINTA licensed music player">
          <div className="eph-audio__player-heading">
            <span className="eph-audio__player-art" aria-hidden="true">♫</span>
            <div className="eph-audio__track-copy">
              <span className="eph-audio__player-label">EPHINTA MUSIC · RIGHTS-CLEARED SOURCE</span>
              <strong title={trackTitle}>{trackTitle}</strong>
            </div>
            <span className={"eph-audio__playing-indicator" + (playing ? " is-playing" : "")} aria-label={playing ? "Playing" : "Paused"} />
          </div>
          <div className="eph-audio__player-controls">
            <button className="eph-audio__control eph-audio__play" type="button" onClick={() => playing ? audioRef.current?.pause() : void play()} aria-label={playing ? "Pause music" : "Play music"}>{playing ? "Ⅱ" : "▶"}</button>
            <label className="eph-audio__volume">
              <span className="eph-audio__volume-label">Volume</span>
              <input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            </label>
            <button className="eph-audio__control eph-audio__mute" type="button" onClick={() => setVolume((value) => value === 0 ? 0.35 : 0)} aria-label={volume === 0 ? "Unmute music" : "Mute music"}>{volume === 0 ? "×" : "♪"}</button>
          </div>
          <div className="eph-audio__progress">
            <span>{formatTime(currentTime)}</span>
            <input aria-label="Seek music" type="range" min="0" max={duration || 0} step="1" value={Math.min(currentTime, duration || 0)} disabled={!duration} onChange={(event) => {
              const next = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = next;
              setCurrentTime(next);
            }} />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="eph-audio__player-footer">
            <button className="eph-audio__dismiss" type="button" onClick={() => setExpanded(false)}>Minimize</button>
            <button className="eph-audio__dismiss" type="button" onClick={() => chooseConsent(false)}>Turn music off</button>
          </div>
        </section>
      ))}
    </>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return minutes + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}
