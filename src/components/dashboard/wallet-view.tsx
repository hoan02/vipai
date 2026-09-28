"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Wallet } from "lucide-react";
import { PageHead, Pill, SectionTitle, Stat } from "@/components/dashboard/kit";
import { DataTable, useColumnHelper, type Column } from "@/components/admin/data-table";
import { usd } from "@/lib/money";

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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function WalletView({
  balanceUsd,
  usedUsd,
  requestCount,
  info,
  topups,
}: {
  balanceUsd: number;
  usedUsd: number;
  requestCount: number;
  info: WalletInfo;
  topups: WalletTopUp[];
}) {
  const router = useRouter();
  const helper = useColumnHelper<WalletTopUp>();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const redeem = async () => {
    const key = code.trim();
    if (!key) {
      setError("Enter a credit code.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
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
        setError(payload?.message || "That code could not be redeemed.");
        return;
      }
      setNotice(`Code redeemed — ${usd(payload?.creditedUsd ?? 0)} added.`);
      setCode("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<WalletTopUp>[] = [
    {
      id: "createdAt",
      header: "Date",
      accessorFn: (r) => r.createdAt,
      cell: (info) => formatDate(info.getValue()),
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
        sub="Balance, credit codes, and how your account has been funded."
      />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label="Balance" value={usd(balanceUsd)} hint="unspent credit" />
        <Stat label="Spent" value={usd(usedUsd)} hint="lifetime, at list price" />
        <Stat label="Requests" value={requestCount.toLocaleString()} />
      </div>

      <SectionTitle hint="Credits never expire">Add credit</SectionTitle>
      <div className="panel" style={{ padding: 18 }}>
        {info.enableOnlineTopup && info.payMethods.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <b style={{ fontSize: 14.5 }}>Card and local payment</b>
            <p className="note" style={{ marginTop: 6 }}>
              Available amounts: {info.amountOptions.map((a) => usd(a)).join(", ")} (minimum{" "}
              {usd(info.minTopup)}). Methods: {info.payMethods.map((m) => m.name).join(", ")}.
            </p>
          </div>
        ) : null}

        {info.enableRedemption ? (
          <div>
            <label className="note" htmlFor="redeemCode" style={{ display: "block", marginBottom: 6 }}>
              Credit code
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                id="redeemCode"
                className="field"
                style={{ flex: "1 1 260px", fontFamily: "var(--font-mono)" }}
                placeholder="Paste the code from your purchase"
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
          </div>
        ) : (
          <p className="note">
            Credit codes are disabled on this instance. Ask on Telegram for a top-up.
          </p>
        )}

        {error ? (
          <p className="note" style={{ marginTop: 10, color: "#b91c1c" }} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="note" style={{ marginTop: 10, color: "#0e6b45" }} role="status">
            {notice}
          </p>
        ) : null}
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
          empty="No purchases yet. Credits redeemed with a code appear here."
        />
      </div>
    </>
  );
}
