"use client";

import { useState } from "react";
import { Bell, LayoutGrid, LayoutList } from "lucide-react";
import { PageHead, Stat } from "@/components/dashboard/kit";
import type { DashboardBilling } from "@/server/dashboard";
import type { BillingRow } from "@/lib/dashboard-data";

function BalanceCard({ balance }: { balance: string | null }) {
  return (
    <div className="bal">
      <div className="bal-row">
        <span className="bal-amt">{balance ?? "—"}</span>
        <button className="btn btn-primary btn-sm" type="button" data-topup>
          Top up
        </button>
      </div>
      <p className="bal-note">
        Credits are added at face value in USD. Model discounts are applied automatically when credits are used. See
        per-request charges in Billing details.
      </p>
      <button className="bal-alert" type="button">
        <Bell size={15} /> Set balance alert
      </button>
    </div>
  );
}

function BillingDetail({ rows }: { rows: BillingRow[] }) {
  return (
    <div className="panel">
      <div className="panel-hd">
        <h3>Billing detail</h3>
        <p>
          Per-request usage charges by model · All times in your local timezone (UTC+7) ·{" "}
          <a className="link" href="#support">
            Questions about your bill?
          </a>
          <br />
          Each request is billed at its real-time discount.
        </p>
      </div>
      <div className="twrap" style={{ marginTop: 10 }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>Request time</th>
              <th>Model</th>
              <th>Source</th>
              <th className="r">Input tokens</th>
              <th className="r">Output tokens</th>
              <th className="r">Cache read</th>
              <th className="r">Cache write</th>
              <th className="r">Amount due</th>
              <th className="r">Balance change</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={9}>No usage yet</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.time}>
                  <td>{r.time}</td>
                  <td>{r.model}</td>
                  <td>{r.source}</td>
                  <td className="r num">{r.input}</td>
                  <td className="r num">{r.output}</td>
                  <td className="r num">{r.cacheRead}</td>
                  <td className="r num">{r.cacheWrite}</td>
                  <td className="r num">{r.amount}</td>
                  <td className="r num">{r.balance}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BillingView({ billing }: { billing: DashboardBilling }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const { balance, monthSpend, rows } = billing;

  return (
    <>
      <PageHead
        title="Balance & billing"
        side={
          <div className="seg" role="group" aria-label="Layout">
            <button
              type="button"
              className={view === "list" ? "is-on" : undefined}
              aria-pressed={view === "list"}
              aria-label="List layout"
              onClick={() => setView("list")}
            >
              <LayoutList size={16} />
            </button>
            <button
              type="button"
              className={view === "grid" ? "is-on" : undefined}
              aria-pressed={view === "grid"}
              aria-label="Grid layout"
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        }
      />

      {view === "grid" ? (
        <div className="stack-16" style={{ marginTop: 20 }}>
          <BalanceCard balance={balance} />
          <div className="stats two">
            <Stat label="Balance" value={balance ?? "—"} />
            <Stat label="This month" value={monthSpend} />
          </div>
          <BillingDetail rows={rows} />
        </div>
      ) : (
        <div className="stack-16" style={{ marginTop: 20 }}>
          <BalanceCard balance={balance} />
          <BillingDetail rows={rows} />
        </div>
      )}
    </>
  );
}
