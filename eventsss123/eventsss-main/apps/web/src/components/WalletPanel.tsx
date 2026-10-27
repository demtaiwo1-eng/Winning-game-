import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatMoney, type CurrencyCode, type LocaleCode, t } from "../lib/i18n";
import { walletApi, paymentsApi, type ApiWallet } from "../lib/api";

type WalletBalance = {
  id?: string;
  currency: CurrencyCode;
  availableMinor: string;
  escrowMinor: string;
  pendingMinor: string;
};

export default function WalletPanel({
  locale = "en",
  role = "CLIENT",
}: {
  locale?: LocaleCode;
  role?: string;
}) {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletError, setWalletError] = useState("");
  const [msg, setMsg] = useState("");
  const [depositAmount, setDepositAmount] = useState("50000");
  const [depositCurrency, setDepositCurrency] = useState<CurrencyCode>("NGN");
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(() => {
    setLoading(true);
    walletApi
      .list()
      .then((res) => {
        setBalances(
          res.items.map((w: ApiWallet) => ({
            id: w.id,
            currency: w.currency as CurrencyCode,
            availableMinor: w.availableMinor,
            escrowMinor: w.escrowMinor,
            pendingMinor: w.pendingMinor || "0",
          })),
        );
        setWalletError("");
      })
      .catch((error: unknown) => {
        setBalances([]);
        setWalletError(error instanceof Error ? error.message : "Unable to load wallet balances.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("payment") !== "return") return;
    setMsg("Payment returned to ESS. Your wallet updates after the provider confirms the transaction.");
    load();
    const next = new URLSearchParams(searchParams);
    next.delete("payment");
    setSearchParams(next, { replace: true });
  }, [load, searchParams, setSearchParams]);

  const addFunds = async () => {
    setMsg("");
    const major = Number(depositAmount);
    if (!Number.isFinite(major) || major <= 0) {
      setMsg("Enter a valid amount in major units.");
      return;
    }
    const amountMinor = String(Math.round(major * 100));
    try {
      const { intent, checkoutUrl, mode } = await paymentsApi.createIntent({
        currency: depositCurrency,
        amountMinor,
        purpose: "WALLET_DEPOSIT",
      });
      if (mode === "live") {
        const providerUrl = new URL(checkoutUrl);
        if (providerUrl.protocol !== "https:") {
          throw new Error("Payment provider returned an insecure checkout URL.");
        }
        setMsg(`Redirecting to ${intent.provider} secure checkout…`);
        window.location.assign(providerUrl.toString());
        return;
      }
      if (mode !== "demo") {
        throw new Error("Payment intent returned an unsupported checkout mode.");
      }
      await paymentsApi.demoCheckout(intent.id);
      setMsg(`Test deposit of ${depositAmount} ${depositCurrency} succeeded via simulated checkout.`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Deposit failed");
    }
  };

  const totalEscrow = balances.reduce((s, b) => s + Number(b.escrowMinor), 0);

  return (
    <section className="ess-panel ess-wallet-panel">
      <div className="ess-wallet-badge" style={{ marginBottom: 12 }}>
        Wallet deposits use the configured payment provider. Simulated deposits are available only in non-production test mode.
      </div>
      <div className="ess-wallet-head">
        <div>
          <p className="ess-eyebrow">{t(locale, "wallet.title")}</p>
          <h2>
            {role === "VENDOR"
              ? "Earnings & wallet"
              : "Funds & protection"}
          </h2>
          <p className="ess-muted">
            Wallet balances are loaded from ESS · append-only ledger · minor-unit precision.
          </p>
        </div>
        {totalEscrow > 0 && (
          <div className="ess-wallet-badge">
            <span>Protected in escrow</span>
            <strong>
              {formatMoney(String(totalEscrow), balances[0]?.currency ?? "NGN", locale)}
            </strong>
          </div>
        )}
      </div>

      {msg && (
        <div
          className="ess-form-error"
          style={{
            background: "#052e16",
            borderColor: "#166534",
            color: "#86efac",
            marginBottom: 12,
          }}
        >
          {msg}
        </div>
      )}

      {loading ? (
        <p className="ess-muted">Loading wallets…</p>
      ) : walletError ? (
        <p className="ess-form-error" role="alert">
          Wallet balances could not be loaded: {walletError}
        </p>
      ) : balances.length === 0 ? (
        <p className="ess-muted">No wallet balances are available yet.</p>
      ) : (
        <div className="ess-wallet-grid">
          {balances.map((b) => (
            <article key={b.currency + (b.id || "")} className="ess-wallet-card">
              <header>
                <strong>{b.currency}</strong>
              </header>
              <div className="ess-wallet-rows">
                <div>
                  <span>{t(locale, "wallet.available")}</span>
                  <strong>{formatMoney(b.availableMinor, b.currency, locale)}</strong>
                </div>
                <div>
                  <span>{t(locale, "wallet.held")}</span>
                  <strong className="ess-wallet-escrow">
                    {formatMoney(b.escrowMinor, b.currency, locale)}
                  </strong>
                </div>
                <div>
                  <span>{t(locale, "wallet.pending")}</span>
                  <strong>{formatMoney(b.pendingMinor, b.currency, locale)}</strong>
                </div>
              </div>
              <div className="ess-wallet-actions">
                {b.id && (
                  <button
                    className="ess-quiet-button"
                    type="button"
                    onClick={() =>
                      walletApi.ledger(b.id!).then(() => setMsg(`Ledger loaded for ${b.currency}`))
                    }
                  >
                    View ledger
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="ess-wallet-card" style={{ marginTop: 16 }}>
        <strong>Add funds</strong>
        <p className="ess-muted" style={{ margin: "6px 0 12px" }}>
          Use the configured payment provider. Simulated deposits are restricted to non-production test mode.
        </p>
        <div className="ess-form-grid">
          <label>
            Amount (major units)
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>
            Currency
            <select
              value={depositCurrency}
              onChange={(e) => setDepositCurrency(e.target.value as CurrencyCode)}
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="GHS">GHS</option>
              <option value="KES">KES</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="ess-primary" type="button" onClick={addFunds}>
            Deposit to wallet
          </button>
        </div>
      </div>

      {(role === "VENDOR") && (
        <div className="ess-wallet-card" style={{ marginTop: 16 }}>
          <strong>Receive payments</strong>
          <p className="ess-muted" style={{ margin: "6px 0 12px" }}>
            The payer's funds stay protected in platform-controlled escrow until the event ends, every service check is green, and the event's assigned lead verifier authorizes release. Released funds are added to your wallet. External bank and mobile-money withdrawals are not yet enabled.
          </p>
        </div>
      )}

      <div className="ess-escrow-explainer">
        <div>
          <strong>How escrow works</strong>
          <p>
            When a booking is paid, funds move into platform-controlled escrow. The payer and payee are protected: only the event's assigned lead verifier can authorize release after the event ends and all service checks are green. Every movement is append-only and auditable via the ledger.
          </p>
        </div>
        <ul>
          <li>Hold on payment success</li>
          <li>Release after verifier-confirmed event completion</li>
          <li>Refund on approved dispute</li>
          <li>Commission taken at release</li>
        </ul>
      </div>
    </section>
  );
}
