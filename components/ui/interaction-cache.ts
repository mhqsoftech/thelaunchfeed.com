"use client";

/**
 * Session cache is a read-through mirror of /api/me. It exists so the UI
 * can render vote/save state instantly without waiting on a round-trip;
 * the source of truth is Postgres via toggleVote / toggleBookmark.
 */
export function readSessionFromCache(): { savedProductIds?: string[]; upvotedProductIds?: string[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("tlf-user-session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSessionToCache(s: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("tlf-user-session", JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("authChanged", { detail: s }));
  } catch {
    /* ignore */
  }
}

export function isProductSaved(id: string): boolean {
  return readSessionFromCache()?.savedProductIds?.includes(id) ?? false;
}

export function isProductUpvoted(id: string): boolean {
  return readSessionFromCache()?.upvotedProductIds?.includes(id) ?? false;
}

/** Optimistically flip the cache; server call reconciles below. */
export function optimisticToggle(id: string, key: "savedProductIds" | "upvotedProductIds"): boolean {
  const s = readSessionFromCache();
  if (!s) return false;
  const list = (s[key] as string[] | undefined) ?? [];
  const has = list.includes(id);
  const next = has ? list.filter((x) => x !== id) : [...list, id];
  writeSessionToCache({ ...s, [key]: next });
  return !has;
}
