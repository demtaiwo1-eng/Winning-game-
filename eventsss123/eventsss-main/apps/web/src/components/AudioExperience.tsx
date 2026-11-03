import React, { useEffect, useRef, useState } from "react";
import { EPHINTA_MUSIC, safeEphintaPlaylistUrl } from "../lib/music/ephinta-config";

type Props = {
  /** Optional override; by default the bundled, licensed EPHINTA tracks are used. */
  audioUrl?: string;
  /** Show the playback controls even when sound is initially disabled. */
  showPrompt?: boolean;
  /** Attempt playback on load. Browsers may block this until the user taps Play. */
  autoPlay?: boolean;
};

const TRACKS = [
  { title: "Here We Are — Wedding", category: "wedding", src: EPHINTA_MUSIC.categoryTracks.wedding[0] },
  { title: "Here We Are — Wedding (Part 2)", category: "wedding", src: EPHINTA_MUSIC.categoryTracks.wedding[1] },
  { title: "Welcome, Little One — Naming", category: "naming", src: EPHINTA_MUSIC.categoryTracks.naming[0] },
  { title: "Welcome, Little One — Naming (Part 2)", category: "naming", src: EPHINTA_MUSIC.categoryTracks.naming[1] },
  { title: "You Will Live in Our Hearts — Memorial", category: "burial", src: EPHINTA_MUSIC.categoryTracks.burial[0] },
  { title: "You Will Live in Our Hearts — Memorial (Part 2)", category: "burial", src: EPHINTA_MUSIC.categoryTracks.burial[1] },
] as const;

