import { lazy, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { APP_ROUTE_PATHS, dashboardRouteRedirect, legacyDashboardPath } from "./lib/appRoutes";
const EventReadinessBoard = lazy(() => import("./components/EventReadinessBoard"));
const EventCreatePanel = lazy(() => import("./components/EventCreatePanel"));
const EventChecklistPanel = lazy(() => import("./components/EventChecklistPanel"));
const EventMessagesPanel = lazy(() => import("./components/EventMessagesPanel"));
const GuestCheckInPanel = lazy(() => import("./components/GuestCheckInPanel"));
const VendorEventMessagesPanel = lazy(() => import("./components/EventMessagesPanel").then((module) => ({ default: module.VendorEventMessagesPanel })));
const VerifierPicker = lazy(() => import("./components/VerifierPicker"));
import { OnboardingOverlay, hasCompletedOnboard, ResumeStrip } from "./components/JourneyMoments";
import { api } from "./lib/api";
import {
  eventBuilderProgressFromLandingDraft,
  eventDraftToCreateInput,
  parseEventBuilderProgress,
  parseEventDraft,
  type EventBuilderProgress,
} from "./lib/eventDraft";
import { registrationFieldError, type RegistrationField } from "./lib/registrationValidation";
import "./enterprise.css";
import "./styles/event-planner-registration.css";
import "./portal-menu.css";
import "./public-menu.css";
import "./event-builder.css";
import "./public-landing.css";
const PublicLanding = lazy(() => import("./components/PublicLanding"));
const WalletPanel = lazy(() => import("./components/WalletPanel"));
const MarketplaceBrowse = lazy(() => import("./components/MarketplaceBrowse"));
const FeedbackPanel = lazy(() => import("./components/FeedbackPanel"));
import { EmptyState } from "./components/EmptyState";
const KycUpload = lazy(() => import("./components/KycUpload"));
const SubscriptionsPanel = lazy(() => import("./components/SubscriptionsPanel"));
import {
  checkPassword,
  PASSWORD_HELPER,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./lib/passwordRule";
import {
  COUNTRIES,
  CURRENCIES,
  LOCALES,
  passwordStrength,
  type CurrencyCode,
  type LocaleCode,
  t,
} from "./lib/i18n";

type Role = "CLIENT" | "ORGANIZATION" | "VENDOR" | "AFFILIATE" | "VERIFIER" | "CONSULTANT" | "ADMIN";
type OrganizationMode = "EVENT_PLANNING" | "SERVICE_PROVIDER";
type Status = "Pending" | "Confirmed" | "Completed" | "Revision";

type Listing = {
  id: number;
  name: string;
  category: string;
  price: string;
  currency: string;
  status: "Live" | "Draft";
  image: string;
  city?: string;
  capacity?: string;
  leadTime?: string;
  includes?: string;
};
type Gig = {
  id: number;
  event: string;
  location: string;
  service: string;
  amount: string;
  status: Status;
};
type KycCase = {
  id: number;
  business: string;
  owner: string;
  location: string;
  submitted: string;
  status: "Pending" | "Revision";
};

type UserSession = { name: string; email: string; role: Role; organizationMode?: OrganizationMode | null };

const roleMeta: Record<
  Role,
  { label: string; short: string; description: string }
> = {
  CLIENT: {
    label: "Event planner",
    short: "Event planner",
    description: "Plan, budget, invite guests and book verified services.",
  },
  ORGANIZATION: {
    label: "Organizer",
    short: "Organizer",
    description: "Coordinate events or run a team that delivers them.",
  },
  VENDOR: {
    label: "Vendor",
    short: "Vendor",
    description: "List venues, goods or services and secure paid bookings.",
  },
  AFFILIATE: {
    label: "Growth partner",
    short: "Affiliate",
    description: "Refer planners and vendors; track commissions in real time.",
  },
  VERIFIER: {
    label: "Pre-event readiness",
    short: "Verifier",
    description: "Confirm every booked service is green at least 2 hours before go-time.",
  },
  CONSULTANT: {
    label: "Consultant",
    short: "Consultant",
    description: "Support event operations and monitor assigned work.",
  },
  ADMIN: {
    label: "Platform operations",
    short: "Admin",
    description: "Operate the global marketplace, users and economics.",
  },
};

const isRole = (role: string): role is Role =>
  Object.prototype.hasOwnProperty.call(roleMeta, role);

function DashboardRouteGuard({ session }: { session: UserSession | null }) {
  const { role: requestedRole = "" } = useParams();
  const redirectTo = dashboardRouteRedirect(session?.role ?? null, requestedRole);
  return redirectTo ? <Navigate to={redirectTo} replace /> : <Outlet />;
}

function LegacyDashboardRedirect() {
  const params = useParams();
  const target = legacyDashboardPath(params["*"] ?? "");
  return <Navigate to={target ?? "/"} replace />;
}

function SignedOutDashboardRedirect() {
  const { role: requestedRole = "" } = useParams();
  const target = dashboardRouteRedirect(null, requestedRole);
  return <Navigate to={target ?? "/"} replace />;
}

const initialListings: Listing[] = [];
const initialGigs: Gig[] = [];
const initialCases: KycCase[] = [];

function Icon({ children }: { children: string }) {
  return (
    <span className="ess-icon" aria-hidden="true">
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className={accent ? "ess-metric ess-metric-accent" : "ess-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ess-section-title">
      <div>
        <p className="ess-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`ess-status ess-status-${status.toLowerCase().replace(/\s/g, "-")}`}
    >
      {status}
    </span>
  );
}

function useDashboardTab<Tab extends string>(
  tabs: readonly Tab[],
  defaultTab: Tab,
): [Tab, (tab: Tab) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get("tab");
  const activeTab = tabs.find((tab) => tab === current) ?? defaultTab;
  const setActiveTab = (tab: Tab) => {
    setSearchParams((currentParams) => {
      const next = new URLSearchParams(currentParams);
      next.set("tab", tab);
      return next;
    });
  };
  return [activeTab, setActiveTab];
}

function ClientPortal({
  session,
  locale,
  country,
  currency,
}: {
  session: UserSession;
  locale: LocaleCode;
  country: string;
  currency: CurrencyCode;
}) {
  const [tab, setTab] = useDashboardTab(
    ["overview", "checklist", "checkin", "marketplace", "wallet", "readiness", "messages", "verifiers", "plans", "kyc", "feedback"] as const,
    "marketplace",
  );
  const [bookingNotice, setBookingNotice] = useState("");
  const [readinessEvents, setReadinessEvents] = useState<Array<{ id: string; title: string; startsAt?: string | null }>>([]);
  const [checklistEventId, setChecklistEventId] = useState<string>("");
  const [readinessEventId, setReadinessEventId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [ownedEvents, setOwnedEvents] = useState<Array<{ id: string; title: string; startsAt?: string | null; city?: string | null }>>([]);
  const [eventLoadError, setEventLoadError] = useState("");
  const [readinessLoadError, setReadinessLoadError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftError, setDraftError] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [planningAnswersEventId, setPlanningAnswersEventId] = useState(() => {
    try {
      return localStorage.getItem("ess_deep_questionnaire_event_id") || "";
    } catch {
      return "";
    }
  });

  const importPlannerDraft = async () => {
    setDraftError(false);
    let raw: string | null;
    try {
      raw = localStorage.getItem("ess_event_draft");
    } catch {
      setDraftNotice("This browser could not access the saved event brief. Check storage permissions and try again.");
      setDraftError(true);
      return;
    }
    if (!raw) return;
    const draft = parseEventDraft(raw);
    if (!draft) {
      setDraftNotice("Your saved event brief could not be read. It has been kept in this browser; please return to the event builder to create a new brief.");
      setDraftError(true);
      return;
    }
    setSavingDraft(true);
    setDraftNotice("Saving your event brief to your planning workspace…");
    try {
      const result = await api<{ event: { id: string; title: string; startsAt?: string | null; city?: string | null } }>("/events", {
        method: "POST",
        body: JSON.stringify(eventDraftToCreateInput(draft, country, currency)),
      });
      if (localStorage.getItem("ess_deep_questions_pending") === "true") {
        localStorage.setItem("ess_deep_questionnaire_event_id", result.event.id);
        localStorage.removeItem("ess_deep_questions_pending");
        setPlanningAnswersEventId(result.event.id);
      }
      setEventLoadError("");
      setOwnedEvents((current) => [result.event, ...current.filter((event) => event.id !== result.event.id)]);
      if (result.event.startsAt && Date.parse(result.event.startsAt) >= Date.now() - 6 * 60 * 60 * 1000) {
        setReadinessEvents((current) => [result.event, ...current.filter((event) => event.id !== result.event.id)]);
        setReadinessEventId(result.event.id);
      }
      const latest = parseEventDraft(localStorage.getItem("ess_event_draft"));
      if (latest?.clientRequestId === draft.clientRequestId) {
        localStorage.removeItem("ess_event_draft");
      }
      setDraftNotice(`“${result.event.title}” is saved in your planning workspace with its event checklist.`);
    } catch (error) {
      setDraftNotice(
        `${error instanceof Error ? error.message : "Unable to save your event brief."} Your brief is still saved on this device. Retry when you are online.`,
      );
      setDraftError(true);
    } finally {
      setSavingDraft(false);
    }
  };

  useEffect(() => {
    api<{ items: Array<{ id: string; title: string; startsAt?: string | null; city?: string | null }> }>("/events")
      .then((result) => {
        setEventLoadError("");
        setOwnedEvents((current) => {
          const byId = new Map((result.items || []).map((event) => [event.id, event]));
          for (const event of current) byId.set(event.id, event);
          return [...byId.values()];
        });
      })
      .catch((error: Error) => setEventLoadError(error.message));
  }, []);

  useEffect(() => {
    void importPlannerDraft();
  }, []);

  useEffect(() => {
    api<{ items: Array<{ id: string; title: string; startsAt?: string | null }> }>("/readiness/mine")
      .then((r) => {
        setReadinessLoadError("");
        setReadinessEvents(r.items || []);
        if (r.items?.[0]) setReadinessEventId(r.items[0].id);
      })
      .catch((error: Error) => setReadinessLoadError(error.message));
  }, []);

  return (
    <div className="ess-portal-stack">
      <div className="ess-page-heading">
        <div>
          <p className="ess-eyebrow">Executive Planner command center</p>
          <h1>Welcome back, {session.name.split(" ")[0]}.</h1>
          <p>
            Guests, budget, vendors and pre-event green lights — one workspace built for clarity.
          </p>
        </div>
        <button className="ess-primary" type="button" onClick={() => setShowCreate((v) => !v)}>
          <Icon>＋</Icon> New event
        </button>
      </div>

      <div className="ess-filter-row" style={{ marginBottom: 8 }}>
        {(
          [
            ["overview", "Overview"],
            ["checklist", "Checklist"],
            ["checkin", "Guest check-in"],
            ["marketplace", "Marketplace"],
            ["verifiers", "Verifiers"],
            ["wallet", "Wallet & escrow"],
            ["readiness", "Go-live readiness"],
            ["messages", "Messages"],
            ["feedback", "Feedback"],
            ["plans", "Plans"],
            ["kyc", "KYC"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "ess-chip ess-chip-active" : "ess-chip"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {showCreate && (
        <EventCreatePanel
          onCreated={(id) => {
            setReadinessEventId(id);
            setChecklistEventId(id);
            setTab("checklist");
            setShowCreate(false);
            api<{ items: Array<{ id: string; title: string; startsAt?: string | null; city?: string | null }> }>("/events")
              .then((result) => {
                setEventLoadError("");
                setOwnedEvents(result.items || []);
              })
              .catch((error: Error) => setEventLoadError(error.message));
            api<{ items: Array<{ id: string; title: string; startsAt?: string | null }> }>("/readiness/mine")
              .then((result) => {
                setReadinessLoadError("");
                setReadinessEvents(result.items || []);
              })
              .catch((error: Error) => setReadinessLoadError(error.message));
            try {
              localStorage.setItem("ess_resume_event", "Go-live readiness");
            } catch { /* */ }
          }}
        />
      )}
      {tab === "overview" && (
        <>
          {planningAnswersEventId && (
            <PlanningQuestionnaire
              eventId={planningAnswersEventId}
              eventTitle={ownedEvents.find((event) => event.id === planningAnswersEventId)?.title || "your event"}
              onComplete={() => {
                localStorage.removeItem("ess_deep_questionnaire_event_id");
                setPlanningAnswersEventId("");
              }}
            />
          )}
          {draftNotice && (
            <div className={draftError ? "ess-form-error" : "ess-panel"} role="status" style={{ marginBottom: 12 }}>
              {draftNotice}
              {draftError && (
                <button className="ess-outline-button" type="button" disabled={savingDraft} onClick={() => void importPlannerDraft()}>
                  {savingDraft ? "Saving…" : "Retry saving event brief"}
                </button>
              )}
            </div>
          )}
          {eventLoadError && <p className="ess-form-error" role="alert">{eventLoadError}</p>}
          <div className="ess-metrics">
            <Metric
              label="Active events"
              value={String(ownedEvents.length)}
              detail={ownedEvents.length === 1 ? "Event in your workspace" : "Events in your workspace"}
              accent
            />
            <Metric label="Committed budget" value="—" detail="Review budgets inside each event" />
            <Metric label="Guest responses" value="—" detail="Open an event to manage guests" />
            <Metric label="Vendor shortlist" value="—" detail="Browse marketplace services" />
          </div>
          {ownedEvents.length === 0 ? (
            <section className="ess-panel">
              <EmptyState
                icon="◈"
                title={t(locale, "empty.events")}
                description="Create an event to unlock the guided checklist, guest collection, budget plan, and vendor shortlist. Escrow-protected bookings start here."
                actionLabel={t(locale, "cta.createEvent")}
                onAction={() => setShowCreate(true)}
              />
            </section>
          ) : (
            <section className="ess-panel">
              <p className="ess-eyebrow">Your planning workspace</p>
              <h2>Events</h2>
              <div className="ess-listing-grid">
                {ownedEvents.map((event) => (
                  <article className="ess-card" key={event.id}>
                    <h3>{event.title}</h3>
                    <p className="ess-muted">
                      {[event.city, event.startsAt ? new Date(event.startsAt).toLocaleDateString() : "Date to be confirmed"].filter(Boolean).join(" · ")}
                    </p>
                    <button
                      className="ess-outline-button"
                      type="button"
                      disabled={!readinessEvents.some((readinessEvent) => readinessEvent.id === event.id)}
                      onClick={() => {
                        setReadinessEventId(event.id);
                        setTab("readiness");
                      }}
                    >
                      {readinessEvents.some((readinessEvent) => readinessEvent.id === event.id) ? "Open readiness" : "Add a future event date to open readiness"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "marketplace" && (
        <>
          {bookingNotice && (
            <div className="ess-form-error" style={{ background: "#052e16", borderColor: "#166534", color: "#86efac", marginBottom: 12 }}>
              {bookingNotice}
            </div>
          )}
          <MarketplaceBrowse
            locale={locale}
            onBook={(listing) =>
              setBookingNotice(
                `${listing.title} is in your cart. Review checkout to continue with escrow-protected payment.`,
              )
            }
            onOpenWallet={() => setTab("wallet")}
          />
        </>
      )}

      {tab === "readiness" && (
        <section className="ess-panel">
          {readinessLoadError && <p className="ess-form-error" role="alert">{readinessLoadError}</p>}
          <p className="ess-eyebrow">Verifier-backed</p>
          <h2>Go-live readiness</h2>
          <p className="ess-muted">
            Your verifier confirms each booked service. All lights must be green at least 2 hours before start.
            The confirmation window opens 6 hours before the event.
          </p>
          {readinessEvents.length === 0 ? (
            <EmptyState
              icon="●"
              title="No upcoming events"
              description="Create an event with a start time, book services, then open this tab so a verifier can traffic-light every item."
            />
          ) : (
            <>
              <label style={{ display: "block", marginTop: 12, marginBottom: 8 }}>
                Event
                <select
                  value={readinessEventId}
                  onChange={(e) => setReadinessEventId(e.target.value)}
                  style={{ display: "block", width: "100%", maxWidth: 420, marginTop: 6 }}
                >
                  {readinessEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                      {e.startsAt ? ` · ${new Date(e.startsAt).toLocaleString()}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {readinessEventId ? <EventReadinessBoard eventId={readinessEventId} mode="client" /> : null}
            </>
          )}
        </section>
      )}

      {tab === "checklist" && (
        <EventChecklistPanel events={ownedEvents} initialEventId={checklistEventId || undefined} />
      )}
      {tab === "checkin" && <GuestCheckInPanel events={ownedEvents} />}
      {tab === "messages" && <EventMessagesPanel events={ownedEvents} />}
      {tab === "wallet" && <WalletPanel locale={locale} role="CLIENT" />}
      {tab === "feedback" && <FeedbackPanel locale={locale} />}
      {tab === "plans" && <SubscriptionsPanel audience="CLIENT" />}
      {tab === "verifiers" && (
        <VerifierPicker eventId={readinessEventId || undefined} />
      )}
      {tab === "kyc" && <KycUpload defaultKind="IDENTITY" />}
    </div>
  );
}

function VendorPortal({
  listings,
  setListings,
  gigs,
  setGigs,
}: {
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  gigs: Gig[];
  setGigs: React.Dispatch<React.SetStateAction<Gig[]>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "Catering",
    price: "",
    currency: "NGN",
    status: "Draft" as "Live" | "Draft",
    image: "✦",
    city: "",
    capacity: "",
    leadTime: "",
    includes: "",
  });
  const openForm = (listing?: Listing) => {
    setEditing(listing ?? null);
    setForm(
      listing
        ? {
            name: listing.name,
            category: listing.category,
            price: listing.price,
            currency: listing.currency,
            status: listing.status,
            image: listing.image,
            city: listing.city ?? "",
            capacity: listing.capacity ?? "",
            leadTime: listing.leadTime ?? "",
            includes: listing.includes ?? "",
          }
        : {
            name: "",
            category: "Catering",
            price: "",
            currency: "NGN",
            status: "Draft",
            image: "✦",
            city: "",
            capacity: "",
            leadTime: "",
            includes: "",
          },
    );
    setShowForm(true);
  };
  const saveListing = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.price) return;
    if (editing)
      setListings((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...editing, ...form } : item,
        ),
      );
    else setListings((current) => [{ ...form, id: Date.now() }, ...current]);
    setNotice("Catalog saved and ready for planner discovery.");
    setShowForm(false);
  };
  const [vendorTab, setVendorTab] = useDashboardTab(
    ["catalog", "wallet", "plans", "kyc", "messages"] as const,
    "catalog",
  );
  return (
    <>
      <div className="ess-page-heading">
        <div>
          <p className="ess-eyebrow">Vendor command center</p>
          <h1>Sell the experience.</h1>
          <p>
            Manage your catalog, requests, and international earnings from one
            view.
          </p>
        </div>
        <button className="ess-primary" onClick={() => openForm()}>
          <Icon>＋</Icon> Add package
        </button>
      </div>
      {notice && <div className="ess-toast">{notice}</div>}
      <div className="ess-filter-row" style={{ marginBottom: 12 }}>
        <button type="button" className={vendorTab === "catalog" ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setVendorTab("catalog")}>Catalog & demand</button>
        <button type="button" className={vendorTab === "wallet" ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setVendorTab("wallet")}>Wallet & escrow</button>
        <button type="button" className={vendorTab === "plans" ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setVendorTab("plans")}>Plans & promos</button>
        <button type="button" className={vendorTab === "kyc" ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setVendorTab("kyc")}>KYC</button>
        <button type="button" className={vendorTab === "messages" ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setVendorTab("messages")}>Messages</button>
      </div>
      {vendorTab === "wallet" ? (
        <WalletPanel role="VENDOR" />
      ) : vendorTab === "plans" ? (
        <SubscriptionsPanel audience="VENDOR" />
      ) : vendorTab === "kyc" ? (
        <KycUpload defaultKind="BUSINESS" />
      ) : vendorTab === "messages" ? (
        <VendorEventMessagesPanel />
      ) : (
      <>
      <div className="ess-metrics">
        <Metric
          label="Available balance"
          value="—"
          detail="Open Wallet & escrow for live balance"
          accent
        />
        <Metric
          label="This month"
          value="—"
          detail="Monthly earnings data not connected"
        />
        <Metric
          label="Active requests"
          value="—"
          detail="Request data not connected"
        />
        <Metric
          label="Trust score"
          value="—"
          detail="Review data not connected"
        />
      </div>
      {listings.length === 0 && gigs.length === 0 && (
        <section className="ess-panel">
          <EmptyState
            icon="▦"
            title="No listings yet"
            description="Add your first package so planners can discover you. Verified vendors with clear pricing convert faster."
            actionLabel="Add your first listing"
            onAction={() => openForm()}
          />
        </section>
      )}
      <div className="ess-grid ess-grid-main">
        <section className="ess-panel ess-panel-wide">
          <SectionTitle
            eyebrow="Demand"
            title="Event gig requests"
            action={<button className="ess-quiet-button">Export CSV</button>}
          />
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gigs.map((gig) => (
                  <tr key={gig.id}>
                    <td>
                      <strong>{gig.event}</strong>
                    </td>
                    <td>{gig.service}</td>
                    <td>{gig.location}</td>
                    <td>{gig.amount}</td>
                    <td>
                      <StatusPill status={gig.status} />
                    </td>
                    <td>
                      <button
                        className="ess-row-action"
                        onClick={() =>
                          setGigs((current) =>
                            current.map((item) =>
                              item.id === gig.id
                                ? {
                                    ...item,
                                    status:
                                      item.status === "Pending"
                                        ? "Confirmed"
                                        : item.status,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {gig.status === "Pending" ? "Confirm" : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="ess-panel">
          <SectionTitle eyebrow="Wallet" title="Balances by currency" />
          <p className="ess-muted">Open Wallet & escrow to review current balances and ledger activity.</p>
        </section>
      </div>
      <section className="ess-panel">
        <SectionTitle
          eyebrow="Storefront"
          title="Service catalog"
          action={
            <button className="ess-quiet-button" onClick={() => openForm()}>
              Add package →
            </button>
          }
        />
        <div className="ess-catalog-grid">
          {listings.length === 0 ? (
            <div className="ess-empty-dashboard">
              <strong>No packages entered yet.</strong>
              <span>
                Add your first complete service package to become discoverable.
              </span>
            </div>
          ) : (
            listings.map((listing) => (
              <article className="ess-catalog-card" key={listing.id}>
                <div className="ess-product-art">{listing.image}</div>
                <div className="ess-catalog-card-body">
                  <div>
                    <StatusPill status={listing.status} />
                    <span className="ess-card-category">
                      {listing.category}
                    </span>
                  </div>
                  <h3>{listing.name}</h3>
                  <strong>
                    {listing.currency} {listing.price}
                  </strong>
                  <small>
                    {listing.city || "Location not set"} ·{" "}
                    {listing.capacity || "Capacity not set"}
                  </small>
                  <button
                    className="ess-outline-button"
                    onClick={() => openForm(listing)}
                  >
                    Edit package
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      {showForm && (
        <div className="ess-modal-backdrop">
          <form className="ess-modal" onSubmit={saveListing}>
            <div className="ess-modal-header">
              <div>
                <p className="ess-eyebrow">Catalog manager</p>
                <h2>{editing ? "Edit package" : "Add service package"}</h2>
              </div>
              <button
                type="button"
                className="ess-close"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>
            <label>
              Package name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="e.g. Full-service catering"
                required
              />
            </label>
            <label>
              What is included?
              <textarea
                value={form.includes}
                onChange={(event) =>
                  setForm({ ...form, includes: event.target.value })
                }
                placeholder="Staff, menu, setup, cleanup..."
                rows={3}
                required
              />
            </label>
            <div className="ess-form-grid">
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                >
                  <option>Catering</option>
                  <option>Decor</option>
                  <option>Photography & Video</option>
                  <option>Entertainment</option>
                  <option>Venues</option>
                </select>
              </label>
              <label>
                Currency
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm({ ...form, currency: event.target.value })
                  }
                >
                  <option>NGN</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </label>
              <label>
                Price
                <input
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  placeholder="850000"
                  required
                />
              </label>
              <label>
                Capacity
                <input
                  value={form.capacity}
                  onChange={(event) =>
                    setForm({ ...form, capacity: event.target.value })
                  }
                  placeholder="Guests served"
                  required
                />
              </label>
              <label>
                Operating city
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm({ ...form, city: event.target.value })
                  }
                  placeholder="Lagos"
                  required
                />
              </label>
              <label>
                Lead time
                <input
                  value={form.leadTime}
                  onChange={(event) =>
                    setForm({ ...form, leadTime: event.target.value })
                  }
                  placeholder="7 days"
                  required
                />
              </label>
              <label>
                Visibility
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as "Live" | "Draft",
                    })
                  }
                >
                  <option>Draft</option>
                  <option>Live</option>
                </select>
              </label>
              <label>
                Portfolio visual token
                <input
                  value={form.image}
                  onChange={(event) =>
                    setForm({ ...form, image: event.target.value })
                  }
                  placeholder="📸"
                />
              </label>
            </div>
            <button className="ess-primary" type="submit">
              Save complete package
            </button>
          </form>
        </div>
      )}
    </>
      )}
    </>
  );
}

function AffiliatePortal() {
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState("Social media");
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="ess-page-heading">
        <div>
          <p className="ess-eyebrow">Affiliate workspace</p>
          <h1>Grow the event network.</h1>
          <p>
            Share useful event infrastructure and track the people you refer.
          </p>
        </div>
        <button
          className="ess-primary"
          onClick={() => setNotice("Referral link copied to clipboard.")}
        >
          Copy referral link
        </button>
      </div>
      {notice && <div className="ess-toast">{notice}</div>}
      <div className="ess-metrics">
        <Metric
          label="Referrals"
          value="0"
          detail="Your new entries appear here"
          accent
        />
        <Metric
          label="Qualified accounts"
          value="0"
          detail="Awaiting your first referral"
        />
        <Metric
          label="Rewards"
          value="—"
          detail="Calculated after qualification"
        />
        <Metric label="Conversion" value="—" detail="No traffic recorded" />
      </div>
      <section className="ess-panel">
        <SectionTitle
          eyebrow="Partner setup"
          title="Define your growth channel"
        />
        <div className="ess-form-grid">
          <label className="ess-note-label">
            Referral code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Your preferred code"
            />
          </label>
          <label className="ess-note-label">
            Primary channel
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option>Social media</option>
              <option>Community</option>
              <option>Agency network</option>
              <option>Content publication</option>
            </select>
          </label>
        </div>
        <button
          className="ess-primary"
          onClick={() => setNotice("Affiliate preferences saved.")}
        >
          Save partner profile
        </button>
      </section>
    </>
  );
}

function VerifierPortal() {
  const [queue, setQueue] = useState<
    Array<{
      id: string;
      title: string;
      startsAt?: string | null;
      endsAt?: string | null;
      status?: string;
      city?: string | null;
      bookingCount?: number;
      readiness?: { status: string; greenCount: number; totalChecks: number; allGreen?: boolean } | null;
    }>
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ items: typeof queue }>("/readiness/queue")
      .then((r) => setQueue(r.items || []))
      .catch((e) => setMsg(e instanceof Error ? e.message : "Queue failed"));
  }, []);

  return (
    <div className="ess-shell">
      <header className="ess-topbar">
        <div>
          <p className="ess-eyebrow">Verifier</p>
          <h1>Pre-event service confirmation</h1>
        </div>
      </header>
      <p className="ess-muted" style={{ maxWidth: 720 }}>
        Your job: confirm every booked service for the customer. Window opens <strong>6 hours</strong> before
        start. Everything must be <strong>green at least 2 hours</strong> before the event begins. The customer
        watches the same board and countdown.
      </p>
      {msg && <div className="ess-form-error">{msg}</div>}
      <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <section className="ess-panel">
          <h2>Recent and upcoming events</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {queue.length === 0 && <li className="ess-muted">No recent or upcoming events need verifier action.</li>}
            {queue.map((e) => (
              <li key={e.id} className="ess-wallet-card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>{e.title}</strong>
                  <div className="ess-muted" style={{ fontSize: 13 }}>
                    {e.startsAt ? new Date(e.startsAt).toLocaleString() : "No start time"}
                    {e.endsAt ? ` – ${new Date(e.endsAt).toLocaleString()}` : ""}
                    {" · "}{e.city || "—"} · {e.status || "PLANNING"}
                    {e.status === "COMPLETED" && e.bookingCount
                      ? ` · ${e.bookingCount} escrow release${e.bookingCount === 1 ? "" : "s"} pending`
                      : ""}
                    {e.readiness
                      ? ` · ${e.readiness.greenCount}/${e.readiness.totalChecks} green · ${e.readiness.status}`
                      : " · not synced"}
                  </div>
                </div>
                <button type="button" className="ess-primary" onClick={() => setSelected(e.id)}>
                  {e.status === "COMPLETED" ? "Retry escrow release" : "Open checks & escrow"}
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selected && (
          <EventReadinessBoard eventId={selected} mode="verifier" />
        )}
        {queue.length > 0 && <EventMessagesPanel events={queue} />}
      </div>
    </div>
  );
}

function ConsultantPortal() {
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; createdAt: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: typeof notifications }>("/notifications")
      .then((result) => setNotifications(result.items || []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load consultant updates."));
  }, []);

  return (
    <div className="ess-shell">
      <header className="ess-page-heading">
        <div>
          <p className="ess-eyebrow">Consultant workspace</p>
          <h1>Operations updates</h1>
          <p>Review the latest notifications for your assigned event work.</p>
        </div>
      </header>
      <section className="ess-panel">
        <SectionTitle eyebrow="Activity" title="Recent updates" />
        {error ? <p className="ess-form-error" role="alert">{error}</p> : null}
        {!error && notifications.length === 0 ? <p className="ess-muted">No updates yet. Assignment and readiness notices will appear here.</p> : null}
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {notifications.map((item) => (
            <li className="ess-wallet-card" key={item.id}>
              <strong>{item.title}</strong>
              <p className="ess-muted">{item.body}</p>
              <small>{new Date(item.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}


function AdminPortal() {
  const [overview, setOverview] = useState<{
    accounts: { total: number; active: number };
    events: number;
    vendors: number;
    activeListings: number;
    activeMarkets: number;
    pendingVerifications: number;
    disputedBookings: number;
    bookingsByStatus: Record<string, number>;
    settledBookingValue: Array<{ currency: string; amountMinor: string }>;
    recentAudit: Array<{ id: string; action: string; entity: string; entityId?: string | null; createdAt: string; actor?: { name: string; role: string } | null }>;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<typeof overview>("/admin/overview")
      .then((result) => {
        if (active) {
          setOverview(result);
          setError("");
        }
      })
      .catch((loadError: Error) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <>
      <div className="ess-page-heading">
        <div>
          <p className="ess-eyebrow">Platform operations</p>
          <h1>Platform operations</h1>
          <p>Live account, marketplace, booking, and verification status.</p>
        </div>
        <button className="ess-outline-button" type="button" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {loading && !overview ? <p className="ess-muted">Loading platform data…</p> : null}
      {overview && (
        <>
          <div className="ess-metrics">
            <Metric label="Accounts" value={overview.accounts.total.toLocaleString()} detail={`${overview.accounts.active.toLocaleString()} active`} accent />
            <Metric label="Events" value={overview.events.toLocaleString()} detail="All event records" />
            <Metric label="Vendors" value={overview.vendors.toLocaleString()} detail={`${overview.activeListings.toLocaleString()} active listings`} />
            <Metric label="Active markets" value={overview.activeMarkets.toLocaleString()} detail="Countries with active listings" />
          </div>
          <div className="ess-grid ess-grid-main">
            <section className="ess-panel ess-panel-wide">
              <SectionTitle eyebrow="Marketplace" title="Booking activity" />
              <div className="ess-metrics">
                {Object.entries(overview.bookingsByStatus).map(([status, count]) => (
                  <Metric key={status} label={status.replace(/_/g, " ")} value={count.toLocaleString()} detail="Bookings" />
                ))}
              </div>
              <h3>Settled booking value</h3>
              {overview.settledBookingValue.length ? overview.settledBookingValue.map((entry) => (
                <p key={entry.currency}>{entry.currency} {entry.amountMinor} minor units</p>
              )) : <p className="ess-muted">No settled bookings yet.</p>}
            </section>
            <section className="ess-panel">
              <SectionTitle eyebrow="Verification" title="Review queue" />
              <Metric label="Pending verification requests" value={overview.pendingVerifications.toLocaleString()} detail="Review access is available to authorized staff" />
              <Metric label="Disputed bookings" value={overview.disputedBookings.toLocaleString()} detail="Requires case-by-case review" />
            </section>
          </div>
          <section className="ess-panel">
            <SectionTitle eyebrow="Governance" title="Recent audit activity" />
            {overview.recentAudit.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {overview.recentAudit.map((item) => (
                  <article className="ess-card" key={item.id}>
                    <strong>{item.action.replace(/_/g, " ")}</strong>
                    <p className="ess-muted">{item.entity}{item.entityId ? ` · ${item.entityId}` : ""} · {item.actor?.name || "System"}</p>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </article>
                ))}
              </div>
            ) : <p className="ess-muted">No audit activity recorded.</p>}
          </section>
        </>
      )}
    </>
  );
}

export default function EnterpriseApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const initialRouteRole = location.pathname.match(/^\/auth\/(signin|signup|forgot)\/?$/)
    ? new URLSearchParams(location.search).get("role")
    : null;
  const [selectedRole, setSelectedRole] = useState<Role>(() =>
    initialRouteRole && isRole(initialRouteRole) ? initialRouteRole : "CLIENT",
  );
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode | "">("");
  const [activeRole, setActiveRole] = useState<Role>("CLIENT");
  const [showOnboard, setShowOnboard] = useState(false);
  const [resumeLabel, setResumeLabel] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ess_user");
      const token = localStorage.getItem("ess_access_token");
      if (raw && token) {
        const user = JSON.parse(raw) as { name?: string; email?: string; role?: string; organizationMode?: OrganizationMode | null };
        if (user?.name && user?.email && user?.role && isRole(user.role)) {
          if (user.role === "ORGANIZATION" && user.organizationMode !== "EVENT_PLANNING" && user.organizationMode !== "SERVICE_PROVIDER") {
            localStorage.removeItem("ess_access_token");
            localStorage.removeItem("ess_refresh_token");
            localStorage.removeItem("ess_user");
            setAccountNotice("Choose an organization operating mode when creating your organization account.");
          } else {
            setSession({ name: user.name, email: user.email, role: user.role, organizationMode: user.organizationMode });
            setActiveRole(user.role);
          }
        } else if (user?.role === "RIDER") {
          localStorage.removeItem("ess_access_token");
          localStorage.removeItem("ess_refresh_token");
          localStorage.removeItem("ess_user");
          setAccountNotice("Rider access is no longer available. Existing account and dispatch records have been preserved.");
        }
      }
      const pending = localStorage.getItem("ess_resume_event");
      if (pending) setResumeLabel(pending);
    } catch { /* */ }
  }, []);


  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [registrationCategory, setRegistrationCategory] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorCity, setVendorCity] = useState("");
  const [vendorDescription, setVendorDescription] = useState("");
  const [vendorKycUrl, setVendorKycUrl] = useState("");
  const [country, setCountry] = useState("NG");
  const [currency, setCurrency] = useState<CurrencyCode>("NGN");
  const [localePref, setLocalePref] = useState<LocaleCode>("en");
  const [listings, setListings] = useState(initialListings);
  const [gigs, setGigs] = useState(initialGigs);
  const resetToken = new URLSearchParams(location.search).get("token");
  const routeAuthMode = location.pathname.match(/^\/auth\/(signin|signup|forgot)\/?$/)?.[1] as
    | "signin"
    | "signup"
    | "forgot"
    | undefined;
  const authOpen = Boolean(routeAuthMode);
  const authMode = routeAuthMode ?? "signin";

  const openAuth = (role: Role, mode: "signin" | "signup" | "forgot" = "signin") => {
    setSelectedRole(role);
    if (role !== "ORGANIZATION") setOrganizationMode("");
    setAuthError("");
    navigate(`/auth/${mode}?role=${encodeURIComponent(role)}`);
  };
  const closeAuth = () =>
    navigate(session ? `/dashboard/${session.role.toLowerCase()}` : "/");
  const startEventBuilder = () => {
    setMenuOpen(false);
    navigate("/plan");
  };
  const changeAuthMode = (mode: "signin" | "signup" | "forgot") =>
    navigate(`/auth/${mode}?role=${encodeURIComponent(selectedRole)}`);
  const changeAuthRole = (role: Role) => {
    setSelectedRole(role);
    if (role !== "ORGANIZATION") setOrganizationMode("");
    navigate(`/auth/${routeAuthMode ?? "signin"}?role=${encodeURIComponent(role)}`, {
      replace: true,
    });
  };
  const openDashboard = (role: Role) => {
    if (session && role !== session.role) {
      setActiveRole(session.role);
      navigate(`/dashboard/${session.role.toLowerCase()}`, { replace: true });
      return;
    }
    setActiveRole(role);
    navigate(`/dashboard/${role.toLowerCase()}`);
  };

  useEffect(() => {
    if (routeAuthMode) {
      const role = new URLSearchParams(location.search).get("role");
      if (role && Object.prototype.hasOwnProperty.call(roleMeta, role)) {
        setSelectedRole(role as Role);
      }
    }
  }, [routeAuthMode, location.search]);
  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError("");
    if (
      !email ||
      (authMode !== "forgot" && !password) ||
      (authMode === "signup" && !name)
    ) {
      setAuthError("Complete the required fields to continue.");
      return;
    }
    if (authMode === "signup" && !checkPassword(password).ok) {
      setAuthError(PASSWORD_HELPER);
      return;
    }
    if (authMode === "signup" && selectedRole === "ORGANIZATION" && !organizationMode) {
      setAuthError("Choose how your organization will use ESS.");
      return;
    }
    try {
      const endpoint =
        authMode === "signup"
          ? "/api/v1/auth/register"
          : authMode === "forgot"
            ? "/api/v1/auth/forgot-password"
            : "/api/v1/auth/login";
      const body =
        authMode === "signup"
          ? {
              email,
              password,
              name,
              role: selectedRole,
              organizationMode: selectedRole === "ORGANIZATION" ? organizationMode : undefined,
              registrationCategory: registrationCategory || undefined,
              referralCode: referralCode || undefined,
              businessName: selectedRole === "VENDOR" || (selectedRole === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER") ? business : undefined,
              phone:
                selectedRole === "VENDOR" || (selectedRole === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER")
                  ? vendorPhone
                  : undefined,
              businessCity: selectedRole === "VENDOR" || (selectedRole === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER") ? vendorCity : undefined,
              businessDescription:
                selectedRole === "VENDOR" || (selectedRole === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER") ? vendorDescription : undefined,
              kycDocumentUrl:
                (selectedRole === "VENDOR" || (selectedRole === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER")) && vendorKycUrl
                  ? vendorKycUrl
                  : undefined,
              country,
              currency,
              locale: localePref,
            }
          : { email, ...(authMode === "forgot" ? {} : { password }) };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result?.error?.message || "Unable to authenticate.");
      if (authMode === "forgot") {
        setAuthError("");
        navigate("/auth/signin?role=CLIENT", { replace: true });
        return;
      }
      const user = result.user;
      if (!isRole(user?.role) || user.role !== selectedRole) {
        throw new Error(`This account does not have the ${roleMeta[selectedRole].short} role.`);
      }
      localStorage.setItem("ess_access_token", result.accessToken);
      localStorage.setItem("ess_refresh_token", result.refreshToken);
      localStorage.setItem("ess_user", JSON.stringify(user));
      setSession({ name: user.name, email: user.email, role: user.role, organizationMode: user.organizationMode });
      setActiveRole(user.role);
      navigate(`/dashboard/${String(user.role).toLowerCase()}`, { replace: true });
      if (authMode === "signup" || !hasCompletedOnboard()) {
        setShowOnboard(true);
      }
      try {
        const pending = localStorage.getItem("ess_resume_event");
        if (pending) setResumeLabel(pending);
      } catch { /* */ }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to authenticate.",
      );
    }
  };
  const signOut = () => {
    setSession(null);
    localStorage.removeItem("ess_access_token");
    localStorage.removeItem("ess_refresh_token");
    localStorage.removeItem("ess_user");
    navigate("/");
  };
  if (session && showOnboard) {
    return (
      <OnboardingOverlay name={session.name} onDone={() => setShowOnboard(false)} />
    );
  }

  const portal =
    session && (activeRole === "CLIENT" || (activeRole === "ORGANIZATION" && session.organizationMode === "EVENT_PLANNING")) ? (
      <ClientPortal session={session} locale={localePref} country={country} currency={currency} />
    ) : session && (activeRole === "VENDOR" || (activeRole === "ORGANIZATION" && session.organizationMode === "SERVICE_PROVIDER")) ? (
      <VendorPortal
        listings={listings}
        setListings={setListings}
        gigs={gigs}
        setGigs={setGigs}
      />
    ) : session && activeRole === "AFFILIATE" ? (
      <AffiliatePortal />
    ) : session && activeRole === "VERIFIER" ? (
      <VerifierPortal />
    ) : session && activeRole === "CONSULTANT" ? (
      <ConsultantPortal />
    ) : session && activeRole === "ADMIN" ? (
      <AdminPortal />
    ) : null;
  const publicLandingContent = (
    <PublicLanding
      onLoginSuccess={(payload) => {
        const user = payload.user;
        if (!isRole(user?.role)) {
          throw new Error("Unsupported account role in sign-in response.");
        }
        if (
          user.role === "ORGANIZATION" &&
          user.organizationMode !== "EVENT_PLANNING" &&
          user.organizationMode !== "SERVICE_PROVIDER"
        ) {
          throw new Error("This organization account needs an operating mode. Please contact support.");
        }
        localStorage.setItem("ess_access_token", payload.accessToken);
        localStorage.setItem("ess_refresh_token", payload.refreshToken);
        localStorage.setItem("ess_user", JSON.stringify(user));
        setSession({
          name: user.name,
          email: user.email,
          role: user.role,
          organizationMode: user.organizationMode,
        });
        setActiveRole(user.role);
        let hasPendingEventBrief = false;
        try {
          hasPendingEventBrief = Boolean(localStorage.getItem("ess_event_draft"));
        } catch { /* storage may be disabled */ }
        navigate(`/dashboard/${String(user.role).toLowerCase()}`, { replace: true });
        if (!hasCompletedOnboard()) setShowOnboard(true);
        try {
          const pending = localStorage.getItem("ess_resume_event");
          if (pending) setResumeLabel(pending);
        } catch { /* */ }
      }}
      onStartBuilder={startEventBuilder}
    />
  );
  if (!session) {
    return (
      <>
        {accountNotice && <div className="ess-shell"><p className="ess-muted" role="status">{accountNotice}</p></div>}
        <Routes>
          <Route path={APP_ROUTE_PATHS.home} element={publicLandingContent} />
          <Route
            path={APP_ROUTE_PATHS.plan}
            element={<EventBuilder onBack={() => navigate("/")} onComplete={() => openAuth("CLIENT", "signup")} />}
          />
          <Route
            path={APP_ROUTE_PATHS.auth}
            element={authOpen ? publicLandingContent : <Navigate to="/" replace />}
          />
          <Route
            path={APP_ROUTE_PATHS.resetPassword}
            element={resetToken ? <ResetPasswordPage token={resetToken} /> : <Navigate to="/" replace />}
          />
          <Route path={APP_ROUTE_PATHS.dashboard} element={<SignedOutDashboardRedirect />} />
          <Route path={APP_ROUTE_PATHS.legacyDashboard} element={<LegacyDashboardRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!session && authOpen && (
          <AuthModal
            role={selectedRole}
            mode={authMode}
            organizationMode={organizationMode}
            email={email}
            password={password}
            name={name}
            business={business}
            vendorPhone={vendorPhone}
            vendorCity={vendorCity}
            vendorDescription={vendorDescription}
            vendorKycUrl={vendorKycUrl}
            registrationCategory={registrationCategory}
            referralCode={referralCode}
            error={authError}
            onClose={closeAuth}
            onSubmit={submitAuth}
            onRole={changeAuthRole}
            setEmail={setEmail}
            setPassword={setPassword}
            setName={setName}
            setBusiness={setBusiness}
            setVendorPhone={setVendorPhone}
            setVendorCity={setVendorCity}
            setVendorDescription={setVendorDescription}
            setVendorKycUrl={setVendorKycUrl}
            setRegistrationCategory={setRegistrationCategory}
            setOrganizationMode={setOrganizationMode}
            setReferralCode={setReferralCode}
            setMode={changeAuthMode}
            country={country}
            setCountry={setCountry}
            currency={currency}
            setCurrency={setCurrency}
            localePref={localePref}
            setLocalePref={setLocalePref}
          />
        )}
      </>
    );
  }

  return (
    <div className="ess-app">
      <header className="ess-topbar">
        <button
          className="ess-brand"
          onClick={() => (session ? openDashboard(session.role) : navigate("/"))}
        >
          <img className="ess-app-brand-logo" src="/brand/ephinta_logo2.png" alt="EPHINTA" /><span className="ess-brand-mark">EPHINTA</span>
          <span>
            EPHINTA
            <small>International event infrastructure</small>
          </span>
        </button>
        {session ? (
          <>
            <div className="ess-portal-menu">
              <button
                className="ess-menu-trigger"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="ess-account-dot" />
                {roleMeta[activeRole].short} portal{" "}
                <span className="ess-menu-chevron">⌄</span>
              </button>
              {menuOpen && (
                <div className="ess-menu-dropdown">
                  <div className="ess-menu-heading">
                    <span>Switch workspace</span>
                    <small>Choose an operating lane</small>
                  </div>
                  {[session.role].map((role) => (
                    <button
                      className={
                        activeRole === role
                          ? "ess-menu-option active"
                          : "ess-menu-option"
                      }
                      key={role}
                      onClick={() => {
                        openDashboard(role);
                        setMenuOpen(false);
                      }}
                    >
                      <span className="ess-menu-option-icon">
                        {role === "CLIENT"
                          ? "◈"
                          : role === "ORGANIZATION"
                            ? "▧"
                            : role === "VENDOR"
                            ? "▦"
                            : role === "CONSULTANT"
                              ? "◎"
                              : role === "AFFILIATE"
                              ? "◎"
                              : role === "VERIFIER"
                                ? "✓"
                                : "⌘"}
                      </span>
                      <span>
                        <strong>{roleMeta[role].short} portal</strong>
                        <small>{roleMeta[role].description}</small>
                      </span>
                      <b>{activeRole === role ? "Current" : "Open"}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ess-locale-switch">
              <select
                value={localePref}
                onChange={(e) => setLocalePref(e.target.value as LocaleCode)}
                aria-label="Language"
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                aria-label="Currency"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="ess-account">
              <span>{session.name}</span>
              <button onClick={signOut}>Sign out</button>
            </div>
          </>
        ) : (
          <div className="ess-public-menu">
            <button
              className="ess-menu-trigger"
              aria-label="Open ESS menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="ess-hamburger">
                <i />
                <i />
                <i />
              </span>
              Menu
            </button>
            {menuOpen && (
              <div className="ess-menu-dropdown ess-public-dropdown">
                <div className="ess-menu-heading">
                  <span>EPHINTA</span>
                  <small>Choose how you want to work</small>
                </div>
                <button
                  className="ess-menu-option"
                  onClick={startEventBuilder}
                >
                  <span className="ess-menu-option-icon">◈</span>
                  <span>
                    <strong>Start planning</strong>
                    <small>Build your desired event brief</small>
                  </span>
                  <b>Open</b>
                </button>
                <button
                  className="ess-menu-option"
                  onClick={() => {
                    openAuth("VENDOR");
                    setMenuOpen(false);
                  }}
                >
                  <span className="ess-menu-option-icon">▦</span>
                  <span>
                    <strong>Vendor portal</strong>
                    <small>Sell services and manage bookings</small>
                  </span>
                  <b>Open</b>
                </button>
                <button
                  className="ess-menu-option"
                  onClick={() => {
                    openAuth("VERIFIER");
                    setMenuOpen(false);
                  }}
                >
                  <span className="ess-menu-option-icon">↗</span>
                  <span>
                    <strong>Verifier portal</strong>
                    <small>Confirm services green before go-time</small>
                  </span>
                  <b>Open</b>
                </button>
                <button
                  className="ess-menu-option"
                  onClick={() => {
                    openAuth("AFFILIATE", "signup");
                    setMenuOpen(false);
                  }}
                >
                  <span className="ess-menu-option-icon">◎</span>
                  <span>
                    <strong>Affiliate portal</strong>
                    <small>Refer trusted event services</small>
                  </span>
                  <b>Open</b>
                </button>
                <button
                  className="ess-menu-option"
                  onClick={() => {
                    openAuth("CLIENT");
                    setMenuOpen(false);
                  }}
                >
                  <span className="ess-menu-option-icon">→</span>
                  <span>
                    <strong>Sign in</strong>
                    <small>Access your existing workspace</small>
                  </span>
                  <b>Open</b>
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <Routes>
        <Route element={<DashboardRouteGuard session={session} />}>
          <Route
            path={APP_ROUTE_PATHS.dashboard}
            element={
              <main className="ess-content">
                {resumeLabel && (
                  <div className="ess-shell" style={{ paddingBottom: 0 }}>
                    <ResumeStrip
                      label={resumeLabel}
                      onContinue={() => {
                        openDashboard("CLIENT");
                        setResumeLabel(null);
                      }}
                      onDismiss={() => {
                        setResumeLabel(null);
                        try {
                          localStorage.removeItem("ess_resume_event");
                        } catch { /* */ }
                      }}
                    />
                  </div>
                )}
                {portal}
              </main>
            }
          />
        </Route>
        <Route path={APP_ROUTE_PATHS.legacyDashboard} element={<LegacyDashboardRedirect />} />
        <Route
          path="*"
          element={<Navigate to={`/dashboard/${session.role.toLowerCase()}`} replace />}
        />
      </Routes>
      {!session && authOpen && (
        <AuthModal
          role={selectedRole}
          mode={authMode}
          organizationMode={organizationMode}
          email={email}
          password={password}
          name={name}
          business={business}
          vendorPhone={vendorPhone}
          vendorCity={vendorCity}
          vendorDescription={vendorDescription}
          vendorKycUrl={vendorKycUrl}
          registrationCategory={registrationCategory}
          referralCode={referralCode}
          error={authError}
          onClose={closeAuth}
          onSubmit={submitAuth}
          onRole={changeAuthRole}
          setEmail={setEmail}
          setPassword={setPassword}
          setName={setName}
          setBusiness={setBusiness}
          setVendorPhone={setVendorPhone}
          setVendorCity={setVendorCity}
          setVendorDescription={setVendorDescription}
          setVendorKycUrl={setVendorKycUrl}
          setRegistrationCategory={setRegistrationCategory}
          setOrganizationMode={setOrganizationMode}
          setReferralCode={setReferralCode}
          setMode={changeAuthMode}
          country={country}
          setCountry={setCountry}
          currency={currency}
          setCurrency={setCurrency}
          localePref={localePref}
          setLocalePref={setLocalePref}
        />
      )}
    </div>
  );
}

function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(true);
  const [feedback, setFeedback] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!checkPassword(password).ok) {
      setFeedback(PASSWORD_HELPER);
      return;
    }
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const result = await response.json().catch(() => ({}));
    setFeedback(
      response.ok
        ? "Password updated. You can return to sign in."
        : result?.error?.message || "Unable to reset password.",
    );
  };
  return (
    <div className="ess-app">
      <main className="ess-content">
        <div className="ess-auth-modal">
          <p className="ess-eyebrow">Secure recovery</p>
          <h2>Create a new password</h2>
          <p className="ess-muted">{PASSWORD_HELPER}</p>
          <form onSubmit={submit}>
            <div>
              <label htmlFor="reset-password-input">New password</label>
              <div className="ess-password-input" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="reset-password-input"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  placeholder={PASSWORD_HELPER}
                  required
                  style={{ flex: 1, minWidth: 0 }}
                />
                <PasswordVisibilityButton
                  visible={passwordVisible}
                  onToggle={() => setPasswordVisible((visible) => !visible)}
                />
              </div>
              <PasswordRuleChecklist password={password} />
            </div>
            {feedback && <div className="ess-form-error">{feedback}</div>}
            <button className="ess-primary ess-full-button" type="submit">
              Update password
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function PlanningQuestionnaire({ eventId, eventTitle, onComplete }: { eventId: string; eventTitle: string; onComplete: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const questions = [
    ["desiredOutcome", "What would make this event a success for you?"],
    ["audienceNeeds", "Who is attending, and what should their experience include?"],
    ["accessibility", "What accessibility, language, or mobility needs should we plan for?"],
    ["dietaryNeeds", "Are there dietary, cultural, or other guest requirements?"],
    ["programDetails", "What key moments, speakers, or activities belong in the programme?"],
    ["safetyAndPermits", "Are there safety, security, venue, or permit constraints?"],
    ["successMeasures", "How will you measure the outcome after the event?"],
  ] as const;

  useEffect(() => {
    let active = true;
    api<{ answers: Record<string, string>; complete: boolean }>(`/events/${eventId}/plan-answers`)
      .then((result) => {
        if (!active) return;
        setAnswers(result.answers || {});
        if (result.complete) onComplete();
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [eventId, onComplete]);

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ complete: boolean }>(`/events/${eventId}/plan-answers`, {
        method: "PUT",
        body: JSON.stringify({ answers }),
      });
      if (result.complete) onComplete();
      else setNotice("Your answers are saved. Complete every prompt when you are ready to finish.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your answers.");
    } finally {
      setSaving(false);
    }
  };

  const complete = questions.every(([key]) => answers[key]?.trim());
  if (loading) return <section className="ess-panel" aria-live="polite">Loading your planning questions…</section>;
  return (
    <section className="ess-panel" aria-labelledby="planning-questions-title">
      <p className="ess-eyebrow">Continue your event brief</p>
      <h2 id="planning-questions-title">Plan the details for {eventTitle}</h2>
      <p className="ess-muted">Your answers are saved to this event and can be completed over multiple visits.</p>
      {questions.map(([key, label]) => (
        <label key={key} style={{ display: "block", marginTop: 12 }}>
          {label}
          <textarea
            value={answers[key] || ""}
            maxLength={2000}
            rows={3}
            onChange={(event) => setAnswers((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      ))}
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {notice && <p className="ess-muted" role="status">{notice}</p>}
      <div className="ess-builder-actions">
        <button className="ess-outline-button" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save progress"}
        </button>
        <button className="ess-primary" type="button" disabled={saving || !complete} onClick={() => void save()}>
          Save and finish
        </button>
      </div>
    </section>
  );
}

const EVENT_BUILDER_STEP_COUNT = 5;

function EventBuilder({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem("ess_event_builder_step");
      const parsed = saved === null ? 0 : Number(saved);
      return Number.isInteger(parsed) && parsed >= 0 && parsed < EVENT_BUILDER_STEP_COUNT ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const [complete, setComplete] = useState(() => {
    try {
      return localStorage.getItem("ess_event_builder_complete") === "true";
    } catch {
      return false;
    }
  });
  const [saveError, setSaveError] = useState("");
  const [answers, setAnswers] = useState<EventBuilderProgress>(() => {
    const defaults: EventBuilderProgress = {
      title: "",
      type: "SOCIAL",
      goal: "Celebrate",
      date: "",
      city: "",
      guests: "",
      budget: "",
      atmosphere: "Warm and social",
      food: "Mixed menu",
      venue: "Still deciding",
      priorities: "Guest experience",
    };
    try {
      return (
        parseEventBuilderProgress(localStorage.getItem("ess_event_builder_progress")) ??
        eventBuilderProgressFromLandingDraft(localStorage.getItem("ess:eventDraft")) ??
        defaults
      );
    } catch {
      return defaults;
    }
  });
  const update = (key: keyof typeof answers, value: string) => {
    setAnswers((current) => {
      const next = { ...current, [key]: value };
      try {
        localStorage.setItem("ess_event_builder_progress", JSON.stringify(next));
      } catch {
        setSaveError("Your progress could not be saved on this device. Keep this page open to avoid losing it.");
      }
      return next;
    });
  };
  useEffect(() => {
    try {
      localStorage.setItem("ess_event_builder_progress", JSON.stringify(answers));
      localStorage.setItem("ess_event_builder_step", String(step));
      localStorage.setItem("ess_event_builder_complete", String(complete));
      setSaveError("");
    } catch {
      setSaveError("Your progress could not be saved on this device. Keep this page open to avoid losing it.");
    }
  }, [answers, complete, step]);
  const questions = [
    { title: 'What are you creating?', prompt: 'Give the event a working name and choose its format.', fields: <><label>Event name<input value={answers.title} maxLength={160} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Wale Waves Life Experience" required /></label><label>Event format<select value={answers.type} onChange={(event) => update('type', event.target.value)}><option value="PERSONAL">Personal milestone</option><option value="CORPORATE">Corporate gathering</option><option value="SOCIAL">Social celebration</option><option value="ENTERTAINMENT">Entertainment experience</option><option value="EDUCATIONAL">Workshop or learning event</option></select></label></> },
    { title: 'What should it achieve?', prompt: 'This shapes the checklist, vendor recommendations, and guest experience.', fields: <><label>Primary goal<select value={answers.goal} onChange={(event) => update('goal', event.target.value)}><option>Celebrate</option><option>Launch a product</option><option>Build community</option><option>Raise funds</option><option>Train or educate</option><option>Host an unforgettable guest experience</option></select></label><label>What matters most?<select value={answers.priorities} onChange={(event) => update('priorities', event.target.value)}><option>Guest experience</option><option>Brand impression</option><option>Budget control</option><option>Speed and simplicity</option><option>Accessibility and inclusion</option></select></label></> },
    { title: 'Where and when?', prompt: 'Location and timing help us suggest vendors close to the venue.', fields: <><label>Event date<input type="date" value={answers.date} onChange={(event) => update('date', event.target.value)} /></label><label>City or venue area<input value={answers.city} maxLength={120} onChange={(event) => update('city', event.target.value)} placeholder="Lagos, Abuja, London..." required /></label><label>Venue status<select value={answers.venue} onChange={(event) => update('venue', event.target.value)}><option>Still deciding</option><option>Venue selected</option><option>Private residence</option><option>Outdoor or public space</option><option>Virtual</option><option>Hybrid</option></select></label></> },
    { title: 'Who is coming?', prompt: 'Guest volume drives capacity, catering, staffing, and RSVP planning.', fields: <><label>Expected guests<input type="number" min="1" max="5000000" value={answers.guests} onChange={(event) => update('guests', event.target.value)} placeholder="150" required /></label><label>Food direction<select value={answers.food} onChange={(event) => update('food', event.target.value)}><option>Mixed menu</option><option>Local cuisine</option><option>International menu</option><option>Vegetarian or vegan focused</option><option>Not sure yet</option></select></label></> },
    { title: 'What is the guardrail?', prompt: 'We use this to build a realistic budget plan and protect the essentials.', fields: <><label>Planning budget<input value={answers.budget} onChange={(event) => update('budget', event.target.value)} placeholder="e.g. NGN 2,500,000" /></label><label>Atmosphere<select value={answers.atmosphere} onChange={(event) => update('atmosphere', event.target.value)}><option>Warm and social</option><option>Premium and editorial</option><option>High-energy and entertaining</option><option>Calm and intimate</option><option>Professional and focused</option></select></label></> },
  ];
  const checklist = ['Confirm date, venue, and event objective', 'Set an essential-service budget split', `Source location-matched vendors for ${answers.city || 'your venue area'}`, 'Build guest list and RSVP communications', 'Confirm logistics, staffing, and run of show'];
  if (complete) return (
    <main className="ess-builder">
      <button className="ess-quiet-button" onClick={onBack}>← Back to home</button>
      <div className="ess-builder-card">
        <p className="ess-eyebrow">Your event brief</p>
        <h1>{answers.title || "New event"}</h1>
        <p className="ess-builder-lead">{answers.type} · {answers.city || "Location to confirm"} · {answers.guests || "Guest count to confirm"} guests</p>
        <div className="ess-builder-summary">
          <div><span>Purpose</span><strong>{answers.goal}</strong></div>
          <div><span>Priority</span><strong>{answers.priorities}</strong></div>
          <div><span>Budget direction</span><strong>{answers.budget || "To be planned"}</strong></div>
          <div><span>Atmosphere</span><strong>{answers.atmosphere}</strong></div>
        </div>
        <h2>Your first planning missions</h2>
        <ul className="ess-builder-checklist">{checklist.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul>
        {saveError && <p className="ess-form-error" role="alert">{saveError}</p>}
        <button className="ess-outline-button" type="button" onClick={() => setComplete(false)}>Edit your brief</button>
        <button
          className="ess-primary"
          onClick={() => {
            try {
              localStorage.setItem("ess_deep_questions_pending", "true");
              localStorage.setItem("ess_event_draft", JSON.stringify({ ...answers, clientRequestId: crypto.randomUUID() }));
              localStorage.removeItem("ess_event_builder_progress");
              localStorage.removeItem("ess_event_builder_step");
              localStorage.removeItem("ess_event_builder_complete");
              localStorage.removeItem("ess:eventDraft");
              onComplete();
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : "Unable to save this event brief on this device.");
            }
          }}
        >
          Save brief and create account →
        </button>
      </div>
    </main>
  );
  const current = questions[step];
  return <main className="ess-builder"><button className="ess-quiet-button" onClick={onBack}>← Back to home</button><div className="ess-builder-progress" role="group" aria-label="Event planner progress"><span>Step {step + 1} of {questions.length}: {current.title}</span><b>{step + 1} / {questions.length}</b></div><div className="ess-builder-card"><p className="ess-eyebrow">Guided setup</p><h1>{current.title}</h1><p className="ess-builder-lead">{current.prompt}</p>{saveError ? <p className="ess-form-error" role="alert">{saveError}</p> : <p className="ess-muted" role="status">Your progress is saved on this device.</p>}<form onSubmit={(event) => { event.preventDefault(); step === questions.length - 1 ? setComplete(true) : setStep(step + 1); }}>{current.fields}<div className="ess-builder-actions">{step > 0 && <button type="button" className="ess-outline-button" onClick={() => setStep(step - 1)}>Back</button>}<button type="submit" className="ess-primary">{step === questions.length - 1 ? 'Build my event brief' : 'Next question →'}</button></div></form></div></main>;
}

function PublicHome({
  onRole,
  onSignup,
}: {
  onRole: (role: Role) => void;
  onSignup: () => void;
}) {
  return (
    <main className="ess-public">
      <section className="ess-hero">
        <div className="ess-hero-copy">
          <span className="ess-kicker">
            <span className="ess-live-dot" /> The event planning workspace
          </span>
          <h1>
            Make event planning feel <em>more manageable.</em>
          </h1>
          <p>
            Organize event details, explore available services, and keep track
            of the tasks and bookings involved.
          </p>
          <div className="ess-hero-actions">
            <button className="ess-primary ess-large-button" onClick={onSignup}>
              Build your event <span>→</span>
            </button>
            <button
              className="ess-ghost-button"
              onClick={() => onRole("VENDOR")}
            >
              I provide event services
            </button>
          </div>
        </div>
        <div className="ess-hero-art">
          <div className="ess-orbit orbit-a" />
          <div className="ess-orbit orbit-b" />
          <div className="ess-hero-card">
            <p className="ess-eyebrow">Planning snapshot</p>
            <strong>Event brief</strong>
            <span>Keep the next steps together</span>
            <div className="ess-mini-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="ess-floating-tag tag-a">Tasks to review</span>
          <span className="ess-floating-tag tag-b">Booking details</span>
        </div>
      </section>
      <section className="ess-proof-bar">
        <div>
          <strong>Plan</strong>
          <span>before creating an account</span>
        </div>
        <div>
          <strong>Browse</strong>
          <span>available services</span>
        </div>
        <div>
          <strong>Track</strong>
          <span>tasks and readiness</span>
        </div>
        <div>
          <strong>Review</strong>
          <span>booking details</span>
        </div>
      </section>
      <section className="ess-role-section">
        <SectionTitle
          eyebrow="Three ways to start"
          title="Choose your lane"
        />
        <div className="ess-role-grid">
          {(["CLIENT", "ORGANIZATION", "VENDOR"] as Role[]).map((role) => (
            <button
              className="ess-role-card"
              key={role}
              onClick={() => onRole(role)}
            >
              <span className="ess-role-symbol">
                {role === "CLIENT" ? "◈" : role === "ORGANIZATION" ? "▧" : "▦"}
              </span>
              <strong>{roleMeta[role].short}</strong>
              <span>{roleMeta[role].description}</span>
              <b>Enter portal →</b>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function AuthModal({
  role,
  mode,
  organizationMode,
  email,
  password,
  name,
  business,
  vendorPhone,
  vendorCity,
  vendorDescription,
  vendorKycUrl,
  registrationCategory,
  referralCode,
  error,
  onClose,
  onSubmit,
  onRole,
  setEmail,
  setPassword,
  setName,
  setBusiness,
  setVendorPhone,
  setVendorCity,
  setVendorDescription,
  setVendorKycUrl,
  setRegistrationCategory,
  setOrganizationMode,
  setReferralCode,
  setMode,
  country,
  setCountry,
  currency,
  setCurrency,
  localePref,
  setLocalePref,
}: {
  role: Role;
  mode: "signin" | "signup" | "forgot";
  organizationMode: OrganizationMode | "";
  email: string;
  password: string;
  name: string;
  business: string;
  vendorPhone: string;
  vendorCity: string;
  vendorDescription: string;
  vendorKycUrl: string;
  registrationCategory: string;
  referralCode: string;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onRole: (role: Role) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setName: (value: string) => void;
  setBusiness: (value: string) => void;
  setVendorPhone: (value: string) => void;
  setVendorCity: (value: string) => void;
  setVendorDescription: (value: string) => void;
  setVendorKycUrl: (value: string) => void;
  setRegistrationCategory: (value: string) => void;
  setOrganizationMode: (value: OrganizationMode | "") => void;
  setReferralCode: (value: string) => void;
  setMode: (mode: "signin" | "signup" | "forgot") => void;
  country: string;
  setCountry: (value: string) => void;
  currency: CurrencyCode;
  setCurrency: (value: CurrencyCode) => void;
  localePref: LocaleCode;
  setLocalePref: (value: LocaleCode) => void;
}) {
  const [passwordVisible, setPasswordVisible] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<RegistrationField, boolean>>>({});
  const internal = role === "VERIFIER" || role === "ADMIN";
  useEffect(() => setTouched({}), [role, mode]);
  const touch = (field: RegistrationField) => setTouched((current) => ({ ...current, [field]: true }));
  const fieldError = (field: RegistrationField, value: string) =>
    touched[field] ? registrationFieldError(field, value, { role, mode, organizationMode }) : null;
  const fieldFeedback = (field: RegistrationField, value: string) => {
    const message = fieldError(field, value);
    return message ? <span className="ess-form-error" id={`auth-${field}-error`} role="alert">{message}</span> : null;
  };
  const suggestPassword = () =>
    setPassword(`Ess-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}!`);
  return (
    <div className="ess-modal-backdrop">
      <div className="ess-auth-modal">
        <button className="ess-close" onClick={onClose}>
          ×
        </button>
        <div className="ess-auth-brand">
          <img src="/brand/ephinta_logo2.png" alt="" />
          <span>EPHINTA</span>
        </div>
        <p className="ess-eyebrow">Secure access</p>
        <h2>
          {mode === "signup"
            ? "Create your workspace"
            : mode === "forgot"
              ? "Reset your password"
              : `${roleMeta[role].short} sign in`}
        </h2>
        <p className="ess-muted">
          {mode === "forgot"
            ? "Enter your email and we will send a secure reset link if the account exists."
            : internal
              ? "Use the operations preview only for authorized internal roles."
              : roleMeta[role].description}
        </p>
        {mode !== "forgot" && (
          <div className="ess-auth-roles">
            {(["CLIENT", "ORGANIZATION", "VENDOR"] as Role[]).map((item) => (
              <button
                className={role === item ? "active" : ""}
                key={item}
                type="button"
                onClick={() => onRole(item)}
              >
                {roleMeta[item].short}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit}>
          {mode === "signup" && (
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  touch("name");
                }}
                onBlur={() => touch("name")}
                placeholder="Jordan Taylor"
                minLength={2}
                maxLength={100}
                required
                aria-invalid={Boolean(fieldError("name", name))}
                aria-describedby={fieldError("name", name) ? "auth-name-error" : undefined}
              />
              {fieldFeedback("name", name)}
            </label>
          )}
          {mode === "signup" && role === "ORGANIZATION" && (
            <fieldset className="ess-choice-group">
              <legend>How will your organization use ESS?</legend>
              <label>
                <input
                  type="radio"
                  name="organization-mode"
                  value="EVENT_PLANNING"
                  checked={organizationMode === "EVENT_PLANNING"}
                  onChange={() => setOrganizationMode("EVENT_PLANNING")}
                  required
                />
                Plan and manage events
              </label>
              <label>
                <input
                  type="radio"
                  name="organization-mode"
                  value="SERVICE_PROVIDER"
                  checked={organizationMode === "SERVICE_PROVIDER"}
                  onChange={() => setOrganizationMode("SERVICE_PROVIDER")}
                />
                Provide services to event planners
              </label>
            </fieldset>
          )}
          {mode === "signup" && (role === "VENDOR" || (role === "ORGANIZATION" && organizationMode === "SERVICE_PROVIDER")) && (
            <>
              <label>
                Business name
                <input
                  value={business}
                  onChange={(event) => {
                    setBusiness(event.target.value);
                    touch("business");
                  }}
                  onBlur={() => touch("business")}
                  placeholder="Northstar Events"
                  minLength={2}
                  maxLength={120}
                  required
                  aria-invalid={Boolean(fieldError("business", business))}
                  aria-describedby={fieldError("business", business) ? "auth-business-error" : undefined}
                />
                {fieldFeedback("business", business)}
              </label>
              <div className="ess-form-grid">
                <label>
                  Business phone
                  <input
                    value={vendorPhone}
                    onChange={(event) => {
                      setVendorPhone(event.target.value);
                      touch("vendorPhone");
                    }}
                    onBlur={() => touch("vendorPhone")}
                    placeholder="+234..."
                    minLength={7}
                    maxLength={20}
                    aria-invalid={Boolean(fieldError("vendorPhone", vendorPhone))}
                    aria-describedby={fieldError("vendorPhone", vendorPhone) ? "auth-vendorPhone-error" : undefined}
                  />
                  {fieldFeedback("vendorPhone", vendorPhone)}
                </label>
                <label>
                  Operating city
                  <input
                    value={vendorCity}
                    onChange={(event) => {
                      setVendorCity(event.target.value);
                      touch("vendorCity");
                    }}
                    onBlur={() => touch("vendorCity")}
                    placeholder="Lagos"
                    maxLength={120}
                    aria-invalid={Boolean(fieldError("vendorCity", vendorCity))}
                    aria-describedby={fieldError("vendorCity", vendorCity) ? "auth-vendorCity-error" : undefined}
                  />
                  {fieldFeedback("vendorCity", vendorCity)}
                </label>
              </div>
              <label>
                What do you provide?
                <textarea
                  value={vendorDescription}
                  onChange={(event) => {
                    setVendorDescription(event.target.value);
                    touch("vendorDescription");
                  }}
                  onBlur={() => touch("vendorDescription")}
                  placeholder="Describe your services, capacity, and ideal events."
                  rows={3}
                  maxLength={2000}
                  aria-invalid={Boolean(fieldError("vendorDescription", vendorDescription))}
                  aria-describedby={fieldError("vendorDescription", vendorDescription) ? "auth-vendorDescription-error" : undefined}
                />
                {fieldFeedback("vendorDescription", vendorDescription)}
              </label>
              <label>
                KYC document URL
                <input
                  type="url"
                  value={vendorKycUrl}
                  onChange={(event) => {
                    setVendorKycUrl(event.target.value);
                    touch("vendorKycUrl");
                  }}
                  onBlur={() => touch("vendorKycUrl")}
                  placeholder="https://secure-document-link"
                  maxLength={2048}
                  aria-invalid={Boolean(fieldError("vendorKycUrl", vendorKycUrl))}
                  aria-describedby={fieldError("vendorKycUrl", vendorKycUrl) ? "auth-vendorKycUrl-error" : undefined}
                />
                {fieldFeedback("vendorKycUrl", vendorKycUrl)}
              </label>
            </>
          )}
          {mode === "signup" && role === "AFFILIATE" && (
            <>
              <label>
                Primary referral channel
                <select value={registrationCategory} onChange={(event) => setRegistrationCategory(event.target.value)}>
                  <option value="">Choose a channel</option>
                  <option>Social media</option>
                  <option>Community</option>
                  <option>Agency network</option>
                  <option>Content publication</option>
                </select>
              </label>
              <label>
                Referral or partner code
                <input
                  value={referralCode}
                  onChange={(event) => {
                    setReferralCode(event.target.value);
                    touch("referralCode");
                  }}
                  onBlur={() => touch("referralCode")}
                  placeholder="Optional code"
                  maxLength={80}
                  aria-invalid={Boolean(fieldError("referralCode", referralCode))}
                  aria-describedby={fieldError("referralCode", referralCode) ? "auth-referralCode-error" : undefined}
                />
                {fieldFeedback("referralCode", referralCode)}
              </label>
            </>
          )}
          <>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    touch("email");
                  }}
                  onBlur={() => touch("email")}
                  placeholder="you@company.com"
                  required
                  aria-invalid={Boolean(fieldError("email", email))}
                  aria-describedby={fieldError("email", email) ? "auth-email-error" : undefined}
                />
                {fieldFeedback("email", email)}
              </label>
              {mode !== "forgot" && (
                <div>
                  <label htmlFor="auth-password-input">Password</label>
                  <div className="ess-password-input" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      id="auth-password-input"
                      type={passwordVisible ? "text" : "password"}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        touch("password");
                      }}
                      onBlur={() => touch("password")}
                      placeholder={PASSWORD_HELPER}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      style={{ flex: 1, minWidth: 0 }}
                      aria-invalid={Boolean(fieldError("password", password))}
                      aria-describedby={fieldError("password", password) ? "auth-password-error" : undefined}
                    />
                    <PasswordVisibilityButton
                      visible={passwordVisible}
                      onToggle={() => setPasswordVisible((visible) => !visible)}
                    />
                  </div>
                  {fieldFeedback("password", password)}
                  {mode === "signup" && <PasswordRuleChecklist password={password} />}
                  {mode === "signup" && password.length > 0 && (() => {
                    const s = passwordStrength(password);
                    return (
                      <div className="ess-password-meter">
                        <div className="ess-password-meter-bar">
                          <div
                            className="ess-password-meter-fill"
                            style={{
                              width: `${(s.score / 4) * 100}%`,
                              background: s.color,
                            }}
                          />
                        </div>
                        <div className="ess-password-meter-label" style={{ color: s.color }}>
                          {s.label} · A longer passphrase is even stronger.
                        </div>
                      </div>
                    );
                  })()}
                  {mode === "signup" && (
                    <button
                      type="button"
                      className="ess-quiet-button"
                      onClick={suggestPassword}
                    >
                      Suggest a strong password
                    </button>
                  )}
                </div>
              )}
              {mode === "signup" && (
                <div className="ess-locale-row">
                  <label>
                    Country
                    <select
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        const match = COUNTRIES.find((c) => c.code === e.target.value);
                        if (match) {
                          setCurrency(match.currency);
                          setLocalePref(match.locale);
                        }
                      }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Currency
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
          </>
          {mode === "signup" && (
            <div className="ess-auth-trust">
              <span>✓ Escrow-protected bookings</span>
              <span>✓ Multi-currency wallet</span>
              <span>✓ Role-based workspace</span>
            </div>
          )}
          {error && <div className="ess-form-error">{error}</div>}
          <button className="ess-primary ess-full-button" type="submit">
            {internal
              ? "Open authorized portal"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Continue securely"}{" "}
            <span>→</span>
          </button>
        </form>
        {mode === "signin" && (
          <button
            className="ess-modal-switch"
            onClick={() => setMode("forgot")}
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordVisibilityButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="ess-password-visibility"
      style={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center" }}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {!visible && <path d="m3 3 18 18" />}
      </svg>
    </button>
  );
}

function PasswordRuleChecklist({ password }: { password: string }) {
  const check = checkPassword(password);
  const itemStyle = (met: boolean) => ({ color: met ? "#34d399" : "inherit" });
  return (
    <div className="ess-password-rules" aria-live="polite">
      <p>{PASSWORD_HELPER}</p>
      <ul>
        <li style={itemStyle(check.length)}>At least 8 characters</li>
        <li style={itemStyle(check.symbol)}>Includes a special character</li>
      </ul>
      <small>A longer passphrase is even stronger.</small>
    </div>
  );
}
