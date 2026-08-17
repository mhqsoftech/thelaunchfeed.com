"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { logoutSession } from "@/app/data";

export default function SignOutPage() {
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" });
      } catch {}
      try {
        await authClient.signOut();
      } catch {
        // ignore — clearing the local cache below is still meaningful
      }
      logoutSession();
      window.location.href = "/";
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-xs font-mono text-ink-dim">
      Signing out…
    </div>
  );
}
