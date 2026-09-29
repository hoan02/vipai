"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/lib/icons";
import { topupAmounts } from "@/lib/data";

export function TopUpModal() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("50");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("[data-topup]");
      if (target) {
        setOpen(true);
        setAmount(50);
        setCustom("50");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const pick = (a: number) => {
    setAmount(a);
    setCustom(String(a));
  };

  const onCustom = (value: string) => {
    setCustom(value);
    setAmount(Math.max(5, Number(value) || 50));
  };

  return (
    <div
      className={`tu-overlay${open ? " open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tuTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="tu">
        <div className="tu-hd">
          <h3 id="tuTitle">Top up</h3>
          <button className="tu-x" type="button" aria-label="Close" onClick={() => setOpen(false)}>
            <Icon name="ic-x" width={16} height={16} />
          </button>
        </div>
        <p className="tu-note">Discounts may vary with upstream costs; see the live price catalog for current rates.</p>
        <div className="tu-grid">
          {topupAmounts.map((t) => (
            <button
              key={t.amt}
              className={`tu-amt${amount === t.amt ? " on" : ""}`}
              type="button"
              onClick={() => pick(t.amt)}
            >
              <b>${t.amt.toFixed(2)}</b>
              <small>{t.label}</small>
            </button>
          ))}
        </div>
        <div className="tu-custom">
          <label htmlFor="tuCustom">Or enter a custom amount (min $5)</label>
          <input
            id="tuCustom"
            type="number"
            min={5}
            step={1}
            inputMode="decimal"
            placeholder="50"
            value={custom}
            onChange={(e) => onCustom(e.target.value)}
          />
        </div>
        <div className="tu-est">
          <div>
            <span>Approximately</span>
            <span />
          </div>
          <div>
            <span>Claude</span>
            <b>${(amount * 4.348).toFixed(1)}</b>
          </div>
          <div>
            <span>or OpenAI</span>
            <b>${(amount * 10).toFixed(0)}</b>
          </div>
          <div>
            <span>or Gemini</span>
            <b>${(amount * 4.348).toFixed(1)}</b>
          </div>
        </div>
        <p className="tu-terms">By purchasing you agree to VipAI&apos;s Terms. Your USD balance stays in your account.</p>
        <div className="tu-actions">
          <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button">
            Pay ${amount.toFixed(2)}
          </button>
        </div>
        <p className="tu-stripe">Stripe checkout for all languages</p>
      </div>
    </div>
  );
}
