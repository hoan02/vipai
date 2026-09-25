"use client";

import { useState } from "react";
import { BadgeCheck, Check, Gauge, Minus, Percent, Plus } from "lucide-react";
import { PageHead } from "@/components/dashboard/kit";
import { Icon } from "@/lib/icons";

type Strategy = "budget" | "curated" | "discount";

const helpDot = {
  width: 15,
  height: 15,
  border: "1px solid currentColor",
  borderRadius: "50%",
  display: "inline-grid",
  placeItems: "center",
  fontSize: 10,
  lineHeight: 1,
  opacity: 0.55,
} as const;

const providers = [
  { key: "claude", name: "Claude", vendor: "Anthropic", icon: "ic-claude" },
  { key: "gpt", name: "GPT", vendor: "OpenAI", icon: "ic-openai" },
  { key: "gemini", name: "Gemini", vendor: "Google", icon: "ic-gemini" },
] as const;

export function RoutingView() {
  const [strategy, setStrategy] = useState<Strategy>("discount");
  const [caps, setCaps] = useState<Record<string, number>>({ claude: 0, gpt: 0, gemini: 0 });

  const bump = (key: string, delta: number) =>
    setCaps((c) => ({ ...c, [key]: Math.max(0, Math.min(90, c[key] + delta)) }));

  return (
    <>
      <PageHead
        title="Routing settings"
        sub="Pick one routing strategy: budget routing, curated routing and discount caps are mutually exclusive."
      />

      <div className="opts" style={{ marginTop: 20 }}>
        <button
          type="button"
          className={`opt${strategy === "budget" ? " is-on" : ""}`}
          onClick={() => setStrategy("budget")}
        >
          <span className="oi">
            <Gauge />
          </span>
          <span className="opt-tx">
            <b>
              Budget routing <span style={helpDot}>?</span>
            </b>
            <p>Lower price; latency and stability vary with supply. Ideal for high-frequency calls, batch jobs and cost-sensitive scenarios.</p>
          </span>
          <span className="opt-radio" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`opt${strategy === "curated" ? " is-on" : ""}`}
          onClick={() => setStrategy("curated")}
        >
          <span className="oi">
            <BadgeCheck />
          </span>
          <span className="opt-tx">
            <b>
              Curated routing <span style={helpDot}>?</span>
            </b>
            <p>Quality-validated with continuous monitoring and replacement — stability first. Built for production, critical paths and quality-sensitive scenarios.</p>
          </span>
          <span className="opt-radio" aria-hidden="true" />
        </button>

        <div className={`opt opt-disc${strategy === "discount" ? " is-on" : ""}`}>
          <span className="oi">
            <Percent />
          </span>
          <span className="opt-tx" style={{ flex: 1 }}>
            <b>Custom discount</b>
            <p>
              The cap is the deepest discount applied to your charges. Lowering it reduces available model resources —
              please adjust with care.
            </p>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setStrategy("discount")}>
              Edit
            </button>
            {strategy === "discount" ? (
              <span
                aria-label="Selected"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--d-amber)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Check size={14} />
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="sh">
        <h2>Discount caps by provider</h2>
        <span className="hint">0% = no cap</span>
      </div>

      <div className="panel">
        {providers.map((p) => (
          <div className="prov" key={p.key}>
            <span className="pi">
              <span className="av">
                <Icon name={p.icon} width={26} height={26} />
              </span>
              <span>
                <b>{p.name}</b>
                <small>{p.vendor}</small>
              </span>
            </span>
            <span className="stepper">
              <span className="lbl">MAX</span>
              <span className="ctl">
                <button
                  type="button"
                  aria-label={`Lower ${p.name} cap`}
                  disabled={caps[p.key] <= 0}
                  onClick={() => bump(p.key, -1)}
                >
                  <Minus size={14} />
                </button>
                <span className="val">{caps[p.key]} %</span>
                <button
                  type="button"
                  aria-label={`Raise ${p.name} cap`}
                  disabled={caps[p.key] >= 90}
                  onClick={() => bump(p.key, 1)}
                >
                  <Plus size={14} />
                </button>
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
