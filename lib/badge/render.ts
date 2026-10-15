/**
 * Badge renderer — pure function, SVG out.
 *
 * One layout for every badge, so they read as a family:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [emblem]  EYEBROW LABEL            │  ▲ 315  │
 *   │           THE LAUNCH FEED          │ UPVOTES │
 *   └──────────────────────────────────────────────┘
 *
 *  - emblem: the brand's 4-square matrix (launch / featured), an upvote
 *    chevron, a verified check (revenue), or — for awards — a period emblem
 *    whose SHAPE shows the board's depth (day: sunrise disc · week: shield ·
 *    month: rosette · year: crowned plate · all-time: laurel wreath) and whose
 *    METAL shows the rank (gold / silver / bronze)
 *  - award depth cues: a 5-pip prestige meter, and metal card frames for the
 *    yearly (single) and all-time (double "certificate") boards
 *  - eyebrow: what the badge certifies, in plain words
 *  - title: the THE LAUNCH FEED wordmark ("FEED" in signal orange) or, for
 *    revenue badges, the verified MRR figure
 *  - metric: live upvotes on wide badges (compact ones carry them in the eyebrow)
 *
 * Sizes stay 220×48 (compact) and 284×48 (wide) — the exact dimensions of the
 * previous generation, so every badge already embedded with fixed
 * width/height attributes upgrades in place without distortion.
 * No emoji (they render differently on every OS) and no external assets: the
 * Doto display face is inlined, the rest uses system UI / mono stacks.
 */

import { DOTO_FONT_BASE64 } from "@/lib/badgeFont";

export type BadgeTheme = "light" | "dark" | "signal" | "minimal";

export type BadgeInput = {
  /** featured | launch | upvote | revenue | daily_1..alltime_3 (+ legacy pod / champion) */
  award: string;
  theme: string;
  votes?: number | null;
  revenue?: string | null;
  /** Year shown on yearly awards. */
  year?: number;
  /** Pre-launch generic badge ("Featured on"). */
  featured?: boolean;
};

type Palette = {
  bg: string;
  bg2: string;
  border: string;
  ink: string;
  dim: string;
  accent: string;
  accentSoft: string;
  divider: string;
};

const PALETTES: Record<BadgeTheme, Palette> = {
  light: {
    bg: "#FFFFFF",
    bg2: "#FBFAF8",
    border: "#E4E2DD",
    ink: "#111111",
    dim: "#6B6A64",
    accent: "#D14000",
    accentSoft: "#FFF0E8",
    divider: "#ECEAE5",
  },
  dark: {
    bg: "#131316",
    bg2: "#0C0C0E",
    border: "#2A2A30",
    ink: "#F4F4F5",
    dim: "#9B9BA5",
    accent: "#FF5A1F",
    accentSoft: "#2A160D",
    divider: "#26262B",
  },
  signal: {
    bg: "#FF5A1F",
    bg2: "#E84800",
    border: "#D94300",
    ink: "#FFFFFF",
    dim: "#FFE1D2",
    accent: "#FFFFFF",
    accentSoft: "rgba(255,255,255,0.18)",
    divider: "rgba(255,255,255,0.28)",
  },
  minimal: {
    bg: "#FFFFFF",
    bg2: "#FFFFFF",
    border: "#111111",
    ink: "#111111",
    dim: "#555555",
    accent: "#111111",
    accentSoft: "#F1F1F1",
    divider: "#E2E2E2",
  },
};

type Medal = { from: string; to: string; ink: string; ring: string };
const MEDALS: Record<1 | 2 | 3, Medal> = {
  1: { from: "#F7CF5C", to: "#D9961C", ink: "#3A2600", ring: "#FFE7A3" },
  2: { from: "#EEF1F5", to: "#A9B2BF", ink: "#1E2733", ring: "#FFFFFF" },
  3: { from: "#F0B488", to: "#B9682F", ink: "#3A1803", ring: "#FFD9BD" },
};

