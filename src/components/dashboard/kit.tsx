import type { ReactNode } from "react";

export function PageHead({ title, sub, side }: { title: ReactNode; sub?: ReactNode; side?: ReactNode }) {
  return (
    <div className="ph">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {side ? <div className="ph-side">{side}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="sh">
      <h2>{children}</h2>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <span className="k">{label}</span>
      <div className="v">{value}</div>
      {hint ? <span className="note" style={{ display: "block", marginTop: 6 }}>{hint}</span> : null}
    </div>
  );
}

export function Pill({ tone = "role", children }: { tone?: "cap" | "role" | "ok" | "off"; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
