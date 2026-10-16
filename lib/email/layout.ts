/**
 * Shared layout for every email The Launch Feed sends.
 *
 * Templates describe their content as data (EmailContent); renderEmail turns
 * that into email-client-safe HTML (tables, inline styles, 600px max width,
 * a prefers-color-scheme dark override) plus a matching plain-text body, so
 * the two versions never drift apart.
 *
 * Every link goes through absUrl(), which builds it from NEXT_PUBLIC_APP_URL.
 * This file is imported by the admin preview (a client component), so it must
 * stay free of server-only code.
 */

const SITE_FALLBACK = "https://thelaunchfeed.com";

export const SUPPORT_EMAIL = "hi@thelaunchfeed.com";

export const COMMUNITY_LINKS = [
  { label: "WhatsApp", url: "https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U" },
  { label: "Telegram", url: "https://t.me/thelaunchfeed" },
  { label: "Bluesky", url: "https://bsky.app/profile/thelaunchfeed.bsky.social" },
];

/** Site origin without a trailing slash. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || SITE_FALLBACK).replace(/\/+$/, "");
}

/** Absolute URL for a site path; full http(s)/mailto URLs pass through. */
export function absUrl(href: string): string {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  return `${appUrl()}/${href.replace(/^\/+/, "")}`;
}

/* ─────────── palette (mirrors app/globals.css) ─────────── */

const C = {
  canvas: "#F3F2EF",
  card: "#FFFFFF",
  panel: "#FAF9F7",
  hairline: "#E5E3DE",
  ink: "#111111",
  body: "#2B2A26",
  dim: "#57564F",
  faint: "#8D8B84",
  signal: "#D14000",
  signalDim: "#FFEFE6",
  verified: "#00875A",
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/* ─────────── content model ─────────── */

export type Tone = "signal" | "verified" | "neutral";

export interface EmailLink {
  label: string;
  /** Site path ("/profile") or absolute URL. */
  url: string;
}

export interface EmailContent {
  /** Inbox preview line shown after the subject. */
  preheader: string;
  /** Small uppercase label above the heading ("Submission received"). */
  eyebrow?: string;
  eyebrowTone?: Tone;
  heading: string;
  /** Plain text; **double asterisks** mark bold. Variables are escaped. */
  intro: string[];
  /** Large monospace value, e.g. a one-time code. */
  code?: { value: string; caption?: string };
  details?: [string, string][];
  /** Boxed free-form text (reviewer notes, a custom message). */
  callout?: { title: string; body: string; tone?: Tone };
  table?: { title: string; rows: { name: string; tagline: string; value: string }[] };
  list?: { title: string; items: string[] };
  /** The one primary button. */
  cta?: EmailLink;
  /** Quieter text links shown under the button. */
  secondary?: EmailLink[];
  /** Short paragraphs after the call to action. */
  outro?: string[];
  /** Why the recipient got this email (footer). */
  reason: string;
  /** Show the unsubscribe link (non-essential mail only). */
  unsubscribe?: boolean;
  /** Show the community channel links in the footer. */
  community?: boolean;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/* ─────────── helpers ─────────── */

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then turn **x** into <strong>. */
function inline(s: string) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.ink};font-weight:600;" class="tlf-ink">$1</strong>`);
}

function plain(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1");
}

function toneColor(t: Tone | undefined) {
  return t === "verified" ? C.verified : t === "neutral" ? C.dim : C.signal;
}

function unsubscribeUrl() {
  return `mailto:${SUPPORT_EMAIL}?subject=Unsubscribe`;
}

function sectionTitle(text: string) {
  return `<p class="tlf-dim" style="margin:0 0 10px;font-family:${MONO};font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.dim};">${esc(text)}</p>`;
}

/** Full-width row inside the card with standard side padding. */
function row(inner: string, padding = "0 40px 24px") {
  return `<tr><td class="tlf-pad" style="padding:${padding};">${inner}</td></tr>`;
}

