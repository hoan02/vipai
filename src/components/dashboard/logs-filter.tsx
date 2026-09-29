"use client";

import { Calendar, RotateCcw, Search } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

/** The filter fields every Usage-logs section shares. */
export type LogFilterState = {
  /** `YYYY-MM-DD`, empty means unbounded. */
  from: string;
  to: string;
  model: string;
  group: string;
  source: string;
};

export const EMPTY_LOG_FILTERS: LogFilterState = {
  from: "",
  to: "",
  model: "",
  group: "",
  source: "",
};

/** Quick ranges offered as chips, in days back from today. */
const RANGE_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "29 days", days: 29 },
] as const;

function toInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return toInput(date);
}

export function LogsFilterBar({
  value,
  onChange,
  onApply,
  onReset,
  busy = false,
  show,
}: {
  value: LogFilterState;
  onChange: (next: LogFilterState) => void;
  /** Runs the query with the given filters (first page). */
  onApply: (next: LogFilterState) => void;
  onReset: () => void;
  busy?: boolean;
  show?: { model?: boolean; group?: boolean; source?: boolean; sourceLabel?: string };
}) {
  const set = (patch: Partial<LogFilterState>) => onChange({ ...value, ...patch });
  const today = toInput(new Date());

  return (
    <div className="toolbar" style={{ marginTop: 18 }}>
      <span className="date-range">
        <DatePicker
          label="From date"
          value={value.from}
          onChange={(from) => set({ from })}
          max={value.to || undefined}
          icon={<Calendar size={16} />}
        />
        <span className="note">–</span>
        <DatePicker
          label="To date"
          value={value.to}
          onChange={(to) => set({ to })}
          min={value.from || undefined}
          icon={<Calendar size={16} />}
        />
      </span>

      <span className="an-range" role="group" aria-label="Quick range">
        {RANGE_PRESETS.map((preset) => {
          const from = daysAgo(preset.days);
          const on = value.from === from && value.to === today;
          return (
            <button
              key={preset.days}
              type="button"
              className={`chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => {
                const next = { ...value, from, to: today };
                onChange(next);
                onApply(next);
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </span>

      {show?.model ? (
        <input
          className="field"
          style={{ minWidth: 150 }}
          placeholder="Model"
          aria-label="Model"
          value={value.model}
          onChange={(e) => set({ model: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply(value);
          }}
        />
      ) : null}

      {show?.group ? (
        <input
          className="field"
          style={{ minWidth: 130 }}
          placeholder="Group"
          aria-label="Group"
          value={value.group}
          onChange={(e) => set({ group: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply(value);
          }}
        />
      ) : null}

      {show?.source ? (
        <input
          className="field"
          style={{ minWidth: 150 }}
          placeholder={show.sourceLabel ?? "API key"}
          aria-label={show.sourceLabel ?? "API key"}
          value={value.source}
          onChange={(e) => set({ source: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply(value);
          }}
        />
      ) : null}

        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => onApply(value)}
          disabled={busy}
        >
          <Search size={14} aria-hidden="true" /> {busy ? "Loading…" : "Filter"}
        </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={onReset} disabled={busy}>
        <RotateCcw size={14} aria-hidden="true" /> Reset
      </button>
    </div>
  );
}
