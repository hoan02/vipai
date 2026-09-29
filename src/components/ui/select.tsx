"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/**
 * A select that is not the browser's.
 *
 * The native `<select>` popup cannot be styled — it is drawn by the OS, differs
 * per platform, and ignores the page's type scale. This renders its own listbox
 * instead, in a portal so it escapes any panel's `overflow: hidden`, and keeps
 * the parts that matter from the native control: focus stays on the trigger,
 * arrows and Home/End move the active option, Enter picks it, Escape closes, and
 * typing letters jumps to a matching option.
 *
 * It is deliberately not built on a headless library: the whole component is
 * this file plus the `.ui-select*` rules, and there is no runtime dependency to
 * keep in step with React.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Shown under the label, for options that need a second line. */
  hint?: string;
  /** A small leading mark, e.g. a model vendor icon. */
  icon?: ReactNode;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name. Required when there is no visible label. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  /** Renders the trigger full-width instead of hugging its content. */
  block?: boolean;
  /** A leading icon inside the trigger. */
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Shown when the list is empty. */
  emptyLabel?: string;
};

/** Distance kept between the popup and the viewport edge. */
const EDGE_GAP = 8;
const POPUP_MAX_HEIGHT = 288;

export function Select({
  value,
  onChange,
  options,
  label,
  placeholder = "Select…",
  disabled = false,
  block = false,
  icon,
  className,
  style,
  emptyLabel = "No options",
}: SelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  // The typed-prefix jump (like a native select) is reset after a pause.
  const typeahead = useRef({ text: "", at: 0 });

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const firstEnabled = useCallback(
    (from: number, step: 1 | -1) => {
      for (let i = from; i >= 0 && i < options.length; i += step) {
        if (!options[i].disabled) return i;
      }
      return -1;
    },
    [options],
  );

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPosition(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openWith = useCallback(
    (index: number) => {
      const start = options[index]?.disabled ? firstEnabled(index, 1) : index;
      setActiveIndex(start >= 0 ? start : 0);
      setOpen(true);
    },
    [firstEnabled, options],
  );

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      close();
    },
    [close, onChange, options],
  );

  /* Position the popup against the trigger, flipping above it when the space
     below is too small. Runs on open and on any scroll or resize. */
  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - EDGE_GAP;
    const above = rect.top - EDGE_GAP;
    const goUp = below < Math.min(POPUP_MAX_HEIGHT, 160) && above > below;
    const height = Math.min(POPUP_MAX_HEIGHT, goUp ? above : below);

    setPosition({
      top: goUp ? rect.top - height - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - rect.width - EDGE_GAP),
      width: rect.width,
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
    // `capture` catches scrolling in any ancestor, not just the window.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [close, open, reposition]);

  // Keep the active row in view as the keyboard moves it.
  useEffect(() => {
    if (!open) return;
    const row = popupRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openWith(selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1));
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = firstEnabled(activeIndex + 1, 1);
        if (next >= 0) setActiveIndex(next);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = firstEnabled(activeIndex - 1, -1);
        if (prev >= 0) setActiveIndex(prev);
        break;
      }
      case "Home": {
        event.preventDefault();
        const first = firstEnabled(0, 1);
        if (first >= 0) setActiveIndex(first);
        break;
      }
      case "End": {
        event.preventDefault();
        const last = firstEnabled(options.length - 1, -1);
        if (last >= 0) setActiveIndex(last);
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        choose(activeIndex);
        break;
      }
      case "Tab": {
        close(false);
        break;
      }
      default: {
        // Native-like typeahead: letters accumulate briefly, then reset.
        if (event.key.length !== 1 || !/[a-z0-9]/i.test(event.key)) return;
        const now = Date.now();
        const prefix = (now - typeahead.current.at > 700 ? "" : typeahead.current.text) + event.key;
        typeahead.current = { text: prefix, at: now };
        const match = options.findIndex(
          (option) => !option.disabled && option.label.toLowerCase().startsWith(prefix.toLowerCase()),
        );
        if (match >= 0) setActiveIndex(match);
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        disabled={disabled}
        className={`field ui-select-trigger${block ? " is-block" : ""}${
          className ? ` ${className}` : ""
        }`}
        style={style}
        onClick={() => (open ? close() : openWith(selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1)))}
        onKeyDown={onTriggerKeyDown}
      >
        {icon}
        <span className={`ui-select-value${selected ? "" : " is-placeholder"}`}>
          {selected?.icon ? <span className="ui-select-lead">{selected.icon}</span> : null}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="ui-select-caret" size={16} aria-hidden="true" />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              id={listId}
              role="listbox"
              aria-label={label}
              className="ui-select-popup"
              style={{ top: position.top, left: position.left, minWidth: position.width }}
            >
              {options.length === 0 ? (
                <div className="ui-select-empty">{emptyLabel}</div>
              ) : (
                options.map((option, index) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                      disabled={option.disabled}
                      className={`ui-select-option${index === activeIndex ? " is-active" : ""}${
                        isSelected ? " is-selected" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(index)}
                    >
                      <span className="ui-select-option-text">
                        <span className="ui-select-option-line">
                          {option.icon ? <span className="ui-select-lead">{option.icon}</span> : null}
                          <span>{option.label}</span>
                        </span>
                        {option.hint ? <small>{option.hint}</small> : null}
                      </span>
                      {isSelected ? <Check size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
