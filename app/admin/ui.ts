/**
 * Shared class names for the admin dashboard, so every tab uses the same
 * card / control / table look as the redesigned shell (rounded cards on
 * `bg-card`, sans body text, small uppercase labels, rounded-md controls).
 */

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Panels and sections. */
export const card = "rounded-xl border border-hairline bg-card shadow-card";
export const cardPad = `${card} p-4 sm:p-5`;
/** A panel whose header is a <SectionTitle> and whose rows run edge to edge. */
export const cardList = `${card} overflow-hidden`;
/** Inset well inside a card (code, previews, nested settings). */
export const well = "rounded-lg border border-hairline bg-surface/60";

/** Tiny uppercase field / column label. */
export const label = "block text-[10px] uppercase tracking-wider text-ink-faint font-bold";
/** Explanatory paragraph under a heading. */
export const help = "font-sans text-sm text-ink-dim leading-relaxed";
export const emptyState = "px-4 py-10 text-center font-sans text-sm text-ink-dim";

/** Form controls. Add `w-full` / `flex-1` at the call site. */
export const input =
  "h-9 px-3 rounded-md border border-hairline bg-void text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink/60 focus:ring-2 focus:ring-signal/15 disabled:opacity-50";
export const textarea =
  "px-3 py-2 rounded-md border border-hairline bg-void text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink/60 focus:ring-2 focus:ring-signal/15 disabled:opacity-50";
export const checkbox = "w-4 h-4 rounded border-hairline accent-[var(--color-signal)] cursor-pointer";

/** Buttons. `btnSm` for in-row actions, `btn` for section actions. */
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-bold uppercase whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40";
export const btn = `${btnBase} h-9 px-3.5 text-xs`;
export const btnSm = `${btnBase} h-7 px-2.5 text-[11px]`;
export const primary = "bg-signal text-white hover:opacity-90";
export const secondary = "border border-hairline bg-card text-ink hover:border-ink/60";
export const ghost = "text-ink-dim hover:text-ink hover:bg-raised/60";
export const danger = "border border-rose-500/30 text-rose-500 hover:bg-rose-500/10";
export const success = "border border-verified/40 text-verified hover:bg-verified/10";

/** Segmented filter (Queue / Published / …). */
export const segment = "inline-flex p-0.5 rounded-lg border border-hairline bg-surface/60";
export const segmentItem = (active: boolean) =>
  cx(
    "h-7 px-3 rounded-md text-[11px] font-bold uppercase whitespace-nowrap transition-colors cursor-pointer",
    active ? "bg-card text-ink shadow-card ring-1 ring-hairline" : "text-ink-dim hover:text-ink"
  );

/** Status pills. */
export type Tone = "neutral" | "signal" | "good" | "warn" | "bad" | "info";
export const pill = (tone: Tone = "neutral") =>
  cx(
    "inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
    tone === "neutral" && "bg-raised text-ink-dim",
    tone === "signal" && "bg-signal-dim text-signal",
    tone === "good" && "bg-verified/10 text-verified",
    tone === "warn" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    tone === "bad" && "bg-rose-500/10 text-rose-500",
    tone === "info" && "bg-sky-500/10 text-sky-600 dark:text-sky-400"
  );

/** Tables. Wrap in `tableWrap`, put `thead` in `thead`, cells in `th` / `td`. */
export const tableWrap = `${card} overflow-auto`;
export const table = "w-full font-sans text-sm";
export const thead = "sticky top-0 z-10 bg-surface/95 backdrop-blur";
export const th = "px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-ink-faint font-bold border-b border-hairline whitespace-nowrap";
export const tr = "border-t border-hairline first:border-t-0 hover:bg-surface/50 transition-colors";
export const td = "px-3 py-2.5 align-middle";

/** Inline notices. */
export const notice = (tone: "info" | "good" | "bad" | "warn" = "info") =>
  cx(
    "rounded-lg border px-3.5 py-2.5 font-sans text-sm",
    tone === "info" && "border-hairline bg-surface/60 text-ink-dim",
    tone === "good" && "border-verified/30 bg-verified/10 text-verified",
    tone === "bad" && "border-rose-500/30 bg-rose-500/10 text-rose-500",
    tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
  );
