"use client";

import { useState, useEffect } from "react";
import { getStoredSession } from "@/app/data";
import { toggleBookmark } from "@/app/actions/interactions";

import {
  readSessionFromCache,
  writeSessionToCache,
  isProductSaved,
  optimisticToggle,
} from "@/components/ui/interaction-cache";

function PixelatedBookmarkIcon({
  active = false,
  className = "w-3 h-3",
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 2H13V14L8 10.5L3 14V2Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function BookmarkButton({ productId }: { productId: string }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    setIsLoggedIn(Boolean(session));
    setSaved(isProductSaved(productId));

    const handleAuthChange = () => {
      const s = getStoredSession();
      setIsLoggedIn(Boolean(s));
      setSaved(isProductSaved(productId));
    };
    window.addEventListener("authChanged", handleAuthChange);
    return () => window.removeEventListener("authChanged", handleAuthChange);
  }, [productId]);

  if (!isLoggedIn) return null;

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const optimistic = optimisticToggle(productId, "savedProductIds");
    setSaved(optimistic);
    try {
      const res = await toggleBookmark(productId);
      if (res.saved !== optimistic) {
        const s = readSessionFromCache() || {};
        const list = (s.savedProductIds ?? []).filter((x: string) => x !== productId);
        if (res.saved) list.push(productId);
        writeSessionToCache({ ...s, savedProductIds: list });
        setSaved(res.saved);
      }
    } catch (err) {
      optimisticToggle(productId, "savedProductIds");
      setSaved(!optimistic);
      console.error("[bookmark] failed:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBookmark}
      title={saved ? "Remove Bookmark" : "Save Product"}
      className={`px-1.5 py-0.5 border text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
        saved
          ? "border-signal bg-void text-signal font-bold"
          : "border-hairline bg-void text-ink-faint hover:text-ink hover:border-ink-dim"
      }`}
    >
      <PixelatedBookmarkIcon active={saved} className={`w-3 h-3 ${saved ? "text-signal" : "text-ink-faint"}`} />
      <span className="uppercase font-bold tracking-tight">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
