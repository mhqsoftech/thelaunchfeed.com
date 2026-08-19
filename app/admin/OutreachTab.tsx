"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getDirectoryLeadsOverviewAction,
  crawlDirectoryAction,
  importRawLeadsAction,
  updateAutoOutreachConfigAction,
  sendOutreachCampaignAction,
  sendTestOutreachEmailAction,
  triggerAutoOutreachBatchAction,
  updateLeadStatusAction,
  deleteLeadsAction,
  addCustomDirectoryAction,
  deleteCustomDirectoryAction,
  updateAutoCrawlerConfigAction,
  runDailyDirectoryCrawlBatchAction,
  type DirectoryLeadsOverview,
} from "@/app/actions/leads";
import {
  PREDEFINED_DIRECTORIES,
  DEFAULT_AUTO_CONFIG,
  DEFAULT_AUTO_CRAWLER_CONFIG,
  type AutoOutreachConfig,
  type AutoCrawlerConfig,
  type CustomDirectory,
} from "@/lib/crawler/constants";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

export default function OutreachTab() {
  const [data, setData] = useState<DirectoryLeadsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sub-view navigation: "leads" | "crawler" | "automation"
  const [activeSubView, setActiveSubView] = useState<"leads" | "crawler" | "automation">("leads");

  // Crawler form state
  const [crawlUrl, setCrawlUrl] = useState("");
  const [selectedDirName, setSelectedDirName] = useState("Uneed.best");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlSummary, setCrawlSummary] = useState<any | null>(null);

  // Raw import state
  const [rawText, setRawText] = useState("");
  const [rawDirSource, setRawDirSource] = useState("Product Hunt");
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  // Table filters & selection
  const [filterDirectory, setFilterDirectory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [expandedDirName, setExpandedDirName] = useState<string | null>(null);

  // Automation settings state
  const [autoConfig, setAutoConfig] = useState<AutoOutreachConfig>({
    enabled: false,
    dailyLimit: 50,
    autoSendOnCrawl: false,
    sendDelayMs: 1000,
    testEmailRecipient: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Auto-Crawler scheduled settings & batch sweep state
  const [autoCrawlerConfig, setAutoCrawlerConfig] = useState<AutoCrawlerConfig>(DEFAULT_AUTO_CRAWLER_CONFIG);
  const [savingCrawlerConfig, setSavingCrawlerConfig] = useState(false);
  const [isRunningBatchCrawl, setIsRunningBatchCrawl] = useState(false);
  const [batchCrawlSummary, setBatchCrawlSummary] = useState<any | null>(null);

  // Add custom directory modal state
  const [isAddDirModalOpen, setIsAddDirModalOpen] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [newDirUrl, setNewDirUrl] = useState("");
  const [newDirCategory, setNewDirCategory] = useState<"Daily Launchpad" | "Curated Directory" | "Indie Hacker" | "AI & SaaS">("Daily Launchpad");
  const [newDirDesc, setNewDirDesc] = useState("");
  const [isAddingDir, setIsAddingDir] = useState(false);
  const [deletingDirId, setDeletingDirId] = useState<string | null>(null);

  // Preview / Test Email Modal state
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);
  const [testEmailInput, setTestEmailInput] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDirectoryLeadsOverviewAction();
      setData(res);
      setAutoConfig(res.autoConfig);
      if (res.autoCrawlerConfig) {
        setAutoCrawlerConfig(res.autoCrawlerConfig);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load directory leads telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to detect directory label automatically from URL or text
  const detectDirectoryLabel = (input: string): string => {
    if (!input || !input.trim()) return "";
    try {
      const clean = input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`;
      const hostname = new URL(clean).hostname.replace(/^www\./, "").toLowerCase();
      const matched = PREDEFINED_DIRECTORIES.find(
        (d) =>
          hostname.includes(d.id.toLowerCase()) ||
          d.url.toLowerCase().includes(hostname) ||
          hostname.includes(d.url.replace(/^https?:\/\/(www\.)?/, "").toLowerCase())
      );
      if (matched) return matched.name;
      const namePart = hostname.split(".")[0];
      return namePart ? namePart.charAt(0).toUpperCase() + namePart.slice(1) : "";
    } catch {
      // Check if text mentions a predefined directory name
      const lower = input.toLowerCase();
      const matched = PREDEFINED_DIRECTORIES.find((d) => lower.includes(d.name.toLowerCase()) || lower.includes(d.id));
      return matched ? matched.name : "";
    }
  };

  // Crawl a specific directory URL
  const handleCrawl = async (urlToCrawl = crawlUrl, dirName?: string) => {
    if (!urlToCrawl.trim()) {
      setError("Please enter a directory URL to crawl.");
      return;
    }

    const finalDirName = dirName || selectedDirName || detectDirectoryLabel(urlToCrawl) || "Custom Directory";

    try {
      setIsCrawling(true);
      setError(null);
      setSuccessMsg(null);
      setCrawlSummary(null);

      const res = await crawlDirectoryAction(urlToCrawl, finalDirName);
      setCrawlSummary(res);
      setSuccessMsg(
        `Crawling finished for ${res.sourceDirectory}: Found ${res.leadsFound} leads (${res.newLeadsSaved} new saved, ${res.existingLeadsUpdated} existing updated).`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Directory crawl failed");
    } finally {
      setIsCrawling(false);
    }
  };

  // Crawl from predefined directory card
  const handlePresetCrawl = async (dir: (typeof PREDEFINED_DIRECTORIES)[0]) => {
    setCrawlUrl(dir.url);
    setSelectedDirName(dir.name);
    setRawDirSource(dir.name);
    await handleCrawl(dir.url, dir.name);
  };

  // Import raw text / CSV
  const handleImportRaw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    const finalDir = rawDirSource || detectDirectoryLabel(rawText) || "Direct Import";

    try {
      setIsImporting(true);
      setError(null);
      setSuccessMsg(null);
      setImportSummary(null);
      const res = await importRawLeadsAction(rawText, finalDir);
      setImportSummary(res);
      setSuccessMsg(
        `Import complete: Parsed ${res.total} contact(s) (${res.created} new created, ${res.updated} updated).`
      );
      setRawText("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Raw import failed");
    } finally {
      setIsImporting(false);
    }
  };

  // Save automation settings — persists the full autoConfig via the admin
  // action. Used by both the explicit "Save Settings" button and the
  // per-toggle auto-persist below so any UI change reaches the DB immediately.
  const persistAutoConfig = async (next: AutoOutreachConfig): Promise<AutoOutreachConfig | null> => {
    try {
      setSavingConfig(true);
      setError(null);
      const updated = await updateAutoOutreachConfigAction(next);
      setAutoConfig(updated);
      return updated;
    } catch (err: any) {
      setError(err?.message || "Failed to update auto outreach configuration");
      return null;
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveAutoConfig = async () => {
    try {
      setSuccessMsg(null);
      const updated = await persistAutoConfig(autoConfig);
      if (updated) setSuccessMsg("Automatic outreach configuration updated successfully.");
      await loadData();
    } finally {
      // persistAutoConfig manages savingConfig; nothing else to reset.
    }
  };

  // Trigger auto outreach batch immediately
  const handleTriggerAutoBatch = () => {
    startTransition(async () => {
      try {
        setError(null);
        setSuccessMsg(null);
        const res = await triggerAutoOutreachBatchAction();
        if ("sentCount" in res) {
          setSuccessMsg(
            `Auto-outreach batch processed: Sent ${res.sentCount || 0} emails (${res.failedCount || 0} failed).`
          );
        } else {
          setSuccessMsg(res.message || "Auto-outreach batch completed.");
        }
        await loadData();
      } catch (err: any) {
        setError(err?.message || "Failed to trigger auto outreach batch");
      }
    });
  };

  // Send campaign to selected leads
  const handleSendCampaign = async () => {
    if (selectedLeadIds.length === 0) return;

    const confirmed = confirm(
      `Send personalized outreach emails to ${selectedLeadIds.length} selected founder(s)?`
    );
    if (!confirmed) return;

    try {
      setSendingCampaign(true);
      setError(null);
      setSuccessMsg(null);
      const res = await sendOutreachCampaignAction(selectedLeadIds);
      setSuccessMsg(
        `Campaign dispatched: Successfully sent ${res.sentCount} email(s) (${res.failedCount} failed).`
      );
      setSelectedLeadIds([]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to send outreach campaign");
    } finally {
      setSendingCampaign(false);
    }
  };

  // Send single test email
  const handleSendTestEmail = async () => {
    if (!testEmailInput || !testEmailInput.includes("@")) {
      setError("Please enter a valid recipient email address for testing.");
      return;
    }

    try {
      setSendingTestEmail(true);
      setError(null);
      setSuccessMsg(null);
      await sendTestOutreachEmailAction(testEmailInput, previewLeadId || undefined);
      setSuccessMsg(`Test outreach email successfully sent to ${testEmailInput}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to send test email");
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Bulk delete selected leads
  const handleDeleteSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Delete ${selectedLeadIds.length} selected lead(s) permanently?`)) return;

    try {
      setError(null);
      await deleteLeadsAction(selectedLeadIds);
      setSuccessMsg(`Deleted ${selectedLeadIds.length} lead(s).`);
      setSelectedLeadIds([]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete leads");
    }
  };

  // Update Scheduled Daily Crawler Config
  const handleSaveCrawlerConfig = async (updates: Partial<AutoCrawlerConfig>) => {
    try {
      setSavingCrawlerConfig(true);
      setError(null);
      const updated = await updateAutoCrawlerConfigAction(updates);
      setAutoCrawlerConfig(updated);
      setSuccessMsg(
        updates.enabled !== undefined
          ? `Auto-Crawler schedule ${updated.enabled ? "ENABLED (Runs daily at " + updated.scheduledTime + " UTC)" : "DISABLED"}.`
          : `Scheduled time updated to ${updated.scheduledTime} UTC.`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update auto-crawler configuration");
    } finally {
      setSavingCrawlerConfig(false);
    }
  };

  // Run Batch Sweep of all saved directories immediately
  const handleRunBatchCrawl = async () => {
    try {
      setIsRunningBatchCrawl(true);
      setError(null);
      setBatchCrawlSummary(null);
      setSuccessMsg("Initiating batch crawl across all saved launch directories...");
      const summary = await runDailyDirectoryCrawlBatchAction(autoCrawlerConfig.selectedDirectoryIds);
      setBatchCrawlSummary(summary);
      setSuccessMsg(
        `Batch crawl finished! Scanned ${summary.directoriesScanned} directories: Found ${summary.totalLeadsFound} leads (${summary.newLeadsSaved} new saved, ${summary.existingLeadsUpdated} updated).`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to complete full directory sweep");
    } finally {
      setIsRunningBatchCrawl(false);
    }
  };

  // Add Custom Directory
  const handleAddCustomDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirName.trim() || !newDirUrl.trim()) {
      setError("Please provide both a directory name and URL.");
      return;
    }

    try {
      setIsAddingDir(true);
      setError(null);
      const created = await addCustomDirectoryAction({
        name: newDirName.trim(),
        url: newDirUrl.trim(),
        category: newDirCategory,
        description: newDirDesc.trim() || undefined,
      });

      setSuccessMsg(`Added custom directory "${created.name}" successfully.`);
      setNewDirName("");
      setNewDirUrl("");
      setNewDirDesc("");
      setIsAddDirModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to add custom directory");
    } finally {
      setIsAddingDir(false);
    }
  };

  // Delete Custom Directory
  const handleDeleteCustomDirectory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the directory "${name}"?`)) return;

    try {
      setDeletingDirId(id);
      setError(null);
      await deleteCustomDirectoryAction(id);
      setSuccessMsg(`Removed directory "${name}".`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to remove custom directory");
    } finally {
      setDeletingDirId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-20 flex justify-center items-center">
        <LaunchFeedLoader size={28} label="Loading Directory Leads & Outreach telemetry…" />
      </div>
    );
  }

  const stats = data?.stats || {
    totalLeads: 0,
    newLeads: 0,
    emailedLeads: 0,
    convertedLeads: 0,
    bouncedLeads: 0,
  };

  // Filtered leads
  const filteredLeads = (data?.leads || []).filter((lead) => {
    if (filterDirectory !== "ALL" && lead.sourceDirectory !== filterDirectory) return false;
    if (filterStatus !== "ALL" && lead.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.organization.toLowerCase().includes(q) ||
        lead.sourceDirectory.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelectAllFiltered = () => {
    const allFilteredIds = filteredLeads.map((l) => l.id);
    const allSelected = allFilteredIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const selectAllNewLeads = () => {
    const newLeadIds = filteredLeads.filter((l) => l.status === "NEW").map((l) => l.id);
    setSelectedLeadIds(newLeadIds);
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedPreviewLead = data?.leads.find((l) => l.id === previewLeadId) || data?.leads[0] || {
    id: "sample",
    name: "Alex",
    email: "founder@startup.io",
    organization: "SuperTool AI",
    sourceDirectory: "Product Hunt",
  };

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto font-mono text-ink">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-signal shrink-0" />
            <h1 className="text-base sm:text-xl font-bold uppercase tracking-tight">
              Directory Lead Crawler & Outreach Engine
            </h1>
            {autoConfig.enabled && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Auto-Outreach Active
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-ink-dim mt-0.5 leading-relaxed">
            Extract founder contacts from product directories, store unique leads in PostgreSQL, and send branded launch invitation emails.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            disabled={loading}
            className="h-8 px-3 border border-hairline bg-surface hover:bg-raised text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={() => setActiveSubView("crawler")}
            className="h-8 px-3.5 bg-signal text-surface border border-signal hover:opacity-90 text-xs font-bold uppercase transition-opacity cursor-pointer"
          >
            + Crawl Directory
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-hairline pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubView("leads")}
          className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors rounded-xs cursor-pointer ${
            activeSubView === "leads"
              ? "bg-ink text-surface"
              : "bg-surface hover:bg-raised text-ink-dim hover:text-ink border border-hairline"
          }`}
        >
          Prospect Leads ({stats.totalLeads})
        </button>

        <button
          onClick={() => setActiveSubView("crawler")}
          className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors rounded-xs cursor-pointer ${
            activeSubView === "crawler"
              ? "bg-ink text-surface"
              : "bg-surface hover:bg-raised text-ink-dim hover:text-ink border border-hairline"
          }`}
        >
          Directory Crawlers & Importer
        </button>

        <button
          onClick={() => setActiveSubView("automation")}
          className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors rounded-xs cursor-pointer ${
            activeSubView === "automation"
              ? "bg-ink text-surface"
              : "bg-surface hover:bg-raised text-ink-dim hover:text-ink border border-hairline"
          }`}
        >
          Automatic Outreach Settings
          {autoConfig.enabled && (
            <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-start justify-between gap-2">
          <span>[Error] {error}</span>
          <button onClick={() => setError(null)} className="text-ink-dim hover:text-ink cursor-pointer">
            [close]
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-start justify-between gap-2">
          <span>[Success] {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-ink-dim hover:text-ink cursor-pointer">
            [close]
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div className="p-3 border border-hairline bg-surface">
          <div className="text-[10px] uppercase text-ink-dim">Total Leads</div>
          <div className="text-2xl font-bold text-ink mt-1">{stats.totalLeads}</div>
          <div className="text-[10px] text-ink-dim mt-0.5">Unique in DB</div>
        </div>

        <div className="p-3 border border-hairline bg-surface">
          <div className="text-[10px] uppercase text-ink-dim">Ready to Email</div>
          <div className="text-2xl font-bold text-amber-500 mt-1">{stats.newLeads}</div>
          <div className="text-[10px] text-ink-dim mt-0.5">Status: NEW</div>
        </div>

        <div className="p-3 border border-hairline bg-surface">
          <div className="text-[10px] uppercase text-ink-dim">Outreach Sent</div>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.emailedLeads}</div>
          <div className="text-[10px] text-ink-dim mt-0.5">Emailed founders</div>
        </div>

        <div className="p-3 border border-hairline bg-surface">
          <div className="text-[10px] uppercase text-ink-dim">Converted</div>
          <div className="text-2xl font-bold text-ink mt-1">{stats.convertedLeads}</div>
          <div className="text-[10px] text-ink-dim mt-0.5">Launched on Feed</div>
        </div>

        <div className="p-3 border border-hairline bg-surface col-span-2 md:col-span-1">
          <div className="text-[10px] uppercase text-ink-dim">Auto-Dispatch</div>
          <div className="text-base font-bold mt-1">
            {autoConfig.enabled ? (
              <span className="text-emerald-500">ENABLED</span>
            ) : (
              <span className="text-ink-dim">DISABLED</span>
            )}
          </div>
          <div className="text-[10px] text-ink-dim mt-0.5">Limit: {autoConfig.dailyLimit}/day</div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          SUB-VIEW 1: PROSPECT LEADS MANAGER & CAMPAIGN DISPATCHER
         ─────────────────────────────────────────────────────────── */}
      {activeSubView === "leads" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-3 border border-hairline bg-surface flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSendCampaign}
                disabled={selectedLeadIds.length === 0 || sendingCampaign}
                className="h-8 px-3.5 bg-ink text-surface hover:bg-signal text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-40"
              >
                {sendingCampaign ? "Sending..." : `Send Outreach (${selectedLeadIds.length})`}
              </button>

              <button
                onClick={() => setPreviewLeadId(selectedLeadIds[0] || data?.leads[0]?.id || "sample")}
                className="h-8 px-3 border border-hairline bg-surface hover:bg-raised text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Preview Template
              </button>

              <button
                onClick={selectAllNewLeads}
                className="h-8 px-2.5 border border-hairline bg-raised hover:bg-surface text-xs font-bold uppercase cursor-pointer"
              >
                Select All New ({stats.newLeads})
              </button>

              {selectedLeadIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="h-8 px-2.5 border border-red-500/40 text-red-500 hover:bg-red-500/10 text-xs font-bold uppercase cursor-pointer"
                >
                  Delete Selected
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 px-2.5 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden"
              />

              <select
                value={filterDirectory}
                onChange={(e) => setFilterDirectory(e.target.value)}
                className="h-8 px-2 bg-raised border border-hairline text-xs text-ink cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">All Directories ({data?.directories.length || 0})</option>
                {data?.directories.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.count})
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-8 px-2 bg-raised border border-hairline text-xs text-ink cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">NEW ({stats.newLeads})</option>
                <option value="EMAILED">EMAILED ({stats.emailedLeads})</option>
                <option value="CONVERTED">CONVERTED ({stats.convertedLeads})</option>
                <option value="BOUNCED">BOUNCED ({stats.bouncedLeads})</option>
              </select>
            </div>
          </div>

          {/* Mobile Card List (Visible on mobile screens) */}
          <div className="block md:hidden space-y-2.5">
            <div className="p-2.5 bg-surface border border-hairline flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    filteredLeads.length > 0 &&
                    filteredLeads.every((l) => selectedLeadIds.includes(l.id))
                  }
                  onChange={toggleSelectAllFiltered}
                  className="cursor-pointer accent-signal w-4 h-4"
                />
                <span className="font-bold">Select All ({filteredLeads.length})</span>
              </div>
              <span className="text-ink-dim text-[11px] font-bold">
                {selectedLeadIds.length} selected
              </span>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-ink-dim text-xs bg-surface border border-hairline">
                No directory leads found matching filters.
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = selectedLeadIds.includes(lead.id);
                return (
                  <div
                    key={lead.id}
                    className={`p-3.5 border border-hairline bg-surface transition-colors space-y-2.5 ${
                      isSelected ? "border-signal/60 bg-signal/5" : ""
                    }`}
                  >
                    {/* Card Header: Checkbox + Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="cursor-pointer accent-signal w-4 h-4 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-ink truncate">
                            {lead.name || "Unknown Founder"}
                          </div>
                          <div className="text-[11px] text-ink-dim font-mono select-all truncate">
                            {lead.email}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0 rounded-xs ${
                          lead.status === "NEW"
                            ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                            : lead.status === "EMAILED"
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            : lead.status === "CONVERTED"
                            ? "bg-signal/15 text-signal border border-signal/40"
                            : "bg-raised text-ink-dim border border-hairline"
                        }`}
                      >
                        {lead.status}
                        {lead.emailCount > 0 && ` (${lead.emailCount}x)`}
                      </span>
                    </div>

                    {/* Product & Directory Info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-hairline/60">
                      <div>
                        <div className="text-[10px] text-ink-dim uppercase">Product / Org:</div>
                        <div className="font-bold text-ink truncate">{lead.organization || "-"}</div>
                        {lead.productUrl && (
                          <a
                            href={lead.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-signal hover:underline truncate block"
                          >
                            ↗ Visit Site
                          </a>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] text-ink-dim uppercase">Source / Emailed:</div>
                        <div className="font-bold text-ink truncate">{lead.sourceDirectory}</div>
                        <div className="text-[10px] text-ink-dim">
                          {lead.lastEmailedAt
                            ? new Date(lead.lastEmailedAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : "Never emailed"}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-hairline/60">
                      <button
                        onClick={() => setPreviewLeadId(lead.id)}
                        className="py-1.5 border border-hairline bg-raised hover:bg-surface text-[11px] font-bold uppercase transition-colors text-center cursor-pointer"
                      >
                        Preview
                      </button>
                      <button
                        onClick={async () => {
                          await sendOutreachCampaignAction([lead.id]);
                          await loadData();
                        }}
                        className="py-1.5 bg-ink text-surface hover:bg-signal text-[11px] font-bold uppercase transition-colors text-center cursor-pointer"
                      >
                        Send Outreach
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Leads Table (Hidden on mobile) */}
          <div className="hidden md:block border border-hairline bg-surface overflow-hidden">
            <div className="p-3 border-b border-hairline flex items-center justify-between text-xs bg-surface">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    filteredLeads.length > 0 &&
                    filteredLeads.every((l) => selectedLeadIds.includes(l.id))
                  }
                  onChange={toggleSelectAllFiltered}
                  className="cursor-pointer accent-signal w-3.5 h-3.5"
                />
                <span className="font-bold">
                  Select All Filtered ({filteredLeads.length} leads)
                </span>
              </div>
              <span className="text-ink-dim text-[11px]">{selectedLeadIds.length} selected</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-raised/70 border-b border-hairline text-[11px] text-ink-dim uppercase">
                  <tr>
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3">Founder / Email</th>
                    <th className="py-2.5 px-3">Product / Organization</th>
                    <th className="py-2.5 px-3">Source Directory</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last Emailed</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-ink-dim text-xs">
                        No directory leads found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          className={`transition-colors ${
                            isSelected ? "bg-signal/5" : "hover:bg-raised/40"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectLead(lead.id)}
                              className="cursor-pointer accent-signal w-3.5 h-3.5"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-ink">{lead.name || "Unknown"}</div>
                            <div className="text-[11px] text-ink-dim select-all font-mono">{lead.email}</div>
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px] truncate">
                            <div className="text-ink font-medium truncate">
                              {lead.organization || "-"}
                            </div>
                            {lead.productUrl && (
                              <a
                                href={lead.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-ink-dim hover:text-signal hover:underline truncate block"
                              >
                                {lead.productUrl}
                              </a>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 text-[10px] font-bold border border-hairline rounded-xs bg-surface text-ink">
                              {lead.sourceDirectory}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs ${
                                lead.status === "NEW"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                                  : lead.status === "EMAILED"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                                  : lead.status === "CONVERTED"
                                  ? "bg-signal/15 text-signal border border-signal/40"
                                  : "bg-raised text-ink-dim border border-hairline"
                              }`}
                            >
                              {lead.status}
                              {lead.emailCount > 0 && ` (${lead.emailCount}x)`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-ink-dim text-[11px] whitespace-nowrap">
                            {lead.lastEmailedAt ? (
                              new Date(lead.lastEmailedAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            ) : (
                              <span className="text-ink-dim/60">Never</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPreviewLeadId(lead.id)}
                                className="text-[11px] font-bold text-ink-dim hover:text-ink underline cursor-pointer"
                              >
                                Preview
                              </button>
                              <button
                                onClick={async () => {
                                  await sendOutreachCampaignAction([lead.id]);
                                  await loadData();
                                }}
                                className="px-2 py-0.5 bg-ink text-surface hover:bg-signal text-[10px] font-bold uppercase transition-colors cursor-pointer"
                              >
                                Send
                              </button>
                            </div>
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

      {/* ───────────────────────────────────────────────────────────
          SUB-VIEW 2: PREDEFINED DIRECTORY CRAWLERS & RAW IMPORTER
         ─────────────────────────────────────────────────────────── */}
      {activeSubView === "crawler" && (
        <div className="space-y-6">
          {/* Scheduled Daily Auto-Crawler Control Panel */}
          <div className="p-4 border border-hairline bg-surface space-y-3.5 overflow-hidden">
            {/* Header: Title, Active Status Badge, and Description */}
            <div className="space-y-1 pb-3 border-b border-hairline">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${autoCrawlerConfig.enabled ? "bg-emerald-500 animate-pulse" : "bg-ink-dim/40"}`} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Automated Daily Directory Lead Crawler
                </h3>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs border ${
                  autoCrawlerConfig.enabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-raised text-ink-dim border-hairline"
                }`}>
                  {autoCrawlerConfig.enabled ? `Active • Daily at ${autoCrawlerConfig.scheduledTime} UTC` : "Disabled"}
                </span>
              </div>
              <p className="text-[11px] text-ink-dim leading-relaxed max-w-2xl">
                Automatically sweeps all saved startup directories and RSS/Atom feeds at your scheduled daily time to discover and save new founder leads.
              </p>
            </div>

            {/* Schedule Configuration Controls & Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] sm:text-[11px] font-mono font-bold text-ink-dim uppercase whitespace-nowrap">
                    Daily Time:
                  </label>
                  <select
                    value={autoCrawlerConfig.scheduledTime}
                    disabled={savingCrawlerConfig}
                    onChange={(e) => handleSaveCrawlerConfig({ scheduledTime: e.target.value })}
                    className="border border-hairline bg-surface px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-ink cursor-pointer max-w-full"
                  >
                    <option value="00:00">00:00 UTC (Midnight)</option>
                    <option value="03:00">03:00 UTC (Early Morning)</option>
                    <option value="06:00">06:00 UTC (Morning IST/UTC)</option>
                    <option value="09:00">09:00 UTC (Standard Sweep)</option>
                    <option value="12:00">12:00 UTC (Noon)</option>
                    <option value="15:00">15:00 UTC (Afternoon)</option>
                    <option value="18:00">18:00 UTC (Evening / US Morning)</option>
                    <option value="21:00">21:00 UTC (Night)</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={savingCrawlerConfig}
                  onClick={() => handleSaveCrawlerConfig({ enabled: !autoCrawlerConfig.enabled })}
                  className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase transition-colors cursor-pointer border shrink-0 ${
                    autoCrawlerConfig.enabled
                      ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-xs"
                      : "bg-surface text-ink-dim hover:text-ink border-hairline hover:bg-raised"
                  }`}
                >
                  {autoCrawlerConfig.enabled ? "✓ Scheduled (ON)" : "Enable Schedule"}
                </button>
              </div>

              <button
                type="button"
                disabled={isRunningBatchCrawl}
                onClick={handleRunBatchCrawl}
                className="w-full sm:w-auto px-4 py-1.5 bg-ink text-surface hover:bg-signal text-xs font-mono font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
              >
                {isRunningBatchCrawl ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                    <span>Scanning…</span>
                  </>
                ) : (
                  <>
                    <span>▶ Run Crawl Sweep</span>
                  </>
                )}
              </button>
            </div>

            {/* Telemetry / Last Run Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-ink-dim gap-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">Last Daily Sweep:</span>
                <span>
                  {autoCrawlerConfig.lastRunAt
                    ? `${new Date(autoCrawlerConfig.lastRunAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })} (${autoCrawlerConfig.lastRunStats?.directoriesScanned || 0} scanned, ${autoCrawlerConfig.lastRunStats?.newLeadsSaved || 0} new leads)`
                    : "No automated crawl recorded yet."}
                </span>
              </div>

              {autoCrawlerConfig.lastRunStatus && autoCrawlerConfig.lastRunStatus !== "IDLE" && (
                <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase rounded-xs ${
                  autoCrawlerConfig.lastRunStatus === "SUCCESS"
                    ? "text-emerald-500 bg-emerald-500/10"
                    : "text-amber-500 bg-amber-500/10"
                }`}>
                  Status: {autoCrawlerConfig.lastRunStatus}
                </span>
              )}
            </div>

            {/* Batch Crawl Results Banner */}
            {batchCrawlSummary && (
              <div className="p-3 bg-raised/70 border border-hairline text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">
                    ✓ Full Sweep Completed: {batchCrawlSummary.directoriesScanned} Directories Scanned
                  </span>
                  <span className="text-[10px] text-signal font-bold">
                    +{batchCrawlSummary.newLeadsSaved} New Leads Saved
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-hairline/60">
                  <div>
                    <span className="text-ink-dim">Directories:</span>{" "}
                    <span className="font-bold">{batchCrawlSummary.directoriesScanned}</span>
                  </div>
                  <div>
                    <span className="text-ink-dim">Total Found:</span>{" "}
                    <span className="font-bold">{batchCrawlSummary.totalLeadsFound}</span>
                  </div>
                  <div>
                    <span className="text-ink-dim">New Saved:</span>{" "}
                    <span className="font-bold text-emerald-500">+{batchCrawlSummary.newLeadsSaved}</span>
                  </div>
                  <div>
                    <span className="text-ink-dim">Updated:</span>{" "}
                    <span className="font-bold">{batchCrawlSummary.existingLeadsUpdated}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preset & Custom Directories Grid */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase text-ink flex items-center gap-2">
                  <span>Saved Launch Directories & Feeds</span>
                  <span className="text-[10px] text-ink-dim font-normal">
                    ({(data?.predefinedDirectories || PREDEFINED_DIRECTORIES).length} directories)
                  </span>
                </h3>
                <p className="text-[11px] text-ink-dim">
                  Crawl individual platforms, manage saved directory feeds, or dispatch targeted maker outreach.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddDirModalOpen(true)}
                className="px-3 py-1.5 bg-raised hover:bg-surface border border-hairline text-xs font-bold uppercase text-ink hover:text-signal transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+ Add Custom Directory</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(data?.predefinedDirectories || PREDEFINED_DIRECTORIES).map((dir) => {
                const dirLeads = (data?.leads || []).filter(
                  (l) =>
                    l.sourceDirectory.toLowerCase().includes(dir.id.toLowerCase()) ||
                    l.sourceDirectory.toLowerCase() === dir.name.toLowerCase() ||
                    (l.sourceUrl && l.sourceUrl.includes(dir.url.replace(/^https?:\/\//, "")))
                );
                const newCount = dirLeads.filter((l) => l.status === "NEW").length;
                const isExpanded = expandedDirName === dir.id;
                const isCustomDir = (dir as any).isCustom;

                return (
                  <div
                    key={dir.id}
                    className={`p-3.5 border bg-surface flex flex-col justify-between transition-colors ${
                      isCustomDir
                        ? "border-signal/40 hover:border-signal"
                        : "border-hairline hover:border-signal/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs font-bold uppercase text-ink truncate">{dir.name}</h4>
                          {isCustomDir && (
                            <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase bg-signal/10 text-signal border border-signal/30 rounded-xs shrink-0">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-raised border border-hairline text-ink-dim shrink-0">
                          {dir.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-dim mt-1 line-clamp-2">{dir.description}</p>
                      
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-hairline/60 text-[10px]">
                        <a
                          href={dir.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-dim hover:text-signal hover:underline truncate max-w-[140px] block"
                        >
                          ↗ {dir.url.replace(/^https?:\/\//, "")}
                        </a>
                        <span className="font-bold text-ink">
                          {dirLeads.length} saved {newCount > 0 && <span className="text-amber-500">({newCount} new)</span>}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 pt-2.5 border-t border-hairline">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handlePresetCrawl(dir)}
                          disabled={isCrawling}
                          className="py-1.5 bg-ink text-surface hover:bg-signal text-[11px] font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 text-center truncate"
                        >
                          {isCrawling && crawlUrl === dir.url ? "Crawling..." : "Crawl Leads →"}
                        </button>
                        
                        <button
                          onClick={() => setExpandedDirName(isExpanded ? null : dir.id)}
                          className={`py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer border text-center truncate ${
                            isExpanded
                              ? "bg-raised border-ink text-ink"
                              : "bg-surface hover:bg-raised border-hairline text-ink-dim hover:text-ink"
                          }`}
                        >
                          {isExpanded ? "▲ Hide Contacts" : `View Contacts (${dirLeads.length})`}
                        </button>
                      </div>

                      {/* Custom Directory Delete Button */}
                      {isCustomDir && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            disabled={deletingDirId === dir.id}
                            onClick={() => handleDeleteCustomDirectory(dir.id, dir.name)}
                            className="text-[10px] text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {deletingDirId === dir.id ? "Removing…" : "✕ Remove Directory"}
                          </button>
                        </div>
                      )}

                      {/* Expandable Contacts Drawer */}
                      {isExpanded && (
                        <div className="pt-2 mt-2 border-t border-hairline text-xs space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-ink">
                            <span>Saved Contacts ({dirLeads.length}):</span>
                            {newCount > 0 && (
                              <button
                                onClick={async () => {
                                  const ids = dirLeads.filter((l) => l.status === "NEW").map((l) => l.id);
                                  if (ids.length > 0) {
                                    await sendOutreachCampaignAction(ids);
                                    await loadData();
                                  }
                                }}
                                className="text-[10px] text-signal hover:underline font-bold cursor-pointer"
                              >
                                Email {newCount} New →
                              </button>
                            )}
                          </div>

                          {dirLeads.length === 0 ? (
                            <div className="p-3 text-center text-ink-dim text-[11px] bg-raised/40 border border-hairline">
                              No contacts extracted yet. Click "Crawl Leads" to scan {dir.name}.
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-hairline bg-raised/30 p-2 border border-hairline">
                              {dirLeads.map((dl) => (
                                <div key={dl.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-[11px] gap-2">
                                  <div className="min-w-0">
                                    <div className="font-bold text-ink truncate">{dl.name || dl.organization || "Founder"}</div>
                                    <div className="text-[10px] text-ink-dim font-mono truncate select-all">{dl.email}</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`px-1 py-0.2 text-[9px] font-bold rounded-xs ${
                                      dl.status === "NEW"
                                        ? "text-amber-500 bg-amber-500/10"
                                        : "text-emerald-500 bg-emerald-500/10"
                                    }`}>
                                      {dl.status}
                                    </span>
                                    <button
                                      onClick={async () => {
                                        await sendOutreachCampaignAction([dl.id]);
                                        await loadData();
                                      }}
                                      className="px-1.5 py-0.5 bg-ink text-surface hover:bg-signal text-[9px] font-bold uppercase transition-colors cursor-pointer"
                                    >
                                      Send
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom URL Crawler Card */}
          <div className="p-4 border border-hairline bg-surface space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-ink">
                Custom Directory, Product Listing, or RSS/Atom Feed Crawler
              </h3>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                HTML + RSS/Atom Feed Parallel Engine
              </span>
            </div>
            <p className="text-[11px] text-ink-dim">
              Enter any startup directory, listing page, or RSS/Atom feed URL (e.g. <code>https://example.com/feed.xml</code> or <code>https://news.ycombinator.com/rss</code>) to crawl and extract contact emails.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="url"
                placeholder="https://example-directory.com or https://example.com/feed.xml"
                value={crawlUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setCrawlUrl(val);
                  const detected = detectDirectoryLabel(val);
                  if (detected) {
                    setSelectedDirName(detected);
                    setRawDirSource(detected);
                  }
                }}
                className="flex-1 h-9 px-3 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden w-full"
              />
              <input
                type="text"
                placeholder="Directory Name (e.g. Uneed)"
                value={selectedDirName}
                onChange={(e) => {
                  setSelectedDirName(e.target.value);
                  setRawDirSource(e.target.value);
                }}
                className="w-full sm:w-48 h-9 px-3 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden"
              />
              <button
                onClick={() => handleCrawl()}
                disabled={isCrawling || !crawlUrl.trim()}
                className="w-full sm:w-auto h-9 px-4 bg-signal text-surface text-xs font-bold uppercase hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isCrawling ? "Crawling..." : "Crawl URL"}
              </button>
            </div>

            {crawlSummary && (
              <div className="mt-3 p-3 bg-raised/70 border border-hairline text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-ink border-b border-hairline/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span>Crawl Results for {crawlSummary.sourceDirectory}:</span>
                    {crawlSummary.feedScanned && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-signal/15 text-signal border border-signal/30">
                        Feed Scanned ({crawlSummary.feedItemsFound || 0} items)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveSubView("leads")}
                    className="text-[11px] text-signal font-bold hover:underline cursor-pointer"
                  >
                    View in Leads Table →
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div className="p-1.5 bg-surface border border-hairline">
                    <div className="text-[10px] text-ink-dim uppercase">Discovered</div>
                    <div className="font-bold text-ink">{crawlSummary.leadsFound}</div>
                  </div>
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-500 uppercase">New Saved</div>
                    <div className="font-bold text-emerald-500">{crawlSummary.newLeadsSaved}</div>
                  </div>
                  <div className="p-1.5 bg-surface border border-hairline">
                    <div className="text-[10px] text-ink-dim uppercase">Updated</div>
                    <div className="font-bold text-ink">{crawlSummary.existingLeadsUpdated}</div>
                  </div>
                </div>
                {crawlSummary.leads && crawlSummary.leads.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[11px] font-bold text-ink-dim uppercase">Extracted Leads:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-hairline bg-surface p-2 border border-hairline">
                      {crawlSummary.leads.map((l: any, idx: number) => (
                        <div key={idx} className="pt-1 first:pt-0 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-ink">{l.organization || l.name || "Lead"}</span>
                          <span className="text-ink-dim font-mono">{l.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Raw Text / CSV Importer Card */}
          <div className="p-4 border border-hairline bg-surface space-y-3">
            <h3 className="text-xs font-bold uppercase text-ink">
              Bulk Text, CSV, or HTML Contact Importer
            </h3>
            <p className="text-[11px] text-ink-dim">
              Paste raw text containing emails, CSV rows (Name, Email, Product), or HTML markup to extract and deduplicate leads automatically.
            </p>

            <form onSubmit={handleImportRaw} className="space-y-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
                placeholder="Alex, alex@startup.com, SuperTool&#10;Sam, sam@ai.co, NextGen AI&#10;Or paste raw text/HTML containing emails..."
                className="w-full p-3 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-dim">Source Directory Label:</span>
                  <input
                    type="text"
                    value={rawDirSource}
                    onChange={(e) => setRawDirSource(e.target.value)}
                    className="h-8 px-2 bg-raised border border-hairline text-xs text-ink focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isImporting || !rawText.trim()}
                  className="h-8 px-4 bg-ink text-surface hover:bg-signal text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? "Importing..." : "Parse & Save Unique Leads"}
                </button>
              </div>
            </form>

            {importSummary && (
              <div className="mt-3 p-3 bg-raised/70 border border-hairline text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-ink border-b border-hairline/60 pb-1.5">
                  <span>Import Results:</span>
                  <button
                    onClick={() => setActiveSubView("leads")}
                    className="text-[11px] text-signal font-bold hover:underline cursor-pointer"
                  >
                    View in Leads Table →
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div className="p-1.5 bg-surface border border-hairline">
                    <div className="text-[10px] text-ink-dim uppercase">Total Processed</div>
                    <div className="font-bold text-ink">{importSummary.total}</div>
                  </div>
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-500 uppercase">New Created</div>
                    <div className="font-bold text-emerald-500">{importSummary.created}</div>
                  </div>
                  <div className="p-1.5 bg-surface border border-hairline">
                    <div className="text-[10px] text-ink-dim uppercase">Existing Updated</div>
                    <div className="font-bold text-ink">{importSummary.updated}</div>
                  </div>
                </div>
                {importSummary.leads && importSummary.leads.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[11px] font-bold text-ink-dim uppercase">Imported Leads:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-hairline bg-surface p-2 border border-hairline">
                      {importSummary.leads.map((l: any, idx: number) => (
                        <div key={idx} className="pt-1 first:pt-0 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-ink">{l.organization || l.name || "Lead"}</span>
                          <span className="text-ink-dim font-mono">{l.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          SUB-VIEW 3: AUTOMATIC EMAIL SENDING CONFIGURATION
         ─────────────────────────────────────────────────────────── */}
      {activeSubView === "automation" && (
        <div className="space-y-4 max-w-3xl">
          <div className="p-4 sm:p-5 border border-hairline bg-surface space-y-4">
            <div className="border-b border-hairline pb-3">
              <h3 className="text-xs font-bold uppercase text-ink">
                Automated Background Outreach Engine
              </h3>
              <p className="text-[11px] text-ink-dim mt-0.5">
                Configure automatic email sending to new directory leads without manual review.
              </p>
            </div>

            {/* Toggle 1: Global Auto Outreach */}
            <div className="flex items-center justify-between p-3 bg-raised/50 border border-hairline">
              <div>
                <div className="text-xs font-bold text-ink uppercase">Enable Auto-Outreach</div>
                <div className="text-[11px] text-ink-dim mt-0.5">
                  Automatically sends the launch invitation template to newly added leads.
                </div>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={async () => {
                  // Persist immediately — do not rely on the user clicking
                  // the separate "Save Settings" button. Every observed report
                  // of "the toggle doesn't work" traced back to this.
                  const next = { ...autoConfig, enabled: !autoConfig.enabled };
                  setAutoConfig(next);
                  await persistAutoConfig(next);
                }}
                className={`px-3 py-1 text-xs font-bold uppercase transition-colors cursor-pointer border disabled:opacity-60 ${
                  autoConfig.enabled
                    ? "bg-emerald-500 text-black border-emerald-500"
                    : "bg-surface text-ink-dim border-hairline"
                }`}
              >
                {autoConfig.enabled ? "ACTIVE (ON)" : "DISABLED (OFF)"}
              </button>
            </div>

            {/* Toggle 2: Auto-Send on Crawl */}
            <div className="flex items-center justify-between p-3 bg-raised/50 border border-hairline">
              <div>
                <div className="text-xs font-bold text-ink uppercase">Auto-Dispatch Immediately Upon Crawling</div>
                <div className="text-[11px] text-ink-dim mt-0.5">
                  Dispatches emails to new leads as soon as they are extracted from a directory crawl.
                </div>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={async () => {
                  const next = { ...autoConfig, autoSendOnCrawl: !autoConfig.autoSendOnCrawl };
                  setAutoConfig(next);
                  await persistAutoConfig(next);
                }}
                className={`px-3 py-1 text-xs font-bold uppercase transition-colors cursor-pointer border disabled:opacity-60 ${
                  autoConfig.autoSendOnCrawl
                    ? "bg-signal text-surface border-signal"
                    : "bg-surface text-ink-dim border-hairline"
                }`}
              >
                {autoConfig.autoSendOnCrawl ? "ENABLED" : "DISABLED"}
              </button>
            </div>

            {/* Daily Sending Limit */}
            <div className="p-3 bg-raised/50 border border-hairline space-y-2">
              <label className="text-xs font-bold text-ink uppercase block">
                Daily Automated Outreach Limit (Per 24h)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={autoConfig.dailyLimit}
                  onChange={(e) =>
                    setAutoConfig((prev) => ({ ...prev, dailyLimit: Number(e.target.value) || 50 }))
                  }
                  className="w-28 h-8 px-2.5 bg-surface border border-hairline text-xs text-ink focus:outline-hidden"
                />
                <span className="text-[11px] text-ink-dim">
                  Max emails sent automatically per day (prevents spam flags & provider rate limits).
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-hairline">
              <button
                type="button"
                onClick={handleTriggerAutoBatch}
                disabled={isPending || stats.newLeads === 0}
                className="h-8 px-4 bg-ink text-surface hover:bg-signal text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-40"
              >
                {isPending ? "Processing..." : `Dispatch Next Auto Batch (${stats.newLeads} ready)`}
              </button>

              <button
                type="button"
                onClick={handleSaveAutoConfig}
                disabled={savingConfig}
                className="h-8 px-4 bg-signal text-surface text-xs font-bold uppercase hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: LIVE TEMPLATE PREVIEW & TEST SENDER
         ─────────────────────────────────────────────────────────── */}
      {previewLeadId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-hairline max-w-2xl w-full max-h-[90vh] flex flex-col p-4 sm:p-5 text-xs">
            <div className="flex items-center justify-between border-b border-hairline pb-2.5 shrink-0">
              <div>
                <h4 className="text-xs font-bold uppercase text-ink">
                  Outreach Email Template Preview
                </h4>
                <p className="text-[10px] text-ink-dim">
                  Simulated preview for: <strong>{selectedPreviewLead.name}</strong> ({selectedPreviewLead.organization} on {selectedPreviewLead.sourceDirectory})
                </p>
              </div>
              <button
                onClick={() => setPreviewLeadId(null)}
                className="text-ink-dim hover:text-ink text-xs font-bold cursor-pointer"
              >
                [close]
              </button>
            </div>

            {/* Email Render Box */}
            <div className="overflow-y-auto py-3 space-y-3 my-2 border border-hairline bg-raised/30 p-4">
              <div className="border-b border-hairline pb-2 text-[11px] space-y-1">
                <div>
                  <span className="text-ink-dim">Subject: </span>
                  <span className="font-bold text-ink">
                    Featured {selectedPreviewLead.organization} on {selectedPreviewLead.sourceDirectory}? Launch on The Launch Feed (100% Free)
                  </span>
                </div>
                <div>
                  <span className="text-ink-dim">From: </span>
                  <span>The Launch Feed &lt;team@thelaunchfeed.com&gt;</span>
                </div>
                <div>
                  <span className="text-ink-dim">To: </span>
                  <span>{selectedPreviewLead.email}</span>
                </div>
              </div>

              {/* Sample Email Body Snippet */}
              <div className="space-y-3 text-[12px] leading-relaxed text-ink">
                <div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-signal text-surface">
                    FOUNDER INVITATION · 100% FREE
                  </span>
                </div>
                <h2 className="text-sm font-bold text-ink">
                  Launch {selectedPreviewLead.organization} on The Launch Feed
                </h2>
                <p>
                  Hey {selectedPreviewLead.name || "Founder"},
                </p>
                <p>
                  We discovered <strong>{selectedPreviewLead.organization}</strong> while browsing <strong>{selectedPreviewLead.sourceDirectory}</strong> and were really impressed by what you are building.
                </p>
                <p>
                  We would love to invite you to freely submit and launch {selectedPreviewLead.organization} on <strong>The Launch Feed</strong> — a real-time, founder-first discovery platform and daily tech leaderboard.
                </p>

                <div className="p-3 border border-hairline bg-surface space-y-1 text-[11px]">
                  <div className="font-bold text-ink uppercase text-[10px]">
                    Why launch on The Launch Feed? (Key Differentiators)
                  </div>
                  <div>1. Multi-Channel Social Broadcast (X, WhatsApp Community, Telegram, Webhooks).</div>
                  <div>2. 24h Real-Time Leaderboards & Embeddable Dynamic SVG Winner Badges.</div>
                  <div>3. Instant Automated Google & IndexNow Search Engine Indexing.</div>
                  <div>4. Verified Live MRR & Revenue Telemetry (Stripe, DodoPayments, Polar, Paddle).</div>
                  <div>5. 100% Free Forever for Makers.</div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <span className="px-3 py-2 bg-ink text-surface font-bold text-[11px] uppercase">
                    Submit {selectedPreviewLead.organization} for Free →
                  </span>
                  <span className="px-3 py-2 border border-hairline bg-surface font-bold text-[11px] uppercase">
                    Explore Live Platform
                  </span>
                </div>
              </div>
            </div>

            {/* Test Sender Footer */}
            <div className="pt-3 border-t border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="email"
                  placeholder="Enter your email to receive a live test..."
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  className="h-8 px-2.5 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden flex-1"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !testEmailInput.trim()}
                  className="h-8 px-3 bg-ink text-surface hover:bg-signal text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {sendingTestEmail ? "Sending..." : "Send Live Test"}
                </button>
              </div>

              <button
                onClick={() => setPreviewLeadId(null)}
                className="h-8 px-3 border border-hairline bg-raised hover:bg-surface text-xs font-bold uppercase cursor-pointer shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: ADD CUSTOM DIRECTORY
         ─────────────────────────────────────────────────────────── */}
      {isAddDirModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-hairline w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-ink">Add Custom Launchpad or Directory</h3>
                <p className="text-[11px] text-ink-dim">
                  Save custom directories and RSS/Atom feeds to include them in automated daily sweeps.
                </p>
              </div>
              <button
                onClick={() => setIsAddDirModalOpen(false)}
                className="text-ink-dim hover:text-ink text-xs font-bold uppercase cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleAddCustomDirectory} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-ink uppercase mb-1">
                  Directory Name <span className="text-signal">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FoundersBeta, IndieTools, OpenDirectory"
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value)}
                  className="w-full h-9 px-3 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink uppercase mb-1">
                  Directory URL or RSS/Atom Feed <span className="text-signal">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://directory.com or https://directory.com/feed.xml"
                  value={newDirUrl}
                  onChange={(e) => setNewDirUrl(e.target.value)}
                  className="w-full h-9 px-3 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden"
                />
                <p className="text-[10px] text-ink-dim mt-1">
                  Tip: Direct RSS/Atom feeds (e.g. <code>/feed.xml</code> or <code>/rss</code>) bypass bot protection and are scanned instantly.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-ink uppercase mb-1">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={newDirCategory}
                    onChange={(e) => setNewDirCategory(e.target.value as any)}
                    className="w-full h-9 pl-3 pr-8 bg-void border border-hairline text-xs font-mono text-ink cursor-pointer focus:border-signal outline-none rounded-xs appearance-none"
                  >
                    <option value="Daily Launchpad">Daily Launchpad</option>
                    <option value="Curated Directory">Curated Directory</option>
                    <option value="Indie Hacker">Indie Hacker</option>
                    <option value="AI & SaaS">AI & SaaS</option>
                  </select>
                  <svg
                    className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the platform, target audience, or launch format..."
                  value={newDirDesc}
                  onChange={(e) => setNewDirDesc(e.target.value)}
                  className="w-full p-2.5 bg-raised/50 border border-hairline text-xs text-ink placeholder:text-ink-dim/50 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-3 border-t border-hairline flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDirModalOpen(false)}
                  className="px-4 py-2 border border-hairline bg-raised hover:bg-surface text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingDir || !newDirName.trim() || !newDirUrl.trim()}
                  className="px-4 py-2 bg-ink text-surface hover:bg-signal text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isAddingDir ? "Saving Directory…" : "Save Directory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