export default function AudioExperience({ audioUrl, showPrompt = true, autoPlay = false }: Props) {
  const [volume, setVolume] = useState(0.35);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("Music is off. Tap Play when you are ready.");
  const [needsGesture, setNeedsGesture] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [soundPreferenceLoaded, setSoundPreferenceLoaded] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoAttempted = useRef(false);
  const continuePlayback = useRef(false);
  const selectedTrack = TRACKS[trackIndex];
  const playlistUrl = safeEphintaPlaylistUrl(EPHINTA_MUSIC.playlistUrl);

  useEffect(() => {
    try {
      const savedVolume = Number(localStorage.getItem("ephinta:sound-volume"));
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 0.7) setVolume(savedVolume);
      const savedTrack = Number(localStorage.getItem("ephinta:music-track"));
      if (Number.isInteger(savedTrack) && savedTrack >= 0 && savedTrack < TRACKS.length) setTrackIndex(savedTrack);
      if (localStorage.getItem("ephinta:sound") === "off") setAutoPlayEnabled(false);
    } catch { /* Storage may be unavailable in private browsing. */ }
    finally { setSoundPreferenceLoaded(true); }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = audioUrl || selectedTrack.src;
    audio.load();
    setPlaying(false);
    if (continuePlayback.current) {
      continuePlayback.current = false;
      void audio.play().then(() => {
        setPlaying(true);
        setNeedsGesture(false);
        setMessage("Playing the next track.");
      }).catch(() => {
        setPlaying(false);
        setNeedsGesture(true);
        setMessage("Tap Play to continue to the next track.");
      });
    } else if (autoPlay && soundPreferenceLoaded && autoPlayEnabled && !autoAttempted.current) {
      autoAttempted.current = true;
      void audio.play().then(() => {
        setPlaying(true);
        setNeedsGesture(false);
        setMessage("Music is playing.");
      }).catch(() => {
        setNeedsGesture(true);
        setMessage("Your browser blocked automatic playback. Tap Play to start the music.");
      });
    }
  }, [audioUrl, selectedTrack.src, autoPlay, soundPreferenceLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem("ephinta:sound-volume", String(volume));
      localStorage.setItem("ephinta:music-track", String(trackIndex));
    } catch { /* Optional preference only. */ }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, trackIndex]);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }, []);

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.volume = volume;
      if (audio.src !== new URL(audioUrl || selectedTrack.src, window.location.href).href) {
        audio.src = audioUrl || selectedTrack.src;
      }
      await audio.play();
      setPlaying(true);
      setNeedsGesture(false);
      setMessage("Music is playing.");
      setAutoPlayEnabled(true);
      try { localStorage.setItem("ephinta:sound", "on"); } catch {}
    } catch (error) {
      setPlaying(false);
      setNeedsGesture(true);
      const mediaError = error instanceof DOMException ? error.name : "";
      setMessage(mediaError === "NotAllowedError"
        ? "Playback needs your tap. Press Play again, and check that your device is not muted."
        : "Music could not start. Check your connection, device volume, and try another track.");
    }
  }

  function pause() {
    audioRef.current?.pause();
    setPlaying(false);
    setAutoPlayEnabled(false);
    setMessage("Music paused.");
    try { localStorage.setItem("ephinta:sound", "off"); } catch {}
  }

  function changeTrack(next: number) {
    setTrackIndex((next + TRACKS.length) % TRACKS.length);
    setNeedsGesture(true);
    setMessage("Track selected. Tap Play to listen.");
  }

  return (
    <section className={expanded ? "eph-audio eph-audio--expanded" : "eph-audio eph-audio--compact"} aria-label="EPHINTA music player">
      <audio
        ref={audioRef}
        src={audioUrl || selectedTrack.src}
        preload="metadata"
        onEnded={() => {
          continuePlayback.current = true;
          setTrackIndex((current) => (current + 1) % TRACKS.length);
          setMessage("Loading the next track…");
        }}
        onError={() => { setPlaying(false); setMessage("This track is unavailable. Choose another track or open the playlist."); }}
      />
      <div className="eph-audio__heading">
        <span aria-hidden="true">♫</span>
        <div><strong>EPHINTA music</strong><p>{selectedTrack.title}</p></div>
      </div>
      <button className="eph-audio__expand" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        {expanded ? "Hide music settings" : "Music settings"}
      </button>
      {(showPrompt || needsGesture) && !playing && (
        <p className="eph-audio__notice">
          {needsGesture ? "Your browser blocked automatic playback. Tap Enable sound & play to start music for this session. No microphone or recording permission is needed." : "Music starts automatically where your browser allows it. Otherwise, tap Play music whenever you are ready."}
        </p>
      )}
      <div className="eph-audio__controls">
        {playing ? (
          <button type="button" onClick={pause} aria-label="Pause music">Pause</button>
        ) : (
          <button type="button" onClick={() => void play()} aria-label={needsGesture ? "Enable sound and play music" : "Play music"}>{needsGesture ? "Enable sound & play" : "Play music"}</button>
        )}
        <button type="button" onClick={() => changeTrack(trackIndex - 1)} aria-label="Previous track">Previous</button>
        <button type="button" onClick={() => changeTrack(trackIndex + 1)} aria-label="Next track">Next</button>
      </div>
      {expanded && <>
        <label htmlFor="eph-audio-track">Choose music</label>
        <select id="eph-audio-track" value={trackIndex} onChange={(event) => changeTrack(Number(event.target.value))}>
          {TRACKS.map((track, index) => <option key={track.src} value={index}>{track.title}</option>)}
        </select>
        <label htmlFor="eph-audio-volume">Volume: {Math.round(volume * 100)}%</label>
        <input id="eph-audio-volume" type="range" min="0" max="0.7" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        {playlistUrl && <a href={playlistUrl} target="_blank" rel="noreferrer">Open EPHINTA playlist on YouTube Music</a>}
      </>}
      <p className="eph-audio__status" role="status" aria-live="polite">{message}</p>
      <p className="eph-audio__fineprint">Automatic playback depends on browser policy. Device mute, volume, data connection, and Bluetooth settings remain under your control.</p>
    </section>
  );
}
