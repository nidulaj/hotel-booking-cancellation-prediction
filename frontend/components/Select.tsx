"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown } from "./Icons";
import { controlClass, cx } from "./ui";

type Option = { value: string; label: string };

/** Approximate panel height, used to decide whether to open upwards. */
const PANEL_MAX_PX = 264;

function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : isValidElement(n) ? nodeText((n.props as { children?: ReactNode }).children) : ""))
    .join("");
}

/** Reads `<option>` children so call sites keep the familiar native-select markup. */
function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((c) => {
    if (!isValidElement(c) || c.type !== "option") return [];
    const props = (c as ReactElement<{ value?: string | number; children?: ReactNode }>).props;
    const label = nodeText(props.children);
    return [{ value: props.value !== undefined ? String(props.value) : label, label }];
  });
}

/**
 * Fixed-position placement next to the trigger. Panels render in a portal on <body> so animated
 * cards (which form their own stacking contexts) or clipped drawers can never cover them.
 * Opens upwards when there isn't room below.
 */
export type PanelSize = { height: number; width?: number };

function measure(el: HTMLElement | null, size: PanelSize): CSSProperties {
  if (!el) return { display: "none" };
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom;
  const up = below < size.height + 16 && r.top > below;
  const width = size.width ?? r.width;
  // Keep fixed-width panels inside the viewport horizontally.
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
  return up
    ? { position: "fixed", left, width, bottom: window.innerHeight - r.top + 8 }
    : { position: "fixed", left, width, top: r.bottom + 8 };
}

/** Outside-click closing plus re-positioning on scroll/resize while open. */
export function usePopover<P extends HTMLElement = HTMLUListElement>(
  open: boolean,
  close: () => void,
  anchor: () => HTMLElement | null,
  size: PanelSize = { height: PANEL_MAX_PX },
) {
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<P>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const { height, width } = size;

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => !!t && (ref.current?.contains(t as Node) || panelRef.current?.contains(t as Node));
    const onDown = (e: MouseEvent) => !inside(e.target) && close();
    const onMove = (e: Event) => {
      if (e.type === "scroll" && inside(e.target)) return; // scrolling the list itself
      setStyle(measure(anchor(), { height, width }));
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, close, anchor, height, width]);

  return { ref, panelRef, style, place: () => setStyle(measure(anchor(), { height, width })) };
}

const panelClass =
  "z-[70] max-h-64 animate-pop overflow-auto overscroll-contain rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(10,36,24,0.28)] ring-1 ring-line";

function optionClass(active: boolean, selected: boolean) {
  return cx(
    "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
    selected ? "font-medium text-brand-800" : "text-slate-700",
    active && selected ? "bg-brand-100" : selected ? "bg-brand-50" : active ? "bg-panel" : "",
  );
}

/* ------------------------------------------------------------------ */

/**
 * Styled replacement for a native select (select-only combobox pattern).
 * Same usage as <select>: `<option>` children, `value`, and `onChange(e => e.target.value)`.
 */
