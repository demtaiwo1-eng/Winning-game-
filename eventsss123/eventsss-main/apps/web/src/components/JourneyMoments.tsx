/**
 * Unique start → finish moments for retention.
 * First-run onboarding + completion payoff when readiness is ALL GREEN.
 */
import { useEffect, useState } from "react";

const STREAK_KEY = "ess_green_streak";

export type OnboardingRole =
  | "CLIENT"
  | "ORGANIZATION"
  | "VENDOR"
  | "AFFILIATE"
  | "VERIFIER"
  | "CONSULTANT"
  | "ADMIN";

export type OnboardingOrganizationMode = "EVENT_PLANNING" | "SERVICE_PROVIDER" | null;

type OnboardingStep = {
  kicker: string;
  title: string;
  body: string;
  visual: string;
};

type RoleOnboarding = {
  steps: OnboardingStep[];
  finishLabel: string;
};

const PLANNER_ONBOARDING: RoleOnboarding = {
  steps: [
    { kicker: "Start", title: "Set up your event", body: "Create your event brief with its date, location, guest count and budget so your planning work has one home.", visual: "⏱" },
    { kicker: "Plan", title: "Turn the brief into a plan", body: "Review your event workspace, checklist and budget. Add the tasks that matter and keep progress together.", visual: "✓" },
    { kicker: "Discover", title: "Find the right services", body: "Browse marketplace providers, ask questions and compare suitable services before checkout.", visual: "⌕" },
    { kicker: "Protect", title: "Track payments and readiness", body: "Use the wallet and booking status to follow confirmed payments. Your readiness board helps track service confirmations before event day.", visual: "◈" },
  ],
  finishLabel: "Open my planner",
};

const VENDOR_ONBOARDING: RoleOnboarding = {
  steps: [
    { kicker: "Profile", title: "Complete your business profile", body: "Check your business name, contact details, operating city and service description. Submit the required verification documents through the secure verification flow.", visual: "▣" },
    { kicker: "Catalogue", title: "Prepare your service listings", body: "Add accurate packages, prices, capacity and availability. Listings may require verification or moderation before customers can book.", visual: "✦" },
    { kicker: "Respond", title: "Manage customer enquiries", body: "Review incoming enquiries, respond clearly and keep availability up to date. Treat a booking as confirmed only when EPHINTA shows the server-confirmed status.", visual: "↗" },
    { kicker: "Deliver", title: "Keep every booking on track", body: "Use event messages and payment-request information where enabled, and coordinate delivery with the customer and assigned readiness verifier.", visual: "✓" },
  ],
  finishLabel: "Open vendor workspace",
};

const ROLE_ONBOARDING: Record<OnboardingRole, RoleOnboarding> = {
  CLIENT: PLANNER_ONBOARDING,
  ORGANIZATION: PLANNER_ONBOARDING,
  VENDOR: VENDOR_ONBOARDING,
  AFFILIATE: {
    steps: [
      { kicker: "Profile", title: "Set your referral channel", body: "Choose the channel where you reach event planners and vendors. Confirm your approved referral code and programme terms with the platform team.", visual: "◎" },
      { kicker: "Share", title: "Use approved referral links", body: "Share only the tracked referral links made available to your account. Do not promise a reward until a referral is qualified under the programme rules.", visual: "↗" },
      { kicker: "Track", title: "Review referral activity", body: "Check your partner workspace for recorded activity. Referral attribution and rewards depend on the live programme configuration.", visual: "▥" },
    ],
    finishLabel: "Open partner workspace",
  },
  VERIFIER: {
    steps: [
      { kicker: "Assignment", title: "Check your assigned events", body: "Your queue shows events assigned to you. If it is empty, wait for an assignment or contact the platform operations team.", visual: "▤" },
      { kicker: "Readiness", title: "Verify booked services", body: "Open an assigned event and record accurate service checks with notes. The readiness window opens six hours before the event.", visual: "●" },
      { kicker: "Deadline", title: "Complete checks before go-time", body: "Work with the event owner to resolve outstanding checks. The target is for all services to be green at least two hours before the event.", visual: "✓" },
    ],
    finishLabel: "Open readiness queue",
  },
  CONSULTANT: {
    steps: [
      { kicker: "Access", title: "Review your assigned work", body: "Your consultant workspace displays operational updates and notifications available to your account.", visual: "▤" },
      { kicker: "Coordinate", title: "Follow event and readiness updates", body: "Use the notices to keep track of assigned activity. If you need a new assignment or broader access, request it from an administrator.", visual: "↗" },
      { kicker: "Support", title: "Escalate blockers promptly", body: "Keep sensitive customer and payment information within approved EPHINTA channels and report operational blockers to the platform team.", visual: "✓" },
    ],
    finishLabel: "Open consultant workspace",
  },
  ADMIN: {
    steps: [
      { kicker: "Access", title: "Use your authorized operations account", body: "Admin access is provisioned by the platform owner and is not available through public self-registration.", visual: "▣" },
      { kicker: "Review", title: "Check platform operations", body: "Review account, marketplace, verification and finance information using the permissions assigned to your account.", visual: "▥" },
      { kicker: "Control", title: "Keep approvals and audit trails intact", body: "Use maker-checker controls where required. Never approve your own request or bypass documented financial controls.", visual: "✓" },
    ],
    finishLabel: "Open platform operations",
  },
};

function onboardingStorageKey(role: OnboardingRole, organizationMode?: OnboardingOrganizationMode): string {
  return `ess_onboard_v2_${role.toLowerCase()}_${organizationMode ?? "default"}`;
}

export function hasCompletedOnboard(
  role: OnboardingRole,
  organizationMode?: OnboardingOrganizationMode,
): boolean {
  try {
    return localStorage.getItem(onboardingStorageKey(role, organizationMode)) === "1";
  } catch {
    return true;
  }
}

export function markOnboardDone(
  role: OnboardingRole,
  organizationMode?: OnboardingOrganizationMode,
) {
  try {
    localStorage.setItem(onboardingStorageKey(role, organizationMode), "1");
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

export function OnboardingOverlay({
  name,
  role,
  organizationMode,
  onDone,
}: {
  name?: string;
  role: OnboardingRole;
  organizationMode?: OnboardingOrganizationMode;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const onboarding =
    role === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER"
      ? VENDOR_ONBOARDING
      : ROLE_ONBOARDING[role] ?? PLANNER_ONBOARDING;
  const steps = onboarding.steps;
  const last = step >= steps.length - 1;
  const s = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const finish = () => {
    setVisible(false);
    markOnboardDone(role, organizationMode);
    setTimeout(onDone, 280);
  };

  return (
    <div className={`ess-journey-overlay ${visible ? "is-in" : "is-out"}`} role="dialog" aria-modal="true" aria-label={`${role.toLowerCase()} onboarding`}>
      <div className="ess-journey-card">
        <div className="ess-journey-progress" aria-hidden>
          {steps.map((_, i) => (
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
              {onboarding.finishLabel}
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
