"use client";

import { useEffect } from "react";
import { saveSession, logoutSession, UserSession } from "@/app/data";

/**
 * Fetches /api/me on mount and mirrors the result into the legacy
 * localStorage `tlf-user-session` key. This lets every existing
 * `getStoredSession()` consumer (MainLayoutShell, product page, profile,
 * admin client view, comments) keep working while auth is real.
 *
 * Poll on window focus so a sign-out in another tab (via Stack's handler)
 * propagates without needing a full refresh.
 */
export default function SessionBridge() {
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          // Temporary server error or connection drop — preserve local session!
          return;
        }
        const data = (await res.json()) as { session: UserSession | null; unauthenticated?: boolean };
        if (cancelled) return;
        if (data.session) {
          saveSession(data.session);
        } else if (data.unauthenticated) {
          // Server explicitly verified that no session cookies exist
          logoutSession();
        }
      } catch {
        // network hiccup — leave whatever's already in localStorage
      }
    };

    sync();
    window.addEventListener("focus", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", sync);
    };
  }, []);

  return null;
}
