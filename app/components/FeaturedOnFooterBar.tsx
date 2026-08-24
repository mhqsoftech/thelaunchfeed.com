"use client";

import React, { useEffect, useState } from "react";
import { getDirectoryEmbeds, type DirectoryEmbedItem } from "@/app/actions/directoryEmbeds";

export default function FeaturedOnFooterBar({
  initialEmbeds,
}: {
  initialEmbeds?: DirectoryEmbedItem[];
}) {
  const [embeds, setEmbeds] = useState<DirectoryEmbedItem[]>(initialEmbeds || []);
  const [loaded, setLoaded] = useState(!!initialEmbeds);

  useEffect(() => {
    if (!initialEmbeds) {
      getDirectoryEmbeds()
        .then((items) => {
          setEmbeds(items);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [initialEmbeds]);

  if (!loaded || embeds.length === 0) {
    return null;
  }

  // We duplicate the list when multiple badges exist for seamless continuous marquee loop
  const shouldMarquee = embeds.length >= 2;
  const loopList = shouldMarquee ? [...embeds, ...embeds, ...embeds] : embeds;

  return (
    <div className="w-full border-b border-hairline py-4 space-y-2.5 font-mono overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-ink-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          <span>Featured On</span>
          <span className="text-[9px] px-1.5 py-0.2 border border-hairline bg-surface/60 text-ink-faint">
            {embeds.length} {embeds.length === 1 ? "Directory" : "Directories"}
          </span>
        </div>
      </div>

      {/* Marquee or Compact Flow Container */}
      <div
        className="relative w-full overflow-hidden marquee-container group py-1"
        title="Featured on online software directories"
      >
        {/* Left and Right Subtle Fade Gradients for clean edge blending */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-void to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-void to-transparent z-10" />

        <div
          className={`flex items-center gap-4 ${
            shouldMarquee ? "directory-marquee-track" : "flex-wrap justify-start"
          }`}
        >
          {loopList.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="shrink-0 flex items-center justify-center h-8 px-2.5 py-1 border border-hairline/80 bg-surface/30 hover:border-signal/50 hover:bg-surface transition-all rounded-xs select-none"
            >
              <div
                className="directory-badge-wrapper flex items-center justify-center max-h-7 overflow-hidden"
                dangerouslySetInnerHTML={{
                  __html: item.embedHtml.replace(
                    /<a /gi,
                    '<a target="_blank" rel="noopener noreferrer" '
                  ),
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
