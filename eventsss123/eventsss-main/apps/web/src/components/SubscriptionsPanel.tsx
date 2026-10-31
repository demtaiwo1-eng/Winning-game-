import { useEffect, useState } from "react";
import { billingApi, type ApiPlan } from "../lib/api";
import { formatMoney, type CurrencyCode } from "../lib/i18n";

export default function SubscriptionsPanel({ audience = "CLIENT" }: { audience?: string }) {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [subs, setSubs] = useState<Array<{ id: string; status: string; plan?: ApiPlan; currentPeriodEnd?: string }>>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([billingApi.plans(audience), billingApi.mySubscriptions()])
      .then(([p, s]) => {
        setPlans(p.items || []);
        setSubs((s.items as typeof subs) || []);
      })
      .catch((e: Error) => setMsg(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [audience]);

  const subscribe = async (planId: string) => {
    setMsg("");
    try {
      await billingApi.subscribe(planId);
      setMsg("Subscription activated.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Subscribe failed");
    }
  };

  const cancel = async (id: string) => {
    try {
      await billingApi.cancel(id);
      setMsg("Subscription cancelled.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  return (
    <section className="ess-panel">
      <p className="ess-eyebrow">Growth · Phase 5</p>
      <h2>Subscriptions & plans</h2>
      <p className="ess-muted">
        Plans from /api/v1/billing/plans · subscribe via /billing/subscriptions
      </p>

      {msg && (
        <div className="ess-form-error" style={{ marginTop: 12, background: "#052e16", borderColor: "#166534", color: "#86efac" }}>
          {msg}
        </div>
      )}

      {loading ? (
        <p className="ess-muted">Loading plans…</p>
      ) : (
        <>
          <div className="ess-listing-grid" style={{ marginTop: 16 }}>
            {plans.map((p) => (
              <article key={p.id} className="ess-listing-card">
                <div className="ess-listing-body">
                  <span className="ess-tag">{p.interval}</span>
                  <h3>{p.name}</h3>
                  <p className="ess-listing-vendor">{p.code}</p>
                  <div className="ess-listing-footer">
                    <strong>
                      {formatMoney(p.priceMinor, (p.currency as CurrencyCode) || "NGN")}
                    </strong>
                    {p.priceMinor === "0" ? (
                      <button className="ess-primary" type="button" onClick={() => subscribe(p.id)}>
                        Activate free plan
                      </button>
                    ) : (
                      <div>
                        <button className="ess-outline-button" type="button" disabled aria-disabled="true">
                          Coming soon
                        </button>
                        <p className="ess-muted" style={{ fontSize: 12, marginTop: 6 }}>
                          Paid checkout is not enabled yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <h3 style={{ marginTop: 28 }}>Your subscriptions</h3>
          {subs.length === 0 ? (
            <p className="ess-muted">No active subscriptions.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
              {subs.map((s) => (
                <li key={s.id} className="ess-wallet-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{s.plan?.name || s.id}</strong>
                    <div className="ess-muted" style={{ fontSize: 13 }}>
                      {s.status}
                      {s.currentPeriodEnd ? ` · until ${new Date(s.currentPeriodEnd).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  {s.status === "ACTIVE" && (
                    <button className="ess-outline-button" type="button" onClick={() => cancel(s.id)}>
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
