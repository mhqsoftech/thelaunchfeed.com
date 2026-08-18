"use client";

import React, { useState, useEffect } from "react";
import {
  getBroadcastConfigAction,
  saveBroadcastConfigAction,
  getBroadcastLogsAction,
  testBroadcastAction,
} from "@/app/actions/broadcast";
import { type BroadcastConfig, type BroadcastLogItem } from "@/lib/broadcast";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

/* ─────────────────────────── Official Brand SVG Logos ─────────────────────────── */

function XBrandLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="X (Twitter) Official Logo">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramBrandLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Telegram Official Logo">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.95-1.28 4.92-2.13 5.91-2.54 2.81-1.17 3.4-.37 3.77.37z" />
    </svg>
  );
}

function WhatsAppBrandLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="WhatsApp Official Logo">
      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.477-.15-.678.15-.201.301-.778.978-.954 1.178-.176.201-.352.226-.653.075-1.304-.653-2.155-1.178-3.006-2.637-.226-.388.226-.36.653-1.215.075-.15.038-.28-.019-.393-.057-.113-.514-1.24-.705-1.7-.186-.447-.375-.386-.514-.393-.133-.007-.285-.008-.437-.008-.152 0-.399.057-.608.285-.209.228-.798.78-.798 1.902 0 1.122.817 2.206.931 2.358.114.152 1.608 2.455 3.896 3.441.545.235.97.375 1.302.48.548.174 1.047.149 1.442.09.44-.066 1.354-.553 1.544-1.087.19-.534.19-.992.133-1.087-.057-.095-.209-.15-.51-.301zm-5.452 7.618a9.94 9.94 0 01-5.07-1.385l-.363-.216-3.768.988 1.006-3.673-.237-.377a9.948 9.948 0 01-1.528-5.337c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10zm0-18.182c-4.511 0-8.182 3.671-8.182 8.182 0 1.443.376 2.85 1.09 4.09l.173.298-.65 2.373 2.427-.637.288.171a8.178 8.178 0 004.854 1.887c4.511 0 8.182-3.671 8.182-8.182 0-4.511-3.671-8.182-8.182-8.182z" />
    </svg>
  );
}

function SaveIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function SendIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function RefreshIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export default function BroadcastTab() {
  const [config, setConfig] = useState<BroadcastConfig | null>(null);
  const [logs, setLogs] = useState<BroadcastLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [testingX, setTestingX] = useState(false);
  const [feedbackX, setFeedbackX] = useState<{ ok: boolean; msg: string } | null>(null);

  const [testingTg, setTestingTg] = useState(false);
  const [feedbackTg, setFeedbackTg] = useState<{ ok: boolean; msg: string } | null>(null);

  const [testingWa, setTestingWa] = useState(false);
  const [feedbackWa, setFeedbackWa] = useState<{ ok: boolean; msg: string } | null>(null);

  const [testingWebhook, setTestingWebhook] = useState(false);
  const [feedbackWebhook, setFeedbackWebhook] = useState<{ ok: boolean; msg: string } | null>(null);

  const [testingBsky, setTestingBsky] = useState(false);
  const [feedbackBsky, setFeedbackBsky] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadData = async () => {
    try {
      const [cfg, lg] = await Promise.all([
        getBroadcastConfigAction(),
        getBroadcastLogsAction(),
      ]);
      setConfig(cfg);
      setLogs(lg);
    } catch (e) {
      console.error("Failed to load broadcast config:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      await saveBroadcastConfigAction(config);
      setSaveStatus(`Broadcast configuration saved · ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSaveStatus(null), 8000);
    } catch (err: any) {
      setSaveStatus(`Error saving settings: ${err.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestChannel = async (channel: "x" | "telegram" | "whatsapp" | "bluesky" | "webhook") => {
    if (channel === "x") {
      setTestingX(true);
      setFeedbackX(null);
      const res = await testBroadcastAction("x");
      setFeedbackX({ ok: res.success, msg: res.message });
      setTestingX(false);
    } else if (channel === "telegram") {
      setTestingTg(true);
      setFeedbackTg(null);
      const res = await testBroadcastAction("telegram");
      setFeedbackTg({ ok: res.success, msg: res.message });
      setTestingTg(false);
    } else if (channel === "whatsapp") {
      setTestingWa(true);
      setFeedbackWa(null);
      const res = await testBroadcastAction("whatsapp");
      setFeedbackWa({ ok: res.success, msg: res.message });
      setTestingWa(false);
    } else if (channel === "bluesky") {
      setTestingBsky(true);
      setFeedbackBsky(null);
      const res = await testBroadcastAction("bluesky");
      setFeedbackBsky({ ok: res.success, msg: res.message });
      setTestingBsky(false);
    } else if (channel === "webhook") {
      setTestingWebhook(true);
      setFeedbackWebhook(null);
      const res = await testBroadcastAction("webhook");
      setFeedbackWebhook({ ok: res.success, msg: res.message });
      setTestingWebhook(false);
    }
    const freshLogs = await getBroadcastLogsAction();
    setLogs(freshLogs);
  };

  if (loading || !config) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center p-12">
        <LaunchFeedLoader size={36} label="Loading social broadcast engine..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-ink">
      {/* Header Banner */}
      <div className="border border-hairline bg-surface/40 p-4 sm:p-6 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
            <span>Multi-Channel Social Broadcast Engine</span>
          </h2>
          <span className="text-[10px] px-2 py-0.5 border border-signal/60 bg-signal/10 text-signal font-bold uppercase shrink-0 self-start sm:self-auto">
            AUTOMATED PRODUCT LAUNCH DISPATCHER
          </span>
        </div>
        <p className="text-xs text-ink-dim leading-relaxed font-sans">
          Configure API credentials and public channel endpoints for <strong>X (Twitter)</strong>, <strong>Telegram</strong>, and <strong>WhatsApp</strong>. When any product is published at the 6:00 AM IST (00:30 UTC) release slot or launched manually, it is automatically broadcasted with rich 360° product specs and direct backlinks.
        </p>
      </div>

      {/* 3 Channel Configuration Columns / Cards */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* 1. X (Twitter) — Native API v2 (free tier is minimal) + optional webhook fallback */}
          <div className="border border-hairline bg-surface/30 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-ink text-void rounded-xs flex items-center justify-center p-1">
                    <XBrandLogo className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs uppercase text-ink">X / Twitter API v2</span>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 border font-bold uppercase tracking-wider ${
                    config.x.enabled
                      ? "border-signal text-signal bg-void"
                      : "border-hairline text-ink-faint bg-surface"
                  }`}
                >
                  {config.x.enabled ? "ACTIVE (X API)" : "DISABLED"}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.x.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, x: { ...config.x, enabled: e.target.checked } })
                  }
                  className="rounded-xs accent-[#00D97E]"
                />
                <span>Enable Direct Auto-Post to X (paid API tier required for reliable cadence)</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-ink-faint">API Key</label>
                  <input
                    type="password"
                    value={config.x.apiKey || ""}
                    onChange={(e) => setConfig({ ...config, x: { ...config.x, apiKey: e.target.value } })}
                    className="w-full px-2 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-ink-faint">API Secret</label>
                  <input
                    type="password"
                    value={config.x.apiSecret || ""}
                    onChange={(e) => setConfig({ ...config, x: { ...config.x, apiSecret: e.target.value } })}
                    className="w-full px-2 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-ink-faint">Access Token</label>
                  <input
                    type="password"
                    value={config.x.accessToken || ""}
                    onChange={(e) => setConfig({ ...config, x: { ...config.x, accessToken: e.target.value } })}
                    className="w-full px-2 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-ink-faint">Access Secret</label>
                  <input
                    type="password"
                    value={config.x.accessTokenSecret || ""}
                    onChange={(e) => setConfig({ ...config, x: { ...config.x, accessTokenSecret: e.target.value } })}
                    className="w-full px-2 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                  />
                </div>
              </div>
              <p className="text-[10px] text-ink-dim font-sans leading-tight">
                Generate at <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer" className="underline">developer.x.com</a> → Project → App → Keys and tokens. App permissions must be <strong>Read and Write</strong>. Since X removed most of the free-tier write allowance, use the <strong>Bluesky</strong> channel for zero-cost auto-broadcast, or fall back to the <strong>manual "Post to X" intent link</strong> shown in the launch log for one-tap posting.
              </p>

              <div className="pt-2 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => handleTestChannel("x")}
                  disabled={testingX || !config.x.apiKey || !config.x.accessToken}
                  className="w-full py-2 px-3 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <SendIcon className="w-3.5 h-3.5 text-signal" />
                  <span>{testingX ? "Posting Test Tweet..." : "Test Post to X"}</span>
                </button>
                {feedbackX && (
                  <div
                    className={`mt-2 p-2.5 border text-[11px] font-mono leading-tight ${
                      feedbackX.ok ? "border-signal text-signal bg-signal/5" : "border-red-500 text-red-500 bg-red-500/5"
                    }`}
                  >
                    {feedbackX.msg}
                  </div>
                )}
              </div>

              <div className="border-t border-hairline pt-3 mt-3">
                <div className="text-[10px] uppercase font-bold text-ink-faint mb-1">Alternative X path: Make.com / Buffer / n8n / Zapier Webhook</div>
                <p className="text-[10px] text-ink-dim font-sans leading-tight mb-2">
                  Independent of the X API block above — enable <strong>either</strong> or <strong>both</strong>. Every launch + winner event is POSTed as JSON (fields: <code>productName</code>, <code>tagline</code>, <code>productUrl</code>, <code>makerName</code>, <code>text</code>, <code>tags</code>, <code>event</code>) — map them inside your Make.com scenario or Buffer inbound and forward to X.
                </p>
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.webhook?.enabled ?? false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      webhook: {
                        enabled: e.target.checked,
                        webhookUrl: config.webhook?.webhookUrl || "",
                      },
                    })
                  }
                  className="rounded-xs accent-[#00D97E]"
                />
                <span>Enable webhook path (mirror every launch + winner event)</span>
              </label>

              <div className="space-y-1 mt-2">
                <label className="text-[10px] uppercase font-bold text-ink-faint">Custom Webhook URL</label>
                <input
                  type="url"
                  value={config.webhook?.webhookUrl || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      webhook: {
                        enabled: config.webhook?.enabled ?? true,
                        webhookUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="https://hook.eu2.make.com/... or Buffer inbound / n8n / Zapier endpoint"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
                <p className="text-[10px] text-ink-dim font-sans leading-tight pt-0.5">
                  POSTs the full JSON launch payload. RSS feed at <code>/feed.xml</code> is also available for any polling automation as a zero-auth fallback.
                </p>
              </div>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline space-y-2">
              <button
                type="button"
                onClick={() => handleTestChannel("webhook")}
                disabled={testingWebhook || !config.webhook?.webhookUrl}
                className="w-full py-2 px-3 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <SendIcon className="w-3.5 h-3.5 text-signal" />
                <span>{testingWebhook ? "Sending Test Ping..." : "Test Webhook (Make.com / Buffer)"}</span>
              </button>
              {feedbackWebhook && (
                <div
                  className={`p-2.5 border text-[11px] font-mono leading-tight ${
                    feedbackWebhook.ok
                      ? "border-signal text-signal bg-signal/5"
                      : "border-red-500 text-red-500 bg-red-500/5"
                  }`}
                >
                  {feedbackWebhook.msg}
                </div>
              )}
            </div>
          </div>

          {/* 2. Telegram Channel */}
          <div className="border border-hairline bg-surface/20 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#229ED9] text-white rounded-xs flex items-center justify-center p-1">
                    <TelegramBrandLogo className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs uppercase text-ink">Telegram Channel</span>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 border font-bold uppercase tracking-wider ${
                    config.telegram.enabled
                      ? "border-signal text-signal bg-void"
                      : "border-hairline text-ink-faint bg-surface"
                  }`}
                >
                  {config.telegram.enabled ? "ACTIVE" : "DISABLED"}
                </span>
              </div>

              {/* Enable Switch */}
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.telegram.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      telegram: { ...config.telegram, enabled: e.target.checked },
                    })
                  }
                  className="rounded-xs accent-[#00D97E]"
                />
                <span>Enable Auto-Broadcast to Telegram</span>
              </label>

              {/* Public Channel URL */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-ink-faint">
                  Public Telegram Channel Link
                </label>
                <input
                  type="url"
                  value={config.telegram.channelUrl}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      telegram: { ...config.telegram, channelUrl: e.target.value },
                    })
                  }
                  placeholder="https://t.me/thelaunchfeed"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
              </div>

              {/* Bot Token */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-ink-faint">
                  Telegram Bot Token (from @BotFather)
                </label>
                <input
                  type="password"
                  value={config.telegram.botToken || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      telegram: { ...config.telegram, botToken: e.target.value },
                    })
                  }
                  placeholder="e.g. 7123456789:AAHk..."
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
              </div>

              {/* Channel Chat ID / Username */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-ink-faint">
                  Channel Chat ID / @Username
                </label>
                <input
                  type="text"
                  value={config.telegram.chatId || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      telegram: { ...config.telegram, chatId: e.target.value },
                    })
                  }
                  placeholder="e.g. @thelaunchfeed or -100123456789"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
                <p className="text-[9px] text-ink-faint font-sans">
                  Ensure the bot is added as an <strong>Administrator</strong> with &ldquo;Post Messages&rdquo; permissions.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline space-y-2">
              <button
                type="button"
                onClick={() => handleTestChannel("telegram")}
                disabled={testingTg || !config.telegram.botToken || !config.telegram.chatId}
                className="w-full py-2 px-3 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <SendIcon className="w-3.5 h-3.5 text-signal" />
                <span>{testingTg ? "Testing Telegram Connection..." : "Test Telegram Message"}</span>
              </button>
              {feedbackTg && (
                <div
                  className={`p-2.5 border text-[11px] font-mono leading-tight ${
                    feedbackTg.ok
                      ? "border-signal text-signal bg-signal/5"
                      : "border-red-500 text-red-500 bg-red-500/5"
                  }`}
                >
                  {feedbackTg.msg}
                </div>
              )}
            </div>
          </div>

          {/* 3. WhatsApp Channel — Green-API gateway */}
          <div className="border border-hairline bg-surface/20 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#25D366] text-white rounded-xs flex items-center justify-center p-1">
                    <WhatsAppBrandLogo className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs uppercase text-ink">WhatsApp (Green-API)</span>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 border font-bold uppercase tracking-wider ${
                    config.whatsapp.enabled && (config.whatsapp.instanceId || config.whatsapp.phoneNumberId) && (config.whatsapp.apiToken || config.whatsapp.accessToken)
                      ? "border-signal text-signal bg-void"
                      : "border-hairline text-ink-faint bg-surface"
                  }`}
                >
                  {config.whatsapp.enabled ? "ACTIVE" : "DISABLED"}
                </span>
              </div>

              {/* Enable Switch */}
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.whatsapp.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, enabled: e.target.checked },
                    })
                  }
                  className="rounded-xs accent-[#00D97E]"
                />
                <span>Enable Auto-Broadcast to WhatsApp</span>
              </label>


              {/* Community Group / Chat ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-ink-faint">
                  Community Group Chat ID
                </label>
                <p className="text-[10px] text-ink-dim font-sans leading-tight">
                  In Green-API dashboard → your Instance → <em>Get Groups Ids</em>, or paste the raw <code>...@g.us</code> string of the group WhatsApp published to that account.
                </p>

                <input
                  type="text"
                  value={config.whatsapp.chatId || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, chatId: e.target.value },
                    })
                  }
                  placeholder="e.g. 1203630XXXXXXXXX@g.us"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
              </div>

              {/* Public Channel URL */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-ink-faint">
                  Public WhatsApp Community Invite Link
                </label>
                <input
                  type="url"
                  value={config.whatsapp.channelUrl}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, channelUrl: e.target.value },
                    })
                  }
                  placeholder="https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
              </div>

              {/* Green-API Production Gateway */}
              <div className="p-3 border border-hairline bg-surface/40 space-y-2.5 rounded-xs">
                <div className="text-[10px] uppercase font-bold text-ink flex items-center justify-between">
                  <span>Production Gateway: Green-API</span>
                  <a
                    href="https://green-api.com/en/pricing/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] text-signal font-mono font-normal underline"
                  >
                    Free tier: 3-day trial then $0 dev plan
                  </a>
                </div>
                <p className="text-[10px] text-ink-dim leading-tight font-sans">
                  Sign up at <a href="https://console.green-api.com/" target="_blank" rel="noreferrer" className="underline">console.green-api.com</a>, create an Instance, scan the QR on their dashboard once (needs a real WhatsApp on your phone), then paste the two credentials below. Free tier covers ~1000 outgoing messages/month.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-ink-faint">Instance ID</label>
                    <input
                      type="text"
                      value={config.whatsapp.instanceId || config.whatsapp.phoneNumberId || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          whatsapp: { ...config.whatsapp, instanceId: e.target.value },
                        })
                      }
                      placeholder="e.g. 7105123456"
                      className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-ink-faint">API Token</label>
                    <input
                      type="password"
                      value={config.whatsapp.apiToken || config.whatsapp.accessToken || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          whatsapp: { ...config.whatsapp, apiToken: e.target.value },
                        })
                      }
                      placeholder="e.g. f2391a5565e3..."
                      className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline space-y-2">
              <button
                type="button"
                onClick={() => handleTestChannel("whatsapp")}
                disabled={testingWa || !config.whatsapp.chatId}
                className="w-full py-2 px-3 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <SendIcon className="w-3.5 h-3.5 text-signal" />
                <span>{testingWa ? "Sending Test WhatsApp Alert..." : "Test WhatsApp Message"}</span>
              </button>
              {feedbackWa && (
                <div
                  className={`p-2.5 border text-[11px] font-mono leading-tight ${
                    feedbackWa.ok
                      ? "border-signal text-signal bg-signal/5"
                      : "border-red-500 text-red-500 bg-red-500/5"
                  }`}
                >
                  {feedbackWa.msg}
                </div>
              )}
            </div>
          </div>

          {/* 4. Bluesky (AT Protocol) — genuinely free X alternative */}
          <div className="border border-hairline bg-surface/20 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#0085FF] text-white rounded-xs flex items-center justify-center p-1 font-bold text-[11px] font-mono">
                    B
                  </div>
                  <span className="font-bold text-xs uppercase text-ink">Bluesky (AT Proto)</span>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 border font-bold uppercase tracking-wider ${
                    config.bluesky?.enabled
                      ? "border-signal text-signal bg-void"
                      : "border-hairline text-ink-faint bg-surface"
                  }`}
                >
                  {config.bluesky?.enabled ? "ACTIVE" : "DISABLED"}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.bluesky?.enabled ?? false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bluesky: {
                        enabled: e.target.checked,
                        handle: config.bluesky?.handle || "",
                        appPassword: config.bluesky?.appPassword || "",
                        service: config.bluesky?.service || "https://bsky.social",
                      },
                    })
                  }
                  className="rounded-xs accent-[#00D97E]"
                />
                <span>Enable Auto-Broadcast to Bluesky (100% free · no rate tier)</span>
              </label>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-ink-faint">Handle</label>
                <input
                  type="text"
                  value={config.bluesky?.handle || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bluesky: {
                        enabled: config.bluesky?.enabled ?? false,
                        handle: e.target.value,
                        appPassword: config.bluesky?.appPassword || "",
                        service: config.bluesky?.service || "https://bsky.social",
                      },
                    })
                  }
                  placeholder="thelaunchfeed.bsky.social"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-ink-faint">App Password</label>
                <input
                  type="password"
                  value={config.bluesky?.appPassword || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bluesky: {
                        enabled: config.bluesky?.enabled ?? false,
                        handle: config.bluesky?.handle || "",
                        appPassword: e.target.value,
                        service: config.bluesky?.service || "https://bsky.social",
                      },
                    })
                  }
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-full px-2.5 py-1.5 border border-hairline bg-void text-xs text-ink focus:outline-none focus:border-ink font-mono"
                />
                <p className="text-[10px] text-ink-dim font-sans leading-tight pt-0.5">
                  Generate at <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer" className="underline">bsky.app/settings/app-passwords</a>. This is NOT your main password — App Passwords can be revoked without affecting your account. No API tier gating; posts land within seconds.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline space-y-2">
              <button
                type="button"
                onClick={() => handleTestChannel("bluesky")}
                disabled={testingBsky || !config.bluesky?.handle || !config.bluesky?.appPassword}
                className="w-full py-2 px-3 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <SendIcon className="w-3.5 h-3.5 text-signal" />
                <span>{testingBsky ? "Posting to Bluesky..." : "Test Bluesky Post"}</span>
              </button>
              {feedbackBsky && (
                <div
                  className={`p-2.5 border text-[11px] font-mono leading-tight ${
                    feedbackBsky.ok
                      ? "border-signal text-signal bg-signal/5"
                      : "border-red-500 text-red-500 bg-red-500/5"
                  }`}
                >
                  {feedbackBsky.msg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Save Bar */}
        <div className="border-t border-hairline pt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-[11px] text-ink-dim font-mono">
              Credentials and channel links are stored in the database.
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-signal text-void font-mono text-xs font-bold hover:bg-signal/90 transition-colors cursor-pointer disabled:opacity-40 shadow-sm flex items-center gap-2"
            >
              <SaveIcon className="w-3.5 h-3.5" />
              <span>{saving ? "Saving Configuration..." : "Save Broadcast Configuration"}</span>
            </button>
          </div>

          {saveStatus && (
            <div
              role="status"
              aria-live="polite"
              className={`p-3 border text-xs font-mono font-bold flex items-center justify-between gap-3 ${
                saveStatus.startsWith("Error")
                  ? "border-red-500 bg-red-500/10 text-red-500"
                  : "border-signal bg-signal/10 text-signal"
              }`}
            >
              <span className="flex items-center gap-2">
                {!saveStatus.startsWith("Error") && (
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span>{saveStatus}</span>
              </span>
              <span className="text-[10px] uppercase opacity-75 shrink-0">
                {saveStatus.startsWith("Error") ? "SAVE FAILED" : "CONFIG SYNCHRONIZED"}
              </span>
            </div>
          )}
        </div>
      </form>

      {/* Broadcast Delivery History */}
      <div className="border border-hairline bg-void p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
              Recent Multi-Channel Broadcast Logs
            </h3>
            <p className="text-[11px] text-ink-dim font-sans mt-0.5">
              Live delivery status for each product published through the automated release queue.
            </p>
          </div>
          <button
            onClick={loadData}
            className="text-[10px] px-2.5 py-1 border border-hairline bg-surface hover:bg-raised text-ink transition-colors cursor-pointer font-bold flex items-center gap-1.5"
          >
            <RefreshIcon className="w-3 h-3" />
            <span>Refresh Logs</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-faint border border-dashed border-hairline">
            No broadcast events recorded yet. Configure credentials above and test a broadcast or publish a product.
          </div>
        ) : (
          <div className="divide-y divide-hairline border border-hairline overflow-y-auto overflow-x-auto max-h-[420px]">
            {logs.map((log) => (
              <div key={log.id} className="p-3 sm:p-4 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/20">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink truncate">{log.productName}</span>
                    <span className="text-[10px] text-ink-dim">({log.productSlug})</span>
                  </div>
                  <div className="text-[10px] text-ink-faint">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* X Status */}
                  <span
                    className={`text-[9px] px-2 py-0.5 border font-bold uppercase flex items-center gap-1 ${
                      log.results.x?.success
                        ? "border-signal text-signal bg-void"
                        : log.results.x === undefined
                        ? "border-hairline text-ink-faint bg-surface opacity-60"
                        : "border-red-500 text-red-500 bg-void"
                    }`}
                    title={log.results.x?.message || "Not configured"}
                  >
                    <XBrandLogo className="w-2.5 h-2.5" />
                    <span>{log.results.x?.success ? "SENT" : log.results.x ? "ERR" : "OFF"}</span>
                  </span>

                  {/* Telegram Status */}
                  <span
                    className={`text-[9px] px-2 py-0.5 border font-bold uppercase flex items-center gap-1 ${
                      log.results.telegram?.success
                        ? "border-signal text-signal bg-void"
                        : log.results.telegram === undefined
                        ? "border-hairline text-ink-faint bg-surface opacity-60"
                        : "border-red-500 text-red-500 bg-void"
                    }`}
                    title={log.results.telegram?.message || "Not configured"}
                  >
                    <TelegramBrandLogo className="w-2.5 h-2.5" />
                    <span>{log.results.telegram?.success ? "SENT" : log.results.telegram ? "ERR" : "OFF"}</span>
                  </span>

                  {/* WhatsApp Status */}
                  <span
                    className={`text-[9px] px-2 py-0.5 border font-bold uppercase flex items-center gap-1 ${
                      log.results.whatsapp?.success
                        ? "border-signal text-signal bg-void"
                        : log.results.whatsapp === undefined
                        ? "border-hairline text-ink-faint bg-surface opacity-60"
                        : "border-red-500 text-red-500 bg-void"
                    }`}
                    title={log.results.whatsapp?.message || "Not configured"}
                  >
                    <WhatsAppBrandLogo className="w-2.5 h-2.5" />
                    <span>{log.results.whatsapp?.success ? "SENT" : log.results.whatsapp ? "ERR" : "OFF"}</span>
                  </span>

                  {/* Bluesky Status */}
                  <span
                    className={`text-[9px] px-2 py-0.5 border font-bold uppercase flex items-center gap-1 ${
                      log.results.bluesky?.success
                        ? "border-signal text-signal bg-void"
                        : log.results.bluesky === undefined
                        ? "border-hairline text-ink-faint bg-surface opacity-60"
                        : "border-red-500 text-red-500 bg-void"
                    }`}
                    title={log.results.bluesky?.message || "Not configured"}
                  >
                    <span>BSKY:</span>
                    <span>{log.results.bluesky?.success ? "SENT" : log.results.bluesky ? "ERR" : "OFF"}</span>
                  </span>

                  {/* Free Webhook Status */}
                  <span
                    className={`text-[9px] px-2 py-0.5 border font-bold uppercase flex items-center gap-1 ${
                      log.results.webhook?.success
                        ? "border-signal text-signal bg-void"
                        : log.results.webhook === undefined
                        ? "border-hairline text-ink-faint bg-surface opacity-60"
                        : "border-red-500 text-red-500 bg-void"
                    }`}
                    title={log.results.webhook?.message || "Not configured"}
                  >
                    <span>HOOK:</span>
                    <span>{log.results.webhook?.success ? "SENT" : log.results.webhook ? "ERR" : "OFF"}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
