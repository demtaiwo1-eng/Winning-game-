import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const IDLE_LIMIT_MS = 5 * 60 * 1000;
const PBKDF2_ITERATIONS = 310_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePinHash(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}

function equalConstantTime(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Props = {
  userId: string;
  onSignOut: () => void;
  children: React.ReactNode;
};

/**
 * Local device privacy gate. This is deliberately not represented as server-side
 * authentication or a replacement for OS biometrics / a native secure keystore.
 */
export default function DeviceSecurityGate({ userId, onSignOut, children }: Props) {
  const storageKey = useMemo(() => `ephinta:device-pin:v1:${userId}`, [userId]);
  const [configured, setConfigured] = useState(() => Boolean(localStorage.getItem(`ephinta:device-pin:v1:${userId}`)));
  const [locked, setLocked] = useState(() => Boolean(localStorage.getItem(`ephinta:device-pin:v1:${userId}`)));
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lastActivity = useRef(Date.now());
  const timer = useRef<number | null>(null);
  const attempts = useRef(0);

  const lock = useCallback(() => {
    setLocked(true);
    setPin("");
    setConfirmPin("");
    setError("");
  }, []);

  const markActivity = useCallback(() => {
    if (document.visibilityState !== "visible" || locked) return;
    lastActivity.current = Date.now();
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) lock();
    }, IDLE_LIMIT_MS);
  }, [lock, locked]);

  useEffect(() => {
    if (!configured || locked) return;
    lastActivity.current = Date.now();
    const activity = () => markActivity();
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) lock();
      } else if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) {
        lock();
      } else {
        markActivity();
      }
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    document.addEventListener("visibilitychange", visibility);
    markActivity();
    return () => {
      events.forEach((event) => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", visibility);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [configured, locked, lock, markActivity]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter a six-digit PIN.");
      return;
    }
    setBusy(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        if (pin !== confirmPin) {
          setError("The PIN entries do not match.");
          return;
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await derivePinHash(pin, salt);
        localStorage.setItem(storageKey, JSON.stringify({ salt: bytesToBase64(salt), hash, version: 1 }));
        setConfigured(true);
        setLocked(false);
        attempts.current = 0;
        markActivity();
        setPin("");
        setConfirmPin("");
        return;
      }
      const record = JSON.parse(stored) as { salt: string; hash: string; version: number };
      const candidate = await derivePinHash(pin, base64ToBytes(record.salt));
      if (!equalConstantTime(candidate, record.hash)) {
        attempts.current += 1;
        setError(attempts.current >= 5 ? "Too many attempts. Sign out and recover access through your account sign-in." : "Incorrect PIN. Try again.");
        if (attempts.current >= 5) {
          localStorage.removeItem(storageKey);
          onSignOut();
        }
        return;
      }
      attempts.current = 0;
      setLocked(false);
      setPin("");
      markActivity();
    } catch {
      setError("Secure PIN storage is unavailable on this device. Please sign out and try a supported browser.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: locked ? "none" : "contents" }} aria-hidden={locked}>{children}</div>
      {locked && (
        <main role="dialog" aria-modal="true" aria-labelledby="ephinta-device-lock-title" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--app-bg, #10002f)", color: "var(--app-text, #fff)", fontFamily: "inherit" }}>
          <form onSubmit={submit} style={{ width: "min(100%, 420px)", padding: 28, borderRadius: 24, background: "var(--surface, #211044)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
            <p style={{ margin: "0 0 8px", opacity: .72, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12 }}>EPHINTA secure access</p>
            <h1 id="ephinta-device-lock-title" style={{ margin: "0 0 10px", fontSize: 28 }}>{configured ? "App locked" : "Set your device PIN"}</h1>
            <p style={{ margin: "0 0 22px", opacity: .8, lineHeight: 1.5 }}>{configured ? "Your app was locked after five minutes of inactivity. Enter your PIN to continue." : "Create a six-digit device PIN. You will need it when reopening the app and after inactivity."}</p>
            <label htmlFor="ephinta-device-pin" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Six-digit PIN</label>
            <input id="ephinta-device-pin" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" type="password" style={{ boxSizing: "border-box", width: "100%", padding: "15px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "inherit", fontSize: 22, letterSpacing: ".35em" }} />
            {!configured && <>
              <label htmlFor="ephinta-device-pin-confirm" style={{ display: "block", margin: "16px 0 8px", fontWeight: 600 }}>Confirm PIN</label>
              <input id="ephinta-device-pin-confirm" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Repeat PIN" type="password" style={{ boxSizing: "border-box", width: "100%", padding: "15px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "inherit", fontSize: 20, letterSpacing: ".25em" }} />
            </>}
            {error && <p role="alert" style={{ color: "#ffb4b4", margin: "12px 0 0" }}>{error}</p>}
            <button disabled={busy || pin.length !== 6 || (!configured && confirmPin.length !== 6)} type="submit" style={{ width: "100%", marginTop: 20, padding: 15, border: 0, borderRadius: 12, background: "var(--primary, #a78bfa)", color: "#16072c", fontWeight: 700, cursor: "pointer" }}>{busy ? "Securing..." : configured ? "Unlock EPHINTA" : "Set PIN and continue"}</button>
            <button type="button" onClick={onSignOut} style={{ width: "100%", marginTop: 12, padding: 12, border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, background: "transparent", color: "inherit", cursor: "pointer" }}>Sign out instead</button>
            <p style={{ fontSize: 12, opacity: .62, lineHeight: 1.5, margin: "18px 0 0" }}>This device PIN is a local privacy lock. Native fingerprint/Face ID authentication and server-enforced account security require the mobile biometric integration described in the security rollout plan.</p>
          </form>
        </main>
      )}
    </>
  );
}
