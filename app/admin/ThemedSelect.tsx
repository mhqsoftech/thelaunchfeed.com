"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ThemedOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Hairline-bordered, mono-typography, no-radius dropdown matching the site.
 * Keyboard: ↑/↓ to move, Enter to select, Esc to close.
 */
export default function ThemedSelect({
  value,
  options,
  onChange,
  label,
  placeholder = "Select…",
}: {
  value: string;
  options: ThemedOption[];
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
  );
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(
      `[data-idx="${active}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt.value);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {label && (
        <div className="text-[10px] uppercase text-ink-dim mb-1">{label}</div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            if (open) {
              e.preventDefault();
              commit(active);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-mono",
          "bg-transparent border border-hairline text-ink hover:border-ink transition-colors",
          "focus:outline-none focus:border-ink",
        ].join(" ")}
      >
        <span className="flex-1 text-left truncate">
          {current ? (
            <>
              <span className="font-bold">{current.label}</span>
              {current.hint && (
                <span className="text-ink-dim"> — {current.hint}</span>
              )}
            </>
          ) : (
            <span className="text-ink-dim">{placeholder}</span>
          )}
        </span>
        <span className={`text-[10px] text-ink-dim transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-40 mt-1 w-full max-h-72 overflow-y-auto bg-surface border border-hairline font-mono shadow-none"
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            const isActive = i === active;
            return (
              <li
                key={o.value}
                data-idx={i}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(i);
                }}
                className={[
                  "px-2.5 py-2 text-xs cursor-pointer border-l-2 flex items-baseline gap-2",
                  isActive
                    ? "border-signal bg-[color:var(--surface-alt,rgba(0,0,0,0.04))]"
                    : "border-transparent",
                  selected ? "text-ink" : "text-ink-dim",
                ].join(" ")}
              >
                <span className={`w-3 shrink-0 text-[10px] ${selected ? "text-signal" : "opacity-0"}`}>
                  ●
                </span>
                <span className="flex-1 truncate">
                  <span className="font-bold text-ink">{o.label}</span>
                  {o.hint && (
                    <span className="text-ink-dim"> — {o.hint}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
