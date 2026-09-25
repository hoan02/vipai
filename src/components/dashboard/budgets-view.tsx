"use client";

import { useState } from "react";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { members as seedMembers } from "@/lib/dashboard-data";

export function BudgetsView() {
  const [orgTotal, setOrgTotal] = useState("200.00");
  const [capping, setCapping] = useState(false);
  const [caps, setCaps] = useState<Record<string, string>>(() =>
    Object.fromEntries(seedMembers.map((m) => [m.email, m.cap === "Not set" ? "" : m.cap.replace("$", "")]))
  );
  const used = 24.42;
  const orgPct = Math.min(100, (used / (Number(orgTotal) || 1)) * 100);

  return (
    <>
      <PageHead title="Team budget" sub="Set a monthly ceiling for the organization and per-member caps to keep spend predictable." />

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="budget-org">
          <div className="budget-cell">
            <div className="k">Organization monthly budget</div>
            <div className="v">${orgTotal}</div>
            <div className="n">Resets monthly on the 1st at 00:00</div>
            {capping ? (
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <input
                  className="field"
                  type="number"
                  min={0}
                  step={10}
                  value={orgTotal}
                  onChange={(e) => setOrgTotal(e.target.value)}
                  aria-label="Organization monthly budget"
                  style={{ width: 150 }}
                />
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setCapping(false)}>
                  Save
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCapping(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" type="button" style={{ marginTop: 14 }} onClick={() => setCapping(true)}>
                Adjust total budget
              </button>
            )}
          </div>
          <div className="budget-cell">
            <div className="k">Organization used this month</div>
            <div className="v">${used.toFixed(2)}</div>
            <div className="n">Refreshes monthly on the 1st at 00:00</div>
            <div className="bar" style={{ marginTop: 14 }}>
              <span style={{ width: `${orgPct.toFixed(1)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        {seedMembers.map((m) => {
          const cap = caps[m.email] ?? "";
          const pct = cap ? Math.min(100, (Number(m.used.replace("$", "")) / Number(cap)) * 100) : 0;
          return (
            <div className="member-row" key={m.email}>
              <span className="who">
                <span className="em">{m.email}</span>
                <Pill tone="role">{m.role}</Pill>
              </span>
              <span className="member-cap">
                <span className="n">
                  Used <b className="num">{m.used}</b> · Cap {cap ? `$${Number(cap).toFixed(2)}` : "Not set"}
                </span>
                <span className="bar">
                  <span style={{ width: `${pct.toFixed(1)}%` }} />
                </span>
              </span>
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <input
                  className="field"
                  type="number"
                  min={0}
                  step={5}
                  placeholder="Cap"
                  value={cap}
                  onChange={(e) => setCaps((c) => ({ ...c, [m.email]: e.target.value }))}
                  aria-label={`Monthly cap for ${m.email}`}
                  style={{ width: 110 }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
