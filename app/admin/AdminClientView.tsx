"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LaunchFeedLogo, LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";
import {
  getStoredSession,
  logoutSession,
  slugify,
  UserSession,
  applyTheme,
  getActiveTheme,
  ThemeMode,
} from "@/app/data";
import { authClient } from "@/lib/auth-client";

// Types shared across the admin tabs — populated from /api/admin/summary.
type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  votes: number;
  maker: string;
  makerName: string;
  category: string;
};
type AdminUser = {
  id: string;
  name: string;
  username: string;
  handle: string;
  email: string;
  role: string;
  avatar: string;
  image?: string | null;
  productCount: number;
  voteCount: number;
};

// Fallback empty arrays used before /api/admin/summary responds.
const ALL_PRODUCTS: AdminProduct[] = [];
const DEMO_USERS: (AdminUser & { subscriptions: never[]; upvotedProductIds: string[]; savedProductIds: string[] })[] = [];
import { listMyProducts, type MyProduct } from "@/app/actions/profile";
import { TEMPLATES, getTemplate, EmailTemplateId, TemplateVars } from "./emailTemplates";
import SubmissionTimer from "@/app/components/SubmissionTimer";
import ThemedSelect from "./ThemedSelect";
import {
  listSubmissions,
  updateSchedule,
  publishSubmissionNow,
  publishAllScheduledSubmissions,
  rejectSubmission,
  deleteSubmission,
  getDefaultLeadHours,
  setDefaultLeadHours,
} from "@/app/actions/submissions";
import {
  listCategories,
  addCategory,
  removeCategory,
} from "@/app/actions/categories";
import {
  listSlots,
  addCustomSlot,
  updateSlot,
  removeCustomSlot,
  reorderSlot,
  UISlot,
} from "@/app/actions/slots";
import {
  sendOne,
  broadcastToAllUsers,
  listEmailLog,
} from "@/app/actions/emails";
import {
  listAutomationRules,
  setAutomationEnabled,
} from "@/app/actions/automation";
import {
  listFlaggedComments,
  dismissFlags,
  deleteFlaggedComment,
} from "@/app/actions/comments";
import {
  getDatabaseStatus,
  purgeAllSeedData,
  unpublishAllProductsFromFeeds,
  publishAllArchivedProductsToFeeds,
  toggleSectionDelist,
  delistAllSections,
  restoreAllSections,
  DatabaseStatus,
} from "@/app/actions/seed";
import {
  getAdminUsersAction,
  updateUserRoleAction,
  updateUserProfileAdminAction,
  createUserAdminAction,
  deleteUserAdminAction,
  type AdminUserData,
} from "@/app/actions/adminUsers";
import { ALL_SECTIONS } from "@/lib/sections";
import BroadcastTab from "./BroadcastTab";
import DirectoryEmbedsTab from "./DirectoryEmbedsTab";
import IndexingTab from "./IndexingTab";
import OutreachTab from "./OutreachTab";
import {
  getAdminRevenueData,
  type AdminRevenueData,
} from "@/app/actions/revenue";

/* ─────────────────────────── types ─────────────────────────── */

type Tab =
  | "overview"
  | "products"
  | "users"
  | "submissions"
  | "broadcast"
  | "revenue"
  | "featured"
  | "categories"
  | "embeds"
  | "indexing"
  | "outreach"
  | "moderation"
  | "founder"
  | "emails"
  | "automation"
  | "seed";

function TabIcon({ id, className = "w-4 h-4 shrink-0" }: { id: Tab; className?: string }) {
  switch (id) {
    case "broadcast":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
        </svg>
      );
    case "overview":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      );
    case "revenue":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9.5 9.5c0-.83.67-1.5 2.5-1.5s2.5.67 2.5 1.5c0 2-5 1.5-5 3.5 0 .83.67 1.5 2.5 1.5s2.5-.67 2.5-1.5" />
        </svg>
      );
    case "products":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      );
    case "submissions":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "users":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "moderation":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "featured":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "categories":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "embeds":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "indexing":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "outreach":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      );
    case "founder":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    case "emails":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case "automation":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "seed":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
      );
  }
}

const TABS: {
  id: Tab;
  label: string;
  group: "monitor" | "manage" | "comms" | "founder" | "system";
}[] = [
  { id: "overview", label: "Overview", group: "monitor" },
  { id: "revenue", label: "Revenue", group: "monitor" },
  { id: "products", label: "Products", group: "manage" },
  { id: "submissions", label: "Submissions", group: "manage" },
  { id: "users", label: "Users", group: "manage" },
  { id: "moderation", label: "Moderation", group: "manage" },
  { id: "featured", label: "Featured & Rotating", group: "manage" },
  { id: "categories", label: "Categories", group: "manage" },
  { id: "embeds", label: "Directory Embeds", group: "manage" },
  { id: "indexing", label: "Web Indexing", group: "manage" },
  { id: "outreach", label: "Directory Outreach", group: "manage" },
  { id: "founder", label: "Founder mode", group: "founder" },
  { id: "broadcast", label: "Social Broadcast", group: "comms" },
  { id: "emails", label: "Compose email", group: "comms" },
  { id: "automation", label: "Automation", group: "comms" },
  { id: "seed", label: "Seed Data", group: "system" },
];

const GROUP_LABEL: Record<string, string> = {
  monitor: "Monitor",
  manage: "Manage",
  comms: "Comms",
  founder: "Founder",
  system: "System",
};

/* ─────────────────────────── shell ─────────────────────────── */

