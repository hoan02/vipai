"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

/** A `t` narrowed to what this file hands around; see `lib/faq.ts`. */
type WalletTranslate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The plan's length, in words.
 *
 * The gateway reports a machine unit ("day", "month", "year", "custom"), so the
 * wording — and the plural — comes from the catalogue rather than being
 * concatenated here, which is what made it English-only before.
 */
function durationLabel(plan: SubscriptionPlan, t: WalletTranslate): string {
  if (plan.durationUnit === "custom") {
    const days = Math.round(plan.customSeconds / 86_400);
    return days > 0 ? t("durationDays", { days }) : t("durationCustom");
  }
  const value = plan.durationValue;
  if (plan.durationUnit === "day") return t("durationDays", { days: value });
  if (plan.durationUnit === "month") return t("durationMonths", { value });
  if (plan.durationUnit === "year") return t("durationYears", { value });
  // An unknown unit is shown as reported rather than hidden.
  return `${value} ${plan.durationUnit}`;
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
  const t = useTranslations("wallet");
  const [notified, setNotified] = useState(false);
  return (
    <div className="bal">
      <div className="bal-row">
        <span className="bal-amt">{usd(balance)}</span>
        <button className="btn btn-primary btn-sm" type="button" data-topup>
          {t("topUp")}
        </button>
      </div>
      <p className="bal-note">{t("balanceNote")}</p>
      <button
        className="bal-alert"
        type="button"
        onClick={() => {
          setNotified(true);
          window.setTimeout(() => setNotified(false), 1800);
        }}
      >
        <Bell size={15} /> {notified ? t("alertsUnavailable") : t("setAlert")}
      </button>
    </div>
  );
}

/* ---------- Recharge ---------- */

function RechargePanel({ info, balance }: { info: WalletInfo; balance: number }) {
  const t = useTranslations("wallet");
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
      toast.error(t("errChooseMethod"));
      return;
    }
    if (!Number.isFinite(effective) || effective < info.minTopup) {
      toast.error(t("errMinTopup", { amount: usd(info.minTopup) }));
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
        toast.error(payload?.message || t("errStartPayment"));
        return;
      }
      if (payload.params && Object.keys(payload.params).length > 0) {
        // The gateway expects a form POST; a bare URL cannot replay it, so no QR.
        submitPaymentForm(payload.url, payload.params);
      } else {
        window.open(payload.url, "_blank", "noopener");
        setPayUrl(payload.url);
      }
      toast.success(t("paymentOpened"));
      router.refresh();
    } catch {
      toast.error(t("errServer"));
    } finally {
      setBusy(false);
    }
  };

  if (!info.enableOnlineTopup || info.payMethods.length === 0) {
    return <p className="note">{t("onlineTopupOff")}</p>;
  }

  return (
    <>
      <p className="note" style={{ marginBottom: 12 }}>
        {t("currentBalance", { balance: usd(balance), minimum: usd(info.minTopup) })}
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
          placeholder={t("otherAmount")}
          aria-label={t("customAmount")}
          inputMode="decimal"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Select
          label={t("paymentMethod")}
          value={method}
          onChange={setMethod}
          options={info.payMethods.map((m) => ({ value: m.type, label: m.name }))}
        />
        <button className="btn btn-primary btn-sm" type="button" onClick={pay} disabled={busy}>
          {busy ? t("starting") : t("pay", { amount: usd(Number.isFinite(effective) ? effective : 0) })}
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
            {t("scanToFinish")}
          </p>
        </div>
      ) : null}
    </>
  );
}

/* ---------- Redeem ---------- */