const PERIOD_LABEL: Record<string, string> = {
  daily: "PRODUCT OF THE DAY",
  weekly: "PRODUCT OF THE WEEK",
  monthly: "PRODUCT OF THE MONTH",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function compactVotes(v: number) {
  const n = Math.max(0, Math.round(v));
  return n >= 10000 ? `${(n / 1000).toFixed(0)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

/** Rough advance widths, used only to keep text inside its box. */
const MONO_ADV = 0.6;
const DOTO_ADV = 0.66;
function fit(text: string, size: number, adv: number, tracking: number, max: number) {
  const est = text.length * (size * adv + tracking);
  return est > max ? ` textLength="${max.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : "";
}

type Period = "daily" | "weekly" | "monthly" | "yearly" | "alltime";

/** Prestige depth of each board: drives the emblem, the pips and the frame. */
const TIER: Record<Period, number> = { daily: 1, weekly: 2, monthly: 3, yearly: 4, alltime: 5 };

type Resolved = {
  kind: "matrix" | "medal" | "upvote" | "revenue";
  rank?: 1 | 2 | 3;
  period?: Period;
  eyebrow: string;
  title: "wordmark" | string;
  metric: boolean;
  wide: boolean;
};

function resolve(input: BadgeInput): Resolved {
  const a = (input.award || "launch").toLowerCase();
  const legacy: Record<string, string> = { pod: "daily_1", champion: "yearly_1" };
  const award = legacy[a] ?? a;

  const m = /^(daily|weekly|monthly|yearly|alltime)_([123])$/.exec(award);
  if (m) {
    const [, period, r] = m;
    const rank = Number(r) as 1 | 2 | 3;
    const eyebrow =
      period === "yearly"
        ? rank === 1
          ? `${input.year ?? new Date().getUTCFullYear()} CHAMPION`
          : `#${rank} PRODUCT OF ${input.year ?? new Date().getUTCFullYear()}`
        : period === "alltime"
        ? rank === 1
          ? "ALL-TIME #1 · HALL OF FAME"
          : `ALL-TIME #${rank} · HALL OF FAME`
        : `#${rank} ${PERIOD_LABEL[period]}`;
    return { kind: "medal", rank, period: period as Period, eyebrow, title: "wordmark", metric: input.votes != null, wide: true };
  }
  if (award === "revenue" && input.revenue) {
    return { kind: "revenue", eyebrow: "VERIFIED REVENUE · THE LAUNCH FEED", title: input.revenue, metric: false, wide: true };
  }
  if (award === "upvote") {
    return { kind: "upvote", eyebrow: "UPVOTED BY MAKERS ON", title: "wordmark", metric: input.votes != null, wide: true };
  }
  if (input.featured) {
    return { kind: "matrix", eyebrow: "FEATURED ON", title: "wordmark", metric: false, wide: false };
  }
  // Compact (220px) badge: votes ride in the eyebrow so the wordmark keeps its room.
  const votes = input.votes != null ? ` · ${compactVotes(input.votes)} UPVOTES` : "";
  return { kind: "matrix", eyebrow: `LAUNCHED ON${votes}`, title: "wordmark", metric: false, wide: false };
}

/* ─────────── award emblems: shape = period depth, metal = rank ─────────── */

const C = 24; // emblem centre (x and y) inside the 48px-high card

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rot = -90) {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(" ");
}

/** Leaf ellipses along an arc — the laurel wreath of the hall of fame. */
function laurel(cx: number, cy: number, radius: number, angles: number[], fill: string) {
  return angles
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      return `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="3.4" ry="1.55" transform="rotate(${(deg + 90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${fill}"/>`;
    })
    .join("");
}

