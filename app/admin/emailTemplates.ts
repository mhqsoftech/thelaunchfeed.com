/**
 * Email templates for The Launch Feed.
 * Table-based HTML, inline styles, mail-client-safe. Mirrors the site:
 * off-white canvas, hairline borders, mono typography, signal-red accent,
 * verified-green check. Every template ships with a preheader, structured
 * body copy, one or more CTAs, divider blocks, and official community channels.
 */

export type EmailTemplateId =
  | "welcome"
  | "product-submitted"
  | "product-approved"
  | "product-rejected"
  | "product-launched"
  | "rank-top3"
  | "rank-first"
  | "weekly-digest"
  | "featured-expiring"
  | "revenue-verified"
  | "comment-received"
  | "custom-broadcast"
  | "directory-founder-invite";

export type EmailTrigger =
  | "manual"
  | "on-signup"
  | "on-submit"
  | "on-approve"
  | "on-reject"
  | "on-launch"
  | "on-rank-change"
  | "on-rank-first"
  | "weekly-cron"
  | "on-slot-expiring"
  | "on-revenue-verified"
  | "on-comment"
  | "on-directory-crawl";

export interface EmailTemplate {
  id: EmailTemplateId;
  name: string;
  description: string;
  trigger: EmailTrigger;
  auto: boolean;
  subject: (v: TemplateVars) => string;
  render: (v: TemplateVars) => string;
}

