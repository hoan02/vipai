"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Bell, Check, Copy, Gift } from "lucide-react";
import { PageHead, Pill, SectionTitle, Stat } from "@/components/dashboard/kit";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/components/site/I18n";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { usd } from "@/lib/money";
import type { SubscriptionPlan, SubscriptionSelf } from "@/server/gateway";

export type WalletTopUp = {
  id: number;
  amountUsd: number;
  paidUsd: number;
  tradeNo: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  completedAt: string | null;
};

export type WalletInfo = {
  minTopup: number;
  amountOptions: number[];
  enableRedemption: boolean;
  enableOnlineTopup: boolean;
  payMethods: Array<{ name: string; type: string; icon: string }>;
};

export type WalletAffiliate = {
  code: string;
  count: number;
  earnedUsd: number;
  /** Unclaimed referral earnings, in quota units, for the transfer call. */
  quota: number;
};

function durationLabel(plan: SubscriptionPlan): string {
  if (plan.durationUnit === "custom") {
    const days = Math.round(plan.customSeconds / 86_400);
    return days > 0 ? `${days} days` : "custom";
  }
  const unit = plan.durationUnit;
  const value = plan.durationValue;
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  document.body.removeChild(area);
}

/** POSTs the order to the gateway, matching how epay expects to be reached. */
function submitPaymentForm(url: string, params: Record<string, unknown>) {
  const form = document.createElement("form");
  form.action = url;
  form.method = "POST";
  form.target = "_blank";
  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

/* ---------- Balance card (moved here from the retired Billing page) ---------- */

function BalanceCard({ balance }: { balance: number }) {
  const [notified, setNotified] = useState(false);
  return (
    <div className="bal">
      <div className="bal-row">
        <span className="bal-amt">{usd(balance)}</span>
        <button className="btn btn-primary btn-sm" type="button" data-topup>
          Top up
        </button>
      </div>
      <p className="bal-note">
        Credits are added at face value in USD. Model discounts are applied automatically when
        credits are used.
      </p>
      <button
        className="bal-alert"
        type="button"
        onClick={() => {
          setNotified(true);
          window.setTimeout(() => setNotified(false), 1800);
        }}
      >
        <Bell size={15} /> {notified ? "Balance alerts are not available yet" : "Set balance alert"}
      </button>
    </div>
  );
}

/* ---------- Recharge ---------- */

function RechargePanel({ info, balance }: { info: WalletInfo; balance: number }) {
  const router = useRouter();
  const options = info.amountOptions.length > 0 ? info.amountOptions : [10, 20, 50, 100];
  const [amount, setAmount] = useState(options[0]);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState(info.payMethods[0]?.type ?? "");
  const [busy, setBusy] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  const effective = custom.trim() ? Number(custom) : amount;

  const pay = async () => {
    if (!method) {
      toast.error("Choose a payment method.");
      return;
    }
    if (!Number.isFinite(effective) || effective < info.minTopup) {
      toast.error(`The minimum top-up is ${usd(info.minTopup)}.`);
      return;
    }
    setBusy(true);
    setPayUrl(null);
    try {
      const response = await fetch("/api/wallet/recharge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Math.floor(effective), paymentMethod: method }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; params?: Record<string, unknown>; message?: string }
        | null;
      if (!response.ok || !payload?.url) {
        toast.error(payload?.message || "Could not start the payment.");
        return;
      }
      if (payload.params && Object.keys(payload.params).length > 0) {
        // The gateway expects a form POST; a bare URL cannot replay it, so no QR.
        submitPaymentForm(payload.url, payload.params);
      } else {
        window.open(payload.url, "_blank", "noopener");
        setPayUrl(payload.url);
      }
      toast.success("Payment opened in a new tab. Your balance updates once it completes.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (!info.enableOnlineTopup || info.payMethods.length === 0) {
    return (
      <p className="note">
        Online top-up is not configured on this instance. Use a credit code below, or ask support.
      </p>
    );
  }

  return (
    <>
      <p className="note" style={{ marginBottom: 12 }}>
        Current balance {usd(balance)} · minimum {usd(info.minTopup)}.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip${!custom && amount === option ? " is-on" : ""}`}
            aria-pressed={!custom && amount === option}
            onClick={() => {
              setAmount(option);
              setCustom("");
            }}
          >
            {usd(option)}
          </button>
        ))}
        <input
          className="field"
          style={{ width: 130 }}
          placeholder="Other amount"
          aria-label="Custom amount"
          inputMode="decimal"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Select
          label="Payment method"
          value={method}
          onChange={setMethod}
          options={info.payMethods.map((m) => ({ value: m.type, label: m.name }))}
        />
        <button className="btn btn-primary btn-sm" type="button" onClick={pay} disabled={busy}>
          {busy ? "Starting…" : `Pay ${usd(Number.isFinite(effective) ? effective : 0)}`}
        </button>
      </div>
      {payUrl ? (
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          <span style={{ border: "1px solid var(--d-line)", padding: 8, background: "var(--surface)", lineHeight: 0 }}>
            <QRCodeSVG
              value={payUrl}
              size={132}
              level="M"
              bgColor="#ffffff"
              fgColor="#14110f"
              marginSize={1}
            />
          </span>
          <p className="note" style={{ maxWidth: 240 }}>
            Or scan with your phone to finish the payment there.
          </p>
        </div>
      ) : null}
    </>
  );
}

/* ---------- Redeem ---------- */

function RedeemPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const redeem = async () => {
    const key = code.trim();
    if (!key) {
      toast.error("Enter a credit code.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { creditedUsd?: number; message?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.message || "That code could not be redeemed.");
        return;
      }
      toast.success(`Code redeemed — ${usd(payload?.creditedUsd ?? 0)} added.`);
      setCode("");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return (
      <p className="note">
        Credit codes are disabled on this instance. Ask on Telegram for a top-up.
      </p>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          id="redeemCode"
          className="field"
          style={{ flex: "1 1 260px", fontFamily: "var(--font-mono)" }}
          placeholder="Paste the code from your purchase"
          aria-label="Credit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void redeem();
          }}
        />
        <button className="btn btn-primary btn-sm" type="button" onClick={redeem} disabled={busy}>
          {busy ? "Redeeming…" : "Redeem"}
        </button>
      </div>
    </>
  );
}

/* ---------- Subscriptions ---------- */

function SubscriptionPanel({
  plans,
  subscription,
}: {
  plans: SubscriptionPlan[];
  subscription: SubscriptionSelf;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [busyId, setBusyId] = useState<number | null>(null);

  const buy = async (plan: SubscriptionPlan) => {
    setBusyId(plan.id);
    try {
      const response = await fetch("/api/wallet/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not buy the plan.");
        return;
      }
      toast.success(`${plan.title} is now active.`);
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {subscription.active.length > 0 ? (
        <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
          <b style={{ fontSize: 14.5 }}>Active subscriptions</b>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {subscription.active.map((sub) => {
              const plan = plans.find((p) => p.id === sub.planId);
              return (
                <li
                  key={sub.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
                >
                  <span>
                    <b>{plan?.title ?? `Plan #${sub.planId}`}</b>{" "}
                    <Pill tone={sub.status === "active" ? "ok" : "off"}>{sub.status}</Pill>
                  </span>
                  <span className="note">
                    {sub.amountUsed.toLocaleString()} / {sub.amountTotal.toLocaleString()} used · until{" "}
                    {formatDate(sub.endTime * 1000, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <p className="note">No subscription plans are available on this instance.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {plans.map((plan) => (
            <div key={plan.id} className="panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <b style={{ fontSize: 15 }}>{plan.title}</b>
                <span className="num" style={{ fontWeight: 600 }}>
                  {plan.currency} {plan.priceAmount.toFixed(2)}
                </span>
              </div>
              {plan.subtitle ? <span className="note">{plan.subtitle}</span> : null}
              <span className="note">Duration: {durationLabel(plan)}</span>
              <span className="note">
                {plan.totalAmount > 0 ? `${plan.totalAmount.toLocaleString()} quota included` : "Unlimited quota"}
                {plan.quotaResetPeriod !== "never" ? ` · resets ${plan.quotaResetPeriod}` : ""}
              </span>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                style={{ marginTop: "auto", alignSelf: "flex-start" }}
                disabled={!plan.allowBalancePay || busyId === plan.id}
                title={plan.allowBalancePay ? undefined : "Pay this plan from the payment page"}
                onClick={() => buy(plan)}
              >
                {busyId === plan.id ? "Buying…" : plan.allowBalancePay ? "Buy with balance" : "Pay online"}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Affiliate ---------- */

function AffiliatePanel({ affiliate }: { affiliate: WalletAffiliate }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = affiliate.code ? `${origin}/?aff=${affiliate.code}` : "";

  const transfer = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/wallet/affiliate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quota: affiliate.quota }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(payload?.message || "Could not transfer the earnings.");
        return;
      }
      toast.success("Earnings moved to your balance.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="stats" style={{ marginBottom: 14 }}>
        <Stat label="Referrals" value={affiliate.count.toLocaleString()} />
        <Stat label="Earned" value={usd(affiliate.earnedUsd)} hint="unclaimed" />
        <Stat label="Code" value={affiliate.code || "—"} />
      </div>

      {affiliate.code ? (
        <>
          <div className="conn-url" style={{ marginBottom: 12 }}>
            <code>{link}</code>
            <button
              className={`conn-copy${copied ? " copied" : ""}`}
              type="button"
              aria-label="Copy referral link"
              onClick={() => {
                copyText(link);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy || affiliate.quota <= 0}
            onClick={transfer}
          >
            <Gift size={14} aria-hidden="true" />
            {busy ? "Transferring…" : "Transfer to balance"}
          </button>
        </>
      ) : (
        <p className="note">Your referral code is not available yet.</p>
      )}
    </>
  );
}

/* ---------- Page ---------- */

export function WalletView({
  balanceUsd,
  usedUsd,
  requestCount,
  info,
  topups,
  plans = [],
  subscription,
  affiliate,
}: {
  balanceUsd: number;
  usedUsd: number;
  requestCount: number;
  info: WalletInfo;
  topups: WalletTopUp[];
  plans?: SubscriptionPlan[];
  subscription: SubscriptionSelf;
  affiliate: WalletAffiliate;
}) {
  const locale = useLocale();

  const columns: Column<WalletTopUp>[] = [
    {
      id: "createdAt",
      header: "Date",
      accessorFn: (r) => r.createdAt,
      cell: (info) => formatDateTime(info.getValue(), locale),
    },
    {
      id: "amountUsd",
      header: "Credited",
      meta: { align: "right" },
      accessorFn: (r) => r.amountUsd,
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    },
    {
      id: "paidUsd",
      header: "Paid",
      meta: { align: "right" },
      accessorFn: (r) => r.paidUsd,
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    },
    {
      id: "paymentMethod",
      header: "Method",
      accessorFn: (r) => r.paymentMethod || "code",
      cell: (info) => info.getValue() || "code",
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.status,
      cell: (info) => (
        <Pill tone={info.getValue() === "success" ? "ok" : "off"}>
          {info.getValue() || "pending"}
        </Pill>
      ),
    },
    {
      id: "tradeNo",
      header: "Reference",
      accessorFn: (r) => r.tradeNo,
      cell: (info) =>
        info.getValue() ? (
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{info.getValue()}</code>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <>
      <PageHead
        title="Wallet"
        sub="Balance, top-ups, subscriptions and referrals — the money side of your account."
      />

      <div className="stack-16" style={{ marginTop: 20 }}>
        <BalanceCard balance={balanceUsd} />

        <div className="stats">
          <Stat label="Balance" value={usd(balanceUsd)} hint="unspent credit" />
          <Stat label="Spent" value={usd(usedUsd)} hint="lifetime, at list price" />
          <Stat label="Requests" value={requestCount.toLocaleString()} />
        </div>
      </div>

      <SectionTitle hint="Credits never expire">Add credit</SectionTitle>
      <div className="panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
        <RechargePanel info={info} balance={balanceUsd} />
        <div style={{ borderTop: "1px dashed var(--d-dash)", paddingTop: 16 }}>
          <b style={{ fontSize: 14.5, display: "block", marginBottom: 10 }}>Redeem a credit code</b>
          <RedeemPanel enabled={info.enableRedemption} />
        </div>
      </div>

      <SectionTitle hint={`${plans.length} plan${plans.length === 1 ? "" : "s"}`}>
        Subscriptions
      </SectionTitle>
      <SubscriptionPanel plans={plans} subscription={subscription} />

      <SectionTitle hint="Share your link, earn credit">Referrals</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <AffiliatePanel affiliate={affiliate} />
      </div>

      <SectionTitle hint={`${topups.length} entr${topups.length === 1 ? "y" : "ies"}`}>
        Purchase history
      </SectionTitle>
      <div className="panel" style={{ padding: 16 }}>
        <DataTable
          columns={columns}
          rows={topups}
          rowKey={(r) => String(r.id)}
          searchable={false}
          pageSize={10}
          fixedHeight
          empty="No purchases yet. Credits redeemed with a code appear here."
        />
      </div>
    </>
  );
}
