import { PageHead, Stat } from "@/components/dashboard/kit";
import { costByModel, monthSpend, savedThisMonth } from "@/lib/dashboard-data";

export default function DashboardCostPage() {
  const totalRequests = costByModel.reduce((sum, r) => sum + Number(r.requests.replace(/,/g, "")), 0);

  return (
    <>
      <PageHead
        title="Cost"
        sub="Spend by model for the current billing period, with the discount already applied."
      />

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat label="Spend this month" value={monthSpend} />
        <Stat label="Saved vs list" value={savedThisMonth} />
        <Stat label="Requests" value={totalRequests.toLocaleString("en-US")} />
      </div>

      <div className="sh">
        <h2>Spend by model</h2>
        <span className="hint">Current period</span>
      </div>

      <div className="panel">
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th className="r">Requests</th>
                <th className="r">Tokens</th>
                <th className="r">Spend</th>
                <th className="r">Saved</th>
              </tr>
            </thead>
            <tbody>
              {costByModel.map((r) => (
                <tr key={r.model}>
                  <td>{r.model}</td>
                  <td>{r.vendor}</td>
                  <td className="r num">{r.requests}</td>
                  <td className="r num">{r.tokens}</td>
                  <td className="r num">{r.spend}</td>
                  <td className="r num">{r.saved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
