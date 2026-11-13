import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatMoney, type CurrencyCode, type LocaleCode, t } from "../lib/i18n";
import { walletApi, paymentsApi, type ApiWallet, type ApiPayout, type ApiLedgerEntry } from "../lib/api";

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
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payouts, setPayouts] = useState<ApiPayout[]>([]);
  const [payoutError, setPayoutError] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<ApiLedgerEntry[]>([]);
  const [ledgerCurrency, setLedgerCurrency] = useState<CurrencyCode>("NGN");
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
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

  const loadPayouts = useCallback(async () => {
    const [bankResult, payoutResult] = await Promise.allSettled([
      paymentsApi.payoutBanks(),
      paymentsApi.payouts(),
    ]);
    if (bankResult.status === "fulfilled") {
      setBanks(bankResult.value.items);
      setBankCode((current) => current || bankResult.value.items[0]?.code || "");
      setPayoutError("");
    } else {
      setPayoutError(bankResult.reason instanceof Error ? bankResult.reason.message : "Bank withdrawals are not available yet.");
    }
    if (payoutResult.status === "fulfilled") setPayouts(payoutResult.value.items);
  }, []);

  useEffect(() => {
    if (role === "VENDOR") void loadPayouts();
  }, [loadPayouts, role]);

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
      if (mode === "live" || mode === "sandbox") {
        const providerUrl = new URL(checkoutUrl);
        if (providerUrl.protocol !== "https:") {
          throw new Error("Payment provider returned an insecure checkout URL.");
        }
        setMsg(`Redirecting to ${intent.provider === "opay" ? "OPay" : intent.provider} secure checkout…`);
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

  const resolveBankAccount = async () => {
    setMsg("");
    setAccountName("");
    setAccountConfirmed(false);
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
      setMsg("Enter a valid 10-digit account number and choose a bank.");
      return;
    }
    setPayoutLoading(true);
    try {
      const result = await paymentsApi.resolvePayoutAccount(accountNumber, bankCode);
      setAccountName(result.accountName);
      setMsg("Bank account verified. Confirm the account name before continuing.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Unable to verify this bank account.");
    } finally {
      setPayoutLoading(false);
    }
  };

  const submitWithdrawal = async () => {
    setMsg("");
    const major = Number(withdrawAmount);
    if (!Number.isFinite(major) || major <= 0 || !Number.isSafeInteger(Math.round(major * 100))) {
      setMsg("Enter a valid withdrawal amount.");
      return;
    }
    if (!accountName || !accountConfirmed) {
      setMsg("Verify and confirm the bank account name first.");
      return;
    }
    setPayoutLoading(true);
    try {
      const amountMinor = String(Math.round(major * 100));
      const idempotencyKey = "web_payout_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      const result = await paymentsApi.createPayout({
        amountMinor, accountNumber, bankCode, confirmAccountName: true,
      }, idempotencyKey);
      setMsg("Withdrawal " + result.payout.status.toLowerCase() + ": " + formatMoney(result.payout.netAmountMinor, "NGN", locale) + " is being sent to " + result.payout.accountName + ".");
      setWithdrawAmount("");
      setAccountNumber("");
      setAccountName("");
      setAccountConfirmed(false);
      await Promise.all([load(), loadPayouts()]);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Withdrawal could not be submitted.");
    } finally {
      setPayoutLoading(false);
    }
  };

  const refreshPayout = async (id: string) => {
    try {
      const result = await paymentsApi.payout(id);
      setPayouts((current) => current.map((item) => item.id === id ? result.payout : item));
      setMsg("Withdrawal status: " + result.payout.status.toLowerCase() + ".");
      if (["SUCCEEDED", "FAILED", "REVERSED"].includes(result.payout.status)) load();
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : "Unable to refresh payout status.");
    }
  };

  const totalEscrow = balances.reduce((s, b) => s + Number(b.escrowMinor), 0);

  return (
    <section className="ess-panel ess-wallet-panel">
      <div className="ess-wallet-badge" style={{ marginBottom: 12 }}>
        OPay is EPHINTA's Nigerian payment provider. NGN deposits and Nigerian bank withdrawals use OPay; payments are credited only after provider confirmation.
      </div>
      <div className="ess-wallet-head">
        <div>
          <p className="ess-eyebrow">{t(locale, "wallet.title")}</p>
          <h2>
            {["VENDOR", "VERIFIER", "AFFILIATE", "CONSULTANT"].includes(role)
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
                    onClick={async () => {
                      try {
                        const result = await walletApi.ledger(b.id!);
                        setLedgerEntries(result.items);
                        setLedgerCurrency(b.currency);
                        setLedgerLoaded(true);
                        setMsg(`Transaction history loaded for ${b.currency}`);
                      } catch (error) {
                        setMsg(error instanceof Error ? error.message : "Unable to load transaction history.");
                      }
                    }}
                  >
                    View ledger
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {ledgerLoaded && (
        <div className="ess-wallet-card" style={{ marginTop: 16 }}>
          <strong>Transaction history · {ledgerCurrency}</strong>
          {ledgerEntries.length === 0 ? (
            <p className="ess-muted">No wallet transactions yet.</p>
          ) : (
            <div className="ess-wallet-rows">
              {ledgerEntries.map((entry) => (
                <div key={entry.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--ess-border, #ddd)" }}>
                  <span>{entry.type.replace(/_/g, " ")} · {entry.provider === "opay" ? "OPay" : entry.provider === "internal" ? "EPHINTA wallet" : entry.provider}</span>
                  <strong>{formatMoney(entry.amountMinor, ledgerCurrency, locale)}</strong>
                  <small className="ess-muted">{entry.refType.replace(/_/g, " ")} · {new Date(entry.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ess-wallet-card" style={{ marginTop: 16 }}>
        <strong>Add funds</strong>
        <p className="ess-muted" style={{ margin: "6px 0 12px" }}>
          {depositCurrency === "NGN"
            ? "Pay securely with OPay. Your wallet is credited after OPay confirms the deposit."
            : "GHS deposits use the configured Ghana payment rail. Select NGN to use OPay."}
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
              <option value="GHS">GHS</option>
            </select>
          </label>
        </div>
        {depositCurrency === "NGN" && Number(depositAmount) > 0 && Number.isFinite(Number(depositAmount)) && (
          <p className="ess-muted" style={{ marginTop: 10 }}>
            OPay deposit · 2% platform fee: {formatMoney(String(Math.round(Number(depositAmount) * 2)), "NGN", locale)} ·
            Wallet credit after fee: {formatMoney(String(Math.max(0, Math.round(Number(depositAmount) * 98))), "NGN", locale)}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="ess-primary" type="button" onClick={addFunds}>
            Deposit to wallet with {depositCurrency === "NGN" ? "OPay" : "GHS provider"}
          </button>
        </div>
      </div>

      {role === "VENDOR" && (
        <>
          <div className="ess-wallet-card" style={{ marginTop: 16 }}>
            <strong>Receive payments</strong>
            <p className="ess-muted" style={{ margin: "6px 0 12px" }}>
              The payer's funds stay protected in platform-controlled escrow until the event ends, every service check is green, and the event's assigned lead verifier authorizes release. Released funds are added to your wallet.
            </p>
          </div>
          <div className="ess-wallet-card" style={{ marginTop: 16 }}>
            <strong>Withdraw to a Nigerian bank</strong>
            <p className="ess-muted" style={{ margin: "6px 0 12px" }}>
              Withdraw from your available NGN balance. A 2% platform fee is deducted from the gross amount; the remaining 98% is sent to your verified bank account. Funds are reserved until the transfer is confirmed.
            </p>
            {payoutError && <p className="ess-form-error" role="alert">{payoutError}</p>}
            <div className="ess-form-grid">
              <label>
                Withdrawal amount (NGN)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="e.g. 10000"
                />
              </label>
              <label>
                Destination bank
                <select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setAccountName(""); setAccountConfirmed(false); }}>
                  <option value="">Select a bank</option>
                  {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
                </select>
              </label>
              <label>
                Account number
                <input
                  value={accountNumber}
                  onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); setAccountName(""); setAccountConfirmed(false); }}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="10-digit account number"
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="ess-quiet-button" type="button" onClick={resolveBankAccount} disabled={payoutLoading || !bankCode || accountNumber.length !== 10}>
                {payoutLoading ? "Please wait…" : "Verify bank account"}
              </button>
            </div>
            {accountName && (
              <div style={{ marginTop: 12 }}>
                <p><strong>Verified account name:</strong> {accountName}</p>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={accountConfirmed} onChange={(e) => setAccountConfirmed(e.target.checked)} />
                  I confirm this is the correct bank account.
                </label>
              </div>
            )}
            {Number(withdrawAmount) > 0 && Number.isFinite(Number(withdrawAmount)) && (
              <p className="ess-muted" style={{ marginTop: 12 }}>
                Estimated fee: {formatMoney(String(Math.round(Number(withdrawAmount) * 2)), "NGN", locale)} ·
                Estimated bank transfer: {formatMoney(String(Math.max(0, Math.round(Number(withdrawAmount) * 98))), "NGN", locale)}
              </p>
            )}
            <button className="ess-primary" type="button" onClick={submitWithdrawal} disabled={payoutLoading || !accountConfirmed || !accountName || !withdrawAmount || !bankCode}>
              {payoutLoading ? "Submitting…" : "Withdraw to bank"}
            </button>
          </div>
          <div className="ess-wallet-card" style={{ marginTop: 16 }}>
            <strong>Withdrawal history</strong>
            {payouts.length === 0 ? (
              <p className="ess-muted">No bank withdrawals yet.</p>
            ) : (
              <div className="ess-wallet-rows">
                {payouts.map((payout) => (
                  <div key={payout.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--ess-border, #ddd)" }}>
                    <span>{payout.provider === "opay" ? "OPay" : payout.provider} bank transfer · {payout.accountName} · {payout.accountNumber} · {payout.status}</span>
                    <strong>{formatMoney(payout.netAmountMinor, "NGN", locale)} sent</strong>
                    <small className="ess-muted">Fee {formatMoney(payout.feeMinor, "NGN", locale)} · {new Date(payout.createdAt).toLocaleString()}</small>
                    {["PENDING", "PROCESSING"].includes(payout.status) && (
                      <button className="ess-quiet-button" type="button" onClick={() => refreshPayout(payout.id)}>Refresh status</button>
                    )}
                    {payout.failureReason && <small className="ess-form-error">{payout.failureReason}</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
