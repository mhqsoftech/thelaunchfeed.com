import { prisma } from "@/lib/db";
import crypto from "crypto";

export interface BroadcastChannelConfig {
  enabled: boolean;
  channelUrl: string; // e.g. https://x.com/thelaunchfeed, https://t.me/thelaunchfeed, https://chat.whatsapp.com/...
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  botToken?: string; // Telegram
  chatId?: string; // Telegram channel or WhatsApp group/chat ID
  phoneNumberId?: string; // WhatsApp Cloud Phone Number ID / Instance ID
  instanceId?: string; // Green-API Instance ID (e.g. 710722711601)
  apiToken?: string; // Green-API Token (e.g. f2391a5565e3...)
}

export interface WebhookBroadcastConfig {
  enabled: boolean;
  webhookUrl: string; // e.g. https://hook.eu2.make.com/... or Buffer inbound / Zapier / n8n
}

export interface BlueskyBroadcastConfig {
  enabled: boolean;
  handle: string;      // e.g. thelaunchfeed.bsky.social
  appPassword: string; // generated at https://bsky.app/settings/app-passwords
  service?: string;    // defaults to https://bsky.social
}

export interface BroadcastConfig {
  x: BroadcastChannelConfig;
  telegram: BroadcastChannelConfig;
  whatsapp: BroadcastChannelConfig;
  bluesky?: BlueskyBroadcastConfig;
  webhook?: WebhookBroadcastConfig;
}

export const DEFAULT_BROADCAST_CONFIG: BroadcastConfig = {
  x: {
    enabled: false,
    channelUrl: "https://x.com/thelaunchfeed",
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  },
  telegram: {
    enabled: false,
    channelUrl: "https://t.me/thelaunchfeed",
    botToken: "",
    chatId: "",
  },
  whatsapp: {
    enabled: false,
    channelUrl: "https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U",
    accessToken: "",
    phoneNumberId: "",
  },
  bluesky: {
    enabled: false,
    handle: "",
    appPassword: "",
    service: "https://bsky.social",
  },
  webhook: {
    enabled: false,
    webhookUrl: "",
  },
};

const BROADCAST_CONFIG_KEY = "broadcast.channels.config";
const BROADCAST_LOG_KEY = "broadcast.delivery.logs";

export interface BroadcastLogItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  timestamp: string;
  results: {
    x?: { success: boolean; message: string; url?: string };
    telegram?: { success: boolean; message: string; url?: string };
    whatsapp?: { success: boolean; message: string; url?: string };
    bluesky?: { success: boolean; message: string; url?: string };
    webhook?: { success: boolean; message: string };
  };
}

/**
 * Loads current broadcast configuration from AppSetting table
 */
export async function getBroadcastConfig(): Promise<BroadcastConfig> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: BROADCAST_CONFIG_KEY },
    });
    if (row && typeof row.value === "object" && row.value !== null) {
      return {
        ...DEFAULT_BROADCAST_CONFIG,
        ...(row.value as any),
        x: { ...DEFAULT_BROADCAST_CONFIG.x, ...((row.value as any).x || {}) },
        telegram: { ...DEFAULT_BROADCAST_CONFIG.telegram, ...((row.value as any).telegram || {}) },
        whatsapp: { ...DEFAULT_BROADCAST_CONFIG.whatsapp, ...((row.value as any).whatsapp || {}) },
        bluesky: { ...DEFAULT_BROADCAST_CONFIG.bluesky!, ...((row.value as any).bluesky || {}) },
        webhook: { ...DEFAULT_BROADCAST_CONFIG.webhook, ...((row.value as any).webhook || {}) },
      };
    }
  } catch (e) {
    console.error("[getBroadcastConfig] error:", e);
  }
  return DEFAULT_BROADCAST_CONFIG;
}

/**
 * Saves broadcast configuration to AppSetting table
 */
export async function saveBroadcastConfig(config: BroadcastConfig): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: BROADCAST_CONFIG_KEY },
    create: {
      key: BROADCAST_CONFIG_KEY,
      value: config as any,
    },
    update: {
      value: config as any,
    },
  });
}