function logoMark() {
  const sq = (color: string) =>
    `<td width="9" height="9" bgcolor="${color}" style="width:9px;height:9px;background-color:${color};font-size:0;line-height:0;">&nbsp;</td>`;
  const gap = `<td width="2" style="width:2px;font-size:0;line-height:0;">&nbsp;</td>`;
  // #FF4F00 at 100/85/65/35% over white, matching app/icon.svg.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr>${sq("#FF4F00")}${gap}${sq("#FF6926")}</tr>
    <tr><td colspan="3" height="2" style="height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>${sq("#FF8D59")}${gap}${sq("#FFC1A6")}</tr>
  </table>`;
}

/* ─────────── HTML ─────────── */

function renderHtml(c: EmailContent): string {
  const parts: string[] = [];

  // Heading block
  const eyebrow = c.eyebrow
    ? `<p style="margin:0 0 12px;font-family:${MONO};font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${toneColor(c.eyebrowTone)};">${esc(c.eyebrow)}</p>`
    : "";
  const intro = c.intro
    .map(
      (para) =>
        `<p class="tlf-body" style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.body};">${inline(para)}</p>`
    )
    .join("");
  parts.push(
    row(
      `${eyebrow}<h1 class="tlf-ink tlf-h1" style="margin:0 0 16px;font-family:${SANS};font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">${esc(c.heading)}</h1>${intro}`,
      "36px 40px 8px"
    )
  );

  if (c.code) {
    parts.push(
      row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tlf-panel" style="background-color:${C.panel};border:1px solid ${C.hairline};border-radius:10px;">
        <tr><td align="center" style="padding:22px 16px;">
          <p class="tlf-ink" style="margin:0;font-family:${MONO};font-size:34px;line-height:40px;font-weight:700;letter-spacing:0.3em;color:${C.ink};">${esc(c.code.value)}</p>
          ${c.code.caption ? `<p class="tlf-dim" style="margin:8px 0 0;font-family:${SANS};font-size:13px;line-height:18px;color:${C.dim};">${esc(c.code.caption)}</p>` : ""}
        </td></tr>
      </table>`)
    );
  }

  if (c.details?.length) {
    const trs = c.details
      .map(
        ([k, v], i) => `<tr>
          <td class="tlf-dim tlf-line" style="padding:11px 16px;${i ? `border-top:1px solid ${C.hairline};` : ""}font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${C.dim};" valign="top">${esc(k)}</td>
          <td class="tlf-ink tlf-line" align="right" style="padding:11px 16px;${i ? `border-top:1px solid ${C.hairline};` : ""}font-family:${SANS};font-size:14px;line-height:20px;font-weight:600;color:${C.ink};" valign="top">${esc(v)}</td>
        </tr>`
      )
      .join("");
    parts.push(
      row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tlf-panel" style="background-color:${C.panel};border:1px solid ${C.hairline};border-radius:10px;border-collapse:separate;">${trs}</table>`
      )
    );
  }

  if (c.callout) {
    const accent = toneColor(c.callout.tone);
    parts.push(
      row(`${sectionTitle(c.callout.title)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tlf-panel" style="background-color:${C.panel};border:1px solid ${C.hairline};border-radius:6px;">
          <tr><td width="3" bgcolor="${accent}" style="width:3px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td><td class="tlf-body" style="padding:14px 16px;font-family:${SANS};font-size:15px;line-height:24px;color:${C.body};white-space:pre-wrap;word-break:break-word;">${esc(c.callout.body)}</td></tr>
        </table>`)
    );
  }

  if (c.table?.rows.length) {
    const trs = c.table.rows
      .map(
        (r, i) => `<tr>
          <td class="tlf-dim tlf-line" width="28" style="padding:12px 0 12px 16px;${i ? `border-top:1px solid ${C.hairline};` : ""}font-family:${MONO};font-size:12px;line-height:20px;color:${C.faint};" valign="top">${i + 1}</td>
          <td class="tlf-line" style="padding:12px 8px;${i ? `border-top:1px solid ${C.hairline};` : ""}" valign="top">
            <p class="tlf-ink" style="margin:0;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:${C.ink};">${esc(r.name)}</p>
            <p class="tlf-dim" style="margin:2px 0 0;font-family:${SANS};font-size:13px;line-height:18px;color:${C.dim};">${esc(r.tagline)}</p>
          </td>
          <td class="tlf-ink tlf-line" align="right" style="padding:12px 16px 12px 8px;${i ? `border-top:1px solid ${C.hairline};` : ""}font-family:${MONO};font-size:13px;line-height:20px;font-weight:700;color:${C.ink};white-space:nowrap;" valign="top">${esc(r.value)}</td>
        </tr>`
      )
      .join("");
    parts.push(
      row(
        `${sectionTitle(c.table.title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tlf-panel" style="background-color:${C.panel};border:1px solid ${C.hairline};border-radius:10px;border-collapse:separate;">${trs}</table>`
      )
    );
  }

  if (c.list?.items.length) {
    const trs = c.list.items
      .map(
        (item) => `<tr>
          <td width="20" valign="top" style="padding:0 0 10px;font-family:${SANS};font-size:15px;line-height:24px;font-weight:700;color:${C.signal};">&rarr;</td>
          <td valign="top" class="tlf-body" style="padding:0 0 10px;font-family:${SANS};font-size:15px;line-height:24px;color:${C.body};">${inline(item)}</td>
        </tr>`
      )
      .join("");
    parts.push(
      row(`${sectionTitle(c.list.title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs}</table>`, "0 40px 14px")
    );
  }

  if (c.cta) {
    const href = esc(absUrl(c.cta.url));
    const secondary = c.secondary?.length
      ? `<p class="tlf-dim" style="margin:18px 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:${C.dim};">${c.secondary
          .map(
            (l) =>
              `<a href="${esc(absUrl(l.url))}" target="_blank" class="tlf-link" style="color:${C.signal};text-decoration:none;font-weight:600;">${esc(l.label)}&nbsp;&rarr;</a>`
          )
          .join(`<span style="color:${C.faint};">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`)}</p>`
      : "";
    parts.push(
      row(`<table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="tlf-btn" bgcolor="${C.signal}" style="border-radius:8px;background-color:${C.signal};">
            <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${esc(c.cta.label)}</a>
          </td></tr>
        </table>
        ${secondary}
        <p class="tlf-faint" style="margin:18px 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">Button not working? Paste this link into your browser:<br><a href="${href}" target="_blank" class="tlf-link" style="color:${C.signal};text-decoration:underline;word-break:break-all;">${esc(absUrl(c.cta.url))}</a></p>`,
        "8px 40px 28px")
    );
  }

  if (c.outro?.length) {
    parts.push(
      row(
        `<div class="tlf-line" style="border-top:1px solid ${C.hairline};padding-top:20px;">${c.outro
          .map(
            (para) =>
              `<p class="tlf-dim" style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:22px;color:${C.dim};">${inline(para)}</p>`
          )
          .join("")}</div>`,
        "0 40px 20px"
      )
    );
  }

  const footerLink = (label: string, url: string) =>
    `<a href="${esc(absUrl(url))}" target="_blank" class="tlf-dim" style="color:${C.dim};text-decoration:underline;">${esc(label)}</a>`;
  const dot = `&nbsp;&middot;&nbsp;`;
  const footerLinks = [
    footerLink("thelaunchfeed.com", "/"),
    footerLink("Account settings", "/profile"),
    `<a href="mailto:${SUPPORT_EMAIL}" class="tlf-dim" style="color:${C.dim};text-decoration:underline;">${SUPPORT_EMAIL}</a>`,
    ...(c.unsubscribe ? [footerLink("Unsubscribe", unsubscribeUrl())] : []),
  ].join(dot);
  const community = c.community
    ? `<p class="tlf-faint" style="margin:0 0 8px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">Join the community: ${COMMUNITY_LINKS.map((l) => footerLink(l.label, l.url)).join(dot)}</p>`
    : "";

  // The &zwnj;&nbsp; run after the preheader stops clients from pulling body
  // text into the inbox preview.
  const preheaderPad = "&zwnj;&nbsp;".repeat(60);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(c.heading)}</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  @media only screen and (max-width:620px) {
    .tlf-pad { padding-left:22px !important; padding-right:22px !important; }
    .tlf-h1 { font-size:23px !important; line-height:29px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .tlf-bg { background-color:#0B0B0D !important; }
    .tlf-card { background-color:#141417 !important; border-color:#26262B !important; }
    .tlf-panel { background-color:#1B1B1F !important; border-color:#2E2E34 !important; }
    .tlf-line { border-color:#2E2E34 !important; }
    .tlf-ink { color:#F4F4F5 !important; }
    .tlf-body { color:#D4D4D8 !important; }
    .tlf-dim { color:#A1A1AA !important; }
    .tlf-faint { color:#8B8B94 !important; }
    .tlf-link { color:#FF6A33 !important; }
    .tlf-btn { background-color:#E34A0F !important; }
  }
  [data-ogsc] .tlf-ink { color:#F4F4F5 !important; }
  [data-ogsc] .tlf-body { color:#D4D4D8 !important; }
  [data-ogsc] .tlf-dim { color:#A1A1AA !important; }
  [data-ogsb] .tlf-bg { background-color:#0B0B0D !important; }
  [data-ogsb] .tlf-card { background-color:#141417 !important; }
</style>
</head>
<body class="tlf-bg" style="margin:0;padding:0;background-color:${C.canvas};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(c.preheader)}${preheaderPad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tlf-bg" style="background-color:${C.canvas};">
  <tr><td align="center" style="padding:32px 12px 40px;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
      <tr><td style="padding:0 4px 18px;">
        <a href="${esc(absUrl("/"))}" target="_blank" style="text-decoration:none;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:10px;">${logoMark()}</td>
            <td valign="middle" class="tlf-ink" style="font-family:${MONO};font-size:15px;line-height:20px;font-weight:700;letter-spacing:0.08em;color:${C.ink};">THE LAUNCH <span style="color:${C.signal};">FEED</span></td>
          </tr></table>
        </a>
      </td></tr>
      <tr><td class="tlf-card" style="background-color:${C.card};border:1px solid ${C.hairline};border-radius:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${parts.join("\n          ")}
        </table>
      </td></tr>
      <tr><td style="padding:22px 8px 0;">
        <p class="tlf-faint" style="margin:0 0 8px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">${esc(c.reason)}</p>
        ${community}
        <p class="tlf-faint" style="margin:0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">${footerLinks}</p>
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>`;
}