export function Select({
  id,
  value,
  onChange,
  invalid,
  disabled,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange?: (e: { target: { value: string } }) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const options = useMemo(() => readOptions(children), [children]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const listId = `${useId()}-list`;
  const close = useCallback(() => setOpen(false), []);
  const anchor = useCallback(() => buttonRef.current, []);
  const { ref, panelRef: listRef, style, place } = usePopover(open, close, anchor);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listRef]);

  function show(index = Math.max(0, selectedIndex)) {
    place();
    setActive(index);
    setOpen(true);
  }

  function choose(index: number) {
    const o = options[index];
    setOpen(false);
    buttonRef.current?.focus();
    if (o && o.value !== value) onChange?.({ target: { value: o.value } });
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const move = (i: number) => (open ? setActive(i) : show(i));
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (e.altKey || !open) show();
        else setActive(Math.min(last, active + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!open) show();
        else setActive(Math.max(0, active - 1));
        return;
      case "Home":
        e.preventDefault();
        move(0);
        return;
      case "End":
        e.preventDefault();
        move(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(active);
        else show();
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // don't also close a surrounding drawer
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    // Type-ahead: jump to the first option starting with the typed text.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
      if (hit >= 0) move(hit);
    }
  }

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cx(
          controlClass(invalid),
          "flex items-center justify-between gap-2 pr-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
          open && !invalid && "border-brand-400 ring-4 ring-brand-100",
        )}
      >
        <span className={cx("truncate", selectedIndex < 0 && "text-slate-400")}>{options[selectedIndex]?.label ?? value ?? "Select…"}</span>
        <span
          className={cx(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full transition",
            open ? "bg-brand-700 text-white" : "bg-panel text-slate-500",
          )}
        >
          <IconChevronDown size={15} strokeWidth={2.2} className={cx("transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>

      {open &&
        createPortal(
          <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} style={style} className={panelClass}>
            {options.map((o, i) => {
              const selected = i === selectedIndex;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => i !== active && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={optionClass(i === active, selected)}
                >
                  <span className="truncate">{o.label}</span>
                  {selected && <IconCheck size={16} strokeWidth={2.4} className="shrink-0 text-brand-600" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Text input with a styled suggestion list. Free text is still allowed;
 * suggestions match on code prefix or name.
 */
export function Autocomplete({
  id,
  value,
  onChange,
  options,
  invalid,
  maxLength,
  placeholder,
  transform = (v) => v,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { code: string; name: string }[];
  invalid?: boolean;
  maxLength?: number;
  placeholder?: string;
  transform?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${useId()}-list`;
  const close = useCallback(() => setOpen(false), []);
  const anchor = useCallback(() => inputRef.current, []);
  const { ref, panelRef: listRef, style, place } = usePopover(open, close, anchor);

  const q = value.trim().toLowerCase();
  const matches = useMemo(
    () => (filtering && q ? options.filter((o) => o.code.toLowerCase().startsWith(q) || o.name.toLowerCase().includes(q)) : options),
    [filtering, q, options],
  );
  const exact = options.find((o) => o.code.toLowerCase() === q);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listRef]);

  function show(filter: boolean, list = matches) {
    place();
    setFiltering(filter);
    const sel = list.findIndex((o) => o.code.toLowerCase() === q);
    setActive(Math.max(0, sel));
    setOpen(true);
  }

  function choose(code: string) {
    onChange(code);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) show(false, options);
      else setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault(); // pick the suggestion instead of submitting the form
      choose(matches[active].code);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onFocus={() => show(false, options)}
        onClick={() => !open && show(false, options)}
        onChange={(e) => {
          onChange(transform(e.target.value));
          if (!open) show(true);
          setFiltering(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className={cx(controlClass(invalid), "pr-32 font-medium tracking-wide", open && !invalid && "border-brand-400 ring-4 ring-brand-100")}
      />
      {exact && (
        <span className="pointer-events-none absolute right-4 top-1/2 max-w-[7.5rem] -translate-y-1/2 truncate text-sm text-slate-400">{exact.name}</span>
      )}

      {open &&
        createPortal(
          <ul ref={listRef} id={listId} role="listbox" style={style} className={panelClass}>
            {matches.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-500">No match. The code you typed will be used as is.</li>
            ) : (
              matches.map((o, i) => {
                const selected = o.code.toLowerCase() === q;
                return (
                  <li
                    key={o.code}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => i !== active && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o.code)}
                    className={optionClass(i === active, selected)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cx("w-11 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold tracking-wide", selected ? "bg-brand-600 text-white" : "bg-panel text-slate-600")}>
                        {o.code}
                      </span>
                      <span className="truncate">{o.name}</span>
                    </span>
                    {selected && <IconCheck size={16} strokeWidth={2.4} className="shrink-0 text-brand-600" />}
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