/**
 * Loads recent broadcast delivery logs
 */
export async function getBroadcastLogs(limit = 25): Promise<BroadcastLogItem[]> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: BROADCAST_LOG_KEY },
    });
    if (row && Array.isArray(row.value)) {
      return (row.value as unknown as BroadcastLogItem[]).slice(0, limit);
    }
  } catch (e) {
    console.error("[getBroadcastLogs] error:", e);
  }
  return [];
}

/**
 * Appends an entry to the broadcast delivery log
 */
async function appendBroadcastLog(item: BroadcastLogItem): Promise<void> {
  try {
    const logs = await getBroadcastLogs(50);
    const updated = [item, ...logs.filter((l) => l.id !== item.id)].slice(0, 50);
    await prisma.appSetting.upsert({
      where: { key: BROADCAST_LOG_KEY },
      create: { key: BROADCAST_LOG_KEY, value: updated as any },
      update: { value: updated as any },
    });
  } catch (e) {
    console.error("[appendBroadcastLog] error:", e);
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   CHANNEL 1: X / TWITTER API v2 BROADCAST
────────────────────────────────────────────────────────────────────────────── */

function generateOAuth1Header(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  oauthParams["oauth_signature"] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`);

  return `OAuth ${headerParts.join(", ")}`;
}

export async function sendXBroadcast(
  text: string,
  config: BroadcastChannelConfig
): Promise<{ success: boolean; message: string; tweetId?: string }> {
  if (!config.apiKey || !config.apiSecret || !config.accessToken || !config.accessTokenSecret) {
    return {
      success: false,
      message: "Missing X API v2 credentials (API Key, Secret, Access Token, or Secret).",
    };
  }

  const endpoint = "https://api.twitter.com/2/tweets";
  const authHeader = generateOAuth1Header(
    "POST",
    endpoint,
    config.apiKey.trim(),
    config.apiSecret.trim(),
    config.accessToken.trim(),
    config.accessTokenSecret.trim()
  );

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.data?.id) {
      return {
        success: true,
        message: `Successfully posted to X (Tweet ID: ${data.data.id})`,
        tweetId: data.data.id,
      };
    } else {
      const errMsg = data?.detail || data?.title || JSON.stringify(data);
      return {
        success: false,
        message: `X API error (${res.status}): ${errMsg}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `X network error: ${err.message || String(err)}`,
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   CHANNEL 1b: BLUESKY (AT PROTOCOL) — genuinely free, no API tier gating
   Auth via App Password (bsky.app → Settings → App Passwords). No rate limits
   that matter for launch cadence (~5,000 writes/hour per account).
────────────────────────────────────────────────────────────────────────────── */

/**
 * Detects URLs in `text` and returns AT-Protocol facets with the byte offsets
 * (Bluesky counts UTF-8 bytes, not characters) so links become tappable.
 */
function buildBlueskyLinkFacets(text: string) {
  const facets: Array<Record<string, any>> = [];
  const encoder = new TextEncoder();
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const byteStart = encoder.encode(text.slice(0, m.index)).length;
    const byteEnd = byteStart + encoder.encode(m[0]).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  return facets;
}

export async function sendBlueskyBroadcast(
  text: string,
  config: BlueskyBroadcastConfig
): Promise<{ success: boolean; message: string; url?: string }> {
  if (!config.handle || !config.appPassword) {
    return {
      success: false,
      message: "Missing Bluesky handle or App Password. Generate one at https://bsky.app/settings/app-passwords.",
    };
  }

  const service = (config.service || "https://bsky.social").replace(/\/$/, "");
  const identifier = config.handle.trim().replace(/^@/, "");

  try {
    const sessionRes = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password: config.appPassword.trim() }),
    });
    const session = await sessionRes.json().catch(() => ({} as any));
    if (!sessionRes.ok || !session.accessJwt || !session.did) {
      return {
        success: false,
        message: `Bluesky auth failed (${sessionRes.status}): ${session.message || session.error || "invalid handle or app password"}`,
      };
    }

    // Bluesky post cap is 300 graphemes; trim conservatively.
    const trimmed = text.length > 300 ? text.slice(0, 297) + "…" : text;

    const postRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: trimmed,
          facets: buildBlueskyLinkFacets(trimmed),
          createdAt: new Date().toISOString(),
        },
      }),
    });
    const posted = await postRes.json().catch(() => ({} as any));
    if (!postRes.ok || !posted.uri) {
      return {
        success: false,
        message: `Bluesky post failed (${postRes.status}): ${posted.message || posted.error || JSON.stringify(posted)}`,
      };
    }

    // Convert at:// URI → public bsky.app URL for the log.
    const rkey = String(posted.uri).split("/").pop() || "";
    const url = `https://bsky.app/profile/${identifier}/post/${rkey}`;
    return { success: true, message: `Posted to Bluesky as @${identifier}`, url };
  } catch (err: any) {
    return {
      success: false,
      message: `Bluesky network error: ${err.message || String(err)}`,
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   CHANNEL 2: TELEGRAM CHANNEL BROADCAST
────────────────────────────────────────────────────────────────────────────── */

export async function sendTelegramBroadcast(
  htmlText: string,
  config: BroadcastChannelConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.botToken || !config.chatId) {
    return {
      success: false,
      message: "Missing Telegram Bot Token or Channel Chat ID (@channel or -100...).",
    };
  }

  const token = config.botToken.trim();
  const chatId = config.chatId.trim();
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      return {
        success: true,
        message: `Successfully posted to Telegram channel (${chatId})`,
      };
    } else {
      return {
        success: false,
        message: `Telegram API error: ${data?.description || JSON.stringify(data)}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Telegram network error: ${err.message || String(err)}`,
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   CHANNEL 3: WHATSAPP CHANNEL / BAILEYS / GREEN-API BROADCAST
────────────────────────────────────────────────────────────────────────────── */

export async function sendWhatsAppBroadcast(
  text: string,
  config: BroadcastChannelConfig
): Promise<{ success: boolean; message: string }> {
  const rawChatId = (config.chatId || "").trim();

  // Mode 1: Native Baileys Direct WhatsApp Connection
  try {
    const { sendBaileysMessage, getBaileysStatus } = await import("@/lib/baileys");
    const status = await getBaileysStatus();
    if (status.status === "CONNECTED" && rawChatId) {
      const bRes = await sendBaileysMessage(rawChatId, text);
      if (bRes.success) {
        return bRes;
      }
    }
  } catch (e) {
    console.warn("[sendWhatsAppBroadcast] Baileys attempt warning:", e);
  }

  const instanceId = (config.instanceId || config.phoneNumberId || "").trim().replace(/^waInstance/i, "");
  const apiToken = (config.apiToken || config.accessToken || "").trim();

  // Mode 2: Green-API Gateway fallback
  if (instanceId && apiToken) {
    let chatId = rawChatId;
    if (chatId && !chatId.includes("@")) {
      if (chatId.length > 15 || chatId.startsWith("120")) {
        chatId = `${chatId}@g.us`;
      } else {
        chatId = `${chatId.replace(/[^0-9]/g, "")}@c.us`;
      }
    }

    if (!chatId) {
      return {
        success: false,
        message: "Missing WhatsApp Community / Group Chat ID (e.g. 1203630XXXXXXXXX@g.us).",
      };
    }

    const endpoint = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          message: text,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.idMessage) {
        return {
          success: true,
          message: `Successfully posted to WhatsApp group (${chatId})`,
        };
      } else {
        const errMsg = data?.message || data?.error || JSON.stringify(data);
        return {
          success: false,
          message: `WhatsApp Green-API error (${res.status}): ${errMsg}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `WhatsApp network error: ${err.message || String(err)}`,
      };
    }
  }

  // Mode 3: Direct Baileys Connect Request
  if (rawChatId) {
    try {
      const { sendBaileysMessage } = await import("@/lib/baileys");
      return await sendBaileysMessage(rawChatId, text);
    } catch (e: any) {
      return {
        success: false,
        message: `WhatsApp Baileys error: ${e.message || String(e)}`,
      };
    }
  }

  return {
    success: false,
    message: "Missing WhatsApp Community Group Chat ID. Please configure it in the admin dashboard.",
  };
}

export async function sendWebhookBroadcast(
  payload: Record<string, any>,
  config?: WebhookBroadcastConfig
): Promise<{ success: boolean; message: string }> {
  if (!config?.webhookUrl) {
    return {
      success: false,
      message: "Missing webhook URL (Make.com / Buffer / n8n / Zapier).",
    };
  }

  const endpoint = config.webhookUrl.trim();

  // Rich JSON payload — Make.com, Buffer's inbound webhook, Zapier "Catch Hook",
  // and n8n's Webhook node all parse arbitrary JSON out of the box.
  const body = JSON.stringify(payload);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      return {
        success: true,
        message: `Delivered to webhook (HTTP ${res.status}). In your Make.com scenario / Buffer inbound / n8n workflow, map fields from the JSON body (productName, tagline, productUrl, makerName, text, tags, event).`,
      };
    } else {
      const text = await res.text().catch(() => "");
      return {
        success: false,
        message: `Webhook returned HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Webhook network error: ${err.message || String(err)}`,
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   UNIFIED BROADCAST DISPATCHER
────────────────────────────────────────────────────────────────────────────── */

export interface ProductLaunchPayload {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  makerName?: string | null;
  makerHandle?: string | null;
  category?: string | null;
  tags?: string[];
  websiteUrl?: string | null;
}

export async function broadcastProductLaunch(
  product: ProductLaunchPayload
): Promise<BroadcastLogItem> {
  const config = await getBroadcastConfig();
  const siteBase = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";
  const productUrl = `${siteBase}/product/${product.slug}`;
  const makerDisplay = product.makerHandle
    ? `${product.makerName || "Maker"} (${product.makerHandle})`
    : product.makerName || "Founder";

  const hashtags = (product.tags || [])
    .slice(0, 3)
    .map((t) => `#${t.replace(/[^a-zA-Z0-9]/g, "")}`)
    .filter(Boolean)
    .join(" ");

  const results: BroadcastLogItem["results"] = {};

  // Time-box each channel so one slow provider (Telegram / X hanging) cannot
  // exceed Inngest's step timeout and force a retry that duplicates every
  // *already-succeeded* broadcast.
  const withTimeout = <T>(p: Promise<T>, label: string, ms = 10_000): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms)
      ),
    ]);

  // Every disabled channel gets an explicit "not configured" entry so the
  // broadcast log tells operators why a channel produced no output, instead
  // of an empty results object indistinguishable from "everything failed."
  const tasks: Array<Promise<void>> = [];

  if (config.x.enabled) {
    const xText = `🚀 NEW LAUNCH ON THE LAUNCH FEED\n\n${product.name} — ${product.tagline}\n👤 Maker: ${makerDisplay}\n\n⚡ 360° Specs, Architecture & Upvote:\n${productUrl}\n\n#buildinpublic #indiehackers ${hashtags}`.trim();
    tasks.push(
      withTimeout(sendXBroadcast(xText, config.x), "x")
        .then((r) => { results.x = r; })
        .catch((e) => { results.x = { success: false, message: e.message || String(e) }; })
    );
  } else {
    results.x = { success: false, message: "channel not enabled" };
  }

  if (config.telegram.enabled) {
    const tgHtml = `🚀 <b>NEW LAUNCH ON THE LAUNCH FEED</b>\n\n<b>${product.name}</b>\n<i>${product.tagline}</i>\n\n👤 <b>Maker:</b> ${makerDisplay}\n📁 <b>Category:</b> ${product.category || "Software"}\n\n⚡ <b>Full 360° Specs &amp; Upvote:</b>\n<a href="${productUrl}">${productUrl}</a>\n\n#launch #${product.category?.toLowerCase() || "tech"}`;
    tasks.push(
      withTimeout(sendTelegramBroadcast(tgHtml, config.telegram), "telegram")
        .then((r) => { results.telegram = r; })
        .catch((e) => { results.telegram = { success: false, message: e.message || String(e) }; })
    );
  } else {
    results.telegram = { success: false, message: "channel not enabled" };
  }

  if (config.whatsapp.enabled) {
    const waText = `🚀 *NEW LAUNCH ON THE LAUNCH FEED*\n\n*${product.name}*\n_${product.tagline}_\n\n👤 *Maker:* ${makerDisplay}\n\n⚡ *Explore 360° Architecture Specs & Upvote:*\n${productUrl}`;
    tasks.push(
      withTimeout(sendWhatsAppBroadcast(waText, config.whatsapp), "whatsapp")
        .then((r) => { results.whatsapp = r; })
        .catch((e) => { results.whatsapp = { success: false, message: e.message || String(e) }; })
    );
  } else {
    results.whatsapp = { success: false, message: "channel not enabled" };
  }

  if (config.bluesky?.enabled) {
    const bskyText = `🚀 New launch: ${product.name} — ${product.tagline}\nBy ${makerDisplay}\n${productUrl}\n${hashtags}`.trim();
    tasks.push(
      withTimeout(sendBlueskyBroadcast(bskyText, config.bluesky), "bluesky")
        .then((r) => { results.bluesky = r; })
        .catch((e) => { results.bluesky = { success: false, message: e.message || String(e) }; })
    );
  } else {
    results.bluesky = { success: false, message: "channel not enabled" };
  }

  if (config.webhook?.enabled && config.webhook.webhookUrl) {
    const webhookPayload = {
      event: "product.launched",
      productName: product.name,
      tagline: product.tagline,
      productUrl,
      makerName: makerDisplay,
      category: product.category || "Software",
      tags: product.tags || [],
      text: `🚀 NEW LAUNCH: ${product.name} — ${product.tagline}\n\n👤 Maker: ${makerDisplay}\n⚡ Upvote & View Specs: ${productUrl}\n\n#buildinpublic #indiehackers ${hashtags}`,
      timestamp: new Date().toISOString(),
    };
    tasks.push(
      withTimeout(sendWebhookBroadcast(webhookPayload, config.webhook), "webhook")
        .then((r) => { results.webhook = r; })
        .catch((e) => { results.webhook = { success: false, message: e.message || String(e) }; })
    );
  } else {
    results.webhook = { success: false, message: "channel not enabled" };
  }

  await Promise.allSettled(tasks);

  const logItem: BroadcastLogItem = {
    id: `bcast-${Date.now()}-${product.id.slice(0, 6)}`,
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    timestamp: new Date().toISOString(),
    results,
  };

  await appendBroadcastLog(logItem);
  return logItem;
}

export interface LeaderboardWinnerItem {
  rank: number;
  id: string;
  name: string;
  slug: string;
  tagline: string;
  voteCount: number;
  makerName: string;
  makerHandle?: string | null;
}

export interface LeaderboardWinnersPayload {
  period: "daily" | "weekly" | "monthly" | "yearly" | "alltime";
  periodTitle: string;
  winners: LeaderboardWinnerItem[];
}

export async function broadcastLeaderboardWinners(
  payload: LeaderboardWinnersPayload
): Promise<BroadcastLogItem> {
  const config = await getBroadcastConfig();
  const siteBase = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";
  const { periodTitle, winners } = payload;

  if (!winners || winners.length === 0) {
    return {
      id: `bcast-winners-${Date.now()}`,
      productId: "none",
      productName: periodTitle,
      productSlug: payload.period,
      timestamp: new Date().toISOString(),
      results: {},
    };
  }

  const w1 = winners[0];
  const w2 = winners[1];
  const w3 = winners[2];

  const results: BroadcastLogItem["results"] = {};

  // 1. X / Twitter
  if (config.x.enabled) {
    let xText = `🏆 THE LAUNCH FEED — TOP WINNERS: ${periodTitle.toUpperCase()}\n\n`;
    if (w1) xText += `🥇 #1 ${w1.name} (${w1.voteCount} votes)\n👤 Maker: ${w1.makerHandle ? `${w1.makerName} (${w1.makerHandle})` : w1.makerName}\n🔗 ${siteBase}/product/${w1.slug}\n\n`;
    if (w2) xText += `🥈 #2 ${w2.name} (${w2.voteCount} votes)\n🔗 ${siteBase}/product/${w2.slug}\n\n`;
    if (w3) xText += `🥉 #3 ${w3.name} (${w3.voteCount} votes)\n🔗 ${siteBase}/product/${w3.slug}\n\n`;
    xText += `⚡ Official Embed Badges & Leaderboard: ${siteBase}\n#buildinpublic #indiehackers`;
    results.x = await sendXBroadcast(xText.trim(), config.x);
  }

  // 2. Telegram
  if (config.telegram.enabled) {
    let tgHtml = `🏆 <b>THE LAUNCH FEED — TOP WINNERS: ${periodTitle.toUpperCase()}</b>\n\n`;
    if (w1) tgHtml += `🥇 <b>#1 <a href="${siteBase}/product/${w1.slug}">${w1.name}</a></b> (${w1.voteCount} votes)\n<i>${w1.tagline}</i>\n👤 <b>Maker:</b> ${w1.makerName}\n\n`;
    if (w2) tgHtml += `🥈 <b>#2 <a href="${siteBase}/product/${w2.slug}">${w2.name}</a></b> (${w2.voteCount} votes)\n<i>${w2.tagline}</i>\n\n`;
    if (w3) tgHtml += `🥉 <b>#3 <a href="${siteBase}/product/${w3.slug}">${w3.name}</a></b> (${w3.voteCount} votes)\n<i>${w3.tagline}</i>\n\n`;
    tgHtml += `⚡ <b>Official Embed Badges &amp; Leaderboard:</b>\n<a href="${siteBase}">${siteBase}</a>`;
    results.telegram = await sendTelegramBroadcast(tgHtml, config.telegram);
  }

  // 3. WhatsApp
  if (config.whatsapp.enabled) {
    let waText = `🏆 *THE LAUNCH FEED — TOP WINNERS: ${periodTitle.toUpperCase()}*\n\n`;
    if (w1) waText += `🥇 *#1 ${w1.name}* (${w1.voteCount} votes)\n_${w1.tagline}_\n👤 *Maker:* ${w1.makerName}\n🔗 ${siteBase}/product/${w1.slug}\n\n`;
    if (w2) waText += `🥈 *#2 ${w2.name}* (${w2.voteCount} votes)\n_${w2.tagline}_\n🔗 ${siteBase}/product/${w2.slug}\n\n`;
    if (w3) waText += `🥉 *#3 ${w3.name}* (${w3.voteCount} votes)\n_${w3.tagline}_\n🔗 ${siteBase}/product/${w3.slug}\n\n`;
    waText += `⚡ *View Leaderboard & Official Award Embeds:*\n${siteBase}`;
    results.whatsapp = await sendWhatsAppBroadcast(waText.trim(), config.whatsapp);
  }

  // 4. Bluesky (native AT Protocol)
  if (config.bluesky?.enabled) {
    let bText = `🏆 Top winners — ${periodTitle}\n\n`;
    if (w1) bText += `🥇 ${w1.name} (${w1.voteCount})\n${siteBase}/product/${w1.slug}\n`;
    if (w2) bText += `🥈 ${w2.name} — ${siteBase}/product/${w2.slug}\n`;
    if (w3) bText += `🥉 ${w3.name} — ${siteBase}/product/${w3.slug}\n`;
    results.bluesky = await sendBlueskyBroadcast(bText.trim(), config.bluesky);
  }

  // 5. Webhook
  if (config.webhook?.enabled && config.webhook.webhookUrl) {
    const webhookPayload = {
      event: "leaderboard.winners",
      period: payload.period,
      periodTitle,
      winners,
      timestamp: new Date().toISOString(),
    };
    results.webhook = await sendWebhookBroadcast(webhookPayload, config.webhook);
  }

  const logItem: BroadcastLogItem = {
    id: `bcast-winners-${Date.now()}-${payload.period}`,
    productId: w1?.id || "winners",
    productName: `${periodTitle} Winners`,
    productSlug: payload.period,
    timestamp: new Date().toISOString(),
    results,
  };

  await appendBroadcastLog(logItem);
  return logItem;
}