function awardEmblem(period: Period, rank: 1 | 2 | 3, theme: BadgeTheme, uid: string): string {
  const mono = theme === "minimal" || theme === "signal";
  const medal = MEDALS[rank];
  const g = `${uid}-metal`;
  const fill = mono ? (theme === "signal" ? "#FFFFFF" : "#111111") : `url(#${g})`;
  const ink = mono ? (theme === "signal" ? "#E84800" : "#FFFFFF") : medal.ink;
  const ring = mono ? (theme === "signal" ? "#E84800" : "#FFFFFF") : medal.ring;
  const edge = mono ? "none" : "rgba(0,0,0,0.14)";
  const grad = mono
    ? ""
    : `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${medal.from}"/><stop offset="1" stop-color="${medal.to}"/></linearGradient>`;
  const num = (cy: number, size: number) =>
    `<text x="${C}" y="${(cy + size * 0.36).toFixed(2)}" text-anchor="middle" class="doto" font-size="${size}" fill="${ink}">${rank}</text>`;

  switch (period) {
    // Daily — sunrise disc: the 6:00 AM drop.
    case "daily": {
      const cy = 26;
      const rays = [-150, -120, -90, -60, -30]
        .map((deg) => {
          const a = (deg * Math.PI) / 180;
          return `<line x1="${(C + 14.5 * Math.cos(a)).toFixed(2)}" y1="${(cy + 14.5 * Math.sin(a)).toFixed(2)}" x2="${(C + 17.5 * Math.cos(a)).toFixed(2)}" y2="${(cy + 17.5 * Math.sin(a)).toFixed(2)}" stroke="${mono ? fill : medal.to}" stroke-width="1.6" stroke-linecap="round"/>`;
        })
        .join("");
      return `${grad}${rays}
        <circle cx="${C}" cy="${cy}" r="12" fill="${fill}" stroke="${edge}"/>
        <circle cx="${C}" cy="${cy}" r="9.8" fill="none" stroke="${ring}" stroke-opacity="0.55"/>
        ${num(cy, 14)}`;
    }
    // Weekly — shield: held the line for seven days.
    case "weekly": {
      const d = "M24 8.5 L37 12.8 V22.5 C37 30.5 31.5 36.2 24 39.5 C16.5 36.2 11 30.5 11 22.5 V12.8 Z";
      return `${grad}
        <path d="${d}" fill="${fill}" stroke="${edge}"/>
        <path d="${d}" fill="none" stroke="${ring}" stroke-opacity="0.55" transform="translate(24 24) scale(0.8) translate(-24 -24)"/>
        ${num(23.5, 14)}`;
    }
    // Monthly — eight-point rosette: a decorated achievement.
    case "monthly": {
      return `${grad}
        <polygon points="${starPoints(C, C, 16, 12.6, 8, -90)}" fill="${fill}" stroke="${edge}" stroke-linejoin="round"/>
        <circle cx="${C}" cy="${C}" r="9" fill="none" stroke="${ring}" stroke-opacity="0.6"/>
        ${num(C, 13)}`;
    }
    // Yearly — crowned plate: royalty of the year.
    case "yearly": {
      const crown = "M12.5 18 L13.6 9.5 L19 14 L24 7 L29 14 L34.4 9.5 L35.5 18 Z";
      return `${grad}
        <path d="${crown}" fill="${fill}" stroke="${edge}" stroke-linejoin="round"/>
        <circle cx="13.6" cy="9.3" r="1.4" fill="${fill}"/><circle cx="24" cy="6.8" r="1.5" fill="${fill}"/><circle cx="34.4" cy="9.3" r="1.4" fill="${fill}"/>
        <rect x="11" y="18.5" width="26" height="21" rx="5" fill="${fill}" stroke="${edge}"/>
        <rect x="13" y="20.5" width="22" height="17" rx="3.6" fill="none" stroke="${ring}" stroke-opacity="0.55"/>
        ${num(29, 13)}`;
    }
    // All-time — laurel wreath around a gem, crowned by a star: hall of fame.
    case "alltime": {
      const leaf = mono ? fill : medal.to;
      const left = [105, 130, 155, 180, 205];
      const right = left.map((a) => 180 - a);
      return `${grad}
        ${laurel(C, 25, 13.6, left, leaf)}${laurel(C, 25, 13.6, right, leaf)}
        <polygon points="${starPoints(C, 7.6, 3.6, 1.5, 5, -90)}" fill="${leaf}"/>
        <circle cx="${C}" cy="25" r="9" fill="${fill}" stroke="${edge}"/>
        <circle cx="${C}" cy="25" r="7.2" fill="none" stroke="${ring}" stroke-opacity="0.6"/>
        ${num(25, 12)}`;
    }
  }
}