/* ─────────── plain text ─────────── */

function renderText(c: EmailContent): string {
  const out: string[] = ["THE LAUNCH FEED", ""];
  if (c.eyebrow) out.push(c.eyebrow.toUpperCase(), "");
  out.push(c.heading, "=".repeat(Math.min(c.heading.length, 60)), "");
  for (const para of c.intro) out.push(plain(para), "");

  if (c.code) {
    out.push(`    ${c.code.value}`, "");
    if (c.code.caption) out.push(c.code.caption, "");
  }
  if (c.details?.length) {
    for (const [k, v] of c.details) out.push(`${k}: ${v}`);
    out.push("");
  }
  if (c.callout) out.push(`${c.callout.title}:`, c.callout.body, "");
  if (c.table?.rows.length) {
    out.push(`${c.table.title}:`);
    c.table.rows.forEach((r, i) => out.push(`${i + 1}. ${r.name} (${r.value}) - ${r.tagline}`));
    out.push("");
  }
  if (c.list?.items.length) {
    out.push(`${c.list.title}:`);
    for (const item of c.list.items) out.push(`- ${plain(item)}`);
    out.push("");
  }
  if (c.cta) {
    out.push(`${c.cta.label}: ${absUrl(c.cta.url)}`, "");
    for (const l of c.secondary ?? []) out.push(`${l.label}: ${absUrl(l.url)}`);
    if (c.secondary?.length) out.push("");
  }
  for (const para of c.outro ?? []) out.push(plain(para), "");

  out.push("--", c.reason);
  if (c.community) out.push(`Community: ${COMMUNITY_LINKS.map((l) => `${l.label} ${l.url}`).join(" | ")}`);
  out.push(`${absUrl("/")} | Account settings: ${absUrl("/profile")} | ${SUPPORT_EMAIL}`);
  if (c.unsubscribe) out.push(`Unsubscribe: reply with "unsubscribe" or email ${SUPPORT_EMAIL}`);
  return out.join("\n");
}

export function renderEmail(c: EmailContent): RenderedEmail {
  return { html: renderHtml(c), text: renderText(c) };
}
