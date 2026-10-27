/**
 * Unique start → finish moments for retention.
 * First-run onboarding + completion payoff when readiness is ALL GREEN.
 */
import { useEffect, useState } from "react";

const ONBOARD_KEY = "ess_onboard_v1";
const STREAK_KEY = "ess_green_streak";

export function hasCompletedOnboard(): boolean {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardDone() {
  try {
    localStorage.setItem(ONBOARD_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function bumpGreenStreak(): number {
  try {
    const n = Number(localStorage.getItem(STREAK_KEY) || "0") + 1;
    localStorage.setItem(STREAK_KEY, String(n));
    return n;
  } catch {
    return 1;
  }
}

const STEPS = [
  {
    kicker: "Start",
    title: "Your event, one clock",
    body: "Pick a start time. Everything — vendors, money, readiness — runs toward that moment.",
    visual: "⏱",
  },
  {
    kicker: "Trust",
    title: "Pay into escrow, not hope",
    body: "Book services knowing funds stay protected until the work is real.",
    visual: "◈",
  },
  {
    kicker: "Proof",
    title: "All green before go-time",
    body: "Independent verifiers light every service. You only open doors when the board is green — at least 2 hours before start.",
    visual: "●",
  },
  {
    kicker: "Finish",
    title: "Walk in calm",
    body: "Countdown hits zero with every light green. That is the finish line we build for — not another group chat.",
    visual: "✓",
  },
];

export function OnboardingOverlay({
  name,
  onDone,
}: {
  name?: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const last = step >= STEPS.length - 1;
  const s = STEPS[step];

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const finish = () => {
    setVisible(false);
    markOnboardDone();
    setTimeout(onDone, 280);
  };

  return (
    <div className={`ess-journey-overlay ${visible ? "is-in" : "is-out"}`} role="dialog" aria-modal="true">
      <div className="ess-journey-card">
        <div className="ess-journey-progress" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>
        <p className="ess-journey-kicker">{s.kicker}</p>
        <div className="ess-journey-visual" aria-hidden>
          {s.visual}
        </div>
        <h2>
          {step === 0 && name ? `${name.split(" ")[0]}, ` : ""}
          {s.title}
        </h2>
        <p className="ess-journey-body">{s.body}</p>
        <div className="ess-journey-actions">
          {!last ? (
            <button type="button" className="ess-primary" onClick={() => setStep((x) => x + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" className="ess-primary ess-journey-finish" onClick={finish}>
              Begin your first event
            </button>
          )}
          <button type="button" className="ess-link-button" onClick={finish}>
            Skip intro
          </button>
        </div>
      </div>
    </div>
  );
}

/** Celebration when readiness hits ALL GREEN — the unique finish */
export function AllGreenFinale({
  eventTitle,
  onDismiss,
}: {
  eventTitle?: string;
  onDismiss: () => void;
}) {
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    setStreak(bumpGreenStreak());
  }, []);

  return (
    <div className="ess-finale is-in" role="status">
      <div className="ess-finale-inner">
        <div className="ess-finale-ring" aria-hidden />
        <p className="ess-journey-kicker">Finish line</p>
        <h2>All systems green</h2>
        <p>
          {eventTitle ? `“${eventTitle}” is clear for go-time.` : "Every service is confirmed."} Verifiers
          locked the board. Walk in knowing the work behind the curtain is done.
        </p>
        {streak > 1 && (
          <p className="ess-finale-streak">
            {streak} green finishes on this device — consistency compounds trust.
          </p>
        )}
        <button type="button" className="ess-primary" onClick={onDismiss}>
          Hold this calm
        </button>
      </div>
    </div>
  );
}

/** Soft resume strip for retention between sessions */
export function ResumeStrip({
  label,
  onContinue,
  onDismiss,
}: {
  label: string;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="ess-resume-strip">
      <span>Continue where you left off — {label}</span>
      <div>
        <button type="button" className="ess-primary" onClick={onContinue}>
          Resume
        </button>
        <button type="button" className="ess-link-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