export interface TemplateVars {
  [key: string]: unknown;
  userName?: string;
  userEmail?: string;
  founderName?: string;
  sourceDirectory?: string;
  productName?: string;
  productSlug?: string;
  rank?: number;
  period?: "daily" | "weekly" | "monthly";
  revenueLabel?: string;
  slotExpiresOn?: string;
  rejectionReason?: string;
  digestItems?: { name: string; tagline: string; votes: number }[];
  customBody?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

const BASE_URL = "https://thelaunchfeed.com";
const INK = "#0a0a0a";
const INK_DIM = "#5f5f5c";
const HAIRLINE = "#e5e5e2";
const CANVAS = "#f4f4f2";
const SIGNAL = "#D6002A";
const VERIFIED = "#00D97E";

const WHATSAPP_URL = "https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U";
const TELEGRAM_URL = "https://t.me/thelaunchfeed";
const X_URL = "https://bsky.app/profile/thelaunchfeed.bsky.social";

/* ─────────── primitives & icons ─────────── */

function esc(s: string | undefined) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whatsappSvg(color = INK) {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="${color}" style="display:inline-block;vertical-align:-1.5px;margin-right:5px;"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.68-1.2 1.26-1.66 1.32-.44.06-1.01.09-3.26-.84-2.73-1.13-4.48-3.9-4.62-4.08-.13-.19-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.24-.27.54-.34.72-.34.18 0 .36 0 .52.01.17.01.4.06.62.53.24.51.81 1.98.88 2.12.07.15.12.32.02.51-.09.19-.14.3-.29.47-.15.17-.31.38-.45.51-.15.15-.3.31-.13.61.17.3 1.05 1.74 2.26 2.82 1.55 1.38 2.86 1.81 3.27 2.01.41.2.65.17.89-.1.24-.27 1.03-1.2 1.3-1.61.27-.41.54-.34.91-.2.37.14 2.37 1.12 2.78 1.32.41.2.68.3.78.47.1.18.1.99-.14 1.67z"/></svg>`;
}

function telegramSvg(color = INK) {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="${color}" style="display:inline-block;vertical-align:-1.5px;margin-right:5px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>`;
}

function xTwitterSvg(color = INK) {
  // Bluesky logo — replaces X/Twitter as our primary auto-broadcast channel.
  return `<svg width="11" height="11" viewBox="0 0 600 530" fill="${color}" style="display:inline-block;vertical-align:-1.5px;margin-right:5px;"><path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.26-54.316 97.782-155.54 164.28-205.463C512.26 8.024 590 -19.44 590 69.24c0 17.7-10.15 148.79-16.11 170.07-20.68 73.94-96.14 92.86-163.23 81.42 117.3 19.95 147.16 86.06 82.72 152.16-122.34 125.55-175.83-31.51-189.53-71.76-2.51-7.38-3.68-10.83-3.85-7.88-.17-2.95-1.34.5-3.85 7.88-13.7 40.26-67.19 197.31-189.53 71.76-64.44-66.1-34.58-132.21 82.72-152.16-67.09 11.44-142.55-7.48-163.22-81.42C20.15 217.99 10 86.9 10 69.24c0-88.68 77.74-61.216 125.72-25.21z"/></svg>`;
}

function pulseDot(color = SIGNAL) {
  return `<span style="display:inline-block;width:7px;height:7px;background:${color};border-radius:50%;vertical-align:middle;margin-right:6px;"></span>`;
}

function shell(inner: string, preheader = "") {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Launch Feed</title></head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${HAIRLINE};">
      <tr><td style="padding:18px 24px;border-bottom:1px solid ${HAIRLINE};">
        <table role="presentation" width="100%"><tr>
          <td style="font-size:13px;font-weight:700;letter-spacing:.02em;">
            ${pulseDot(SIGNAL)}
            THE LAUNCH FEED
          </td>
          <td align="right" style="font-size:10px;text-transform:uppercase;color:${INK_DIM};">daily · weekly · monthly</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 24px;">${inner}</td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid ${HAIRLINE};font-size:10px;color:${INK_DIM};text-transform:uppercase;line-height:1.6;">
        <table role="presentation" width="100%" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid ${HAIRLINE};">
          <tr>
            <td style="font-size:10px;color:${INK_DIM};text-transform:uppercase;">
              Official Channels:
              <a href="${WHATSAPP_URL}" target="_blank" style="color:${INK};font-weight:700;text-decoration:none;margin-left:4px;">${whatsappSvg(INK)}WhatsApp</a> ·
              <a href="${TELEGRAM_URL}" target="_blank" style="color:${INK};font-weight:700;text-decoration:none;margin-left:4px;">${telegramSvg(INK)}Telegram</a> ·
              <a href="${X_URL}" target="_blank" style="color:${INK};font-weight:700;text-decoration:none;margin-left:4px;">${xTwitterSvg(INK)}@thelaunchfeed.bsky.social</a>
            </td>
          </tr>
        </table>
        <a href="${BASE_URL}" style="color:${INK};text-decoration:none;">thelaunchfeed.com</a> ·
        <a href="${BASE_URL}/profile" style="color:${INK};text-decoration:none;">manage preferences</a> ·
        <a href="${BASE_URL}/unsubscribe" style="color:${INK_DIM};text-decoration:none;">unsubscribe</a><br>
        <span style="text-transform:none;">You're receiving this because you have a Launch Feed account.
        Reply to this email if you'd rather not.</span>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function h1(text: string, color = INK) {
  return `<h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;font-weight:700;color:${color};">${esc(text)}</h1>`;
}
function h2(text: string) {
  return `<h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${INK_DIM};margin:24px 0 8px;font-weight:700;">${esc(text)}</h2>`;
}
function p(text: string) {
  return `<p style="font-size:13px;line-height:1.65;color:#2b2b28;margin:0 0 14px;">${text}</p>`;
}
function tag(text: string, color = INK) {
  return `<span style="display:inline-block;font-size:10px;text-transform:uppercase;font-weight:700;padding:3px 6px;border:1px solid ${color};color:${color};margin-right:6px;">${esc(text)}</span>`;
}
function divider() {
  return `<div style="height:1px;background:${HAIRLINE};margin:22px 0;"></div>`;
}
function primaryBtn(label: string, href: string) {
  return `<a href="${esc(href)}" style="display:inline-block;padding:11px 18px;background:${INK};color:#ffffff;text-decoration:none;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;border:1px solid ${INK};margin:2px 6px 2px 0;">${esc(label)} →</a>`;
}
function ghostBtn(label: string, href: string) {
  return `<a href="${esc(href)}" style="display:inline-block;padding:11px 18px;background:#ffffff;color:${INK};text-decoration:none;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;border:1px solid ${HAIRLINE};margin:2px 6px 2px 0;">${esc(label)}</a>`;
}
function signalBtn(label: string, href: string) {
  return `<a href="${esc(href)}" style="display:inline-block;padding:11px 18px;background:${SIGNAL};color:#ffffff;text-decoration:none;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;border:1px solid ${SIGNAL};margin:2px 6px 2px 0;">${esc(label)} →</a>`;
}
function keyValueBlock(rows: [string, string][]) {
  const trs = rows
    .map(
      ([k, v], i) => `
      <tr>
        <td style="padding:10px 12px;font-size:10px;text-transform:uppercase;color:${INK_DIM};${i > 0 ? `border-top:1px solid ${HAIRLINE};` : ""}">${esc(k)}</td>
        <td align="right" style="padding:10px 12px;font-size:13px;font-weight:700;color:${INK};${i > 0 ? `border-top:1px solid ${HAIRLINE};` : ""}">${esc(v)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" style="border:1px solid ${HAIRLINE};margin:8px 0 18px;">${trs}</table>`;
}
function checklist(items: string[]) {
  return `<ul style="list-style:none;padding:0;margin:0 0 18px;">
    ${items
      .map(
        (i) =>
          `<li style="font-size:12.5px;color:#2b2b28;line-height:1.6;padding:6px 0 6px 22px;position:relative;">
             <span style="position:absolute;left:0;top:6px;font-weight:700;color:${INK};">→</span>${esc(i)}
           </li>`
      )
      .join("")}
  </ul>`;
}
function tips(title: string, items: string[]) {
  return `<div style="border:1px solid ${HAIRLINE};padding:16px 18px;margin:0 0 18px;">
    <div style="font-size:10px;text-transform:uppercase;color:${INK_DIM};font-weight:700;margin-bottom:8px;">${esc(title)}</div>
    ${checklist(items)}
  </div>`;
}

function communityChannelsBlock(title = "Join Official Channels For Live Updates") {
  return `
  <div style="border:1px solid ${HAIRLINE};background:#fafaf8;padding:16px 18px;margin:22px 0 16px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${INK_DIM};margin-bottom:6px;letter-spacing:.05em;">
      ${pulseDot(SIGNAL)}${esc(title)}
    </div>
    <p style="font-size:12px;line-height:1.5;color:#2b2b28;margin:0 0 12px;">
      Join our official founder channels to track daily drops, get live product updates, and connect with fellow makers:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:3px 4px 3px 0;" valign="middle">
          <a href="${WHATSAPP_URL}" target="_blank" style="display:inline-block;padding:8px 12px;background:#ffffff;border:1px solid ${VERIFIED};color:#0a0a0a;text-decoration:none;font-size:11px;font-weight:700;border-radius:3px;">
            ${whatsappSvg("#0a0a0a")}WhatsApp Community ↗
          </a>
        </td>
        <td style="padding:3px 4px 3px 0;" valign="middle">
          <a href="${TELEGRAM_URL}" target="_blank" style="display:inline-block;padding:8px 12px;background:#ffffff;border:1px solid ${HAIRLINE};color:#0a0a0a;text-decoration:none;font-size:11px;font-weight:700;border-radius:3px;">
            ${telegramSvg("#0a0a0a")}Telegram Channel ↗
          </a>
        </td>
        <td style="padding:3px 0;" valign="middle">
          <a href="${X_URL}" target="_blank" style="display:inline-block;padding:8px 12px;background:#ffffff;border:1px solid ${HAIRLINE};color:#0a0a0a;text-decoration:none;font-size:11px;font-weight:700;border-radius:3px;">
            ${xTwitterSvg("#0a0a0a")}Follow @thelaunchfeed.bsky.social ↗
          </a>
        </td>
      </tr>
    </table>
  </div>`;
}

function renderEmailBadge({
  theme,
  productSlug,
  productName,
}: {
  theme: "dark" | "light" | "signal";
  productSlug: string;
  productName: string;
}) {
  const targetUrl = `${BASE_URL}/product/${esc(productSlug)}`;

  if (theme === "dark") {
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="font-size:10px;font-family:ui-monospace,Menlo,monospace;color:#71717a;text-transform:uppercase;padding-bottom:5px;letter-spacing:1px;font-weight:700;">
          1. Dark Obsidian Badge
        </td>
      </tr>
      <tr>
        <td>
          <a href="${targetUrl}" target="_blank" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#090A0C;border:1px solid #27272a;border-radius:4px;padding:12px 16px;">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:9px;font-family:ui-monospace,Menlo,monospace;color:#a1a1aa;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:2px;">
                    LAUNCHED ON
                  </div>
                  <div style="font-size:14px;font-family:ui-monospace,Menlo,monospace;font-weight:800;color:#ffffff;letter-spacing:0.5px;">
                    THE LAUNCH FEED
                  </div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 10px;background:#18181b;border:1px solid #00D97E;color:#00D97E;font-size:10px;font-weight:800;font-family:ui-monospace,Menlo,monospace;text-transform:uppercase;border-radius:3px;letter-spacing:0.5px;">
                    ▲ FEATURED · LIVE ↗
                  </span>
                </td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
    </table>`;
  }

  if (theme === "light") {
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="font-size:10px;font-family:ui-monospace,Menlo,monospace;color:#71717a;text-transform:uppercase;padding-bottom:5px;letter-spacing:1px;font-weight:700;">
          2. Clean Light Badge
        </td>
      </tr>
      <tr>
        <td>
          <a href="${targetUrl}" target="_blank" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:4px;padding:12px 16px;">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:9px;font-family:ui-monospace,Menlo,monospace;color:#71717a;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:2px;">
                    FEATURED LAUNCH ON
                  </div>
                  <div style="font-size:14px;font-family:ui-monospace,Menlo,monospace;font-weight:800;color:#09090b;letter-spacing:0.5px;">
                    THE LAUNCH FEED
                  </div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 10px;background:#f4f4f5;border:1px solid #09090b;color:#09090b;font-size:10px;font-weight:800;font-family:ui-monospace,Menlo,monospace;text-transform:uppercase;border-radius:3px;letter-spacing:0.5px;">
                    ▲ FEATURED · LIVE ↗
                  </span>
                </td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
    </table>`;
  }

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:10px;font-family:ui-monospace,Menlo,monospace;color:#71717a;text-transform:uppercase;padding-bottom:5px;letter-spacing:1px;font-weight:700;">
        3. Electric Signal Badge
      </td>
    </tr>
    <tr>
      <td>
        <a href="${targetUrl}" target="_blank" style="text-decoration:none;display:block;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#00D97E;border:1px solid #00b368;border-radius:4px;padding:12px 16px;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:9px;font-family:ui-monospace,Menlo,monospace;color:#043c24;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-bottom:2px;">
                  LIVE TODAY ON
                </div>
                <div style="font-size:14px;font-family:ui-monospace,Menlo,monospace;font-weight:900;color:#000000;letter-spacing:0.5px;">
                  THE LAUNCH FEED
                </div>
              </td>
              <td align="right" style="vertical-align:middle;">
                <span style="display:inline-block;padding:5px 10px;background:#000000;color:#00D97E;font-size:10px;font-weight:800;font-family:ui-monospace,Menlo,monospace;text-transform:uppercase;border-radius:3px;letter-spacing:0.5px;">
                  ▲ VOTE NOW ↗
                </span>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>
  </table>`;
}

/* ─────────── templates ─────────── */

export const TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome",
    description: "Sent when a new user signs up. Onboards them into the leaderboards.",
    trigger: "on-signup",
    auto: true,
    subject: (v) => `Welcome to The Launch Feed, ${v.userName ?? "maker"}`,
    render: (v) =>
      shell(
        `
        ${tag("New account", SIGNAL)}${tag("Onboarding")}
        ${h1(`Welcome, ${v.userName ?? "maker"}.`)}
        ${p(
          `You now have a founder profile on The Launch Feed — a minimal, three-board leaderboard for indie software launches. Every product competes on <b>Today</b>, <b>This Week</b>, and <b>This Month</b> in parallel, and top finishers are archived in the annual Hall of Fame.`
        )}
        ${p(`Here's how to get the most out of your first week.`)}

        ${h2("Get to #1 — the playbook")}
        ${checklist([
          "Submit your product with a sharp 60-character tagline and one clean screenshot.",
          "Schedule your launch for a slot when your audience is awake (Tue–Thu 12:00 UTC works best).",
          "Line up 20+ friendly upvoters for the first six hours — that window sets the ranking curve.",
          "Reply to every comment on launch day. Engagement is scored, not just votes.",
          "Connect your Stripe / Polar / LemonSqueezy account to unlock the verified revenue badge.",
        ])}

        ${h2("Your next step")}
        ${primaryBtn("Submit your first product", `${BASE_URL}/submit`)}
        ${ghostBtn("Browse the daily board", `${BASE_URL}`)}

        ${communityChannelsBlock("Join our Founder Community")}

        ${divider()}
        ${h2("Account details")}
        ${keyValueBlock([
          ["Email", v.userEmail ?? "—"],
          ["Handle", v.userName ? `@${v.userName.toLowerCase().replace(/\s+/g, "_")}` : "—"],
          ["Profile", "PUBLIC BY DEFAULT"],
        ])}
        ${p(
          `You can change any of these — including hiding revenue or making your profile private — from your <a href="${BASE_URL}/profile" style="color:${INK};">profile settings</a>.`
        )}
      `,
        "Your founder account is ready — let's ship your first launch."
      ),
  },
  {
    id: "product-submitted",
    name: "Submission received",
    description: "Confirms a submission is queued and explains the review + release timing.",
    trigger: "on-submit",
    auto: true,
    subject: (v) => `${v.productName ?? "Your product"} is queued for launch`,
    render: (v) =>
      shell(
        `
        ${tag("Submission")}${tag("Pending review", SIGNAL)}
        ${h1("You're in the queue.")}
        ${p(
          `Thanks for submitting <b>${esc(v.productName)}</b>. Our moderation team reviews every submission for basic quality (working link, real product, no spam) and then releases it into the daily launchpad at the scheduled time below.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Founder", v.userName ?? "—"],
          ["Status", "QUEUED FOR REVIEW"],
          ["Scheduled release", v.slotExpiresOn ?? "Within 24h"],
        ])}

        ${h2("What happens next")}
        ${checklist([
          "We review your submission within a few hours. If anything's unclear, we email you back.",
          "At the scheduled release time, your product appears on the Today board and starts collecting votes.",
          "You'll get a launch email the moment it goes live, plus rank-change notifications if you hit the top three.",
        ])}

        ${primaryBtn("View submission status", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("Edit submission", `${BASE_URL}/submit`)}

        ${communityChannelsBlock("Join the Channels to Track Your Launch")}

        ${divider()}
        ${tips("While you wait — sharpen the launch", [
          "Draft the tweet you'll post the moment it goes live. Include the leaderboard link.",
          "Pre-warm your community — Slack, Discord, mailing list. Tell them the launch time in their timezone.",
          "Set up a dedicated landing page for launch day traffic (higher conversion than sending people to the app root).",
        ])}
      `,
        `Your ${v.productName ?? "product"} submission is in the queue.`
      ),
  },
  {
    id: "product-approved",
    name: "Submission approved",
    description: "Sent when a product clears moderation and is locked into a slot.",
    trigger: "on-approve",
    auto: true,
    subject: (v) => `Approved: ${v.productName} launches ${v.slotExpiresOn ?? "soon"}`,
    render: (v) =>
      shell(
        `
        ${tag("Approved", VERIFIED)}${tag("Scheduled")}
        ${h1("Cleared for launch.")}
        ${p(
          `<b>${esc(v.productName)}</b> passed moderation and is locked into its launch slot. Once the countdown hits zero, it enters the Today board and every registered maker on The Launch Feed receives a launch notification.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Slot", v.slotExpiresOn ?? "—"],
          ["Board", "TODAY · UPON RELEASE"],
        ])}

        ${h2("Do this before launch")}
        ${checklist([
          "Double-check your product URL — dead links are the #1 reason submissions get flagged post-launch.",
          "Add a launch-day banner to your homepage linking back to your Launch Feed page.",
          "Draft your first comment on your own page — introduce the product and ask a question to invite discussion.",
        ])}

        ${primaryBtn("Open founder dashboard", `${BASE_URL}/profile`)}
        ${ghostBtn("Preview product page", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}

        ${communityChannelsBlock("Connect With Makers Before Launch")}
      `,
        `${v.productName} is approved and scheduled.`
      ),
  },
  {
    id: "product-rejected",
    name: "Submission rejected",
    description: "Sent when a submission fails moderation. Includes the admin's reason.",
    trigger: "on-reject",
    auto: true,
    subject: (v) => `Update on your ${v.productName ?? "product"} submission`,
    render: (v) =>
      shell(
        `
        ${tag("Rejected", SIGNAL)}${tag("Submission")}
        ${h1("Your submission wasn't approved.")}
        ${p(
          `Thanks for submitting <b>${esc(v.productName)}</b> to The Launch Feed. After review, we're not able to add it to the daily launchpad in its current form. Details are below — we'd love to see a resubmission once these are addressed.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Founder", v.userName ?? "—"],
          ["Status", "REJECTED"],
        ])}

        ${h2("Reviewer notes")}
        <div style="border:1px solid ${HAIRLINE};border-left:3px solid ${SIGNAL};padding:14px 16px;margin:0 0 18px;font-size:13px;line-height:1.65;color:#2b2b28;white-space:pre-wrap;">${esc(
          v.rejectionReason ?? "No specific reason was provided."
        )}</div>

        ${h2("What to do next")}
        ${checklist([
          "Address the notes above, then submit an updated version — the queue accepts revisions immediately.",
          "If you disagree, reply directly to this email and a human will review the appeal.",
          "Check the submission guidelines to see the moderation criteria we apply.",
        ])}

        ${primaryBtn("Submit a revision", `${BASE_URL}/submit`)}
        ${ghostBtn("Read submission guidelines", `${BASE_URL}/guidelines`)}
      `,
        `${v.productName ?? "Your submission"} wasn't approved — reviewer notes inside.`
      ),
  },
  {
    id: "product-launched",
    name: "Product launched",
    description: "Fires the moment a product goes live. Sent to the maker AND to every user.",
    trigger: "on-launch",
    auto: true,
    subject: (v) => `${v.productName} just launched on The Launch Feed`,
    render: (v) =>
      shell(
        `
        ${tag("Live now", SIGNAL)}${tag("Daily board")}
        ${h1(`${v.productName} is live.`)}
        ${p(
          `<b>${esc(v.productName)}</b> just went live on the Today board. The first six hours of votes and comments carry the most weight in the ranking algorithm — this is the window that determines whether a product finishes in the top three or fades to the middle of the board.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Board", "TODAY · LIVE"],
          ["Founder", v.userName ?? "—"],
        ])}

        ${signalBtn("Open the launch page", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("See today's leaderboard", `${BASE_URL}`)}

        ${communityChannelsBlock("Track Live Broadcasts & Announcements")}

        ${divider()}
        ${h2("Your Official Launch Badges")}
        ${p(
          `Click any badge below to test your live product page. You can add these interactive badges directly to your website, landing page, or GitHub README to build social proof and attract daily upvotes:`
        )}

        <div style="margin:16px 0 20px;border:1px solid ${HAIRLINE};background:#f9f9f8;padding:16px;">
          ${renderEmailBadge({ theme: "dark", productSlug: v.productSlug ?? "", productName: v.productName ?? "" })}
          ${renderEmailBadge({ theme: "light", productSlug: v.productSlug ?? "", productName: v.productName ?? "" })}
          ${renderEmailBadge({ theme: "signal", productSlug: v.productSlug ?? "", productName: v.productName ?? "" })}
        </div>

        ${primaryBtn("View embed codes on your launch page", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("Download launch badge asset", v.productSlug ? `${BASE_URL}/api/badge/${esc(v.productSlug)}?award=launch&download=true` : `${BASE_URL}/badges`)}

        ${divider()}
        ${tips("First-hour maker checklist", [
          "Share the direct product URL — not the homepage — in every announcement.",
          "Post in one high-signal community (indiehackers.com, r/SaaS, HN Show) with an honest ask, not a pitch.",
          "Reply to the first five comments within 15 minutes. Response time is scored.",
          "Screenshot your leaderboard ranking when you hit top 10 and post it.",
        ])}
      `,
        `${v.productName} is live on today's board — take a look.`
      ),
  },
  {
    id: "rank-top3",
    name: "Ranked top 3",
    description: "Notifies makers whenever their product enters the top 3 on any board.",
    trigger: "on-rank-change",
    auto: true,
    subject: (v) =>
      `#${v.rank ?? 3} on the ${v.period ?? "daily"} board — ${v.productName}`,
    render: (v) => {
      const rankNum = v.rank ?? 2;
      const top3AwardKey =
        v.period === "weekly"
          ? `weekly_${rankNum}`
          : v.period === "monthly"
          ? `monthly_${rankNum}`
          : `daily_${rankNum}`;
      const top3BadgeDownloadUrl = v.productSlug
        ? `${BASE_URL}/api/badge/${esc(v.productSlug)}?award=${top3AwardKey}&download=true`
        : `${BASE_URL}/badges`;

      return shell(
        `
        ${tag(`Rank #${v.rank ?? 3}`, SIGNAL)}${tag((v.period ?? "daily").toUpperCase())}
        ${h1(`Top ${v.rank ?? 3} on the ${v.period ?? "daily"} board.`)}
        ${p(
          `<b>${esc(v.productName)}</b> is currently ranked <b>#${esc(String(v.rank ?? 3))}</b> on the ${esc(v.period ?? "daily")} leaderboard. This is a real result — most launches never crack the top ten — and it's a signal your positioning and community are working.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Rank", `#${v.rank ?? 3}`],
          ["Board", (v.period ?? "daily").toUpperCase()],
        ])}

        ${h2("How to hold — or climb — from here")}
        ${checklist([
          "Reply to every unanswered comment on your product page. Fast responses lift engagement score.",
          "Ask three specific users (not everyone) to leave an honest review. Reviews weigh more than raw upvotes.",
          "Share the current ranking on socials — 'we're #" +
            String(v.rank ?? 3) +
            " today' converts better than the original launch tweet.",
          "Keep the day's changelog visible. Ongoing updates during the launch window improve rank stability.",
        ])}

        ${primaryBtn("View your placement", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("Download the badge asset", top3BadgeDownloadUrl)}
        ${ghostBtn("See the leaderboard", `${BASE_URL}`)}

        ${communityChannelsBlock("Share Your Top-3 Win in the Community")}
      `,
        `You're #${v.rank ?? 3} — keep the momentum for the next few hours.`
      );
    },
  },
  {
    id: "rank-first",
    name: "Ranked #1",
    description: "Celebration email for a #1 finish. Includes badge details and next-day perks.",
    trigger: "on-rank-first",
    auto: true,
    subject: (v) => `#1 today: ${v.productName}`,
    render: (v) => {
      const firstAwardKey =
        v.period === "weekly"
          ? "weekly_1"
          : v.period === "monthly"
          ? "monthly_1"
          : "daily_1";
      const firstBadgeDownloadUrl = v.productSlug
        ? `${BASE_URL}/api/badge/${esc(v.productSlug)}?award=${firstAwardKey}&download=true`
        : `${BASE_URL}/badges`;

      return shell(
        `
        ${tag("#1", SIGNAL)}${tag("Champion")}
        ${h1(`#1 on the ${v.period ?? "daily"} board.`, SIGNAL)}
        ${p(
          `<b>${esc(v.productName)}</b> is the top launch on The Launch Feed right now. A <b>#1 badge</b> has been added to your product page, your founder profile now shows a "top-of-board" marker, and you're automatically eligible for this week's recap email that goes to every registered maker.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Placement", "#1 · " + (v.period ?? "daily").toUpperCase()],
          ["Badge", "AWARDED"],
          ["Weekly recap", "ELIGIBLE"],
        ])}

        ${h2("Ride the wave")}
        ${checklist([
          "Update your homepage with a '#1 on The Launch Feed today' banner while the ranking holds.",
          "Screenshot the leaderboard now and pin it on socials. This is the highest-share moment of the launch.",
          "Reach out to the people who commented — a personal thank-you converts into long-term customers.",
          "Consider a featured slot renewal so your next launch inherits the momentum. See below.",
        ])}

        ${signalBtn("View your #1 placement", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("Download the badge asset", firstBadgeDownloadUrl)}
        ${primaryBtn("Book the featured slot", `${BASE_URL}/profile`)}

        ${communityChannelsBlock("Celebrate Your #1 Champion Status")}
      `,
        `#1 RANK: ${v.productName} topped the ${v.period ?? "daily"} board.`
      );
    },
  },
  {
    id: "weekly-digest",
    name: "Weekly digest",
    description: "Monday recap of the week's top launches, revenue milestones, and new makers.",
    trigger: "weekly-cron",
    auto: true,
    subject: () => `This week on The Launch Feed`,
    render: (v) => {
      const items =
        v.digestItems && v.digestItems.length
          ? v.digestItems
          : [
              { name: "Synthwave", tagline: "AI code review", votes: 342 },
              { name: "Gridlock", tagline: "Zero-downtime DB deploys", votes: 310 },
              { name: "Pixelform", tagline: "Figma to React", votes: 298 },
              { name: "Chronos", tagline: "Time tracking that doesn't suck", votes: 275 },
              { name: "Neonbase", tagline: "Serverless Postgres for indie hackers", votes: 260 },
            ];
      const rows = items
        .map(
          (i, idx) => `<tr>
          <td style="padding:12px 14px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${INK_DIM};width:28px;">${idx + 1}</td>
          <td style="padding:12px 14px;border-top:1px solid ${HAIRLINE};font-size:13px;font-weight:700;">${esc(i.name)}</td>
          <td style="padding:12px 14px;border-top:1px solid ${HAIRLINE};font-size:12px;color:#2b2b28;">${esc(i.tagline)}</td>
          <td align="right" style="padding:12px 14px;border-top:1px solid ${HAIRLINE};font-size:13px;font-weight:700;">${i.votes}</td>
        </tr>`
        )
        .join("");
      return shell(
        `
        ${tag("Weekly digest")}${tag("Recap")}
        ${h1("The week in launches.")}
        ${p(
          `Here are the products that topped the boards this week, plus a few stats from across the platform. If you launched this week, thanks for shipping.`
        )}

        ${h2("Top launches — this week")}
        <table role="presentation" width="100%" style="border:1px solid ${HAIRLINE};margin:0 0 18px;">${rows}</table>

        ${h2("Platform snapshot")}
        ${keyValueBlock([
          ["Products launched", String(items.length + 12)],
          ["New makers joined", "37"],
          ["Verified revenue added", "$18.4k MRR"],
          ["Top-3 finishes", String(Math.min(3, items.length))],
        ])}

        ${primaryBtn("Explore the full week", `${BASE_URL}`)}
        ${ghostBtn("Submit next week's launch", `${BASE_URL}/submit`)}

        ${communityChannelsBlock("Join the Builder Community")}

        ${divider()}
        ${tips("Something we've noticed", [
          "Products that reply to comments in under 10 minutes are 3× more likely to finish top-5.",
          "Launches scheduled 12:00–14:00 UTC on Tue/Wed consistently outperform other slots.",
          "Verified-revenue badges continue to drive the highest click-through on the daily board.",
        ])}
      `,
        "This week's top launches, platform stats, and shipping tips."
      );
    },
  },
  {
    id: "featured-expiring",
    name: "Featured slot expiring",
    description: "Reminder 3 days before a paid featured slot ends. Includes renewal offer.",
    trigger: "on-slot-expiring",
    auto: true,
    subject: (v) => `Your featured slot for ${v.productName} expires ${v.slotExpiresOn}`,
    render: (v) =>
      shell(
        `
        ${tag("Featured slot", SIGNAL)}${tag("Expiring soon")}
        ${h1("Your featured slot is ending.")}
        ${p(
          `<b>${esc(v.productName)}</b>'s featured placement in the top-of-board hero row ends on <b>${esc(v.slotExpiresOn ?? "soon")}</b>. After that, the slot is offered to the next maker on the waitlist.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Placement", "TOP FEATURED · HERO"],
          ["Ends on", v.slotExpiresOn ?? "—"],
          ["Renewal price", "$99 / month · locked from your current rate"],
        ])}

        ${h2("What renewing gets you")}
        ${checklist([
          "30 more days in the top-of-board hero slot — visible on every page of the site.",
          "Priority in the rotating floater carousel that runs across the header.",
          "One extra weekly digest inclusion, reserved for featured products.",
          "Direct analytics on featured-slot impressions and click-throughs.",
        ])}

        ${signalBtn("Renew for $99/mo", `${BASE_URL}/profile?renew=${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("Compare placement tiers", `${BASE_URL}/#pricing`)}
      `,
        `${v.productName}'s featured placement ends ${v.slotExpiresOn}.`
      ),
  },
  {
    id: "revenue-verified",
    name: "Revenue verified",
    description: "Confirms a maker's MRR was verified via Stripe/Polar/LemonSqueezy.",
    trigger: "on-revenue-verified",
    auto: true,
    subject: (v) => `Verified: ${v.revenueLabel} on ${v.productName}`,
    render: (v) =>
      shell(
        `
        ${tag("Verified", VERIFIED)}${tag("Revenue")}
        ${h1(`Revenue verified for ${v.productName}.`)}
        ${p(
          `We successfully pulled and verified live revenue data for <b>${esc(v.productName)}</b>. A verified badge now appears next to your product across the daily, weekly, and monthly boards.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Verified figure", v.revenueLabel ?? "MRR"],
          ["Badge", "VERIFIED · GREEN"],
          ["Refresh cadence", "Every 24 hours"],
        ])}

        ${h2("What this changes")}
        ${checklist([
          "Your product page shows a live-updating MRR panel, refreshed daily.",
          "Verified-revenue products are eligible for the monthly Revenue leaderboard.",
          "Investors and acquirers browsing the Hall of Fame filter by verified only.",
        ])}

        ${primaryBtn("View verified badge", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}
        ${ghostBtn("Download MRR badge asset", v.productSlug ? `${BASE_URL}/api/badge/${esc(v.productSlug)}?award=revenue&download=true` : `${BASE_URL}/badges`)}
        ${ghostBtn("Adjust display settings", `${BASE_URL}/profile`)}

        ${divider()}
        ${p(
          `Prefer to hide the exact figure? You can switch the display to <b>rounded</b>, <b>range</b>, or <b>hidden</b> in your profile — the badge stays verified either way.`
        )}
      `,
        `${v.revenueLabel ?? "Revenue"} verified on ${v.productName}.`
      ),
  },
  {
    id: "comment-received",
    name: "New comment",
    description: "Sent when a maker's product gets a new comment. Includes a reply CTA.",
    trigger: "on-comment",
    auto: false,
    subject: (v) => `New comment on ${v.productName}`,
    render: (v) =>
      shell(
        `
        ${tag("Comment")}${tag("Awaiting reply", SIGNAL)}
        ${h1("Someone left a comment.")}
        ${p(
          `A new comment landed on <b>${esc(v.productName)}</b>. Fast replies during a launch — under 10 minutes is the target — are one of the strongest signals in our ranking algorithm.`
        )}

        ${keyValueBlock([
          ["Product", v.productName ?? "—"],
          ["Board", "TODAY · LIVE"],
          ["Reply window target", "< 10 minutes"],
        ])}

        ${primaryBtn("Read & reply", `${BASE_URL}/product/${esc(v.productSlug ?? "")}#comments`)}
        ${ghostBtn("View your product", `${BASE_URL}/product/${esc(v.productSlug ?? "")}`)}

        ${divider()}
        ${tips("Comment reply tips", [
          "Answer the actual question first, then thank them.",
          "If it's a feature request, link the roadmap or say 'noted, tracking here'.",
          "If it's negative, respond calmly and publicly. Silence hurts ranking more than criticism.",
        ])}
      `,
        `New comment on ${v.productName} — reply while it's live.`
      ),
  },
  {
    id: "custom-broadcast",
    name: "Custom broadcast",
    description: "Free-form message from the admin. Full themed shell, custom body + CTA.",
    trigger: "manual",
    auto: false,
    subject: () => `A note from The Launch Feed`,
    render: (v) =>
      shell(
        `
        ${tag("Announcement", SIGNAL)}
        ${h1("A note from The Launch Feed")}
        <div style="font-size:13px;line-height:1.7;color:#2b2b28;white-space:pre-wrap;margin:0 0 18px;">${esc(
          v.customBody ?? "Hello from The Launch Feed."
        )}</div>
        ${v.ctaUrl ? primaryBtn(v.ctaLabel ?? "Open", v.ctaUrl) : ""}
        ${ghostBtn("Visit the site", BASE_URL)}

        ${communityChannelsBlock("Stay Connected")}
      `,
        v.customBody?.slice(0, 90) || "A message from The Launch Feed."
      ),
  },
  {
    id: "directory-founder-invite",
    name: "Directory Founder Outreach",
    description: "Invites founders discovered across product directories (Uneed, Product Hunt, Microlaunch, etc.) to launch on The Launch Feed freely with unique features.",
    trigger: "manual",
    auto: false,
    subject: (v) =>
      `Featured ${v.productName || "your product"} on ${v.sourceDirectory || "directories"}? Launch on The Launch Feed (100% Free)`,
    render: (v) => {
      const prodName = v.productName || "your product";
      const founderName = v.founderName || "there";
      const srcDir = v.sourceDirectory || "product directories";

      return shell(
        `
        ${tag("FOUNDER INVITATION · 100% FREE", SIGNAL)}
        ${h1(`Launch ${esc(prodName)} on The Launch Feed`)}

        <div style="font-size:13px;line-height:1.7;color:#2b2b28;margin:0 0 16px;">
          Hey ${esc(founderName)},
          <br><br>
          We discovered <strong>${esc(prodName)}</strong> while browsing <strong>${esc(srcDir)}</strong> and were really impressed by what you are building.
          <br><br>
          We would love to invite you to freely submit and launch ${esc(prodName)} on <strong>The Launch Feed</strong> — a real-time, founder-first discovery platform and daily tech leaderboard.
        </div>

        <div style="border:1px solid ${HAIRLINE};background:#fafaf8;padding:16px 18px;margin:18px 0;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${INK_DIM};letter-spacing:.05em;margin-bottom:8px;">
            ${pulseDot(VERIFIED)}Why launch on The Launch Feed? (Key Differentiators)
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12.5px;color:#2b2b28;line-height:1.6;">
            <tr>
              <td style="padding:5px 0;" valign="top"><strong>1. Multi-Channel Social Launch Broadcast:</strong> The second you launch, our automated engine broadcasts your product to our X/Bluesky feed, WhatsApp Founder Community, Telegram Channel, and Webhooks.</td>
            </tr>
            <tr>
              <td style="padding:5px 0;" valign="top"><strong>2. 24h Real-Time Leaderboards & Live Badges:</strong> Fair daily drops with live community upvoting, instant ranking telemetry, and embeddable dynamic SVG winner badges for Daily Top 3, Weekly Best, and Monthly Champions.</td>
            </tr>
            <tr>
              <td style="padding:5px 0;" valign="top"><strong>3. Instant Automated Google & IndexNow Search Indexing:</strong> Every newly launched product and maker profile is automatically submitted via high-speed API indexing within hours of release.</td>
            </tr>
            <tr>
              <td style="padding:5px 0;" valign="top"><strong>4. Verified Live Revenue & MRR Telemetry:</strong> Optional one-click revenue verification with Stripe, DodoPayments, Polar, Paddle, or LemonSqueezy to build instant trust.</td>
            </tr>
            <tr>
              <td style="padding:5px 0;" valign="top"><strong>5. 100% Free Forever Launching:</strong> No paid queue skipping, no gatekeeping, and no hidden fees for makers.</td>
            </tr>
          </table>
        </div>

        <div style="margin:20px 0 16px;">
          ${primaryBtn(`🚀 Submit ${prodName} for Free`, `${BASE_URL}/submit`)}
          ${ghostBtn("↗ Explore Live Feed & Platform", BASE_URL)}
        </div>

        <div style="font-size:12px;color:${INK_DIM};line-height:1.6;margin:16px 0 8px;">
          Feel free to reply directly to this email if you have any questions or if there is anything we can do to support your launch.
        </div>

        ${communityChannelsBlock("Join Our Official Maker Channels")}
      `,
        `We noticed ${prodName} on ${srcDir}. Launch freely on The Launch Feed today.`
      );
    },
  },
];

export function getTemplate(id: EmailTemplateId) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
