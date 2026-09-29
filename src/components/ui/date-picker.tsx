"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A date field with its own calendar.
 *
 * `input[type=date]` is drawn by the browser and looks different in each one —
 * and on some builds the picker icon is the ugliest control on the page. This
 * renders its own month grid in a portal, matching the dashboard's type scale.
 *
 * The value is the same `YYYY-MM-DD` string the native input produced, so any
 * caller can swap one for the other without touching its state.
 */

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name. Required when there is no visible label. */
  label: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** A leading icon inside the trigger. */
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** First day of the week. 1 = Monday, 0 = Sunday. */
  weekStartsOn?: 0 | 1;
};

const EDGE_GAP = 8;
const POPUP_WIDTH = 288;

/* ---------- date helpers, all in local time ---------- */

/** Parses `YYYY-MM-DD` into a local-midnight Date, or null. */
function parse(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a Date as `YYYY-MM-DD`, the shape the inputs use. */
function format(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  disabled = false,
  icon,
  className,
  style,
  weekStartsOn = 1,
}: DatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => parse(value), [value]);
  const minDate = useMemo(() => (min ? parse(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parse(max) : null), [max]);

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  // The month on screen; independent of the selection until one is made.
  const [view, setView] = useState(() => selected ?? new Date());
  const [typed, setTyped] = useState(value);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!typing) setTyped(value);
  }, [typing, value]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const isDisabledDay = useCallback(
    (day: Date) =>
      (minDate ? day < startOfDay(minDate) : false) || (maxDate ? day > startOfDay(maxDate) : false),
    [maxDate, minDate],
  );

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPosition(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openCalendar = useCallback(() => {
    setView(selected ?? new Date());
    setOpen(true);
  }, [selected]);

  const commit = useCallback(
    (date: Date) => {
      if (isDisabledDay(date)) return;
      onChange(format(date));
      close();
    },
    [close, isDisabledDay, onChange],
  );

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - EDGE_GAP;
    const above = rect.top - EDGE_GAP;
    const height = 336;
    const goUp = below < height && above > below;

    setPosition({
      top: goUp ? Math.max(EDGE_GAP, rect.top - height - 4) : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - POPUP_WIDTH - EDGE_GAP),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const onScrollOrResize = () => reposition();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [close, open, reposition]);

  /* The grid: whole weeks, padded so the first row starts on the right weekday. */
  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date; outside: boolean }> = [];

    for (let i = offset; i > 0; i -= 1) {
      cells.push({ date: new Date(view.getFullYear(), view.getMonth(), 1 - i), outside: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(view.getFullYear(), view.getMonth(), day), outside: false });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
    }
    return cells;
  }, [view, weekStartsOn]);

  const label_ = selected
    ? selected.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";

  const commitTyped = () => {
    setTyping(false);
    if (typed === value) return;
    if (typed === "") {
      onChange("");
      return;
    }
    const date = parse(typed);
    if (date && !isDisabledDay(date)) onChange(format(date));
    else setTyped(value);
  };

  const header = (
    <div className="ui-date-head">
      <button
        type="button"
        className="ui-date-nav"
        aria-label="Previous month"
        onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="ui-date-title">
        {MONTHS[view.getMonth()]} {view.getFullYear()}
      </span>
      <button
        type="button"
        className="ui-date-nav"
        aria-label="Next month"
        onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        className={`field ui-date-trigger${className ? ` ${className}` : ""}`}
        style={style}
        onClick={() => (open ? close() : openCalendar())}
      >
        {icon}
        <span className={`ui-date-value${label_ ? "" : " is-placeholder"}`}>
          {label_ || "Select a date"}
        </span>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              role="dialog"
              aria-label={label}
              className="ui-date-popup"
              style={{ top: position.top, left: position.left, width: POPUP_WIDTH }}
            >
              {header}

              <div className="ui-date-weekdays" aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStartsOn) % 7]).map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>

              <div className="ui-date-grid" role="grid">
                {grid.map((cell) => {
                  const disabledDay = isDisabledDay(cell.date);
                  const isSelected = selected ? sameDay(cell.date, selected) : false;
                  const isToday = sameDay(cell.date, today);
                  return (
                    <button
                      key={format(cell.date)}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      disabled={disabledDay}
                      tabIndex={-1}
                      className={`ui-date-day${cell.outside ? " is-outside" : ""}${
                        isSelected ? " is-selected" : ""
                      }${isToday ? " is-today" : ""}`}
                      onClick={() => commit(cell.date)}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="ui-date-foot">
                <button
                  type="button"
                  className="ui-date-quick"
                  onClick={() => commit(today)}
                  disabled={isDisabledDay(today)}
                >
                  Today
                </button>
                {value ? (
                  <button type="button" className="ui-date-quick" onClick={() => onChange("")}>
                    Clear
                  </button>
                ) : null}
              </div>

              {/* Manual entry stays available for a date far from today. */}
              <div className="ui-date-manual">
                <input
                  className="field"
                  aria-label={`${label} (type a date)`}
                  placeholder="YYYY-MM-DD"
                  value={typed}
                  onChange={(e) => {
                    setTyping(true);
                    setTyped(e.target.value);
                  }}
                  onBlur={commitTyped}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTyped();
                    }
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
