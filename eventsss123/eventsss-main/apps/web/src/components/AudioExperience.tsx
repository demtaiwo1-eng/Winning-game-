import React, { useEffect, useRef, useState } from "react";
import { EPHINTA_MUSIC } from "../lib/music/ephinta-config";

type Props = {
  audioUrl?: string;
  showPrompt?: boolean;
  autoPlay?: boolean;
};
type MusicCategory = keyof typeof EPHINTA_MUSIC.categoryTracks;

const CATEGORY_LABELS: Record<MusicCategory, string> = {
  wedding: "Wedding",
  naming: "Naming ceremony",
  burial: "Burial",
};

function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePreference(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional in private modes. */ }
}
function readCategory(): MusicCategory {
  const value = readPreference("ephinta:music-category");
  return value === "naming" || value === "burial" || value === "wedding" ? value : "wedding";
}

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipNextAutoPlay = useRef(false);
  const [category, setCategory] = useState<MusicCategory>(readCategory);
  const [trackIndex, setTrackIndex] = useState(0);
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
  const tracks = EPHINTA_MUSIC.categoryTracks[category];
  const source = audioUrl || tracks[trackIndex] || tracks[0];
  const trackTitle = source.split("/").pop()?.replace(/%20/g, " ").replace(/\.mp3$/i, "").replace(/[-_]/g, " ") || CATEGORY_LABELS[category];

  useEffect(() => { setPreferencesLoaded(true); }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
    writePreference("ephinta:sound-volume", String(volume));
  }, [volume]);
  useEffect(() => {
    writePreference("ephinta:music-category", category);
    setTrackIndex(0);
  }, [category]);
  useEffect(() => { writePreference("ephinta:music-track", String(trackIndex)); }, [trackIndex]);

  useEffect(() => {
    const onCategoryChange = (event: Event) => {
      const value = (event as CustomEvent).detail;
      if (value === "wedding" || value === "naming" || value === "burial") setCategory(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "ephinta:music-category" &&
        (event.newValue === "wedding" || event.newValue === "naming" || event.newValue === "burial")) {
        setCategory(event.newValue);
      }
      if (event.key === "ephinta:sound" && event.newValue === "off") {
        audioRef.current?.pause();
        setConsent(false);
      }
    };
    window.addEventListener("ephinta:music-category-change", onCategoryChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ephinta:music-category-change", onCategoryChange);
      window.removeEventListener("storage", onStorage);
    };
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
    if (!autoPlay || consent !== true || !preferencesLoaded) return;
    if (skipNextAutoPlay.current) { skipNextAutoPlay.current = false; return; }
    const audio = audioRef.current;
    if (!audio) return;
    // Browsers and Android WebView may reject background autoplay. The visible
    // play control remains available and the rejection is reported accessibly.
    void audio.play().catch(() => setStatus("Tap Play to start music; this browser requires a user gesture."));
  }, [autoPlay, consent, preferencesLoaded, source]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function play(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.volume = volume;
      await audio.play();
      setStatus("Music is playing.");
    } catch (error) {
      console.warn("EPHINTA audio playback was blocked or unavailable.", error);
      setStatus("Music could not start automatically. Check your connection and tap Play again.");
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

  function changeTrack(direction: -1 | 1): void {
    setTrackIndex((index) => (index + direction + tracks.length) % tracks.length);
  }

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
        onEnded={() => changeTrack(1)}
        onError={() => setStatus("This music track is unavailable. Check your connection or choose another track.")}
      />
      <p className="eph-audio__status" role="status" aria-live="polite">{status}</p>

      {showPrompt && preferencesLoaded && consent === null && !authDialogOpen && (
        <div className="eph-audio__backdrop">
          <section className="eph-audio__prompt" role="dialog" aria-modal="true" aria-labelledby="eph-audio-title">
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

      {consent === true && !authDialogOpen && (!expanded ? (
        <button type="button" className="eph-audio__restore" onClick={() => setExpanded(true)} aria-label="Open music player">
          ♫ Music {playing ? "playing" : "paused"}
        </button>
      ) : (
        <section className="eph-audio__player" aria-label="EPHINTA music player">
          <div className="eph-audio__player-heading">
            <span className="eph-audio__player-art" aria-hidden="true">♫</span>
            <div className="eph-audio__track-copy">
              <span className="eph-audio__player-label">EPHINTA MUSIC · {CATEGORY_LABELS[category].toUpperCase()}</span>
              <strong title={trackTitle}>{trackTitle}</strong>
            </div>
            <span className={"eph-audio__playing-indicator" + (playing ? " is-playing" : "")} aria-label={playing ? "Playing" : "Paused"} />
          </div>
          <div className="eph-audio__player-controls">
            <button className="eph-audio__control" type="button" onClick={() => changeTrack(-1)} aria-label="Previous track">|◀</button>
            <button className="eph-audio__control eph-audio__play" type="button" onClick={() => playing ? audioRef.current?.pause() : void play()} aria-label={playing ? "Pause music" : "Play music"}>{playing ? "Ⅱ" : "▶"}</button>
            <button className="eph-audio__control" type="button" onClick={() => changeTrack(1)} aria-label="Next track">▶|</button>
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
            <label>
              <span className="eph-audio__volume-label">Event music</span>
              <select aria-label="Music category" value={category} onChange={(event) => setCategory(event.target.value as MusicCategory)}>
                <option value="wedding">Wedding</option>
                <option value="naming">Naming ceremony</option>
                <option value="burial">Burial</option>
              </select>
            </label>
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