function RedeemPanel({ enabled }: { enabled: boolean }) {
  const t = useTranslations("wallet");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const redeem = async () => {
    const key = code.trim();
    if (!key) {
      toast.error(t("errEnterCode"));
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
        toast.error(payload?.message || t("errRedeem"));
        return;
      }
      toast.success(t("codeRedeemed", { amount: usd(payload?.creditedUsd ?? 0) }));
      setCode("");
      router.refresh();
    } catch {
      toast.error(t("errServer"));
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return <p className="note">{t("redeemOff")}</p>;
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          id="redeemCode"
          className="field"
          style={{ flex: "1 1 260px", fontFamily: "var(--font-mono)" }}
          placeholder={t("codePlaceholder")}
          aria-label={t("creditCode")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void redeem();
          }}
        />
        <button className="btn btn-primary btn-sm" type="button" onClick={redeem} disabled={busy}>
          {busy ? t("redeeming") : t("redeem")}
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
  const t = useTranslations("wallet");
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
        toast.error(payload?.message || t("errBuyPlan"));
        return;
      }
      toast.success(t("planActive", { plan: plan.title }));
      router.refresh();
    } catch {
      toast.error(t("errServer"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {subscription.active.length > 0 ? (
        <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
          <b style={{ fontSize: 14.5 }}>{t("activeSubs")}</b>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {subscription.active.map((sub) => {
              const plan = plans.find((p) => p.id === sub.planId);
              return (
                <li
                  key={sub.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
                >
                  <span>
                    <b>{plan?.title ?? t("planFallback", { id: sub.planId })}</b>{" "}
                    <Pill tone={sub.status === "active" ? "ok" : "off"}>{sub.status}</Pill>
                  </span>
                  <span className="note">
                    {t("usedUntil", {
                      used: sub.amountUsed.toLocaleString(),
                      total: sub.amountTotal.toLocaleString(),
                      date: formatDate(sub.endTime * 1000, locale),
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <p className="note">{t("noPlans")}</p>
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
              <span className="note">{t("duration", { duration: durationLabel(plan, t) })}</span>
              <span className="note">
                {plan.totalAmount > 0
                  ? t("quotaIncluded", { amount: plan.totalAmount.toLocaleString() })
                  : t("unlimitedQuota")}
                {plan.quotaResetPeriod !== "never" ? t("resets", { period: plan.quotaResetPeriod }) : ""}
              </span>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                style={{ marginTop: "auto", alignSelf: "flex-start" }}
                disabled={!plan.allowBalancePay || busyId === plan.id}
                title={plan.allowBalancePay ? undefined : t("payFromPage")}
                onClick={() => buy(plan)}
              >
                {busyId === plan.id
                  ? t("buying")
                  : plan.allowBalancePay
                    ? t("buyWithBalance")
                    : t("payOnline")}
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
  const t = useTranslations("wallet");
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
        toast.error(payload?.message || t("errTransfer"));
        return;
      }
      toast.success(t("earningsMoved"));
      router.refresh();
    } catch {
      toast.error(t("errServer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="stats" style={{ marginBottom: 14 }}>
        <Stat label={t("statReferrals")} value={affiliate.count.toLocaleString()} />
        <Stat label={t("statEarned")} value={usd(affiliate.earnedUsd)} hint={t("unclaimed")} />
        <Stat label={t("statCode")} value={affiliate.code || "—"} />
      </div>

      {affiliate.code ? (
        <>
          <div className="conn-url" style={{ marginBottom: 12 }}>
            <code>{link}</code>
            <button
              className={`conn-copy${copied ? " copied" : ""}`}
              type="button"
              aria-label={t("copyReferral")}
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
            {busy ? t("transferring") : t("transferToBalance")}
          </button>
        </>
      ) : (
        <p className="note">{t("noReferralCode")}</p>
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
  const t = useTranslations("wallet");
  const td = useTranslations("dash");

  const columns: Column<WalletTopUp>[] = [
    {
      id: "createdAt",
      header: t("colDate"),
      accessorFn: (r) => r.createdAt,
      cell: (info) => formatDateTime(info.getValue(), locale),
    },
    {
      id: "amountUsd",
      header: t("colCredited"),
      meta: { align: "right" },
      accessorFn: (r) => r.amountUsd,
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    },
    {
      id: "paidUsd",
      header: t("colPaid"),
      meta: { align: "right" },
      accessorFn: (r) => r.paidUsd,
      cell: (info) => <span className="num">{usd(info.getValue())}</span>,
    },
    {
      id: "paymentMethod",
      header: t("colMethod"),
      accessorFn: (r) => r.paymentMethod || t("methodCode"),
      cell: (info) => info.getValue() || t("methodCode"),
    },
    {
      id: "status",
      header: td("status"),
      accessorFn: (r) => r.status,
      cell: (info) => (
        <Pill tone={info.getValue() === "success" ? "ok" : "off"}>
          {info.getValue() || t("statusPending")}
        </Pill>
      ),
    },
    {
      id: "tradeNo",
      header: t("colReference"),
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
      <PageHead title={t("title")} sub={t("sub")} />

      <div className="stack-16" style={{ marginTop: 20 }}>
        <BalanceCard balance={balanceUsd} />

        <div className="stats">
          <Stat label={t("statBalance")} value={usd(balanceUsd)} hint={t("statBalanceHint")} />
          <Stat label={t("statSpent")} value={usd(usedUsd)} hint={t("statSpentHint")} />
          <Stat label={t("statRequests")} value={requestCount.toLocaleString()} />
        </div>
      </div>

      <SectionTitle hint={t("addCreditHint")}>{t("addCredit")}</SectionTitle>
      <div className="panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
        <RechargePanel info={info} balance={balanceUsd} />
        <div style={{ borderTop: "1px dashed var(--d-dash)", paddingTop: 16 }}>
          <b style={{ fontSize: 14.5, display: "block", marginBottom: 10 }}>{t("redeemTitle")}</b>
          <RedeemPanel enabled={info.enableRedemption} />
        </div>
      </div>

      <SectionTitle hint={t("planCount", { count: plans.length })}>{t("subscriptions")}</SectionTitle>
      <SubscriptionPanel plans={plans} subscription={subscription} />

      <SectionTitle hint={t("referralsHint")}>{t("referrals")}</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        <AffiliatePanel affiliate={affiliate} />
      </div>

      <SectionTitle hint={t("topupCount", { count: topups.length })}>{t("purchaseHistory")}</SectionTitle>
      <div className="panel" style={{ padding: 16 }}>
        <DataTable
          columns={columns}
          rows={topups}
          rowKey={(r) => String(r.id)}
          searchable={false}
          pageSize={10}
          fixedHeight
          empty={t("emptyPurchases")}
        />
      </div>
    </>
  );
}
