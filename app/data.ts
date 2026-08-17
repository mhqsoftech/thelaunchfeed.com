/**
 * Client-side utilities only.
 *
 * All mock/demo arrays and demo-user session data have been removed —
 * the site now reads everything from Postgres via lib/queries/* on the
 * server. This module survives to expose:
 *  - `slugify` / `getProductGradientClass` — pure UI helpers
 *  - `applyTheme` / `getActiveTheme` / `ThemeMode` — theme cycling
 *  - `UserSession` / `getStoredSession` / `saveSession` / `logoutSession`
 *     — the localStorage shape the SessionBridge writes from /api/me
 *
 * If you're adding a new consumer of user/product/category data, query
 * Prisma directly via a server component or a server action — do NOT
 * bring back seed constants here.
 */

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getProductGradientClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % 12;
  return `product-gradient-${index}`;
}

export function formatProductWebsiteUrl(rawUrl?: string | null, ref = "thelaunchfeed"): string {
  if (!rawUrl) return "";
  let url = rawUrl.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("ref")) {
      parsed.searchParams.set("ref", ref);
    }
    return parsed.toString();
  } catch {
    if (url.includes("?")) {
      return `${url}&ref=${ref}`;
    }
    return `${url}?ref=${ref}`;
  }
}

/* ─────────────────────────── Theme ─────────────────────────── */

export type ThemeMode = "light" | "void" | "thermal";

export function getActiveTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const docTheme = document.documentElement.getAttribute("data-theme") as ThemeMode | null;
  if (docTheme === "light" || docTheme === "void" || docTheme === "thermal") return docTheme;
  const localTheme = localStorage.getItem("tlf-theme") as ThemeMode | null;
  if (localTheme === "light" || localTheme === "void" || localTheme === "thermal") return localTheme;
  return "light";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  // Briefly opt in to color transitions so the toggle itself feels smooth,
  // but no transitions on ordinary page loads (avoids the refresh-flash).
  const root = document.documentElement;
  root.setAttribute("data-theme-transitioning", "");
  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("tlf-theme", theme);
  } catch {}
  window.setTimeout(() => root.removeAttribute("data-theme-transitioning"), 260);
  window.dispatchEvent(new CustomEvent("themeChanged", { detail: theme }));
}

/* ─────────────────────────── Session (client-side cache) ─────────────────────────── */

/**
 * Shape mirrored from the server by SessionBridge fetching /api/me.
 * This is a read-through cache — the DB is authoritative. Client
 * components read this to decide who the current user is without
 * awaiting a network request on every render.
 */
export interface UserSession {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: "founder" | "voter" | "admin";
  avatar: string;
  image?: string | null;
  title: string;
  bio: string;
  revenue: string;
  website: string;
  twitter: string;
  github: string;
  apiKey: string;
  savedProductIds: string[];
  upvotedProductIds: string[];
  subscriptions: unknown[];
}

export function getStoredSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("tlf-user-session");
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("tlf-user-session", JSON.stringify(session));
  } catch {}
  window.dispatchEvent(new CustomEvent("authChanged", { detail: session }));
}

export function logoutSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("tlf-user-session");
    sessionStorage.removeItem("tlf-user-session");
    sessionStorage.removeItem("tlf-my-products");
    sessionStorage.removeItem("tlf-saved-products");
    sessionStorage.removeItem("tlf-upvoted-products");
  } catch {}
  try {
    fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" }).catch(() => {});
  } catch {}
  window.dispatchEvent(new CustomEvent("authChanged", { detail: null }));
}