function parseTabFromLocation(): Tab {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace(/^#/, "").toLowerCase();
  const searchTab = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
  const validTabs = TABS.map((t) => t.id as string);
  if (hash && validTabs.includes(hash)) return hash as Tab;
  if (searchTab && validTabs.includes(searchTab)) return searchTab as Tab;
  return "overview";
}

export default function AdminClientView({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const changeTab = (newTab: Tab) => {
    setTab(newTab);
    setQuery("");
    setSidebarOpen(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${newTab}`);
    }
  };

  useEffect(() => {
    setSession(getStoredSession());
    setThemeMode(getActiveTheme());
    const initialTab = parseTabFromLocation();
    setTab(initialTab);
    if (window.location.hash !== `#${initialTab}`) {
      window.history.replaceState(null, "", `#${initialTab}`);
    }
    setHydrated(true);

    const onHashChange = () => {
      const current = parseTabFromLocation();
      setTab(current);
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);

    const onAuth = (e: Event) => {
      const ev = e as CustomEvent<UserSession | null>;
      setSession(ev.detail ?? getStoredSession());
    };
    window.addEventListener("authChanged", onAuth);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
      window.removeEventListener("authChanged", onAuth);
    };
  }, []);

  const isAdmin = useMemo(() => {
    if (!session || !adminEmail) return false;
    return session.email.trim().toLowerCase() === adminEmail;
  }, [session, adminEmail]);

  const cycleTheme = () => {
    const order: ThemeMode[] = ["light", "void", "thermal"];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    setThemeMode(next);
    applyTheme(next);
  };

  if (!hydrated) {
    return (
      <FullBleed>
        <div className="w-full min-h-[40vh] flex items-center justify-center py-16">
          <LaunchFeedLoader size={32} label="Loading admin console…" />
        </div>
      </FullBleed>
    );
  }

  if (!adminEmail) {
    return (
      <FullBleed>
        <GateCard
          title="ADMIN_EMAIL NOT CONFIGURED"
          body="Set ADMIN_EMAIL in your environment and restart the server to enable the admin console."
        />
      </FullBleed>
    );
  }

  if (!session) {
    return (
      <FullBleed>
        <GateCard
          title="AUTHENTICATION REQUIRED"
          body="You must be signed in with the configured admin account to access this area."
          action={
            <Link
              href="/handler/sign-in?after_auth_return_to=/admin"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase font-bold border border-hairline bg-surface text-ink hover:bg-ink hover:text-surface transition-colors"
            >
              → Go to sign in
            </Link>
          }
        />
      </FullBleed>
    );
  }

  if (!isAdmin) {
    return (
      <FullBleed>
        <GateCard
          title="ACCESS DENIED"
          body={`Signed in as ${session.email}. This console is restricted to the configured admin account.`}
          action={
            <button
              onClick={async () => {
                try {
                  await authClient.signOut();
                } catch {}
                logoutSession();
                window.location.href = "/";
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase font-bold border border-hairline bg-surface text-ink hover:bg-ink hover:text-surface transition-colors cursor-pointer"
            >
              → Sign out & switch account
            </button>
          }
        />
      </FullBleed>
    );
  }

  const groups: Array<"monitor" | "manage" | "comms" | "founder" | "system"> = [
    "monitor",
    "manage",
    "founder",
    "comms",
    "system",
  ];

  return (
    <div className="h-screen bg-surface text-ink font-mono flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="h-14 shrink-0 bg-surface flex items-center sticky top-0 z-30 border-b border-hairline">
        {/* Left header column */}
        <div
          className={[
            "h-14 flex items-center justify-between px-3 sm:px-3.5 shrink-0 bg-surface transition-[width] duration-200 border-r border-hairline relative",
            sidebarCollapsed ? "w-16 md:w-16 justify-center" : "w-auto md:w-60",
          ].join(" ")}
        >
          <Link href="/admin" className="flex items-center gap-2 overflow-hidden hover:opacity-85 transition-opacity" title="The Launch Feed - Admin Console">
            {sidebarCollapsed ? (
              <LaunchFeedLogo size={22} className="shrink-0" />
            ) : (
              <>
                <div className="hidden md:flex items-center">
                  <LaunchFeedBrandLogo height={22} />
                </div>
                <div className="flex md:hidden items-center">
                  <LaunchFeedLogo size={22} className="shrink-0" />
                </div>
              </>
            )}
          </Link>

          {/* Desktop collapse toggle icon positioned directly on the vertical divider border */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-40 w-6 h-6 rounded-full border border-hairline bg-surface hover:bg-raised text-ink items-center justify-center shadow-xs transition-transform hover:scale-110 cursor-pointer"
            title={sidebarCollapsed ? "Expand sidebar (show labels)" : "Collapse sidebar (icons only)"}
            aria-label={sidebarCollapsed ? "Expand sidebar tab" : "Collapse sidebar tab"}
          >
            <svg
              className="w-3.5 h-3.5 text-ink"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {sidebarCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>

        {/* Right header section */}
        <div className="flex-1 h-14 flex items-center justify-end px-2 sm:px-4 min-w-0 bg-surface gap-1.5 sm:gap-2">
          {/* Quick Nav Links (+ Submit and ↗ Public site) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/submit"
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 border border-signal bg-signal text-surface hover:opacity-90 transition-opacity text-xs uppercase font-bold font-mono flex items-center gap-1 rounded-xs shrink-0"
            >
              + Submit
            </Link>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 border border-hairline bg-surface hover:bg-raised text-ink text-xs uppercase font-bold font-mono flex items-center gap-1 transition-colors rounded-xs shrink-0"
            >
              ↗ Public site
            </Link>
          </div>

          {/* Theme switcher button */}
          <button
            onClick={cycleTheme}
            title={`Theme: ${themeMode}`}
            className="h-8 px-2.5 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 rounded-xs"
          >
            <span className="text-xs">{themeMode === "light" ? "☀" : themeMode === "void" ? "◐" : "◉"}</span>
            <span className="hidden sm:inline uppercase text-[11px] font-bold">{themeMode}</span>
          </button>

          {/* Profile Avatar & Name Pill */}
          <Link
            href="/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-2 border border-hairline bg-surface hover:bg-raised text-ink flex items-center gap-2 shrink-0 rounded-xs transition-colors"
            title="View your profile"
          >
            <div className="w-5.5 h-5.5 rounded-xs bg-ink text-surface flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden border border-hairline relative">
              {session.image ? (
                <img
                  src={session.image}
                  alt={session.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                session.avatar
              )}
            </div>
            <span className="hidden sm:inline-block text-xs font-bold font-mono text-ink max-w-[100px] truncate">
              {session.name}
            </span>
          </Link>

          {/* Sign out button on desktop */}
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" });
              } catch {}
              try {
                await authClient.signOut();
              } catch {}
              logoutSession();
              window.location.href = "/";
            }}
            className="hidden sm:inline-flex h-8 px-3 border border-hairline bg-surface hover:bg-signal hover:text-surface hover:border-signal text-xs uppercase font-bold font-mono transition-colors cursor-pointer items-center justify-center rounded-xs shrink-0"
          >
            Sign out
          </button>

          {/* Mobile Hamburger Drawer Toggle Button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden h-8 w-8 border border-hairline bg-surface hover:bg-raised flex items-center justify-center text-ink cursor-pointer shrink-0 rounded-xs"
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-void/60 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content row with vertical tab sidebar */}
      <div className="flex flex-1 min-h-0 relative">
        <aside
          className={[
            "shrink-0 border-r border-hairline bg-surface flex flex-col transition-[width] duration-200",
            sidebarCollapsed ? "md:w-16" : "md:w-60",
            "md:sticky md:top-14 md:h-[calc(100vh-3.5rem)]",
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-50 w-64 shadow-2xl flex"
              : "hidden md:flex",
          ].join(" ")}
        >
          {/* Mobile-only Drawer Top Banner */}
          <div className="flex items-center justify-between p-3.5 border-b border-hairline md:hidden bg-surface/50">
            <div className="flex items-center gap-2">
              <LaunchFeedLogo size={18} />
              <span className="text-xs font-bold uppercase font-mono tracking-wider">Console Tabs</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 flex items-center justify-center border border-hairline text-ink-dim hover:text-ink text-xs"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3">
            {groups.map((g) => (
              <div key={g} className="mb-4">
                {!sidebarCollapsed ? (
                  <div className="px-3 pb-1 text-xs uppercase text-ink-dim font-bold tracking-wider">
                    {GROUP_LABEL[g]}
                  </div>
                ) : (
                  <div className="my-2 border-t border-hairline/60" />
                )}
                <ul>
                  {TABS.filter((t) => t.group === g).map((t) => {
                    const active = tab === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => changeTab(t.id)}
                          title={t.label}
                          className={[
                            "w-full flex items-center gap-3 py-2 text-xs uppercase font-bold border-l-2 transition-colors cursor-pointer",
                            sidebarCollapsed ? "px-0 justify-center" : "px-3",
                            active
                              ? "border-signal bg-[color:var(--surface-alt,rgba(0,0,0,0.03))] text-ink"
                              : "border-transparent text-ink-dim hover:text-ink hover:border-hairline",
                          ].join(" ")}
                        >
                          <TabIcon id={t.id} className="w-4 h-4 shrink-0 text-current" />
                          {!sidebarCollapsed && <span className="truncate">{t.label}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Mobile Drawer Bottom Actions */}
          <div className="p-3 border-t border-hairline space-y-2 md:hidden bg-surface/40">
            <Link
              href="/"
              target="_blank"
              className="w-full px-3 py-1.5 border border-hairline text-xs font-bold flex items-center justify-between text-ink hover:bg-raised"
            >
              <span>↗ Public Site</span>
              <span className="text-[10px] text-ink-faint">thelaunchfeed.com</span>
            </Link>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" });
                } catch {}
                try {
                  await authClient.signOut();
                } catch {}
                logoutSession();
                window.location.href = "/";
              }}
              className="w-full px-3 py-1.5 border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-bold text-center hover:bg-rose-500/20 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-6 flex flex-col overflow-y-auto md:overflow-hidden">
          <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap shrink-0">
            <div>
              <div className="text-xs uppercase text-ink-dim font-bold">
                {GROUP_LABEL[TABS.find((t) => t.id === tab)!.group]}
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-0.5">
                {TABS.find((t) => t.id === tab)!.label}
              </h1>
            </div>
            <div className="text-xs text-ink-dim uppercase">
              {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
            </div>
          </div>

          <div
            className={
              tab === "products" || tab === "users"
                ? "flex-1 min-h-0 flex flex-col"
                : "flex-1 min-h-0 overflow-y-auto"
            }
          >
            {tab === "overview" && <OverviewTab />}
            {tab === "products" && <ProductsTab query={query} setQuery={setQuery} />}
            {tab === "submissions" && <SubmissionsTab />}
            {tab === "users" && <UsersTab query={query} setQuery={setQuery} />}
            {tab === "moderation" && <ModerationTab />}
            {tab === "featured" && <FeaturedTab />}
            {tab === "categories" && <CategoriesTab />}
            {tab === "embeds" && <DirectoryEmbedsTab />}
            {tab === "indexing" && <IndexingTab />}
            {tab === "outreach" && <OutreachTab />}
            {tab === "revenue" && <RevenueTab />}
            {tab === "founder" && <FounderTab session={session} />}
            {tab === "broadcast" && <BroadcastTab />}
            {tab === "emails" && <EmailsTab session={session} />}
            {tab === "automation" && <AutomationTab />}
            {tab === "seed" && <SeedDataTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────── shared UI ─────────────────────────── */

function FullBleed({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink font-mono flex items-center justify-center p-6">
      {children}
    </div>
  );
}

function GateCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-hairline p-6 max-w-xl w-full">
      <div className="flex items-center gap-2 text-xs uppercase font-bold text-signal mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
        {title}
      </div>
      <p className="text-sm text-ink-dim leading-relaxed mb-4">{body}</p>
      {action}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-hairline p-3.5">
      <div className="text-xs uppercase text-ink-dim font-bold">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-ink-dim mt-0.5">{hint}</div> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-hairline text-xs uppercase text-ink-dim font-bold">
      {children}
    </div>
  );
}

function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList): { data: T | null; refresh: () => Promise<void>; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refresh = React.useCallback(async () => {
    setTrigger((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, trigger]);

  return { data, refresh, loading };
}

function TabLoader({ label = "Loading data..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[340px] w-full border border-hairline/60 bg-surface/20 py-16">
      <LaunchFeedLoader size={32} label={label} />
    </div>
  );
}

/* ─────────────────────────── OverviewTab ─────────────────────────── */

function OverviewTab() {
  const featured = useAsync(() => listSlots("FEATURED"), []);
  const rotating = useAsync(() => listSlots("ROTATING"), []);
  const cats = useAsync(() => listCategories(), []);
  const subs = useAsync(() => listSubmissions(), []);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (Array.isArray(d.products)) setProducts(d.products);
        if (Array.isArray(d.users)) setUsers(d.users);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  if (featured.loading || rotating.loading || cats.loading || subs.loading || summaryLoading) {
    return <TabLoader label="Loading dashboard metrics..." />;
  }

  const pending = (subs.data || []).filter((s) => s.status === "SCHEDULED").length;
  const totalVotes = products.reduce((a, p) => a + p.votes, 0);
  const topProduct = [...products].sort((a, b) => b.votes - a.votes)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Products" value={products.length} hint="live in catalog" />
        <Stat label="Users" value={users.length} hint="registered accounts" />
        <Stat label="Total Votes" value={totalVotes.toLocaleString()} hint="all-time" />
        <Stat label="Categories" value={cats.data?.length ?? "—"} hint="taxonomy nodes" />
        <Stat label="Featured" value={featured.data?.length ?? "—"} hint="paid + custom" />
        <Stat label="Rotating" value={rotating.data?.length ?? "—"} hint="paid + custom" />
        <Stat label="Top votes" value={topProduct?.votes ?? 0} hint={topProduct?.name} />
        <Stat label="Pending" value={pending} hint="submissions in queue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-hairline">
          <SectionTitle>Top 5 by votes</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[340px]">
              <tbody>
                {[...products]
                  .sort((a, b) => b.votes - a.votes)
                  .slice(0, 5)
                  .map((p, i) => (
                    <tr key={p.id} className="border-t border-hairline first:border-t-0">
                      <td className="px-3 py-2.5 w-8 text-ink-dim tabular-nums text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-bold">{p.name}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-dim truncate max-w-[240px]">{p.tagline}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right font-bold text-xs">{p.votes}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border border-hairline">
          <SectionTitle>Recent activity</SectionTitle>
          <ul className="text-sm">
            {[
              { t: "queue", msg: `${pending} submission(s) scheduled`, when: "now" },
              { t: "slots", msg: `${(featured.data?.length ?? 0) + (rotating.data?.length ?? 0)} placements live`, when: "now" },
              { t: "cats", msg: `${cats.data?.length ?? 0} categories available`, when: "now" },
            ].map((e, i) => (
              <li
                key={i}
                className="px-3 py-2.5 border-t border-hairline first:border-t-0 flex items-center justify-between"
              >
                <span>
                  <span className="inline-block w-16 text-xs uppercase text-ink-dim font-bold">{e.t}</span>
                  {e.msg}
                </span>
                <span className="text-xs text-ink-dim">{e.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── ProductsTab ─────────────────────────── */

function ProductsTab({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProducts(d.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <TabLoader label="Loading product catalog..." />;
  }

  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.tagline.toLowerCase().includes(q) ||
      p.maker.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });
  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products by name, maker, category…"
        className="w-full px-3 py-2 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink shrink-0"
      />
      <div className="border border-hairline min-h-[350px] md:min-h-0 flex-1 overflow-auto bg-void">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="text-xs uppercase text-ink-dim font-bold">
              <th className="text-left px-3 py-2 border-b border-hairline">ID</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Name</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Tagline</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Maker</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Category</th>
              <th className="text-right px-3 py-2 border-b border-hairline">Votes</th>
              <th className="text-right px-3 py-2 border-b border-hairline">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-hairline">
                <td className="px-3 py-2 text-ink-dim tabular-nums text-xs">{p.id}</td>
                <td className="px-3 py-2 font-bold">{p.name}</td>
                <td className="px-3 py-2 text-xs text-ink-dim truncate max-w-[260px]">{p.tagline}</td>
                <td className="px-3 py-2 text-xs">{p.maker}</td>
                <td className="px-3 py-2 uppercase text-xs font-bold text-ink-dim">{p.category}</td>
                <td className="px-3 py-2 tabular-nums text-right font-bold">{p.votes}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/product/${slugify(p.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    prefetch={false}
                    className="text-xs uppercase font-bold underline underline-offset-2 hover:text-signal"
                  >
                    view ↗
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-dim text-sm">
                  No products match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Parallelogram-styled Role Selector Dropdown matching the platform's brutalist geometry.
 * Only allows selecting MAKER or MODERATOR.
 */
function ParallelogramRoleDropdown({
  role,
  onChange,
  disabled,
  size = "sm",
}: {
  role: string;
  onChange: (newRole: "MAKER" | "MODERATOR") => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMousedown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleMousedown);
    }
    return () => {
      document.removeEventListener("mousedown", handleMousedown);
    };
  }, [open]);

  const isMod = role === "MODERATOR";
  const isAdmin = role === "ADMIN";
  const isMaker = !isMod && !isAdmin;

  return (
    <div ref={ref} className="relative inline-block text-left font-mono">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`group inline-flex items-center gap-1.5 ${
          size === "md" ? "pl-3.5 pr-2.5 py-1.5 text-xs" : "pl-2.5 pr-2 py-1 text-[10px]"
        } font-bold uppercase transition-all cursor-pointer border ${
          isAdmin
            ? "bg-signal/15 border-signal text-signal font-black"
            : isMod
            ? "bg-sky-500/10 border-sky-400 text-sky-400 hover:border-sky-300 font-bold"
            : "bg-surface border-hairline text-ink-dim hover:text-ink hover:border-ink font-bold"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)" }}
      >
        <span className="truncate">
          {isAdmin ? "ADMIN" : isMod ? "MODERATOR" : "MAKER"}
        </span>
        <svg
          className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="square" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1 z-50 min-w-[120px] bg-void border border-hairline shadow-2xl font-mono divide-y divide-hairline/40 overflow-hidden"
          style={{ clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)" }}
        >
          <button
            type="button"
            onClick={() => {
              onChange("MAKER");
              setOpen(false);
            }}
            className={`w-full text-left pl-3.5 pr-2.5 py-1.5 text-[10px] font-bold uppercase transition-colors cursor-pointer flex items-center justify-between ${
              isMaker
                ? "bg-signal/20 text-signal font-black"
                : "text-ink hover:bg-surface hover:text-signal"
            }`}
          >
            <span>MAKER</span>
            {isMaker && <span className="text-signal text-[9px]">✓</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("MODERATOR");
              setOpen(false);
            }}
            className={`w-full text-left pl-3.5 pr-2.5 py-1.5 text-[10px] font-bold uppercase transition-colors cursor-pointer flex items-center justify-between ${
              isMod
                ? "bg-sky-500/20 text-sky-400 font-black"
                : "text-ink hover:bg-surface hover:text-sky-400"
            }`}
          >
            <span>MODERATOR</span>
            {isMod && <span className="text-sky-400 text-[9px]">✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── UsersTab (Full Admin Capabilities) ─────────────────────────── */

function UsersTab({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "MODERATOR" | "MAKER">("ALL");
  const [verifiedFilter, setVerifiedFilter] = useState<"ALL" | "VERIFIED" | "UNVERIFIED">("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "products" | "votes" | "name">("newest");
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Modals state
  const [editingUser, setEditingUser] = useState<AdminUserData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUserData | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    username: "",
    email: "",
    title: "",
    bio: "",
    websiteUrl: "",
    twitterHandle: "",
    githubHandle: "",
    role: "MAKER" as "MAKER" | "MODERATOR" | "ADMIN",
    emailVerified: false,
    isProfilePublic: true,
    showRevenuePublic: false,
  });

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    email: "",
    title: "",
    bio: "",
    websiteUrl: "",
    twitterHandle: "",
    githubHandle: "",
    role: "MAKER" as "MAKER" | "MODERATOR" | "ADMIN",
    emailVerified: true,
    isProfilePublic: true,
    showRevenuePublic: false,
  });

  const loadUsers = React.useCallback(async () => {
    try {
      const data = await getAdminUsersAction();
      setUsers(data);
    } catch (e) {
      console.error("Failed to load admin users:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  };

  const handleRoleChange = (u: AdminUserData, role: "MAKER" | "MODERATOR" | "ADMIN") => {
    startTransition(async () => {
      try {
        await updateUserRoleAction(u.id, role);
        showFlash(`Role updated for @${u.username} to ${role}`);
        await loadUsers();
      } catch (err: any) {
        showFlash(`Failed to update role: ${err.message}`);
      }
    });
  };

  const handleToggleVerified = (u: AdminUserData) => {
    startTransition(async () => {
      try {
        await updateUserProfileAdminAction(u.id, { emailVerified: !u.emailVerified });
        showFlash(`Email verification toggled for @${u.username}`);
        await loadUsers();
      } catch (err: any) {
        showFlash(`Error: ${err.message}`);
      }
    });
  };

  const handleToggleVisibility = (u: AdminUserData) => {
    startTransition(async () => {
      try {
        await updateUserProfileAdminAction(u.id, { isProfilePublic: !u.isProfilePublic });
        showFlash(`Profile visibility toggled for @${u.username}`);
        await loadUsers();
      } catch (err: any) {
        showFlash(`Error: ${err.message}`);
      }
    });
  };

  const openEditModal = (u: AdminUserData) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email,
      title: u.title || "",
      bio: u.bio || "",
      websiteUrl: u.websiteUrl || "",
      twitterHandle: u.twitterHandle || "",
      githubHandle: u.githubHandle || "",
      role: u.role,
      emailVerified: u.emailVerified,
      isProfilePublic: u.isProfilePublic,
      showRevenuePublic: u.showRevenuePublic,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    startTransition(async () => {
      try {
        await updateUserProfileAdminAction(editingUser.id, editForm);
        showFlash(`✓ Profile updated for @${editForm.username}`);
        setEditingUser(null);
        await loadUsers();
      } catch (err: any) {
        showFlash(`Failed to save: ${err.message}`);
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await createUserAdminAction(createForm);
        if (!res.success) {
          showFlash(`Creation failed: ${res.error}`);
          return;
        }
        showFlash(`✓ Created user @${createForm.username}`);
        setIsCreating(false);
        setCreateForm({
          name: "",
          username: "",
          email: "",
          title: "",
          bio: "",
          websiteUrl: "",
          twitterHandle: "",
          githubHandle: "",
          role: "MAKER",
          emailVerified: true,
          isProfilePublic: true,
          showRevenuePublic: false,
        });
        await loadUsers();
      } catch (err: any) {
        showFlash(`Creation error: ${err.message}`);
      }
    });
  };

  const handleDeleteUser = (u: AdminUserData) => {
    startTransition(async () => {
      try {
        const res = await deleteUserAdminAction(u.id);
        if (!res.success) {
          showFlash(`Delete failed: ${res.error}`);
          return;
        }
        showFlash(`✓ Deleted user @${u.username}`);
        setDeletingUser(null);
        await loadUsers();
      } catch (err: any) {
        showFlash(`Delete error: ${err.message}`);
      }
    });
  };

  if (loading) {
    return <TabLoader label="Loading administrative user directory..." />;
  }

  // Telemetry counts
  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const modCount = users.filter((u) => u.role === "MODERATOR").length;
  const makerCount = users.filter((u) => u.role === "MAKER").length;
  const verifiedCount = users.filter((u) => u.emailVerified).length;
  const publicCount = users.filter((u) => u.isProfilePublic).length;

  // Filter and Sort
  const filtered = users
    .filter((u) => {
      // Role filter
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      // Verified filter
      if (verifiedFilter === "VERIFIED" && !u.emailVerified) return false;
      if (verifiedFilter === "UNVERIFIED" && u.emailVerified) return false;
      // Visibility filter
      if (visibilityFilter === "PUBLIC" && !u.isProfilePublic) return false;
      if (visibilityFilter === "PRIVATE" && u.isProfilePublic) return false;

      // Text query
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.handle.toLowerCase().includes(q) ||
        (u.title && u.title.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "products") return b.productCount - a.productCount;
      if (sortBy === "votes") return b.voteCount - a.voteCount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="flex flex-col gap-3 min-h-0 md:h-full font-mono">
      {/* Toast feedback banner */}
      {flash && (
        <div className="p-3 border border-signal/40 bg-signal/10 text-signal text-xs font-bold flex items-center justify-between shrink-0">
          <span>{flash}</span>
          <button onClick={() => setFlash(null)} className="text-ink-dim hover:text-ink">
            ✕
          </button>
        </div>
      )}

      {/* Telemetry Counter Grid - Horizontal scroll on mobile, 6 cols on desktop */}
      <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-6 md:gap-3 md:overflow-visible shrink-0 scrollbar-none">
        <div className="border border-hairline p-2.5 sm:p-3 bg-surface/30 space-y-0.5 sm:space-y-1 min-w-[110px] md:min-w-0 shrink-0 md:shrink">
          <div className="text-[9px] sm:text-[10px] text-ink-dim uppercase font-bold">Total Users</div>
          <div className="text-lg sm:text-xl font-black font-display text-ink">{totalCount}</div>
        </div>
        <div className="border border-hairline p-2.5 sm:p-3 bg-surface/30 space-y-0.5 sm:space-y-1 min-w-[110px] md:min-w-0 shrink-0 md:shrink">
          <div className="text-[9px] sm:text-[10px] text-signal uppercase font-bold">Admins</div>
          <div className="text-lg sm:text-xl font-black font-display text-signal">{adminCount}</div>
        </div>
        <div className="border border-hairline p-2.5 sm:p-3 bg-surface/30 space-y-0.5 sm:space-y-1 min-w-[110px] md:min-w-0 shrink-0 md:shrink">
          <div className="text-[9px] sm:text-[10px] text-ink-dim uppercase font-bold">Moderators</div>
          <div className="text-lg sm:text-xl font-black font-display text-ink">{modCount}</div>
        </div>
        <div className="border border-hairline p-2.5 sm:p-3 bg-surface/30 space-y-0.5 sm:space-y-1 min-w-[110px] md:min-w-0 shrink-0 md:shrink">
          <div className="text-[9px] sm:text-[10px] text-ink-dim uppercase font-bold">Makers</div>
          <div className="text-lg sm:text-xl font-black font-display text-ink">{makerCount}</div>
        </div>
        <div className="border border-hairline p-2.5 sm:p-3 bg-surface/30 space-y-0.5 sm:space-y-1 min-w-[110px] md:min-w-0 shrink-0 md:shrink">
          <div className="text-[9px] sm:text-[10px] text-ink-dim uppercase font-bold">Verified</div>
          <div className="text-lg sm:text-xl font-black font-display text-ink">{verifiedCount}</div>
        </div>
        <div className="border border-hairline p-2.5 sm:p-3 bg-surface/30 space-y-0.5 sm:space-y-1 min-w-[110px] md:min-w-0 shrink-0 md:shrink">
          <div className="text-[9px] sm:text-[10px] text-ink-dim uppercase font-bold">Public Profiles</div>
          <div className="text-lg sm:text-xl font-black font-display text-ink">{publicCount}</div>
        </div>
      </div>

      {/* Controls Bar: Search, Filters, Sort, Actions */}
      <div className="border border-hairline p-3.5 bg-surface/20 space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name, username, email, title…"
            className="flex-1 px-3 py-2 text-xs bg-void border border-hairline focus:outline-none focus:border-signal font-mono text-ink placeholder:text-ink-faint"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsCreating(true)}
              className="px-3.5 py-2 bg-signal text-void text-xs font-bold hover:bg-signal/90 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>+</span>
              <span>Create User</span>
            </button>
            <button
              onClick={() => loadUsers()}
              disabled={pending}
              className="px-3 py-2 border border-hairline bg-surface hover:bg-raised text-xs font-bold text-ink transition-colors cursor-pointer shrink-0 disabled:opacity-40"
              title="Refresh User List"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Filter & Sort Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-hairline/60">
          <div>
            <label className="block text-[9px] uppercase font-bold text-ink-faint mb-1">Role Filter</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-2 py-1 text-xs bg-void border border-hairline text-ink font-mono focus:border-signal outline-none"
            >
              <option value="ALL">All Roles ({totalCount})</option>
              <option value="ADMIN">Admins ({adminCount})</option>
              <option value="MODERATOR">Moderators ({modCount})</option>
              <option value="MAKER">Makers ({makerCount})</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-ink-faint mb-1">Email Verification</label>
            <select
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value as any)}
              className="w-full px-2 py-1 text-xs bg-void border border-hairline text-ink font-mono focus:border-signal outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="VERIFIED">Verified ({verifiedCount})</option>
              <option value="UNVERIFIED">Unverified ({totalCount - verifiedCount})</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-ink-faint mb-1">Public Profile</label>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="w-full px-2 py-1 text-xs bg-void border border-hairline text-ink font-mono focus:border-signal outline-none"
            >
              <option value="ALL">All Visibility</option>
              <option value="PUBLIC">Public ({publicCount})</option>
              <option value="PRIVATE">Private ({totalCount - publicCount})</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-ink-faint mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2 py-1 text-xs bg-void border border-hairline text-ink font-mono focus:border-signal outline-none"
            >
              <option value="newest">Newest Joined</option>
              <option value="oldest">Oldest Joined</option>
              <option value="products">Most Products</option>
              <option value="votes">Most Votes Cast</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Interactive Table — Contained & Scrollable */}
      <div className="border border-hairline min-h-[380px] md:min-h-0 flex-1 overflow-auto bg-void relative">
        <table className="w-full text-xs min-w-[960px]">
          <thead className="sticky top-0 bg-surface z-10 border-b border-hairline">
            <tr className="text-[10px] uppercase text-ink-dim font-bold">
              <th className="text-left px-3 py-2.5">User / Creator</th>
              <th className="text-left px-3 py-2.5">Email &amp; Auth</th>
              <th className="text-left px-3 py-2.5">Role</th>
              <th className="text-left px-3 py-2.5">Visibility</th>
              <th className="text-center px-3 py-2.5">Products</th>
              <th className="text-center px-3 py-2.5">Votes</th>
              <th className="text-center px-3 py-2.5">Comments</th>
              <th className="text-left px-3 py-2.5">Joined</th>
              <th className="text-right px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-hairline hover:bg-surface/20 transition-colors">
                {/* User Info */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[2px] bg-ink text-surface flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden border border-hairline relative">
                      {u.image ? (
                        <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        (u.name || u.username).slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink">{u.name}</span>
                        <Link
                          href={`/founder/${u.username}`}
                          target="_blank"
                          prefetch={false}
                          className="text-[10px] text-ink-dim hover:text-signal"
                          title="Open public profile"
                        >
                          ↗
                        </Link>
                      </div>
                      <div className="text-[11px] text-ink-dim flex items-center gap-1.5 mt-0.5">
                        <span>@{u.username}</span>
                        {u.title && <span className="text-ink-faint truncate max-w-[140px]">· {u.title}</span>}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Email & Verified Toggle */}
                <td className="px-3 py-2.5">
                  <div className="space-y-1">
                    <div className="text-xs text-ink truncate max-w-[180px]">{u.email}</div>
                    <button
                      onClick={() => handleToggleVerified(u)}
                      disabled={pending}
                      className={`text-[9px] px-1.5 py-0.2 border uppercase font-bold cursor-pointer transition-colors ${
                        u.emailVerified
                          ? "border-signal/40 bg-signal/10 text-signal hover:bg-signal/20"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      }`}
                      title="Click to toggle email verification"
                    >
                      {u.emailVerified ? "✓ Verified" : "Unverified"}
                    </button>
                  </div>
                </td>

                {/* Role Switcher — Parallelogram styled, allows only MAKER / MODERATOR */}
                <td className="px-3 py-2.5">
                  <ParallelogramRoleDropdown
                    role={u.role}
                    onChange={(r) => handleRoleChange(u, r)}
                    disabled={pending}
                  />
                </td>

                {/* Visibility Toggle */}
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => handleToggleVisibility(u)}
                    disabled={pending}
                    className={`text-[9px] px-1.5 py-0.5 border uppercase font-bold cursor-pointer transition-colors ${
                      u.isProfilePublic
                        ? "border-hairline text-ink-dim hover:border-ink hover:text-ink"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    }`}
                    title="Click to toggle public profile visibility"
                  >
                    {u.isProfilePublic ? "Public" : "Private"}
                  </button>
                </td>

                {/* Counts */}
                <td className="px-3 py-2.5 tabular-nums text-center font-bold text-ink">
                  {u.productCount}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-center text-ink-dim">
                  {u.voteCount}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-center text-ink-dim">
                  {u.commentCount}
                </td>

                {/* Joined Date */}
                <td className="px-3 py-2.5 tabular-nums text-ink-dim text-[10px] whitespace-nowrap">
                  {new Date(u.createdAt).toISOString().slice(0, 10)}
                </td>

                {/* Action Buttons */}
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-2 py-1 border border-hairline bg-surface hover:bg-raised text-[10px] uppercase font-bold text-ink hover:text-signal transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingUser(u)}
                      className="px-2 py-1 border border-rose-500/30 hover:border-rose-500 bg-rose-500/10 text-[10px] uppercase font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      title="Delete User"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-dim text-xs">
                  No users match the search and filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="border border-hairline bg-surface p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto font-mono text-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <div className="text-[10px] text-signal font-bold uppercase">ADMINISTRATIVE USER EDITOR</div>
                <h3 className="text-base font-bold text-ink">Edit @{editingUser.username}</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-ink-dim hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Username / Handle</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Job Title / Headline</label>
                  <input
                    type="text"
                    placeholder="e.g. Founder & CTO"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Bio / Story</label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  placeholder="Founder bio or manifesto..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Website URL</label>
                  <input
                    type="url"
                    value={editForm.websiteUrl}
                    onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">𝕏 / Twitter Handle</label>
                  <input
                    type="text"
                    value={editForm.twitterHandle}
                    onChange={(e) => setEditForm({ ...editForm, twitterHandle: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">GitHub Handle</label>
                  <input
                    type="text"
                    value={editForm.githubHandle}
                    onChange={(e) => setEditForm({ ...editForm, githubHandle: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                    placeholder="username"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-hairline">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Role Assignment</label>
                  <ParallelogramRoleDropdown
                    role={editForm.role}
                    onChange={(r) => setEditForm({ ...editForm, role: r })}
                    size="md"
                  />
                </div>
                <div className="space-y-1.5 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.emailVerified}
                      onChange={(e) => setEditForm({ ...editForm, emailVerified: e.target.checked })}
                      className="accent-signal"
                    />
                    <span className="text-[11px] font-bold">Email Verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isProfilePublic}
                      onChange={(e) => setEditForm({ ...editForm, isProfilePublic: e.target.checked })}
                      className="accent-signal"
                    />
                    <span className="text-[11px] font-bold">Public Profile Visible</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.showRevenuePublic}
                      onChange={(e) => setEditForm({ ...editForm, showRevenuePublic: e.target.checked })}
                      className="accent-signal"
                    />
                    <span className="text-[11px] font-bold">Show Revenue Publicly</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-1.5 bg-signal text-void text-xs font-bold hover:bg-signal/90 disabled:opacity-40"
                >
                  {pending ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Create User Modal */}
      {isCreating && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="border border-hairline bg-surface p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto font-mono text-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <div className="text-[10px] text-signal font-bold uppercase">PROVISION USER ACCOUNT</div>
                <h3 className="text-base font-bold text-ink">Create New User</h3>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="text-ink-dim hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Satoshi Nakamoto"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. satoshi"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="satoshi@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Chief Architect"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Bio</label>
                <textarea
                  rows={2}
                  placeholder="Short founder biography..."
                  value={createForm.bio}
                  onChange={(e) => setCreateForm({ ...createForm, bio: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Website</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={createForm.websiteUrl}
                    onChange={(e) => setCreateForm({ ...createForm, websiteUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">𝕏 / Twitter</label>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={createForm.twitterHandle}
                    onChange={(e) => setCreateForm({ ...createForm, twitterHandle: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">GitHub</label>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={createForm.githubHandle}
                    onChange={(e) => setCreateForm({ ...createForm, githubHandle: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-void border border-hairline focus:border-signal outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-hairline">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink-dim mb-1">Initial Role</label>
                  <ParallelogramRoleDropdown
                    role={createForm.role}
                    onChange={(r) => setCreateForm({ ...createForm, role: r })}
                    size="md"
                  />
                </div>
                <div className="space-y-1.5 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.emailVerified}
                      onChange={(e) => setCreateForm({ ...createForm, emailVerified: e.target.checked })}
                      className="accent-signal"
                    />
                    <span className="text-[11px] font-bold">Email Verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.isProfilePublic}
                      onChange={(e) => setCreateForm({ ...createForm, isProfilePublic: e.target.checked })}
                      className="accent-signal"
                    />
                    <span className="text-[11px] font-bold">Public Profile Visible</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-1.5 bg-signal text-void text-xs font-bold hover:bg-signal/90 disabled:opacity-40 cursor-pointer"
                >
                  {pending ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="border border-rose-500/50 bg-surface p-6 max-w-md w-full space-y-4 font-mono text-ink shadow-2xl">
            <div className="text-xs uppercase font-bold text-rose-400">DANGER: PERMANENT USER DELETION</div>
            <h3 className="text-base font-bold text-ink">Delete user @{deletingUser.username}?</h3>
            <p className="text-xs text-ink-dim font-sans leading-relaxed">
              This action will permanently delete <strong>{deletingUser.name}</strong> ({deletingUser.email}), their active sessions, votes, and comments. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deletingUser)}
                disabled={pending}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 disabled:opacity-40 cursor-pointer"
              >
                {pending ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─────────────────────────── SubmissionsTab (DB-backed) ─────────────────────────── */

type SubRow = Awaited<ReturnType<typeof listSubmissions>>[number];

function SubmissionsTab() {
  const [items, setItems] = useState<SubRow[]>([]);
  const [leadHours, setLeadHoursState] = useState(24);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = React.useCallback(async () => {
    try {
      const [rows, lead] = await Promise.all([listSubmissions(), getDefaultLeadHours()]);
      setItems(rows);
      setLeadHoursState(lead);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return <TabLoader label="Loading submissions queue..." />;
  }

  const scheduled = items.filter((s) => s.status === "SCHEDULED");
  const published = items.filter((s) => s.status === "PUBLISHED");
  const rejected = items.filter((s) => s.status === "REJECTED");

  const doReject = (sub: SubRow) => {
    if (!rejectReason.trim()) return;
    startTransition(async () => {
      try {
        await rejectSubmission(sub.id, rejectReason.trim());
        setFlash(`Rejected "${sub.name}" — rejection email queued to ${sub.makerEmail}.`);
        setRejectId(null);
        setRejectReason("");
        await refresh();
      } catch (e) {
        setFlash(String((e as Error).message));
      }
      setTimeout(() => setFlash(null), 4500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="border border-hairline p-3.5 flex flex-wrap items-center gap-3">
        <div className="text-xs uppercase text-ink-dim font-bold">Default lead time</div>
        <input
          type="number"
          min={0}
          value={leadHours}
          onChange={(e) => setLeadHoursState(Number(e.target.value) || 0)}
          className="w-20 px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono"
        />
        <span className="text-xs text-ink-dim font-bold">hours after submission</span>
        <button
          onClick={() => {
            startTransition(async () => {
              await setDefaultLeadHours(leadHours);
              setFlash("Default schedule updated.");
              setTimeout(() => setFlash(null), 2500);
            });
          }}
          disabled={pending}
          className="text-xs uppercase font-bold px-3 py-1.5 border border-ink bg-ink text-surface disabled:opacity-40"
        >
          Save default
        </button>
        {flash && <span className="text-xs text-signal font-bold">{flash}</span>}
      </div>

      <div className="border border-hairline">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-hairline bg-surface/30 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase text-ink-dim font-bold">
              Scheduled ({scheduled.length})
            </div>
            <button
              onClick={() => refresh()}
              className="text-[11px] font-mono font-bold px-2 py-0.5 border border-hairline bg-surface hover:bg-raised text-ink hover:text-signal transition-colors cursor-pointer"
            >
              ↻ Refresh
            </button>
          </div>
          {scheduled.length > 0 && (
            <button
              onClick={() => {
                if (
                  scheduled.length > 1 &&
                  !confirm(
                    `Are you sure you want to publish all ${scheduled.length} scheduled products live right now?`
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  try {
                    const res = await publishAllScheduledSubmissions();
                    setFlash(
                      `✓ Successfully published ${res.count} product${
                        res.count === 1 ? "" : "s"
                      } live to The Launch Feed!`
                    );
                    await refresh();
                  } catch (e) {
                    setFlash(`Publish failed: ${(e as Error).message}`);
                  }
                  setTimeout(() => setFlash(null), 5000);
                });
              }}
              disabled={pending}
              className="text-xs uppercase font-bold px-3 py-1.5 bg-signal text-void hover:bg-signal/80 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Publish all scheduled products live at once"
            >
              <span>⚡</span>
              <span>Publish All at Once ({scheduled.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-xs uppercase text-ink-dim font-bold">
                <th className="text-left px-3 py-2 border-b border-hairline">Product</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Maker</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Scheduled for (UTC)</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Countdown</th>
                <th className="text-right px-3 py-2 border-b border-hairline">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map((s) => (
                <React.Fragment key={s.id}>
                  <tr className="border-t border-hairline align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-bold">{s.name}</div>
                      <div className="text-xs text-ink-dim truncate max-w-[240px]">
                        {s.tagline}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{s.makerName}</div>
                      <div className="text-xs text-ink-dim">{s.makerEmail}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="datetime-local"
                        value={toLocalInput(s.scheduledFor.toString())}
                        onChange={(e) => {
                          const iso = fromLocalInput(e.target.value);
                          if (!iso) return;
                          startTransition(async () => {
                            await updateSchedule(s.id, new Date(iso));
                            await refresh();
                          });
                        }}
                        className="px-2 py-1 text-xs bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <SubmissionTimer target={s.scheduledFor.toString()} compact />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            await publishSubmissionNow(s.id);
                            await refresh();
                          });
                        }}
                        disabled={pending}
                        className="text-xs uppercase font-bold px-2.5 py-1 border border-signal bg-signal text-surface mr-1 disabled:opacity-40"
                      >
                        Publish now
                      </button>
                      <button
                        onClick={() => {
                          setRejectId(rejectId === s.id ? null : s.id);
                          setRejectReason("");
                        }}
                        className="text-xs uppercase font-bold px-2.5 py-1 border border-hairline hover:bg-signal hover:text-surface hover:border-signal mr-1"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            await deleteSubmission(s.id);
                            await refresh();
                          });
                        }}
                        className="text-xs uppercase font-bold px-2.5 py-1 border border-hairline hover:bg-ink hover:text-surface"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {rejectId === s.id && (
                    <tr className="border-t border-hairline bg-[color:var(--surface-alt,rgba(0,0,0,0.02))]">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="text-xs uppercase text-ink-dim font-bold mb-1">
                          Reason for rejection · sent to {s.makerEmail}
                        </div>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                          placeholder="Explain why this submission was rejected. Be specific — the founder gets this verbatim."
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink"
                        />
                        <div className="mt-2 flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              setRejectId(null);
                              setRejectReason("");
                            }}
                            className="text-xs uppercase font-bold px-3 py-1.5 border border-hairline"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => doReject(s)}
                            disabled={!rejectReason.trim() || pending}
                            className="text-xs uppercase font-bold px-3 py-1.5 border border-signal bg-signal text-surface disabled:opacity-40"
                          >
                            Reject & send email
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {scheduled.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-ink-dim text-sm">
                    No scheduled submissions in the queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-hairline">
        <SectionTitle>Published ({published.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <tbody>
              {published.slice(0, 20).map((s) => (
                <tr key={s.id} className="border-t border-hairline first:border-t-0">
                  <td className="px-3 py-2.5 font-bold">{s.name}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim truncate max-w-[280px]">{s.tagline}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-ink-dim">
                    {s.publishedAt ? s.publishedAt.toString().replace("T", " ").slice(0, 19) : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/product/${slugify(s.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      prefetch={false}
                      className="text-xs uppercase font-bold underline underline-offset-2 hover:text-signal"
                    >
                      view ↗
                    </Link>
                  </td>
                </tr>
              ))}
              {published.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-ink-dim text-sm">Nothing published yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-hairline">
        <SectionTitle>Rejected ({rejected.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <tbody>
              {rejected.slice(0, 20).map((s) => (
                <tr key={s.id} className="border-t border-hairline first:border-t-0 align-top">
                  <td className="px-3 py-2.5 w-1/4">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-ink-dim">{s.makerEmail}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">
                    <div className="text-xs uppercase text-signal font-bold mb-0.5">Reason</div>
                    {s.rejectionReason || "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-ink-dim whitespace-nowrap">
                    {s.rejectedAt ? s.rejectedAt.toString().replace("T", " ").slice(0, 19) : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          await deleteSubmission(s.id);
                          await refresh();
                        });
                      }}
                      className="text-xs uppercase font-bold px-2.5 py-1 border border-hairline hover:bg-ink hover:text-surface"
                    >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rejected.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-ink-dim text-sm">No rejected submissions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─────────────────────────── FeaturedTab (DB-backed) ─────────────────────────── */

function SlotEditor({
  title,
  help,
  position,
  slots,
  refresh,
}: {
  title: string;
  help: string;
  position: "FEATURED" | "ROTATING";
  slots: UISlot[];
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [url, setUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [pending, startTransition] = useTransition();

  // State for modifying existing listings
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editPosition, setEditPosition] = useState<"FEATURED" | "ROTATING">(position);

  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);

  const paid = slots.filter((s) => s.kind === "PAID");
  const custom = slots.filter((s) => s.kind === "CUSTOM");
  const total = paid.length + custom.length;
  const canAdd = !pending;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      alert("Please select an image under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const add = () => {
    if (!name.trim() || !canAdd) return;
    startTransition(async () => {
      await addCustomSlot({
        position,
        name: name.trim(),
        tagline: tagline.trim(),
        url: url.trim(),
        logoUrl: logoUrl.trim(),
      });
      setName("");
      setTagline("");
      setUrl("");
      setLogoUrl("");
      await refresh();
    });
  };

  const startEditing = (s: UISlot) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditTagline(s.tagline || "");
    setEditUrl(s.url === "#" ? "" : s.url);
    setEditLogoUrl(s.logoUrl || "");
    setEditPosition(s.position);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditTagline("");
    setEditUrl("");
    setEditLogoUrl("");
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    startTransition(async () => {
      await updateSlot({
        id: editingId,
        name: editName.trim(),
        tagline: editTagline.trim(),
        url: editUrl.trim(),
        logoUrl: editLogoUrl.trim(),
        position: editPosition,
      });
      setEditingId(null);
      await refresh();
    });
  };

  return (
    <div className="border border-hairline">
      <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5 flex-wrap gap-2">
        <div className="text-xs uppercase text-ink-dim font-bold">
          {title}{" "}
          <span className="text-ink">({total})</span>{" "}
          <span className="text-ink-dim">— {custom.length} custom (unlimited)</span>
        </div>
        <div className="text-xs uppercase text-ink-dim font-bold">
          {help} · <span className="text-ink">{paid.length}</span> paid ·{" "}
          <span className="text-ink">{custom.length}</span> custom
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="text-xs uppercase text-ink-dim font-bold">
            <th className="text-left px-3 py-2 border-b border-hairline w-8">#</th>
            <th className="text-left px-3 py-2 border-b border-hairline">Logo & Product</th>
            <th className="text-left px-3 py-2 border-b border-hairline">Tagline</th>
            <th className="text-left px-3 py-2 border-b border-hairline">Link</th>
            <th className="text-left px-3 py-2 border-b border-hairline">Source</th>
            <th className="text-right px-3 py-2 border-b border-hairline">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paid.map((s, i) =>
            editingId === s.id ? (
              <tr key={s.id} className="border-t border-hairline bg-surface-subtle/80">
                <td colSpan={6} className="p-3">
                  <div className="p-3.5 border border-ink/40 bg-surface space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-signal tracking-wider flex items-center gap-1.5">
                        <span>✎</span> Modify Listing & Logo · #{i + 1} ({s.kind})
                      </span>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={pending}
                        className="text-xs uppercase font-bold text-ink-dim hover:text-ink disabled:opacity-40"
                      >
                        ✕ Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Product Name *</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Product Name"
                          disabled={pending}
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Tagline</label>
                        <input
                          value={editTagline}
                          onChange={(e) => setEditTagline(e.target.value)}
                          placeholder="Tagline"
                          disabled={pending}
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Destination URL</label>
                        <input
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="https://… or /product/…"
                          disabled={pending}
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Logo URL or Upload</label>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xs border border-hairline bg-void flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {editLogoUrl ? (
                              <img src={editLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              editName.substring(0, 2).toUpperCase() || "?"
                            )}
                          </div>
                          <input
                            value={editLogoUrl}
                            onChange={(e) => setEditLogoUrl(e.target.value)}
                            placeholder="https://… or upload"
                            disabled={pending}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                          />
                          <input
                            type="file"
                            ref={editFileInputRef}
                            onChange={(e) => handleFileUpload(e, setEditLogoUrl)}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            disabled={pending}
                            className="px-2 py-1.5 text-xs uppercase font-bold border border-hairline bg-surface hover:bg-raised text-ink shrink-0 cursor-pointer disabled:opacity-40"
                            title="Upload logo from file"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-hairline flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs uppercase text-ink-dim font-bold">Position:</label>
                        <select
                          value={editPosition}
                          onChange={(e) => setEditPosition(e.target.value as "FEATURED" | "ROTATING")}
                          disabled={pending}
                          className="px-2.5 py-1 text-sm bg-surface border border-hairline focus:outline-none focus:border-ink text-ink font-mono cursor-pointer"
                        >
                          <option value="FEATURED">FEATURED (Top marquee strip)</option>
                          <option value="ROTATING">ROTATING (Header floaters)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={pending}
                          className="px-3 py-1.5 text-xs uppercase font-bold border border-hairline text-ink hover:bg-surface-subtle disabled:opacity-30"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={pending || !editName.trim()}
                          className="px-3 py-1.5 text-xs uppercase font-bold border border-ink bg-ink text-surface hover:opacity-90 disabled:opacity-30"
                        >
                          {pending ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={s.id} className="border-t border-hairline first:border-t-0">
                <td className="px-3 py-2.5 text-ink-dim tabular-nums text-xs">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xs border border-hairline bg-void flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {s.logoUrl ? (
                        <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        s.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="font-bold">{s.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-dim truncate max-w-[240px]">{s.tagline}</td>
                <td className="px-3 py-2.5">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs uppercase underline underline-offset-2 hover:text-signal"
                  >
                    {s.url.replace(/^https?:\/\//, "")} ↗
                  </a>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 border border-[color:var(--verified,#00D97E)] text-[color:var(--verified,#00D97E)]">
                    PAID
                  </span>
                  {s.subscription && (
                    <div className="text-xs text-ink-dim mt-0.5">
                      {s.subscription.userName} · ${s.subscription.price}/mo
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => startEditing(s)}
                    disabled={pending}
                    className="px-2 py-1 text-xs uppercase font-bold border border-hairline hover:bg-surface-subtle cursor-pointer"
                    title="Modify listing & logo"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            )
          )}
          {custom.map((c, i) =>
            editingId === c.id ? (
              <tr key={c.id} className="border-t border-hairline bg-surface-subtle/80">
                <td colSpan={6} className="p-3">
                  <div className="p-3.5 border border-ink/40 bg-surface space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-signal tracking-wider flex items-center gap-1.5">
                        <span>✎</span> Modify Listing & Logo · #{paid.length + i + 1} ({c.kind})
                      </span>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={pending}
                        className="text-xs uppercase font-bold text-ink-dim hover:text-ink disabled:opacity-40"
                      >
                        ✕ Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Product Name *</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Product Name"
                          disabled={pending}
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Tagline</label>
                        <input
                          value={editTagline}
                          onChange={(e) => setEditTagline(e.target.value)}
                          placeholder="Tagline"
                          disabled={pending}
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Destination URL</label>
                        <input
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="https://… or /product/…"
                          disabled={pending}
                          className="w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-ink-dim mb-1 font-bold">Logo URL or Upload</label>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xs border border-hairline bg-void flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {editLogoUrl ? (
                              <img src={editLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              editName.substring(0, 2).toUpperCase() || "?"
                            )}
                          </div>
                          <input
                            value={editLogoUrl}
                            onChange={(e) => setEditLogoUrl(e.target.value)}
                            placeholder="https://… or upload"
                            disabled={pending}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono disabled:opacity-40"
                          />
                          <input
                            type="file"
                            ref={editFileInputRef}
                            onChange={(e) => handleFileUpload(e, setEditLogoUrl)}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            disabled={pending}
                            className="px-2 py-1.5 text-xs uppercase font-bold border border-hairline bg-surface hover:bg-raised text-ink shrink-0 cursor-pointer disabled:opacity-40"
                            title="Upload logo from file"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-hairline flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs uppercase text-ink-dim font-bold">Position:</label>
                        <select
                          value={editPosition}
                          onChange={(e) => setEditPosition(e.target.value as "FEATURED" | "ROTATING")}
                          disabled={pending}
                          className="px-2.5 py-1 text-sm bg-surface border border-hairline focus:outline-none focus:border-ink text-ink font-mono cursor-pointer"
                        >
                          <option value="FEATURED">FEATURED (Top marquee strip)</option>
                          <option value="ROTATING">ROTATING (Header floaters)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={pending}
                          className="px-3 py-1.5 text-xs uppercase font-bold border border-hairline text-ink hover:bg-surface-subtle disabled:opacity-30 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={pending || !editName.trim()}
                          className="px-3 py-1.5 text-xs uppercase font-bold border border-ink bg-ink text-surface hover:opacity-90 disabled:opacity-30 cursor-pointer"
                        >
                          {pending ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={c.id} className="border-t border-hairline">
                <td className="px-3 py-2.5 text-ink-dim tabular-nums text-xs">{paid.length + i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xs border border-hairline bg-void flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        c.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="font-bold">{c.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-dim truncate max-w-[240px]">{c.tagline}</td>
                <td className="px-3 py-2.5">
                  {c.url && c.url !== "#" ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs uppercase underline underline-offset-2 hover:text-signal"
                    >
                      {c.url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-xs text-ink-dim">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 border border-signal text-signal">
                    CUSTOM
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => startEditing(c)}
                    disabled={pending}
                    className="px-2 py-1 text-xs uppercase font-bold border border-hairline hover:bg-surface-subtle mr-1 cursor-pointer"
                    title="Modify listing & logo"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => startTransition(async () => { await reorderSlot(c.id, -1); await refresh(); })}
                    disabled={i === 0 || pending}
                    className="px-2 py-1 text-xs font-bold border border-hairline mr-1 disabled:opacity-30 cursor-pointer"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => startTransition(async () => { await reorderSlot(c.id, 1); await refresh(); })}
                    disabled={i === custom.length - 1 || pending}
                    className="px-2 py-1 text-xs font-bold border border-hairline mr-1 disabled:opacity-30 cursor-pointer"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => startTransition(async () => { await removeCustomSlot(c.id); await refresh(); })}
                    disabled={pending}
                    className="px-2.5 py-1 text-xs uppercase font-bold border border-hairline hover:bg-signal hover:text-surface hover:border-signal cursor-pointer"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            )
          )}
          {total === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-ink-dim text-sm">
                No placements yet — either wait for a paid slot or add a custom one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

      {/* Add Custom Slot Input Strip */}
      <div className="border-t border-hairline p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_2fr_2fr_1.8fr_auto] gap-2.5 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name *"
          disabled={!canAdd}
          className="px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink disabled:opacity-40"
        />
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Tagline"
          disabled={!canAdd}
          className="px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink disabled:opacity-40"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Destination URL (https://…)"
          disabled={!canAdd}
          className="px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink disabled:opacity-40"
        />
        <div className="flex items-center gap-1.5">
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="Logo URL or upload"
            disabled={!canAdd}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-transparent border border-hairline focus:outline-none focus:border-ink disabled:opacity-40 font-mono"
          />
          <input
            type="file"
            ref={addFileInputRef}
            onChange={(e) => handleFileUpload(e, setLogoUrl)}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => addFileInputRef.current?.click()}
            disabled={!canAdd}
            className="px-2 py-1.5 text-xs uppercase font-bold border border-hairline bg-surface hover:bg-raised text-ink shrink-0 cursor-pointer disabled:opacity-40"
            title="Upload logo file"
          >
            Upload
          </button>
        </div>
        <button
          onClick={add}
          disabled={!canAdd || !name.trim() || pending}
          className="text-xs uppercase font-bold px-3.5 py-1.5 border border-ink bg-ink text-surface disabled:opacity-30 cursor-pointer shrink-0"
        >
          + Add custom
        </button>
      </div>
    </div>
  );
}

function FeaturedTab() {
  const [featured, setFeatured] = useState<UISlot[]>([]);
  const [rotating, setRotating] = useState<UISlot[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = React.useCallback(async () => {
    try {
      const [f, r] = await Promise.all([listSlots("FEATURED"), listSlots("ROTATING")]);
      setFeatured(f);
      setRotating(r);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <TabLoader label="Loading featured & rotating slots..." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-dim leading-relaxed">
        Paid placements are pulled automatically from active FeaturedPurchase rows —{" "}
        <span className="text-ink font-bold">FEATURED</span> position fills the top slots,{" "}
        <span className="text-ink font-bold">ROTATING</span> fills the strip. Custom entries are stored in
        the FeaturedSlot table with an external URL for partners or house ads.
      </p>
      <SlotEditor
        title="Top featured"
        help="Marquee strip · rotates every 15s"
        position="FEATURED"
        slots={featured}
        refresh={refresh}
      />
      <SlotEditor
        title="Rotating floaters"
        help="Header carousel · 4 visible, cycles in pairs every 15s"
        position="ROTATING"
        slots={rotating}
        refresh={refresh}
      />
    </div>
  );
}

/* ─────────────────────────── CategoriesTab (DB-backed) ─────────────────────────── */

function CategoriesTab() {
  const [cats, setCats] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const refresh = React.useCallback(async () => {
    try {
      setCats(await listCategories());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <TabLoader label="Loading category taxonomy..." />;
  }

  const submit = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      await addCategory(newName);
      setNewName("");
      await refresh();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-dim leading-relaxed">
        Categories the submit form shows to users. Additions appear in the{" "}
        <span className="text-ink font-bold">/submit</span> dropdown immediately (revalidatePath is
        triggered server-side). Removing a category does not affect products already tagged
        with it.
      </p>

      <div className="border border-hairline p-3 flex flex-wrap gap-2 items-center">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="New category name (e.g. Robotics & Automation)"
          className="flex-1 min-w-[220px] px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink"
        />
        <button
          onClick={submit}
          disabled={!newName.trim() || pending}
          className="text-xs uppercase font-bold px-3.5 py-1.5 border border-ink bg-ink text-surface disabled:opacity-30"
        >
          + Add category
        </button>
      </div>

      <div className="border border-hairline">
        <SectionTitle>Categories ({cats.length})</SectionTitle>
        <ul>
          {cats.map((c) => (
            <li
              key={c.id}
              className="px-3.5 py-2.5 text-sm border-t border-hairline first:border-t-0 flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">
                <span className="font-bold">{c.name}</span>
                <span className="text-ink-dim ml-2 text-xs">{c.slug}</span>
              </span>
              <button
                onClick={() => startTransition(async () => { await removeCategory(c.id); await refresh(); })}
                disabled={pending}
                className="text-xs uppercase font-bold px-2.5 py-1 border border-hairline hover:bg-signal hover:text-surface hover:border-signal disabled:opacity-40 shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
          {cats.length === 0 && (
            <li className="px-3 py-4 text-center text-ink-dim text-sm">No categories.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────── ModerationTab (DB-backed) ─────────────────────────── */

type FlaggedRow = Awaited<ReturnType<typeof listFlaggedComments>>[number];

function ModerationTab() {
  const [items, setItems] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const refresh = React.useCallback(async () => {
    try {
      setItems(await listFlaggedComments());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <TabLoader label="Loading moderation queue..." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-dim leading-relaxed">
        Every flagged comment on a published product page lands here. Deleting sets
        `isDeleted=true` and drops it from the thread. Dismissing marks all open flags as
        DISMISSED and leaves the comment visible.
      </p>
      <div className="border border-hairline">
        <SectionTitle>Flagged comments ({items.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs uppercase text-ink-dim font-bold">
              <th className="text-left px-3 py-2 border-b border-hairline">Author</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Body</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Product</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Reported by</th>
              <th className="text-left px-3 py-2 border-b border-hairline">When</th>
              <th className="text-right px-3 py-2 border-b border-hairline">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-hairline align-top">
                <td className="px-3 py-2.5">
                  <div className="font-bold">{c.user.name || c.user.username}</div>
                  <div className="text-xs text-ink-dim">@{c.user.username}</div>
                </td>
                <td className="px-3 py-2.5 max-w-[320px]">
                  <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/product/${c.product.slug}#comments`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs uppercase font-bold underline underline-offset-2 hover:text-signal"
                  >
                    {c.product.slug} ↗
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-ink-dim text-xs">
                  {c.flags.length > 0 ? c.flags[0].raisedBy.email : "—"}
                </td>
                <td className="px-3 py-2.5 text-ink-dim tabular-nums whitespace-nowrap text-xs">
                  {c.createdAt.toString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => startTransition(async () => { await dismissFlags(c.id); await refresh(); })}
                    disabled={pending}
                    className="text-xs uppercase font-bold px-2.5 py-1 border border-hairline mr-1 hover:bg-ink hover:text-surface disabled:opacity-40"
                  >
                    Dismiss flag
                  </button>
                  <button
                    onClick={() => startTransition(async () => { await deleteFlaggedComment(c.id); await refresh(); })}
                    disabled={pending}
                    className="text-xs uppercase font-bold px-2.5 py-1 border border-signal bg-signal text-surface disabled:opacity-40"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-dim text-sm">
                  Nothing to review. All threads are clean.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

/* ─────────────────────────── FounderTab ─────────────────────────── */

function FounderTab({ session }: { session: UserSession }) {
  // The admin's own handle drives the founder URL — never slugify(name), which
  // fuzzy-matches other users when a display name collides. session.handle is
  // the canonical @username kept in sync with /api/me.
  const founderSlug = (session.handle || "").replace(/^@/, "").trim();

  const [myProducts, setMyProducts] = useState<MyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listMyProducts()
      .then((rows) => {
        if (!cancelled) setMyProducts(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusStyle = (status: MyProduct["status"]) => {
    switch (status) {
      case "LIVE":
        return "border-verified/50 text-verified bg-verified/10";
      case "SCHEDULED":
        return "border-signal/50 text-signal bg-signal/10";
      case "DRAFT":
        return "border-hairline text-ink-dim bg-surface";
      case "REJECTED":
        return "border-signal text-signal bg-signal/20";
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-hairline p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[2px] bg-ink text-surface flex items-center justify-center text-base font-bold shrink-0 overflow-hidden border border-hairline relative">
              {session.image ? (
                <img
                  src={session.image}
                  alt={session.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                session.avatar
              )}
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold">{session.name}</div>
              <div className="text-xs text-ink-dim">
                {session.handle} · {session.email}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/founder/${founderSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase font-bold px-3 py-1.5 border border-hairline hover:bg-ink hover:text-surface transition-colors"
            >
              ◆ View founder page ↗
            </Link>
            <Link
              href="/profile"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase font-bold px-3 py-1.5 border border-hairline hover:bg-ink hover:text-surface transition-colors"
            >
              ⚙ Edit profile ↗
            </Link>
            <Link
              href="/submit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase font-bold px-3.5 py-1.5 border border-signal bg-signal text-surface hover:opacity-90"
            >
              + Submit product ↗
            </Link>
          </div>
        </div>
        <p className="text-xs text-ink-dim mt-3 leading-relaxed">
          As admin you can also act as a founder. Submitted products from this account behave
          like any other submission and appear in the moderation queue.
        </p>
      </div>

      <div className="border border-hairline">
        <SectionTitle>My products ({myProducts.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-dim text-sm">Loading your products…</td>
              </tr>
            )}
            {!loading && loadError && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-signal text-sm">{loadError}</td>
              </tr>
            )}
            {!loading && !loadError && myProducts.map((p) => (
              <tr key={p.id} className="border-t border-hairline first:border-t-0">
                <td className="px-3 py-2.5 font-bold">{p.name}</td>
                <td className="px-3 py-2.5 text-xs text-ink-dim truncate max-w-[260px]">{p.tagline}</td>
                <td className="px-3 py-2.5 uppercase text-xs font-bold text-ink-dim">{p.category}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border ${statusStyle(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right font-bold">{p.status === "LIVE" ? p.votes : "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  {p.status === "LIVE" && p.slug ? (
                    <Link
                      href={`/product/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs uppercase font-bold underline underline-offset-2 hover:text-signal"
                    >
                      view ↗
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-faint uppercase">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && !loadError && myProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-dim text-sm">
                  No products yet. Submit your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

/* ─────────────────────────── EmailsTab (DB-backed) ─────────────────────────── */

type EmailRow = Awaited<ReturnType<typeof listEmailLog>>[number];

function EmailsTab({ session }: { session: UserSession }) {
  const [templateId, setTemplateId] = useState<EmailTemplateId>("welcome");
  const [to, setTo] = useState("");
  const [vars, setVars] = useState<TemplateVars>({
    userName: session.name,
    productName: "Synthwave",
    productSlug: "synthwave",
    rank: 1,
    period: "daily",
    revenueLabel: "$4.2k MRR",
    slotExpiresOn: "Aug 20, 2026",
    customBody: "",
  });
  const [log, setLog] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = React.useCallback(async () => {
    try {
      setLog(await listEmailLog(100));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <TabLoader label="Loading email dispatch logs & templates..." />;
  }

  const tpl = getTemplate(templateId);
  const subject = tpl.subject(vars);
  const html = tpl.render(vars);

  const send = () => {
    if (!to.trim()) {
      setStatus("Recipient required.");
      return;
    }
    startTransition(async () => {
      try {
        await sendOne({ templateId, to: to.trim(), vars });
        setStatus(`Queued → ${to} (${tpl.name})`);
        setTo("");
        await refresh();
      } catch (e) {
        setStatus(String((e as Error).message));
      }
      setTimeout(() => setStatus(null), 3500);
    });
  };

  const sendAll = () => {
    startTransition(async () => {
      try {
        const n = await broadcastToAllUsers({ templateId, vars });
        setStatus(`Broadcast queued to ${n} users.`);
        await refresh();
      } catch (e) {
        setStatus(String((e as Error).message));
      }
      setTimeout(() => setStatus(null), 3500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-hairline">
          <SectionTitle>Compose</SectionTitle>
          <div className="p-3.5 space-y-3">
            <ThemedSelect
              label="Template"
              value={templateId}
              onChange={(v) => setTemplateId(v as EmailTemplateId)}
              options={TEMPLATES.map((t) => ({ value: t.id, label: t.name, hint: t.trigger }))}
            />
            <p className="text-xs text-ink-dim">{tpl.description}</p>

            <label className="block text-xs uppercase font-bold text-ink-dim">
              To
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <VarInput label="User name" value={vars.userName} onChange={(v) => setVars({ ...vars, userName: v })} />
              <VarInput label="Product name" value={vars.productName} onChange={(v) => setVars({ ...vars, productName: v })} />
              <VarInput label="Product slug" value={vars.productSlug} onChange={(v) => setVars({ ...vars, productSlug: v })} />
              <VarInput label="Rank" value={String(vars.rank ?? "")} onChange={(v) => setVars({ ...vars, rank: Number(v) || undefined })} />
              <ThemedSelect
                label="Period"
                value={vars.period ?? "daily"}
                onChange={(v) => setVars({ ...vars, period: v as TemplateVars["period"] })}
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
              <VarInput label="Slot expires" value={vars.slotExpiresOn} onChange={(v) => setVars({ ...vars, slotExpiresOn: v })} />
            </div>

            {templateId === "custom-broadcast" && (
              <label className="block text-xs uppercase font-bold text-ink-dim">
                Body
                <textarea
                  value={vars.customBody ?? ""}
                  onChange={(e) => setVars({ ...vars, customBody: e.target.value })}
                  rows={5}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink"
                />
              </label>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={send}
                disabled={pending}
                className="text-xs uppercase font-bold px-3 py-1.5 border border-ink bg-ink text-surface disabled:opacity-40"
              >
                ✉ Send test
              </button>
              <button
                onClick={sendAll}
                disabled={pending}
                className="text-xs uppercase font-bold px-3 py-1.5 border border-signal bg-signal text-surface disabled:opacity-40"
              >
                ⚡ Broadcast to all users
              </button>
              <span className="text-xs text-ink-dim self-center">
                From: {session.email}
              </span>
            </div>
            {status && (
              <div className="text-xs text-ink border border-hairline px-2.5 py-1.5 font-bold">{status}</div>
            )}
          </div>
        </div>

        <div className="border border-hairline">
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <div className="text-xs uppercase text-ink-dim font-bold">Preview</div>
            <div className="text-xs text-ink-dim truncate max-w-[60%]" title={subject}>
              subject: <span className="text-ink font-bold">{subject}</span>
            </div>
          </div>
          <iframe title="email-preview" srcDoc={html} className="w-full h-[560px] bg-white" />
        </div>
      </div>

      <div className="border border-hairline">
        <SectionTitle>Send log ({log.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-xs uppercase text-ink-dim font-bold">
              <th className="text-left px-3 py-2 border-b border-hairline">Sent at</th>
              <th className="text-left px-3 py-2 border-b border-hairline">To</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Template</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Subject</th>
              <th className="text-right px-3 py-2 border-b border-hairline">Status</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} className="border-t border-hairline">
                <td className="px-3 py-2 text-ink-dim tabular-nums text-xs">
                  {(e.sentAt ?? e.createdAt).toString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2 text-xs">{e.toEmail}</td>
                <td className="px-3 py-2 uppercase text-xs font-bold">{e.templateId}</td>
                <td className="px-3 py-2 text-ink-dim truncate max-w-[300px] text-xs">{e.subject}</td>
                <td className="px-3 py-2 text-right uppercase text-xs font-bold text-signal">{e.status}</td>
              </tr>
            ))}
            {log.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink-dim text-sm">
                  No emails sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

function VarInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs uppercase font-bold text-ink-dim">
      {label}
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2.5 py-1.5 text-sm bg-transparent border border-hairline focus:outline-none focus:border-ink font-mono"
      />
    </label>
  );
}

/* ─────────────────────────── AutomationTab (DB-backed) ─────────────────────────── */

function AutomationTab() {
  const [rules, setRules] = useState<Array<{ id: string; templateId: string; trigger: string; enabled: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const refresh = React.useCallback(async () => {
    try {
      setRules((await listAutomationRules()) as any);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <TabLoader label="Loading automation triggers & event rules..." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-dim leading-relaxed">
        Automated emails fire when the matching Inngest event occurs. Toggling a rule off
        suppresses the automatic send (the Inngest function consults{" "}
        <span className="text-ink font-bold">isAutomationEnabled</span> before dispatching). Manual
        sends from the Compose tab always work regardless.
      </p>
      <div className="border border-hairline overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs uppercase text-ink-dim font-bold">
              <th className="text-left px-3 py-2 border-b border-hairline">Template</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Trigger</th>
              <th className="text-left px-3 py-2 border-b border-hairline">Description</th>
              <th className="text-right px-3 py-2 border-b border-hairline">Auto-send</th>
            </tr>
          </thead>
          <tbody>
            {TEMPLATES.map((t) => {
              const rule = rules.find((r) => r.templateId === t.id);
              const on = rule ? rule.enabled : true;
              return (
                <tr key={t.id} className="border-t border-hairline">
                  <td className="px-3 py-2.5 font-bold">{t.name}</td>
                  <td className="px-3 py-2.5 uppercase text-xs font-bold text-ink-dim">{t.trigger}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">{t.description}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => startTransition(async () => { await setAutomationEnabled(t.id, !on); await refresh(); })}
                      disabled={pending}
                      className={[
                        "text-xs uppercase font-bold px-3 py-1 border transition-colors disabled:opacity-40",
                        on ? "border-ink bg-ink text-surface" : "border-hairline text-ink-dim hover:text-ink",
                      ].join(" ")}
                    >
                      {on ? "ON" : "OFF"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────── RevenueTab ─────────────────────────── */

function RevenueTab() {
  const [data, setData] = useState<AdminRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAdminRevenueData();
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-hairline p-3.5 animate-pulse">
              <div className="h-3 w-20 bg-hairline mb-2" />
              <div className="h-7 w-16 bg-hairline" />
            </div>
          ))}
        </div>
        <div className="border border-hairline p-8 text-center text-ink-dim text-sm">
          Loading revenue data from database…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-signal/30 bg-signal/5 p-5 text-sm">
        <div className="font-bold text-signal uppercase text-xs mb-1">Error Loading Revenue</div>
        <div className="text-ink-dim">{error}</div>
        <button
          onClick={fetchData}
          className="mt-3 px-3 py-1.5 border border-hairline text-xs font-bold uppercase hover:bg-raised transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats, purchases, activeSlots, revenueConnections } = data;
  const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const statusColor = (s: string) => {
    switch (s.toUpperCase()) {
      case "PAID": return "text-verified";
      case "PENDING": return "text-amber-500";
      case "REFUNDED": return "text-ink-dim";
      case "FAILED": return "text-signal";
      default: return "text-ink-dim";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Summary Stats ── */}
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase font-bold text-ink-dim">Platform Revenue & Subscriptions</div>
        <button
          onClick={fetchData}
          className="px-2.5 py-1 border border-hairline text-[10px] font-bold uppercase hover:bg-raised transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Platform Revenue"
          value={fmtCents(stats.totalPlatformRevenueCents)}
          hint={`${purchases.filter((p) => p.status === "PAID").length} paid purchases`}
        />
        <Stat
          label="Active Placements"
          value={stats.activeSubscriptions}
          hint="featured + spotlight slots"
        />
        <Stat
          label="Pending Payments"
          value={stats.pendingPayments}
          hint="awaiting confirmation"
        />
        <Stat
          label="Verified MRR"
          value={stats.totalVerifiedMrrCents > 0 ? fmtCents(stats.totalVerifiedMrrCents) : "$0"}
          hint={`${stats.verifiedConnections} connections · ${stats.totalProviders} providers`}
        />
      </div>

      {/* ── Section 1: Purchase History ── */}
      <div>
        <div className="px-3 py-2 border border-hairline border-b-0 text-xs uppercase text-ink-dim font-bold bg-surface/30">
          Purchase History ({purchases.length})
        </div>
        <div className="border border-hairline overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-xs uppercase text-ink-dim font-bold">
                <th className="text-left px-3 py-2 border-b border-hairline">User</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Email</th>
                <th className="text-right px-3 py-2 border-b border-hairline">Amount</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Status</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Placement</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Date</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-surface/30 transition-colors">
                  <td className="px-3 py-2.5 font-bold">{p.userName}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim font-mono">{p.userEmail}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-bold">{fmtCents(p.amountCents)}</td>
                  <td className={`px-3 py-2.5 uppercase text-xs font-bold ${statusColor(p.status)}`}>{p.status}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">
                    {p.slots.length > 0
                      ? p.slots.map((s) => `${s.position}${s.productName ? ` · ${s.productName}` : ""}`).join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-dim text-sm">
                    No purchases recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: Active Placement Slots ── */}
      <div>
        <div className="px-3 py-2 border border-hairline border-b-0 text-xs uppercase text-ink-dim font-bold bg-surface/30">
          Active Placement Slots ({activeSlots.length})
        </div>
        <div className="border border-hairline overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-xs uppercase text-ink-dim font-bold">
                <th className="text-left px-3 py-2 border-b border-hairline">Product</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Owner</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Tier</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Position</th>
                <th className="text-right px-3 py-2 border-b border-hairline">Price</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Days Left</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Expires</th>
              </tr>
            </thead>
            <tbody>
              {activeSlots.map((s) => (
                <tr key={s.id} className="border-t border-hairline hover:bg-surface/30 transition-colors">
                  <td className="px-3 py-2.5 font-bold">
                    {s.productSlug ? (
                      <Link href={`/product/${s.productSlug}`} className="hover:text-signal transition-colors">
                        {s.productName || "—"}
                      </Link>
                    ) : (
                      s.productName || "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">{s.ownerName || "—"}</td>
                  <td className="px-3 py-2.5 text-xs font-bold uppercase">{s.tierName}</td>
                  <td className="px-3 py-2.5 text-xs uppercase text-ink-dim">{s.position}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-bold">{s.priceFormatted}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-bold ${s.daysRemaining <= 3 ? "text-signal" : s.daysRemaining <= 7 ? "text-amber-500" : "text-verified"}`}>
                      {s.daysRemaining >= 999 ? "∞" : `${s.daysRemaining}d`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">{s.endsAt ? fmtDate(s.endsAt) : "No expiry"}</td>
                </tr>
              ))}
              {activeSlots.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-dim text-sm">
                    No active placement slots.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: Maker Revenue Connections ── */}
      <div>
        <div className="px-3 py-2 border border-hairline border-b-0 text-xs uppercase text-ink-dim font-bold bg-surface/30">
          Maker Revenue Connections ({revenueConnections.length})
        </div>
        <div className="border border-hairline overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-xs uppercase text-ink-dim font-bold">
                <th className="text-left px-3 py-2 border-b border-hairline">Maker</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Product</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Provider</th>
                <th className="text-right px-3 py-2 border-b border-hairline">MRR</th>
                <th className="text-right px-3 py-2 border-b border-hairline">ARR</th>
                <th className="text-right px-3 py-2 border-b border-hairline">Total Revenue</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Verified</th>
                <th className="text-left px-3 py-2 border-b border-hairline">Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {revenueConnections.map((r) => (
                <tr key={r.id} className="border-t border-hairline hover:bg-surface/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-bold">{r.userName}</div>
                    <div className="text-[10px] text-ink-dim font-mono">{r.userEmail}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.productSlug ? (
                      <Link href={`/product/${r.productSlug}`} className="font-bold hover:text-signal transition-colors">
                        {r.productName || "—"}
                      </Link>
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-bold uppercase">{r.provider}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-bold">{fmtCents(r.mrrCents)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right text-ink-dim">{fmtCents(r.arrCents)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right text-ink-dim">{fmtCents(r.totalRevenueCents)}</td>
                  <td className="px-3 py-2.5">
                    {r.isVerified ? (
                      <span className="text-xs font-bold text-verified uppercase">✓ Verified</span>
                    ) : (
                      <span className="text-xs text-ink-dim uppercase">Unverified</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-dim">{r.syncedAt ? fmtDate(r.syncedAt) : "—"}</td>
                </tr>
              ))}
              {revenueConnections.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-ink-dim text-sm">
                    No maker revenue connections yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── SeedDataTab ─────────────────────────── */

function SeedDataTab() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshStatus = async () => {
    try {
      setLoading(true);
      const res = await getDatabaseStatus();
      setStatus(res);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load database status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleToggleSection = async (sectionId: string, delist: boolean) => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setResultMsg(null);
      const res = await toggleSectionDelist(sectionId, delist);
      if (res.success) {
        setResultMsg(res.message);
        await refreshStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update section delisting");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelistAllSections = async () => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setResultMsg(null);
      const res = await delistAllSections();
      if (res.success) {
        setResultMsg(res.message);
        await refreshStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delist all sections");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreAllSections = async () => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setResultMsg(null);
      const res = await restoreAllSections();
      if (res.success) {
        setResultMsg(res.message);
        await refreshStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to restore all sections");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnpublishFromFeeds = async () => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setResultMsg(null);
      const res = await unpublishAllProductsFromFeeds();
      if (res.success) {
        setResultMsg(res.message);
        await refreshStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delist products from feeds");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublishToFeeds = async () => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setResultMsg(null);
      const res = await publishAllArchivedProductsToFeeds();
      if (res.success) {
        setResultMsg(res.message);
        await refreshStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to restore products to feeds");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurge = async () => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setResultMsg(null);
      const res = await purgeAllSeedData();
      if (res.success) {
        setResultMsg(res.message);
        setConfirmPurge(false);
        await refreshStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to purge seed data");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center p-12">
        <LaunchFeedLoader size={36} label="Inspecting database state & records..." />
      </div>
    );
  }

  const liveCount = status?.liveProductsCount ?? 0;
  const archivedCount = status?.archivedProductsCount ?? 0;
  const totalCount = status?.productsCount ?? 0;
  const delistedSections = status?.delistedSections ?? [];

  return (
    <div className="space-y-6 font-mono text-ink">
      {/* Overview Status Cards */}
      <div className="border border-hairline p-4 sm:p-6 bg-surface/30 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-hairline pb-4">
          <div>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
              <span>Database State &amp; Section Visibility Controller</span>
            </h3>
            <p className="text-xs text-ink-dim mt-0.5 font-sans">
              Delist and isolate products section-by-section (Daily, Weekly, Monthly, Yearly, All-Time, Categories, Featured) with zero database loss.
            </p>
          </div>
          <button
            onClick={refreshStatus}
            disabled={loading || isProcessing}
            className="px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono text-ink transition-colors cursor-pointer disabled:opacity-50 font-bold flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            <span>{loading ? "Refreshing..." : "Refresh Counts"}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-ink-faint">Total In DB</div>
            <div className="text-xl font-bold font-display text-ink mt-1">
              {loading ? "..." : totalCount}
            </div>
          </div>
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-signal">Live on Feeds</div>
            <div className="text-xl font-bold font-display text-signal mt-1">
              {loading ? "..." : liveCount}
            </div>
          </div>
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-ink-faint">Delisted / Stored</div>
            <div className="text-xl font-bold font-display text-ink-dim mt-1">
              {loading ? "..." : archivedCount}
            </div>
          </div>
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-ink-faint">Submissions</div>
            <div className="text-xl font-bold font-display text-ink mt-1">
              {loading ? "..." : (status?.submissionsCount ?? 0)}
            </div>
          </div>
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-ink-faint">User Profiles</div>
            <div className="text-xl font-bold font-display text-ink mt-1">
              {loading ? "..." : (status?.usersCount ?? 0)}
            </div>
          </div>
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-ink-faint">Votes Cast</div>
            <div className="text-xl font-bold font-display text-ink mt-1">
              {loading ? "..." : (status?.votesCount ?? 0)}
            </div>
          </div>
          <div className="border border-hairline p-3 bg-surface">
            <div className="text-[10px] uppercase font-bold text-ink-faint">Categories</div>
            <div className="text-xl font-bold font-display text-ink mt-1">
              {loading ? "..." : (status?.categoriesCount ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {resultMsg && (
        <div className="border border-signal/40 bg-signal/10 p-4 text-xs font-mono text-signal flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase px-1.5 py-0.5 border border-signal/40 bg-void">OK</span>
            <span>{resultMsg}</span>
          </div>
          <button
            onClick={() => setResultMsg(null)}
            className="text-signal hover:underline cursor-pointer text-xs uppercase font-bold"
          >
            [ dismiss ]
          </button>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="border border-red-500/40 bg-red-500/10 p-4 text-xs font-mono text-red-400 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase px-1.5 py-0.5 border border-red-500/40 bg-void">ERROR</span>
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:underline cursor-pointer text-xs uppercase font-bold"
          >
            [ dismiss ]
          </button>
        </div>
      )}

      {/* SECTION-WISE DELISTING SUITE */}
      <div className="border border-hairline p-5 space-y-5 bg-void">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-hairline pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink uppercase tracking-wider">
                Section-Wise Delisting Controls
              </h4>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-hairline bg-surface text-ink-dim">
                DATABASE SAFE · ZERO LOSS
              </span>
            </div>
            <p className="text-xs text-ink-dim mt-1 font-sans">
              Choose exactly which leaderboard or feed sections to clean up for real users without affecting the underlying database data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelistAllSections}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              <span>Delist All 7 Sections</span>
            </button>
            <button
              onClick={handleRestoreAllSections}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-surface hover:bg-raised text-signal border border-signal/40 text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Restore All Sections</span>
            </button>
          </div>
        </div>

        {/* Section List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALL_SECTIONS.map((sec) => {
            const isDelisted = delistedSections.includes(sec.id) || delistedSections.includes("all");
            return (
              <div
                key={sec.id}
                className={`p-4 border transition-colors flex flex-col justify-between gap-3 ${
                  isDelisted
                    ? "border-red-500/30 bg-red-950/10"
                    : "border-hairline bg-surface/40 hover:bg-surface/70"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm text-ink flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isDelisted ? "bg-red-400" : "bg-signal"
                        }`}
                      />
                      <span>{sec.name}</span>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 border ${
                        isDelisted
                          ? "border-red-500/40 text-red-400 bg-red-500/10"
                          : "border-signal/40 text-signal bg-signal/10"
                      }`}
                    >
                      {isDelisted ? "DELISTED / HIDDEN" : "VISIBLE ON FEED"}
                    </span>
                  </div>
                  <p className="text-xs text-ink-dim mt-1.5 font-sans leading-relaxed">
                    {sec.desc}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-hairline pt-2.5">
                  <span className="text-[11px] text-ink-faint">
                    Target ID: <code className="text-ink">{sec.id}</code>
                  </span>

                  {isDelisted ? (
                    <button
                      onClick={() => handleToggleSection(sec.id, false)}
                      disabled={isProcessing}
                      className="px-3 py-1 bg-signal text-void text-xs font-bold font-mono hover:bg-signal/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Restore to {sec.name}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleSection(sec.id, true)}
                      disabled={isProcessing}
                      className="px-3 py-1 bg-surface hover:bg-raised text-red-400 border border-hairline hover:border-red-500/40 text-xs font-bold font-mono transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>Delist from {sec.name}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dual Operational Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operation 1: Database Status Switch (Archive / Unarchive Products) */}
        <div className="border border-hairline p-5 space-y-4 bg-void flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-hairline pb-2.5">
              <h4 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <span>Database Product Status Mode</span>
              </h4>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-hairline bg-surface text-ink-dim">
                DATABASE SAFE · ZERO LOSS
              </span>
            </div>
            <p className="text-xs text-ink-dim leading-relaxed font-sans">
              Switches product status between <code className="text-signal font-bold">LIVE</code> and <code className="text-ink font-bold">ARCHIVED</code> directly in the database.
            </p>
            <p className="text-[11px] text-ink-faint font-sans">
              All 360° architecture specs, founder stories, comments, and votes remain safely preserved in the database.
            </p>
          </div>

          <div className="pt-3 border-t border-hairline space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              {liveCount > 0 && (
                <button
                  onClick={handleUnpublishFromFeeds}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-surface hover:bg-raised text-ink border border-hairline font-mono text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  <span>Archive All Products in DB</span>
                </button>
              )}

              {archivedCount > 0 && (
                <button
                  onClick={handlePublishToFeeds}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-signal text-void font-mono text-xs font-bold hover:bg-signal/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Restore Products to LIVE</span>
                </button>
              )}
            </div>

            <div className="text-[10px] text-ink-dim font-mono">
              Status: <strong className="text-ink">{liveCount}</strong> live · <strong className="text-ink">{archivedCount}</strong> archived in DB
            </div>
          </div>
        </div>

        {/* Operation 2: Clean Slate Permanent Database Purge (Hard Wipe) */}
        <div className="border border-hairline p-5 space-y-4 bg-void flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-hairline pb-2.5">
              <h4 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <span>Permanent Database Purge</span>
              </h4>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-red-500/40 bg-red-500/10 text-red-400">
                HARD DATABASE WIPE
              </span>
            </div>
            <p className="text-xs text-ink-dim leading-relaxed font-sans">
              Permanently wipes seed and demo product records, mock votes, demo comments, and test founders from the PostgreSQL database.
            </p>
            <p className="text-[11px] text-ink-faint font-sans">
              <strong>Admin Safety Protection:</strong> Your admin credentials, app settings, categories, and genuine authenticated user accounts are automatically preserved.
            </p>
          </div>

          <div className="pt-3 border-t border-hairline space-y-3">
            {!confirmPurge ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <button
                  onClick={() => setConfirmPurge(true)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/40 font-mono text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Purge All Seed Data from Database</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-3.5 bg-red-950/20 border border-red-500/30">
                <div className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase">
                  <span>Confirm Complete Database Purge:</span>
                </div>
                <p className="text-xs text-ink-dim leading-relaxed font-sans">
                  This will permanently delete all {totalCount} product records and {status?.votesCount ?? 0} votes from the PostgreSQL database.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handlePurge}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>{isProcessing ? "Purging..." : "Yes, Wipe All Seed Data Now"}</span>
                  </button>
                  <button
                    onClick={() => setConfirmPurge(false)}
                    disabled={isProcessing}
                    className="px-4 py-2 border border-hairline bg-surface hover:bg-raised text-ink font-mono text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
