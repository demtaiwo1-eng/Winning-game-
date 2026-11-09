import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AndroidBiometryStrength, BiometricAuth } from "@aparajita/capacitor-biometric-auth";

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
  // DOM BufferSource types require an ArrayBuffer-backed view. Copying also
  // prevents passing a SharedArrayBuffer-backed view into Web Crypto.
  const pinBytes = new TextEncoder().encode(pin);
  const saltBytes = new Uint8Array(salt);
  const material = await crypto.subtle.importKey("raw", pinBytes.buffer as ArrayBuffer, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS }, material, 256);
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
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const lastActivity = useRef(Date.now());
  const timer = useRef<number | null>(null);
  const attemptsKey = useMemo(() => `ephinta:device-pin-attempts:v1:${userId}`, [userId]);
  const storedAttempts = Number.parseInt(localStorage.getItem(attemptsKey) ?? "0", 10);
  const attempts = useRef(Number.isFinite(storedAttempts) ? Math.max(0, Math.min(5, storedAttempts)) : 0);

  useEffect(() => {
    let active = true;
    if (!Capacitor.isNativePlatform()) return;
    BiometricAuth.checkBiometry()
      .then((result) => {
        if (active) setBiometricAvailable(Boolean(result.isAvailable || result.deviceIsSecure));
      })
      .catch(() => {
        if (active) setBiometricAvailable(false);
      });
    return () => { active = false; };
  }, []);

  const unlockWithBiometrics = async () => {
    setError("");
    setBusy(true);
    try {
      await BiometricAuth.authenticate({
        reason: "Authenticate to unlock EPHINTA",
        cancelTitle: "Use PIN",
        allowDeviceCredential: true,
        iosFallbackTitle: "Use device passcode",
        androidTitle: "Unlock EPHINTA",
        androidSubtitle: "Verify your identity to continue",
        androidConfirmationRequired: false,
        androidBiometryStrength: AndroidBiometryStrength.weak,
      });
      attempts.current = 0;
      localStorage.removeItem(attemptsKey);
      setLocked(false);
      setPin("");
      markActivity();
    } catch {
      setError("Biometric authentication was cancelled or unavailable. You can still use your EPHINTA PIN.");
    } finally {
      setBusy(false);
    }
  };

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
        localStorage.removeItem(attemptsKey);
        markActivity();
        setPin("");
        setConfirmPin("");
        return;
      }
      const record = JSON.parse(stored) as { salt: string; hash: string; version: number };
      const candidate = await derivePinHash(pin, base64ToBytes(record.salt));
      if (!equalConstantTime(candidate, record.hash)) {
        attempts.current = Math.min(5, attempts.current + 1);
        localStorage.setItem(attemptsKey, String(attempts.current));
        setError(attempts.current >= 5 ? "Too many attempts. Sign out and recover access through your account sign-in." : "Incorrect PIN. Try again.");
        if (attempts.current >= 5) {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(attemptsKey);
          onSignOut();
        }
        return;
      }
      attempts.current = 0;
      localStorage.removeItem(attemptsKey);
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
        <main className="ess-device-lock" role="dialog" aria-modal="true" aria-labelledby="ephinta-device-lock-title">
          <form className="ess-device-lock-card" onSubmit={submit}>
            <p style={{ margin: "0 0 8px", opacity: .72, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12 }}>EPHINTA secure access</p>
            <h1 id="ephinta-device-lock-title" style={{ margin: "0 0 10px", fontSize: 28 }}>{configured ? "App locked" : "Set your device PIN"}</h1>
            <p style={{ margin: "0 0 22px", opacity: .8, lineHeight: 1.5 }}>{configured ? "Your app was locked after five minutes of inactivity. Enter your PIN to continue." : "Create a six-digit device PIN. You will need it when reopening the app and after inactivity."}</p>
            <label className="ess-device-lock-label" htmlFor="ephinta-device-pin">Six-digit PIN</label>
            <input className="ess-device-lock-input" id="ephinta-device-pin" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" type="password" />
            {!configured && <>
              <label className="ess-device-lock-label ess-device-lock-label-confirm" htmlFor="ephinta-device-pin-confirm">Confirm PIN</label>
              <input className="ess-device-lock-input" id="ephinta-device-pin-confirm" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Repeat PIN" type="password" />
            </>}
            {error && <p className="ess-device-lock-error" role="alert">{error}</p>}
            {configured && biometricAvailable && (
              <button className="ess-device-lock-secondary" disabled={busy} type="button" onClick={unlockWithBiometrics}>
                {busy ? "Checking..." : "Use fingerprint / Face ID / device passcode"}
              </button>
            )}
            <button className="ess-device-lock-primary" disabled={busy || pin.length !== 6 || (!configured && confirmPin.length !== 6)} type="submit">{busy ? "Securing..." : configured ? "Unlock EPHINTA" : "Set PIN and continue"}</button>
            <button className="ess-device-lock-secondary ess-device-lock-signout" type="button" onClick={onSignOut}>Sign out instead</button>
            <p className="ess-device-lock-note">This device PIN is a local privacy lock. Native fingerprint/Face ID authentication and server-enforced account security require the mobile biometric integration described in the security rollout plan.</p>
          </form>
        </main>
      )}
    </>
  );
}
