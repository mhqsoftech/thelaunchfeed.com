"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getIndexingOverviewAction,
  syncDeployIndexingAction,
  submitCustomUrlsAction,
  getPlatformUrlsAction,
  submitSelectedUrlsAction,
  submitAllUnsubmittedUrlsAction,
  autoDiscoverAndIndexLiveProductsAction,
  type IndexingOverviewData,
  type IndexingLogEntry,
  type PlatformUrlEntry,
  type PlatformUrlsData,
} from "@/app/actions/indexing";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

// Professional Vector SVG Icons
function IconGlobe({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconRefresh({ className = "w-4 h-4", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg className={`${className} ${spinning ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function IconRocket({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2 5-2" />
      <path d="M12 9v5s3.03-.55 4.5-2c1.63-1.62 2-5 2-5" />
    </svg>
  );
}

function IconZap({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconGoogle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function IconMicrosoft({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function IconGauge({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

function IconLayers({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconList({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconCheckCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconXCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconClock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconFilter({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconClose({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconAlertTriangle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconExternalLink({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconCode({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconCopy({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSend({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default function IndexingTab() {
  // Navigation sub-view: "overview" | "directory"
  const [activeSubView, setActiveSubView] = useState<"overview" | "directory">("overview");

  const [data, setData] = useState<IndexingOverviewData | null>(null);
  const [urlsData, setUrlsData] = useState<PlatformUrlsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual submission form
  const [customInput, setCustomInput] = useState("");
  const [customEngine, setCustomEngine] = useState<"ALL" | "GOOGLE" | "INDEXNOW">("ALL");
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [customResult, setCustomResult] = useState<any | null>(null);

  // Table filtering for Recent Logs
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<IndexingLogEntry | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Directory View state
  const [dirStatusFilter, setDirStatusFilter] = useState<"ALL" | "UNSUBMITTED" | "SUBMITTED">("UNSUBMITTED");
  const [dirTypeFilter, setDirTypeFilter] = useState<"ALL" | "PRODUCT" | "FOUNDER" | "CATEGORY" | "STATIC">("ALL");
  const [dirSearch, setDirSearch] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [batchEngine, setBatchEngine] = useState<"ALL" | "GOOGLE" | "INDEXNOW">("ALL");
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [submittingSingleUrl, setSubmittingSingleUrl] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resOverview, resUrls] = await Promise.all([
        getIndexingOverviewAction(),
        getPlatformUrlsAction(),
      ]);
      setData(resOverview);
      setUrlsData(resUrls);
    } catch (err: any) {
      setError(err?.message || "Failed to load indexing data");
    } finally {
      setLoading(false);
    }
  };

  const reloadUrlsOnly = async () => {
    try {
      setLoadingUrls(true);
      const res = await getPlatformUrlsAction();
      setUrlsData(res);
    } catch (err: any) {
      console.warn("Failed to reload platform URLs:", err);
    } finally {
      setLoadingUrls(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncDeploy = () => {
    startTransition(async () => {
      try {
        setError(null);
        setSuccessMsg(null);
        const res = await syncDeployIndexingAction();
        setSuccessMsg(
          `Sync complete: ${res?.googleSubmitted ?? 0} Google submissions, ${res?.indexNowSubmitted ?? 0} IndexNow submissions (${res?.googleSkippedQuota ?? 0} skipped for quota).`
        );
        await loadData();
      } catch (err: any) {
        setError(err?.message || "Deploy sync failed");
      }
    });
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    try {
      setSubmittingCustom(true);
      setError(null);
      setSuccessMsg(null);
      setCustomResult(null);

      const res = await submitCustomUrlsAction(customInput, customEngine);
      setCustomResult(res);
      const count = res?.count ?? 1;
      setSuccessMsg(`Successfully submitted ${count} URL${count === 1 ? "" : "s"} for indexing.`);
      setCustomInput("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Custom submission failed");
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Submit a single URL from the directory table
  const handleSingleDirectorySubmit = async (url: string) => {
    try {
      setSubmittingSingleUrl(url);
      setError(null);
      setSuccessMsg(null);
      const res = await submitSelectedUrlsAction([url], batchEngine);
      setSuccessMsg(`Successfully submitted 1 URL for indexing.`);
      setSelectedUrls((prev) => prev.filter((u) => u !== url));
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to submit URL");
    } finally {
      setSubmittingSingleUrl(null);
    }
  };

  // Submit all selected URLs
  const handleSubmitSelected = async () => {
    if (selectedUrls.length === 0) return;

    try {
      setSubmittingBatch(true);
      setError(null);
      setSuccessMsg(null);
      const res = await submitSelectedUrlsAction(selectedUrls, batchEngine);
      setSuccessMsg(`Successfully submitted ${selectedUrls.length} selected URL(s) for indexing.`);
      setSelectedUrls([]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Batch submission failed");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Submit all unsubmitted platform URLs at once
  const handleSubmitAllUnsubmitted = async () => {
    try {
      setSubmittingBatch(true);
      setError(null);
      setSuccessMsg(null);
      const res = await submitAllUnsubmittedUrlsAction(batchEngine);
      setSuccessMsg(`Submitted ${res?.count ?? 0} unsubmitted URL(s) for indexing.`);
      setSelectedUrls([]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to submit unsubmitted URLs");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Auto-discover all live products and submit unindexed pages
  const [autoDiscovering, setAutoDiscovering] = useState(false);

  const handleAutoDiscoverAndIndexProducts = async () => {
    try {
      setAutoDiscovering(true);
      setError(null);
      setSuccessMsg(null);
      const res = await autoDiscoverAndIndexLiveProductsAction(batchEngine);
      setSuccessMsg(
        `Auto-Discovery Complete: Discovered ${res.totalDiscovered} live product(s). Submitted ${res.submittedCount} URL(s) (${res.batchRes?.googleSubmitted ?? 0} Google, ${res.batchRes?.indexNowSubmitted ?? 0} IndexNow).`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Auto-discovery failed");
    } finally {
      setAutoDiscovering(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-20 flex justify-center items-center">
        <LaunchFeedLoader size={28} label="Loading Web Indexing telemetry…" />
      </div>
    );
  }

  const quota = data?.quota || { usedToday: 0, limit: 200, remaining: 200, resetAt: "" };
  const auth = data?.authStatus || {
    hasGoogleCredentials: false,
    hasWebIndexingApiKey: false,
    hasIndexNowKey: false,
    googleAuthMode: "NONE",
  };
  const stats = data?.stats || {
    totalSubmissions: 0,
    successSubmissions: 0,
    failedSubmissions: 0,
    quotaSkippedSubmissions: 0,
  };

  const quotaPercent = Math.min(100, Math.round(((quota.usedToday || 0) / (quota.limit || 200)) * 100));

  const filteredLogs = (data?.recentLogs || []).filter((log) => {
    if (filterStatus !== "ALL" && log.status !== filterStatus) return false;
    if (searchQuery.trim() && !log.url.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
      return false;
    }
    return true;
  });

  // Filtered Platform URLs in Directory View
  const filteredPlatformUrls = (urlsData?.urls || []).filter((item) => {
    if (dirStatusFilter === "UNSUBMITTED" && item.isSubmitted) return false;
    if (dirStatusFilter === "SUBMITTED" && !item.isSubmitted) return false;
    if (dirTypeFilter !== "ALL" && item.type !== dirTypeFilter) return false;
    if (dirSearch.trim()) {
      const q = dirSearch.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelectAllFiltered = () => {
    const allFilteredUrls = filteredPlatformUrls.map((u) => u.url);
    const allSelected = allFilteredUrls.every((u) => selectedUrls.includes(u));
    if (allSelected) {
      setSelectedUrls((prev) => prev.filter((u) => !allFilteredUrls.includes(u)));
    } else {
      setSelectedUrls((prev) => Array.from(new Set([...prev, ...allFilteredUrls])));
    }
  };

  const toggleSelectUrl = (url: string) => {
    setSelectedUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const unsubmittedCount = urlsData?.unsubmittedCount ?? 0;

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Console Banner - Fully Mobile Adaptive */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-hairline">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xs bg-signal/10 border border-signal/30 text-signal flex items-center justify-center shrink-0 mt-0.5">
            <IconGlobe className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-signal" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-bold font-mono uppercase tracking-tight text-ink">
                Web Search Indexing Console
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-signal/15 text-signal border border-signal/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-ink-dim font-mono mt-0.5 leading-relaxed">
              Automated link dispatch to Google Indexing API & IndexNow (Max 200 latest/day).
            </p>
          </div>
        </div>

        {/* Action Buttons Grid on Mobile */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full lg:w-auto shrink-0 pt-1 lg:pt-0">
          <button
            onClick={loadData}
            disabled={loading || isPending || autoDiscovering}
            className="h-9 sm:h-8 px-3 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-ink shadow-xs rounded-xs"
            title="Refresh Status"
          >
            <IconRefresh className="w-3.5 h-3.5 text-ink-dim" spinning={loading} />
            Refresh
          </button>
          <button
            onClick={handleAutoDiscoverAndIndexProducts}
            disabled={autoDiscovering || isPending || loading}
            className="h-9 sm:h-8 px-3 sm:px-4 bg-ink text-surface border border-ink hover:bg-signal hover:border-signal text-xs font-mono font-bold uppercase transition-colors flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs disabled:opacity-50 rounded-xs"
            title="Auto-discover all live products and push any unindexed pages to Google & IndexNow"
          >
            {autoDiscovering ? (
              <>
                <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                <span>Discovering…</span>
              </>
            ) : (
              <>
                <IconZap className="w-3.5 h-3.5 text-signal shrink-0" />
                <span className="truncate">Auto-Index Products</span>
              </>
            )}
          </button>
          <button
            onClick={handleSyncDeploy}
            disabled={isPending || autoDiscovering || quota.remaining <= 0}
            className="h-9 sm:h-8 px-3 sm:px-4 bg-signal text-surface border border-signal hover:opacity-90 text-xs font-mono font-bold uppercase transition-opacity flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs disabled:opacity-50 rounded-xs"
          >
            {isPending ? (
              <>
                <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing…</span>
              </>
            ) : (
              <>
                <IconRocket className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Sync Latest Links</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-hairline pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubView("overview")}
          className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors flex items-center gap-2 rounded-xs cursor-pointer ${
            activeSubView === "overview"
              ? "bg-ink text-surface shadow-xs"
              : "bg-surface hover:bg-raised text-ink-dim hover:text-ink border border-hairline"
          }`}
        >
          <IconGauge className="w-3.5 h-3.5" />
          <span>Overview & Live Logs</span>
        </button>

        <button
          onClick={() => setActiveSubView("directory")}
          className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors flex items-center gap-2 rounded-xs cursor-pointer relative ${
            activeSubView === "directory"
              ? "bg-ink text-surface shadow-xs"
              : "bg-surface hover:bg-raised text-ink-dim hover:text-ink border border-hairline"
          }`}
        >
          <IconList className="w-3.5 h-3.5" />
          <span>Platform URL Directory</span>
          {unsubmittedCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-extrabold rounded-full animate-pulse">
              {unsubmittedCount} unindexed
            </span>
          )}
        </button>
      </div>

      {/* In-app Alerts */}
      {error && (
        <div className="p-3 sm:p-3.5 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-mono flex items-start justify-between gap-2.5 rounded-xs">
          <div className="flex items-start gap-2 min-w-0">
            <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed break-words">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-ink-dim hover:text-ink cursor-pointer p-0.5 shrink-0">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 sm:p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-mono flex items-start justify-between gap-2.5 rounded-xs">
          <div className="flex items-start gap-2 min-w-0">
            <IconCheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed break-words">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-ink-dim hover:text-ink cursor-pointer p-0.5 shrink-0">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW & LIVE LOGS */}
      {activeSubView === "overview" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Hero 3-Column Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* 1. Google Daily Quota Card */}
            <div className="p-3.5 sm:p-4 border border-hairline bg-surface rounded-xs relative overflow-hidden flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <IconGauge className="w-4 h-4 text-signal shrink-0" />
                    <span className="text-[11px] font-mono uppercase text-ink-dim font-bold tracking-wider">
                      Google 24h Quota
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline bg-raised rounded-xs text-ink font-semibold">
                    Max 200/day
                  </span>
                </div>

                <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-ink">
                    {quota.usedToday}
                  </span>
                  <span className="text-xs font-mono text-ink-dim font-bold">
                    / {quota.limit} URLs
                  </span>
                </div>

                {/* Quota Progress Bar */}
                <div className="mt-2.5 sm:mt-3 w-full bg-raised h-2 rounded-full overflow-hidden border border-hairline/60">
                  <div
                    className={`h-full transition-all duration-500 ${
                      quotaPercent > 90 ? "bg-red-500" : quotaPercent > 70 ? "bg-amber-500" : "bg-signal"
                    }`}
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 sm:pt-3 border-t border-hairline flex items-center justify-between text-[11px] font-mono text-ink-dim">
                <span>Remaining: <strong className="text-ink">{quota.remaining}</strong></span>
                <span className="flex items-center gap-1">
                  <IconClock className="w-3 h-3 text-ink-dim" />
                  Resets 00:00 UTC
                </span>
              </div>
            </div>

            {/* 2. Engines & Auth Status Card */}
            <div className="p-3.5 sm:p-4 border border-hairline bg-surface rounded-xs flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-1.5">
                  <IconGlobe className="w-4 h-4 text-signal shrink-0" />
                  <span className="text-[11px] font-mono uppercase text-ink-dim font-bold tracking-wider">
                    Search Engine Endpoints
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {/* Google Indexing API */}
                  <div className="flex items-center justify-between gap-2 text-xs font-mono p-2 sm:p-2.5 bg-raised/50 border border-hairline/60 rounded-xs">
                    <span className="font-bold flex items-center gap-2 text-ink truncate text-[11px] sm:text-xs">
                      <IconGoogle className="w-4 h-4 shrink-0" />
                      <span className="truncate">Google Search API</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs flex items-center gap-1 shrink-0 ${
                        auth.hasWebIndexingApiKey
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                          : "bg-red-500/10 text-red-500 border border-red-500/30"
                      }`}
                    >
                      {auth.hasWebIndexingApiKey ? (
                        <>
                          <IconCheckCircle className="w-3 h-3" />
                          Active Key
                        </>
                      ) : (
                        <>
                          <IconXCircle className="w-3 h-3" />
                          Unconfigured
                        </>
                      )}
                    </span>
                  </div>

                  {/* IndexNow */}
                  <div className="flex items-center justify-between gap-2 text-xs font-mono p-2 sm:p-2.5 bg-raised/50 border border-hairline/60 rounded-xs">
                    <span className="font-bold flex items-center gap-2 text-ink truncate text-[11px] sm:text-xs">
                      <IconMicrosoft className="w-4 h-4 shrink-0" />
                      <span className="truncate">IndexNow (Bing/Yandex)</span>
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                      <IconCheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-hairline text-[10px] font-mono text-ink-dim">
                Automated triggers on Product Launch & Profile Update.
              </div>
            </div>

            {/* 3. Overall Submissions Card */}
            <div className="p-3.5 sm:p-4 border border-hairline bg-surface rounded-xs flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-1.5">
                  <IconLayers className="w-4 h-4 text-signal shrink-0" />
                  <span className="text-[11px] font-mono uppercase text-ink-dim font-bold tracking-wider">
                    Total Submissions Audit
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  <div className="p-2 border border-hairline/60 bg-raised/40 rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-emerald-500 font-bold">
                      <IconCheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="text-base sm:text-lg font-mono">{stats.successSubmissions}</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono text-ink-dim uppercase mt-0.5 truncate">Success</div>
                  </div>
                  <div className="p-2 border border-hairline/60 bg-raised/40 rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-red-500 font-bold">
                      <IconXCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="text-base sm:text-lg font-mono">{stats.failedSubmissions}</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono text-ink-dim uppercase mt-0.5 truncate">Failed</div>
                  </div>
                  <div className="p-2 border border-hairline/60 bg-raised/40 rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-amber-500 font-bold">
                      <IconClock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="text-base sm:text-lg font-mono">{stats.quotaSkippedSubmissions}</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono text-ink-dim uppercase mt-0.5 truncate">Capped</div>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 sm:pt-3 border-t border-hairline text-[11px] font-mono text-ink-dim flex justify-between">
                <span>All-time Total</span>
                <strong className="text-ink font-bold">{stats.totalSubmissions} logs</strong>
              </div>
            </div>
          </div>

          {/* Quick Notice to Unsubmitted Directory */}
          {unsubmittedCount > 0 && (
            <div className="p-3.5 border border-amber-500/40 bg-amber-500/10 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <IconClock className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-ink">
                  You have <strong className="text-amber-500 font-bold">{unsubmittedCount} platform URL(s)</strong> that have not yet been submitted for web search indexing.
                </span>
              </div>
              <button
                onClick={() => setActiveSubView("directory")}
                className="px-3 py-1.5 bg-amber-500 text-black font-bold uppercase text-[11px] rounded-xs hover:bg-amber-400 cursor-pointer shrink-0"
              >
                Review & Submit URLs →
              </button>
            </div>
          )}

          {/* Manual Submission Form Card */}
          <div className="p-3.5 sm:p-4 border border-hairline bg-surface rounded-xs shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <IconZap className="w-4 h-4 text-signal shrink-0" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
                  Manual URL Submission for Web Indexing
                </h2>
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono text-ink-dim">Single or bulk (one per line)</span>
            </div>

            <p className="text-[11px] sm:text-xs font-mono text-ink-dim leading-relaxed">
              Submit any specific link (e.g. <code className="text-ink bg-raised px-1 py-0.5 rounded-xs">/product/cursor</code>, <code className="text-ink bg-raised px-1 py-0.5 rounded-xs">/founder/username</code>) or paste multiple URLs.
            </p>

            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                rows={2}
                placeholder="https://thelaunchfeed.com/product/xyz&#10;/founder/username"
                className="w-full p-2.5 sm:p-3 bg-raised/50 border border-hairline text-xs font-mono text-ink placeholder:text-ink-dim/50 focus:outline-hidden focus:border-signal transition-colors rounded-xs"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs font-mono">
                  <span className="text-ink-dim text-[11px] sm:text-xs">Target Engines:</span>
                  <select
                    value={customEngine}
                    onChange={(e) => setCustomEngine(e.target.value as any)}
                    className="w-full sm:w-auto bg-raised border border-hairline px-2.5 py-1.5 text-xs font-mono text-ink cursor-pointer focus:outline-hidden rounded-xs"
                  >
                    <option value="ALL">All Engines (Google & IndexNow)</option>
                    <option value="GOOGLE">Google Indexing API Only</option>
                    <option value="INDEXNOW">IndexNow (Bing/Yandex) Only</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submittingCustom || !customInput.trim()}
                  className="w-full sm:w-auto h-9 sm:h-8 px-4 bg-ink text-surface hover:bg-signal text-xs font-mono font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 rounded-xs shadow-xs shrink-0"
                >
                  {submittingCustom ? (
                    <>
                      <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <IconZap className="w-3.5 h-3.5" />
                      Submit for Indexing
                    </>
                  )}
                </button>
              </div>
            </form>

            {customResult && (
              <div className="mt-3 p-3 bg-raised/50 border border-hairline text-xs font-mono text-ink rounded-xs space-y-2">
                <div className="flex items-center justify-between text-ink-dim text-[11px] border-b border-hairline/60 pb-1.5">
                  <span className="font-bold uppercase flex items-center gap-1">
                    <IconCode className="w-3 h-3 text-signal" />
                    Response Payload
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(customResult, null, 2), "custom-res")}
                    className="hover:text-ink flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "custom-res" ? (
                      <>
                        <IconCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <IconCopy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto max-h-40 text-ink text-[11px] leading-relaxed">
                  {JSON.stringify(customResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Audit Logs Section */}
          <div className="border border-hairline bg-surface rounded-xs overflow-hidden shadow-xs">
            {/* Table & Filter Header */}
            <div className="p-3 sm:p-3.5 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-surface">
              <div className="flex items-center gap-2">
                <IconLayers className="w-4 h-4 text-signal shrink-0" />
                <h3 className="text-xs font-mono font-bold uppercase text-ink">
                  Recent Indexing Logs ({filteredLogs.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:flex sm:items-center gap-2">
                <div className="relative w-full sm:w-48">
                  <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search URL…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 bg-raised/50 border border-hairline text-xs font-mono text-ink placeholder:text-ink-dim/50 focus:outline-hidden focus:border-signal rounded-xs"
                  />
                </div>

                <div className="relative flex items-center w-full sm:w-auto">
                  <IconFilter className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full sm:w-auto h-8 pl-7 pr-3 bg-raised border border-hairline text-xs font-mono text-ink cursor-pointer focus:outline-hidden rounded-xs"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="FAILED">FAILED</option>
                    <option value="SKIPPED_QUOTA">SKIPPED_QUOTA</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-hairline">
              {filteredLogs.length === 0 ? (
                <div className="py-8 text-center text-ink-dim font-mono text-xs">
                  <IconGlobe className="w-5 h-5 opacity-40 mx-auto mb-1.5" />
                  No indexing logs match current filters.
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="p-3 hover:bg-raised/40 transition-colors space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border border-hairline rounded-xs bg-surface text-ink">
                          {log.engine === "GOOGLE" ? (
                            <IconGoogle className="w-3 h-3 shrink-0" />
                          ) : (
                            <IconMicrosoft className="w-3 h-3 shrink-0" />
                          )}
                          {log.engine}
                        </span>
                        <span className="text-[10px] text-ink-dim uppercase">
                          {log.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                              : log.status === "SKIPPED_QUOTA"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                              : "bg-red-500/10 text-red-500 border border-red-500/30"
                          }`}
                        >
                          {log.status === "SUCCESS" ? (
                            <IconCheckCircle className="w-3 h-3" />
                          ) : log.status === "SKIPPED_QUOTA" ? (
                            <IconClock className="w-3 h-3" />
                          ) : (
                            <IconXCircle className="w-3 h-3" />
                          )}
                          {log.status}
                        </span>

                        {log.httpStatus && (
                          <span className={`text-[10px] font-bold ${log.httpStatus >= 200 && log.httpStatus < 300 ? "text-emerald-500" : "text-red-500"}`}>
                            HTTP {log.httpStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <a
                        href={log.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink font-medium hover:text-signal hover:underline break-all inline-flex items-center gap-1 text-[11px]"
                      >
                        <span>{log.url}</span>
                        <IconExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                      </a>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-ink-dim pt-1 border-t border-hairline/60">
                      <span>
                        {new Date(log.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" · "}
                        {new Date(log.submittedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>

                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-ink-dim hover:text-ink underline cursor-pointer p-0.5"
                      >
                        <IconCode className="w-3 h-3" />
                        Inspect
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-raised/70 border-b border-hairline text-[11px] text-ink-dim uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Submitted URL</th>
                    <th className="py-2.5 px-3">Engine</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">HTTP</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-ink-dim font-mono text-xs">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <IconGlobe className="w-5 h-5 opacity-40" />
                          <span>No indexing logs match current filters.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-raised/40 transition-colors">
                    <td className="py-2.5 px-3 max-w-[320px] truncate font-medium text-ink">
                      <a
                        href={log.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-signal inline-flex items-center gap-1"
                        title={log.url}
                      >
                        <span className="truncate">{log.url}</span>
                        <IconExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                      </a>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border border-hairline rounded-xs bg-surface text-ink">
                        {log.engine === "GOOGLE" ? (
                          <IconGoogle className="w-3 h-3 shrink-0" />
                        ) : (
                          <IconMicrosoft className="w-3 h-3 shrink-0" />
                        )}
                        {log.engine}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-ink-dim">
                      {log.type}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                            : log.status === "SKIPPED_QUOTA"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                            : "bg-red-500/10 text-red-500 border border-red-500/30"
                        }`}
                      >
                        {log.status === "SUCCESS" ? (
                          <IconCheckCircle className="w-3 h-3" />
                        ) : log.status === "SKIPPED_QUOTA" ? (
                          <IconClock className="w-3 h-3" />
                        ) : (
                          <IconXCircle className="w-3 h-3" />
                        )}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-ink-dim font-mono">
                      {log.httpStatus ? (
                        <span className={log.httpStatus >= 200 && log.httpStatus < 300 ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                          {log.httpStatus}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-ink-dim text-[11px] whitespace-nowrap">
                      {new Date(log.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                      <span className="text-[10px] opacity-70">
                        {new Date(log.submittedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-dim hover:text-ink hover:underline cursor-pointer"
                      >
                        <IconCode className="w-3 h-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* TAB 2: PLATFORM URL DIRECTORY & INDEXING MANAGER */}
      {activeSubView === "directory" && (
        <div className="space-y-4">
          {/* Top Control Bar for Platform URLs */}
          <div className="p-3.5 sm:p-4 border border-hairline bg-surface rounded-xs shadow-xs space-y-3.5 font-mono">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-hairline">
              <div>
                <div className="flex items-center gap-2">
                  <IconList className="w-4 h-4 text-signal" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase text-ink">
                    Platform URL Directory ({filteredPlatformUrls.length} found)
                  </h2>
                </div>
                <p className="text-[11px] text-ink-dim mt-0.5">
                  Audit all existing platform URLs and batch-submit any unindexed pages to Google & IndexNow.
                </p>
              </div>

              {/* Batch Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-ink-dim text-[11px]">Engine:</span>
                  <select
                    value={batchEngine}
                    onChange={(e) => setBatchEngine(e.target.value as any)}
                    className="bg-raised border border-hairline px-2 py-1 text-xs font-mono text-ink cursor-pointer focus:outline-hidden rounded-xs"
                  >
                    <option value="ALL">All (Google + IndexNow)</option>
                    <option value="GOOGLE">Google Only</option>
                    <option value="INDEXNOW">IndexNow Only</option>
                  </select>
                </div>

                <button
                  onClick={handleSubmitSelected}
                  disabled={selectedUrls.length === 0 || submittingBatch}
                  className="h-8 px-3 bg-ink text-surface hover:bg-signal text-xs font-bold uppercase transition-colors flex items-center gap-1.5 rounded-xs cursor-pointer disabled:opacity-40"
                >
                  {submittingBatch ? <IconRefresh className="w-3.5 h-3.5 animate-spin" /> : <IconSend className="w-3.5 h-3.5" />}
                  Submit Selected ({selectedUrls.length})
                </button>

                <button
                  onClick={handleAutoDiscoverAndIndexProducts}
                  disabled={autoDiscovering || submittingBatch}
                  className="h-8 px-3 bg-raised hover:bg-surface border border-hairline hover:border-signal text-ink text-xs font-bold uppercase transition-colors flex items-center gap-1.5 rounded-xs cursor-pointer disabled:opacity-40"
                  title="Auto-discover all live products from the database and submit unindexed pages"
                >
                  {autoDiscovering ? <IconRefresh className="w-3.5 h-3.5 animate-spin" /> : <IconZap className="w-3.5 h-3.5 text-signal" />}
                  Auto-Discover Products
                </button>

                {unsubmittedCount > 0 && (
                  <button
                    onClick={handleSubmitAllUnsubmitted}
                    disabled={submittingBatch || autoDiscovering}
                    className="h-8 px-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase transition-colors flex items-center gap-1.5 rounded-xs cursor-pointer disabled:opacity-40 shadow-xs"
                  >
                    {submittingBatch ? <IconRefresh className="w-3.5 h-3.5 animate-spin" /> : <IconZap className="w-3.5 h-3.5" />}
                    Submit All Unsubmitted ({unsubmittedCount})
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills & Search Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Filter 1: Status (Unsubmitted / Submitted / All) */}
              <div>
                <label className="text-[10px] text-ink-dim uppercase block mb-1">Index Status Filter</label>
                <div className="grid grid-cols-3 gap-1 bg-raised/50 p-1 border border-hairline rounded-xs text-[11px] text-center">
                  <button
                    type="button"
                    onClick={() => setDirStatusFilter("UNSUBMITTED")}
                    className={`py-1 rounded-xs transition-colors cursor-pointer font-bold ${
                      dirStatusFilter === "UNSUBMITTED" ? "bg-amber-500 text-black shadow-xs" : "text-ink-dim hover:text-ink"
                    }`}
                  >
                    Unindexed ({unsubmittedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirStatusFilter("SUBMITTED")}
                    className={`py-1 rounded-xs transition-colors cursor-pointer font-bold ${
                      dirStatusFilter === "SUBMITTED" ? "bg-emerald-500 text-black shadow-xs" : "text-ink-dim hover:text-ink"
                    }`}
                  >
                    Submitted ({urlsData?.submittedCount ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirStatusFilter("ALL")}
                    className={`py-1 rounded-xs transition-colors cursor-pointer font-bold ${
                      dirStatusFilter === "ALL" ? "bg-ink text-surface shadow-xs" : "text-ink-dim hover:text-ink"
                    }`}
                  >
                    All ({urlsData?.totalCount ?? 0})
                  </button>
                </div>
              </div>

              {/* Filter 2: Type Filter */}
              <div>
                <label className="text-[10px] text-ink-dim uppercase block mb-1">Content Type</label>
                <select
                  value={dirTypeFilter}
                  onChange={(e) => setDirTypeFilter(e.target.value as any)}
                  className="w-full h-8 bg-raised border border-hairline px-2.5 text-xs font-mono text-ink cursor-pointer focus:outline-hidden rounded-xs"
                >
                  <option value="ALL">All Types ({urlsData?.totalCount ?? 0})</option>
                  <option value="PRODUCT">Products Only ({urlsData?.productsCount ?? 0})</option>
                  <option value="FOUNDER">Founders Only ({urlsData?.foundersCount ?? 0})</option>
                  <option value="CATEGORY">Categories Only ({urlsData?.categoriesCount ?? 0})</option>
                  <option value="STATIC">Static Pages Only ({urlsData?.staticCount ?? 0})</option>
                </select>
              </div>

              {/* Filter 3: Search text */}
              <div>
                <label className="text-[10px] text-ink-dim uppercase block mb-1">Search Directory</label>
                <div className="relative">
                  <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter by name or /path…"
                    value={dirSearch}
                    onChange={(e) => setDirSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 bg-raised/50 border border-hairline text-xs font-mono text-ink placeholder:text-ink-dim/50 focus:outline-hidden focus:border-signal rounded-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Directory List Container */}
          <div className="border border-hairline bg-surface rounded-xs overflow-hidden shadow-xs font-mono">
            <div className="p-3 border-b border-hairline bg-surface flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    filteredPlatformUrls.length > 0 &&
                    filteredPlatformUrls.every((u) => selectedUrls.includes(u.url))
                  }
                  onChange={toggleSelectAllFiltered}
                  className="cursor-pointer accent-signal w-4 h-4 rounded-xs"
                />
                <span className="text-ink font-bold">Select All Filtered ({filteredPlatformUrls.length})</span>
              </div>

              <div className="text-ink-dim text-[11px]">
                {selectedUrls.length} selected
              </div>
            </div>

            {/* Mobile Directory Cards View */}
            <div className="block md:hidden divide-y divide-hairline text-xs">
              {filteredPlatformUrls.length === 0 ? (
                <div className="py-12 text-center text-ink-dim text-xs">
                  <IconGlobe className="w-6 h-6 opacity-40 mx-auto mb-2" />
                  No platform URLs match the selected criteria.
                </div>
              ) : (
                filteredPlatformUrls.map((item) => {
                  const isSelected = selectedUrls.includes(item.url);
                  return (
                    <div
                      key={item.id}
                      className={`p-3 space-y-2 transition-colors ${
                        isSelected ? "bg-signal/5" : "hover:bg-raised/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUrl(item.url)}
                            className="cursor-pointer accent-signal w-4 h-4 rounded-xs mt-0.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-ink text-[12px] truncate">{item.title}</span>
                              <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase border border-hairline rounded-xs bg-raised text-ink-dim shrink-0">
                                {item.type}
                              </span>
                            </div>
                            {item.subtitle && (
                              <p className="text-[10px] text-ink-dim truncate mt-0.5">{item.subtitle}</p>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {item.isSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                              <IconCheckCircle className="w-3 h-3" />
                              Indexed ({item.submissionCount}x)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                              <IconClock className="w-3 h-3" />
                              Not Submitted
                            </span>
                          )}
                        </div>
                      </div>

                      {/* URL Link */}
                      <div className="pt-0.5 pl-6">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink font-medium hover:text-signal hover:underline break-all inline-flex items-center gap-1 text-[11px]"
                        >
                          <span className="truncate">{item.path}</span>
                          <IconExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                        </a>
                      </div>

                      {/* Action & Metadata Footer */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-hairline/60 pl-6 text-[10px] text-ink-dim">
                        <span>
                          {item.lastSubmittedAt
                            ? `Last: ${new Date(item.lastSubmittedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`
                            : "Never submitted"}
                        </span>

                        <button
                          onClick={() => handleSingleDirectorySubmit(item.url)}
                          disabled={submittingSingleUrl === item.url}
                          className="px-2.5 py-1 bg-ink text-surface hover:bg-signal text-[10px] font-bold uppercase transition-colors rounded-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {submittingSingleUrl === item.url ? (
                            <IconRefresh className="w-3 h-3 animate-spin" />
                          ) : (
                            <IconSend className="w-3 h-3" />
                          )}
                          {item.isSubmitted ? "Re-index" : "Submit"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Directory Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-raised/70 border-b border-hairline text-[11px] text-ink-dim uppercase">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredPlatformUrls.length > 0 &&
                          filteredPlatformUrls.every((u) => selectedUrls.includes(u.url))
                        }
                        onChange={toggleSelectAllFiltered}
                        className="cursor-pointer accent-signal w-3.5 h-3.5 rounded-xs"
                      />
                    </th>
                    <th className="py-2.5 px-3">Title & Type</th>
                    <th className="py-2.5 px-3">Platform Path</th>
                    <th className="py-2.5 px-3">Indexing Status</th>
                    <th className="py-2.5 px-3">Submissions</th>
                    <th className="py-2.5 px-3">Last Checked</th>
                    <th className="py-2.5 px-3 text-right">Quick Submit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredPlatformUrls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-ink-dim text-xs">
                        <IconGlobe className="w-6 h-6 opacity-40 mx-auto mb-2" />
                        No platform URLs match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPlatformUrls.map((item) => {
                      const isSelected = selectedUrls.includes(item.url);
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isSelected ? "bg-signal/5" : "hover:bg-raised/40"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectUrl(item.url)}
                              className="cursor-pointer accent-signal w-3.5 h-3.5 rounded-xs"
                            />
                          </td>
                          <td className="py-2.5 px-3 max-w-[240px]">
                            <div className="font-bold text-ink truncate">{item.title}</div>
                            <span className="text-[10px] text-ink-dim uppercase px-1 py-0.2 border border-hairline rounded-xs bg-raised inline-block mt-0.5">
                              {item.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[280px] truncate">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-ink hover:text-signal hover:underline inline-flex items-center gap-1"
                              title={item.url}
                            >
                              <span className="truncate">{item.path}</span>
                              <IconExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                            </a>
                          </td>
                          <td className="py-2.5 px-3">
                            {item.isSubmitted ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                                <IconCheckCircle className="w-3 h-3" />
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                                <IconClock className="w-3 h-3" />
                                Not Submitted
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-ink-dim">
                            {item.submissionCount > 0 ? `${item.submissionCount} time(s)` : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-ink-dim text-[11px] whitespace-nowrap">
                            {item.lastSubmittedAt ? (
                              <>
                                {new Date(item.lastSubmittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                                <span className="text-[10px] opacity-70">
                                  {new Date(item.lastSubmittedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </span>
                              </>
                            ) : (
                              <span className="text-amber-500/70 font-semibold">Never</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleSingleDirectorySubmit(item.url)}
                              disabled={submittingSingleUrl === item.url}
                              className="px-2.5 py-1 bg-ink text-surface hover:bg-signal text-[11px] font-bold uppercase transition-colors rounded-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {submittingSingleUrl === item.url ? (
                                <IconRefresh className="w-3 h-3 animate-spin" />
                              ) : (
                                <IconSend className="w-3 h-3" />
                              )}
                              {item.isSubmitted ? "Re-index" : "Submit"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Log Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-hairline max-w-xl w-full max-h-[88vh] flex flex-col p-4 sm:p-5 rounded-xs font-mono shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-hairline pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <IconCode className="w-4 h-4 text-signal" />
                <h4 className="text-xs font-bold uppercase text-ink">Indexing Log Inspection</h4>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-ink-dim hover:text-ink p-1 cursor-pointer"
                title="Close"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="space-y-3 text-xs overflow-y-auto py-3 pr-1">
              <div>
                <span className="text-ink-dim text-[10px] sm:text-[11px] block mb-0.5 uppercase tracking-wider">
                  Submitted URL
                </span>
                <div className="flex items-center justify-between gap-2 p-2 bg-raised/50 border border-hairline rounded-xs">
                  <span className="text-ink font-bold break-all text-[11px]">{selectedLog.url}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedLog.url, "modal-url")}
                    className="p-1.5 text-ink-dim hover:text-ink shrink-0 cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedKey === "modal-url" ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-raised/40 border border-hairline rounded-xs">
                  <span className="text-ink-dim text-[9px] sm:text-[10px] block uppercase">Engine</span>
                  <span className="text-ink font-bold text-[10px] sm:text-[11px] inline-flex items-center gap-1 mt-0.5 truncate">
                    {selectedLog.engine === "GOOGLE" ? <IconGoogle className="w-3 h-3 shrink-0" /> : <IconMicrosoft className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{selectedLog.engine}</span>
                  </span>
                </div>
                <div className="p-2 bg-raised/40 border border-hairline rounded-xs">
                  <span className="text-ink-dim text-[9px] sm:text-[10px] block uppercase">Status</span>
                  <span className={`text-[10px] sm:text-[11px] font-bold mt-0.5 inline-block truncate ${selectedLog.status === "SUCCESS" ? "text-emerald-500" : selectedLog.status === "SKIPPED_QUOTA" ? "text-amber-500" : "text-red-500"}`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div className="p-2 bg-raised/40 border border-hairline rounded-xs">
                  <span className="text-ink-dim text-[9px] sm:text-[10px] block uppercase">HTTP</span>
                  <span className="text-ink font-bold text-[10px] sm:text-[11px] mt-0.5 inline-block truncate">
                    {selectedLog.httpStatus || "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-ink-dim text-[10px] block uppercase">Timestamp</span>
                <span className="text-ink text-[11px]">{new Date(selectedLog.submittedAt).toLocaleString()}</span>
              </div>

              {selectedLog.errorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xs space-y-1">
                  <div className="font-bold text-[11px] flex items-center gap-1.5">
                    <IconAlertTriangle className="w-3.5 h-3.5" />
                    Error Message:
                  </div>
                  <div className="text-[11px] break-all leading-relaxed">{selectedLog.errorMessage}</div>
                </div>
              )}

              {selectedLog.responseBody && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-ink-dim text-[10px] uppercase">
                    <span>Response Payload:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedLog.responseBody!, "modal-body")}
                      className="hover:text-ink flex items-center gap-1 cursor-pointer p-0.5"
                    >
                      {copiedKey === "modal-body" ? (
                        <>
                          <IconCheck className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <IconCopy className="w-3 h-3" />
                          <span>Copy Payload</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-raised border border-hairline text-[10px] sm:text-[11px] overflow-x-auto max-h-44 text-ink rounded-xs leading-relaxed">
                    {selectedLog.responseBody}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2.5 border-t border-hairline shrink-0">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto px-4 py-2 sm:py-1.5 border border-hairline bg-raised hover:bg-surface text-xs font-mono font-bold uppercase cursor-pointer rounded-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