function emblem(r: Resolved, p: Palette, theme: BadgeTheme, uid: string): string {
  const x = 8;
  const y = 8;
  const s = 32;
  if (r.kind === "medal" && r.rank && r.period) {
    return awardEmblem(r.period, r.rank, theme, uid);
  }
  const tile = `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="9" fill="${p.accentSoft}"/>`;
  if (r.kind === "upvote") {
    return `${tile}<path d="M${x + 16} ${y + 9} L${x + 24} ${y + 21} H${x + 8} Z" fill="${p.accent}"/>`;
  }
  if (r.kind === "revenue") {
    const green = theme === "signal" || theme === "minimal" ? p.accent : "#00A866";
    const soft = theme === "signal" || theme === "minimal" ? p.accentSoft : theme === "dark" ? "#0C2A1E" : "#E6F7EF";
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="9" fill="${soft}"/>
    <path d="M${x + 9.5} ${y + 16.5} l4.5 4.5 l8.5 -9" fill="none" stroke="${green}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // Brand 4-square matrix with the stepped 100 / 85 / 65 / 35 % signal.
  const o = x + 8;
  const q = y + 8;
  return `${tile}
    <rect x="${o}" y="${q}" width="7" height="7" rx="1.2" fill="${p.accent}"/>
    <rect x="${o + 9}" y="${q}" width="7" height="7" rx="1.2" fill="${p.accent}" fill-opacity="0.85"/>
    <rect x="${o}" y="${q + 9}" width="7" height="7" rx="1.2" fill="${p.accent}" fill-opacity="0.65"/>
    <rect x="${o + 9}" y="${q + 9}" width="7" height="7" rx="1.2" fill="${p.accent}" fill-opacity="0.35"/>`;
}

export function renderBadge(input: BadgeInput): { svg: string; width: number; height: number; label: string } {
  const theme: BadgeTheme = (["light", "dark", "signal", "minimal"].includes(input.theme) ? input.theme : "dark") as BadgeTheme;
  const p = PALETTES[theme];
  const r = resolve(input);
  const width = r.wide ? 284 : 220;
  const height = 48;
  const uid = `tlf${r.kind}${r.period ?? ""}${r.rank ?? ""}${theme}`;

  const textX = 50;
  const metricW = r.metric ? 54 : 0;
  const textMax = width - textX - (r.metric ? metricW + 10 : 12);

  const eyebrowSize = 7.6;
  const eyebrowTrack = 1.1;
  const eyebrow = `<text x="${textX}" y="20" class="mono" font-size="${eyebrowSize}" letter-spacing="${eyebrowTrack}" fill="${p.dim}"${fit(r.eyebrow, eyebrowSize, MONO_ADV, eyebrowTrack, textMax)}>${esc(r.eyebrow)}</text>`;

  let title: string;
  if (r.title === "wordmark") {
    const size = r.wide ? 13.5 : 12;
    title = `<text x="${textX}" y="36" class="doto" font-size="${size}" letter-spacing="0.6" fill="${p.ink}"${fit("THE LAUNCH FEED", size, DOTO_ADV, 0.6, textMax)}>THE LAUNCH <tspan fill="${p.accent}">FEED</tspan></text>`;
  } else {
    const size = 14;
    title = `<text x="${textX}" y="36" class="doto" font-size="${size}" letter-spacing="0.4" fill="${p.ink}"${fit(r.title, size, DOTO_ADV, 0.4, textMax)}>${esc(r.title)}</text>`;
  }

  let metric = "";
  if (r.metric) {
    const label = compactVotes(input.votes ?? 0);
    const cx = width - metricW / 2 - 6;
    const numW = label.length * 13 * DOTO_ADV;
    const startX = cx - (9 + 3 + numW) / 2; // ▲ (9px) + gap + number
    metric = `
    <line x1="${width - metricW - 8}" y1="11" x2="${width - metricW - 8}" y2="37" stroke="${p.divider}"/>
    <path d="M${startX} 30 L${startX + 4.5} 23 L${startX + 9} 30 Z" fill="${p.accent}"/>
    <text x="${startX + 12}" y="31" class="doto" font-size="13" fill="${p.ink}">${esc(label)}</text>
    <text x="${cx}" y="40.5" text-anchor="middle" class="mono" font-size="5.6" letter-spacing="0.9" fill="${p.dim}">UPVOTES</text>`;
  }

  // Prestige meter: 5 pips, lit up to the board's depth (day 1 … all-time 5).
  let pips = "";
  let frame = `stroke="${p.border}"`;
  let innerFrame = "";
  if (r.kind === "medal" && r.period && r.rank) {
    const tier = TIER[r.period];
    const mono = theme === "minimal" || theme === "signal";
    const lit = mono ? p.accent : MEDALS[r.rank].to;
    const pipW = 3.2;
    const gap = 1.8;
    const total = 5 * pipW + 4 * gap;
    const px = r.metric ? width - metricW / 2 - 6 - total / 2 : width - 12 - total;
    pips = Array.from({ length: 5 }, (_, i) =>
      `<rect x="${(px + i * (pipW + gap)).toFixed(2)}" y="${r.metric ? 8.5 : 22.4}" width="${pipW}" height="${pipW}" rx="0.8" fill="${i < tier ? lit : p.divider}"/>`
    ).join("");
    // Yearly + all-time cards get a metal frame; all-time a double "certificate" frame.
    if (!mono && tier >= 4) {
      frame = `stroke="${MEDALS[r.rank].to}" stroke-opacity="0.75"`;
      if (tier === 5) {
        innerFrame = `<rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="8.5" fill="none" stroke="${MEDALS[r.rank].from}" stroke-opacity="0.45"/>`;
      }
    }
  }

  const label =
    r.kind === "revenue" ? `${r.title} verified revenue on The Launch Feed` : `${r.eyebrow.toLowerCase()} The Launch Feed`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
  <title>${esc(label)}</title>
  <defs>
    <style>
      @font-face { font-family: 'Doto'; font-weight: 900; src: url('data:font/woff;base64,${DOTO_FONT_BASE64}') format('woff'); }
      .doto { font-family: 'Doto', ui-monospace, Menlo, monospace; font-weight: 900; text-transform: uppercase; }
      .mono { font-family: ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace; font-weight: 700; }
    </style>
    <linearGradient id="${uid}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bg}"/>
      <stop offset="1" stop-color="${p.bg2}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="11" fill="url(#${uid}-bg)" ${frame}/>
  ${innerFrame}
  ${emblem(r, p, theme, uid)}
  ${eyebrow}
  ${title}
  ${metric}
  ${pips}
</svg>`;

  return { svg, width, height, label };
}
