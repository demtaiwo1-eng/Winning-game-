import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Role = "CLIENT" | "ORGANIZATION" | "VENDOR" | "AFFILIATE" | "VERIFIER" | "CONSULTANT" | "ADMIN";
type ChatMessage = { id: number; from: "assistant" | "user"; text: string; actions?: Array<{ label: string; path: string }> };

const roleNames: Record<Role, string> = {
  CLIENT: "Event planner", ORGANIZATION: "Organization", VENDOR: "Vendor",
  AFFILIATE: "Affiliate", VERIFIER: "Verifier", CONSULTANT: "Consultant", ADMIN: "Platform operations",
};

const helpTopics = [
  { label: "Plan an event", words: ["event", "plan", "create", "planner", "budget"], text: "Start in your event workspace. Add the event name, type, date, location, guest estimate and budget. Save the event, then use its checklist to keep planning on track.", actions: [{ label: "Open event planner", path: "/plan" }, { label: "My dashboard", path: "/dashboard/client" }] },
  { label: "Find services", words: ["vendor", "service", "marketplace", "venue", "cater", "photograph", "book"], text: "Browse the marketplace, compare vendor profiles and listing details, then add the service to your event or start a booking. Check the total and payment schedule before confirming.", actions: [{ label: "Browse marketplace", path: "/marketplace" }] },
  { label: "Payments and wallet", words: ["payment", "pay", "wallet", "deposit", "fund", "money", "transaction"], text: "Open Payments & finances from your dashboard to review your wallet and transaction history. Event deposits and booking payments are recorded against the relevant event or booking. Only trust a payment after its status is confirmed in EPHINTA.", actions: [{ label: "Open my wallet", path: "/dashboard/client?tab=payments" }] },
  { label: "Withdraw to bank", words: ["withdraw", "payout", "bank", "cash out", "transfer"], text: "Open Payments & finances, choose Withdraw, select your bank and resolve the account name. Confirm the displayed account name before submitting. A payout is not complete until EPHINTA shows it as successful.", actions: [{ label: "Open payouts", path: "/dashboard/client?tab=payments" }] },
  { label: "Vendor workspace", words: ["listing", "my services", "vendor dashboard", "part payment", "part-payment", "request payment"], text: "Your vendor workspace is where you manage listings, booking requests, customer messages and payment requests. Keep listing details and availability current. Request a part-payment only against the correct booking.", actions: [{ label: "Vendor dashboard", path: "/dashboard/vendor" }] },
  { label: "Verification and readiness", words: ["verify", "verifier", "readiness", "green", "check", "inspection"], text: "Verifiers use the readiness workspace to open assigned events, inspect each booked service and record its status. Add clear notes when a service needs attention; do not mark a check complete unless it has been verified.", actions: [{ label: "Verifier workspace", path: "/dashboard/verifier" }] },
  { label: "Affiliate workspace", words: ["affiliate", "referral", "commission", "my dashboard"], text: "Your affiliate workspace helps you track referrals and commission progress. Use your referral tools, review the status of referred accounts and check the wallet for confirmed earnings. A commission is payable only when its qualifying transaction is confirmed.", actions: [{ label: "Affiliate dashboard", path: "/dashboard/affiliate" }, { label: "Wallet", path: "/dashboard/affiliate?tab=payments" }] },
  { label: "Consultant workspace", words: ["consultant", "assigned work", "consulting"], text: "Use your consultant workspace to review assigned event work, coordinate with the people involved and keep updates in the relevant event messages. If you cannot see an assignment, contact the event owner or platform support rather than accessing another user’s workspace.", actions: [{ label: "Consultant dashboard", path: "/dashboard/consultant" }] },
  { label: "Organization workspace", words: ["organization", "organizer", "team"], text: "Your organization workspace depends on the mode selected at registration. Event-planning organizations coordinate events and teams; service-provider organizations manage business listings and fulfilment. Use the dashboard that matches your registered organization mode.", actions: [{ label: "Organization dashboard", path: "/dashboard/organization" }] },
  { label: "Platform operations", words: ["admin", "platform operations", "moderation", "manage platform"], text: "The operations portal is for authorized administrators only. Use the relevant operations panel, review records carefully and follow approval controls for sensitive actions. Never use a demo account or bypass an approval to change real customer funds.", actions: [{ label: "Open admin workspace", path: "/dashboard/admin" }] },
  { label: "Messages", words: ["message", "chat", "inbox", "group", "contact"], text: "Open Messages in your dashboard to communicate with the people connected to your event or booking. Check the recipient list before sending a group message and never share passwords, one-time codes or full bank details.", actions: [{ label: "Open messages", path: "/dashboard/client?tab=messages" }] },
  { label: "Account and sign-in", words: ["login", "sign in", "password", "register", "account", "forgot"], text: "Use the sign-in page for an existing account. If your password is not accepted, check the email address and use Forgot password to request a reset link. Never share your password or reset link with anyone.", actions: [{ label: "Sign in", path: "/auth/signin" }, { label: "Create account", path: "/auth/signup" }] },
];

