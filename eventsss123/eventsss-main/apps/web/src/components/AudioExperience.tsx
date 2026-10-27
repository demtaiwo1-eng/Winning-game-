import React, { useEffect, useRef, useState } from "react";

type Props = {
  /** Optional audio URL served by your app. Leave empty to use the test tone. */
  audioUrl?: string;
  /** Set true only for an explicit user-facing sound experience. */
  showPrompt?: boolean;
};

export default function AudioExperience({
  audioUrl,
  showPrompt = true,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [message, setMessage] = useState("Sound is off");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ephinta:sound");
      const savedVolume = Number(
        localStorage.getItem("ephinta:sound-volume")
      );

      if (saved === "on") setEnabled(true);
      if (Number.isFinite(savedVolume) && savedVolume >= 0 &&
          savedVolume <= 0.7) {
        setVolume(savedVolume);
      }
    } catch {
      // Private browsing or restricted storage: use safe defaults.
    }
  }, []);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.preload = "none";
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try {
      localStorage.setItem("ephinta:sound-volume", String(volume));
    } catch {}
  }, [volume]);

  async function enableSound() {
    try {
      // Must be called from an actual user gesture on mobile browsers.
      if (audioUrl && audioRef.current) {
        audioRef.current.volume = volume;
        await audioRef.current.play();
      }

      setEnabled(true);
      setMessage("Sound enabled");
      try {
        localStorage.setItem("ephinta:sound", "on");
      } catch {}
    } catch {
      setEnabled(false);
      setMessage("Tap Enable sound to allow playback");
    }
  }

  function disableSound() {
    audioRef.current?.pause();
    setEnabled(false);
    setPlaying(false);
    setMessage("Sound is off");
    try {
      localStorage.setItem("ephinta:sound", "off");
    } catch {}
  }

  async function testSound() {
    try {
      // Use the Web Audio API only after a button click.
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) {
        setMessage("Audio test is unsupported in this browser");
        return;
      }

      const ctx = contextRef.current ?? new AudioContextClass();
      contextRef.current = ctx;

      if (ctx.state === "suspended") await ctx.resume();

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 660;

      // Respect the selected volume; cap test tone to avoid sudden loud audio.
      gain.gain.setValueAtTime(Math.min(volume, 0.35) * 0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.45
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.46);

      setMessage("Playing a short sound test");
      setPlaying(true);
      window.setTimeout(() => setPlaying(false), 500);
    } catch {
      setMessage("Could not play test sound. Check device volume.");
    }
  }

  return (
    <section className="eph-audio" aria-label="Sound settings">
      <div className="eph-audio__heading">
        <span aria-hidden="true">♫</span>
        <div>
          <strong>Sound settings</strong>
          <p>Control EPHINTA audio on this device.</p>
        </div>
      </div>

      {showPrompt && !enabled && (
        <p className="eph-audio__notice">
          Your device or browser may require a tap before audio can play.
        </p>
      )}

      <div className="eph-audio__controls">
        {!enabled ? (
          <button type="button" onClick={enableSound}>
            Enable sound
          </button>
        ) : (
          <button type="button" onClick={disableSound}>
            Turn sound off
          </button>
        )}

        <button type="button" onClick={testSound}>
          {playing ? "Testing…" : "Test sound"}
        </button>
      </div>

      <label htmlFor="eph-audio-volume">
        Volume preference: {Math.round(volume * 100)}%
      </label>
      <input
        id="eph-audio-volume"
        type="range"
        min="0"
        max="0.7"
        step="0.05"
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
      />

      <p className="eph-audio__status" role="status" aria-live="polite">
        {message}
      </p>
      <p className="eph-audio__fineprint">
        Your device's physical volume, silent mode, Bluetooth routing,
        accessibility settings and browser policies take priority.
      </p>
    </section>
  );
}