function getRole(): Role | null {
  try {
    const user = JSON.parse(localStorage.getItem("ess_user") || "null");
    return user?.role && user.role in roleNames ? user.role as Role : null;
  } catch { return null; }
}

export default function EphintaHelpAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<Role | null>(getRole);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, from: "assistant", text: "Hello! I’m EPHINTA Guide. Tell me what you’re trying to do, or choose a topic below. I can guide you to the right place in the app." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  useEffect(() => { setRole(getRole()); }, [location.pathname]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, open]);

  const suggestions = useMemo(() => {
    if (!role) return ["Plan an event", "Find services", "Payments and wallet", "Account and sign-in"];
    if (role === "VENDOR") return ["Vendor workspace", "Payments and wallet", "Messages", "Withdraw to bank"];
    if (role === "VERIFIER") return ["Verification and readiness", "Messages", "Account and sign-in"];
    if (role === "AFFILIATE") return ["Affiliate workspace", "Payments and wallet", "Account and sign-in"];
    if (role === "CONSULTANT") return ["Consultant workspace", "Messages", "Account and sign-in"];
    if (role === "ORGANIZATION") return ["Organization workspace", "Plan an event", "Vendor workspace", "Messages"];
    if (role === "ADMIN") return ["Platform operations", "Payments and wallet", "Account and sign-in"];
    return ["Plan an event", "Find services", "Payments and wallet", "Messages"];
  }, [role]);

  function respond(input: string) {
    const normalized = input.toLowerCase().trim();
    const topic = helpTopics.find((item) => item.words.some((word) => normalized.includes(word)) || normalized === item.label.toLowerCase());
    const answer = topic
      ? { text: topic.text, actions: topic.actions.map((action) => ({ ...action, path: role && action.path.startsWith("/dashboard/client") ? action.path.replace("/dashboard/client", `/dashboard/${role.toLowerCase()}`) : action.path })) }
      : { text: "I can guide you through event planning, marketplace bookings, wallet and payments, bank withdrawals, vendor listings, verification, messages and account access. Try one of those topics, or describe the screen you are on and what you want to achieve.", actions: helpTopics.slice(0, 4).map((item) => ({ label: item.label, path: item.actions[0]?.path || "/" })) };
    setMessages((current) => [...current, { id: nextId.current++, from: "user", text: input }, { id: nextId.current++, from: "assistant", ...answer }]);
    setDraft("");
  }

  function submit(event: FormEvent) { event.preventDefault(); if (draft.trim()) respond(draft.trim()); }

  return (
    <div className={`ephinta-guide-root ${open ? "is-open" : ""} ${maximized ? "is-maximized" : ""}`}>
      {!open ? (
        <button className="ephinta-guide-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open EPHINTA Guide" title="Need help? Chat with EPHINTA Guide">
          <span className="ephinta-guide-launcher-icon" aria-hidden="true">✦</span><span>Help</span>
        </button>
      ) : (
        <section className="ephinta-guide-panel" aria-label="EPHINTA Guide chat" aria-live="polite">
          <header className="ephinta-guide-header">
            <div className="ephinta-guide-avatar" aria-hidden="true">E</div>
            <div className="ephinta-guide-heading"><strong>EPHINTA Guide</strong><small>{role ? roleNames[role] + " support" : "Your in-app assistant"}</small></div>
            <button type="button" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? "Restore chat size" : "Maximize chat"} title={maximized ? "Restore" : "Maximize"}>{maximized ? "↙" : "↗"}</button>
            <button type="button" onClick={() => { setOpen(false); setMaximized(false); }} aria-label="Minimize chat" title="Minimize">—</button>
          </header>
          <div className="ephinta-guide-messages">
            {messages.map((message) => (
              <div className={`ephinta-guide-message ephinta-guide-${message.from}`} key={message.id}>
                <p>{message.text}</p>
                {message.actions?.length ? <div className="ephinta-guide-actions">{message.actions.map((action) => <button type="button" key={action.label} onClick={() => { navigate(action.path); setOpen(false); setMaximized(false); }}>{action.label}<span aria-hidden="true"> →</span></button>)}</div> : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="ephinta-guide-suggestions" aria-label="Suggested help topics">
            {suggestions.map((item) => <button type="button" key={item} onClick={() => respond(item)}>{item}</button>)}
          </div>
          <form className="ephinta-guide-form" onSubmit={submit}>
            <label className="ephinta-guide-sr-only" htmlFor="ephinta-guide-input">Ask EPHINTA Guide</label>
            <input id="ephinta-guide-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask how to do something…" maxLength={500} />
            <button type="submit" disabled={!draft.trim()} aria-label="Send message">➤</button>
          </form>
          <p className="ephinta-guide-disclaimer">Guidance assistant · Never share passwords or verification codes.</p>
        </section>
      )}
    </div>
  );
}
