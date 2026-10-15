"use client";

import React from "react";

/**
 * Link to a maker's website that is counted by /go/<slug>.
 *
 * `href` stays the real destination, so crawlers, "copy link" and no-JS
 * visitors see (and pass equity to) the maker's site exactly as before —
 * free launches keep their dofollow backlink. The moment a person activates
 * the link (mouse, middle-click, touch or keyboard) it is swapped for the
 * tracked `goHref`, which records the visit and 302s to the same place.
 */
export function OutboundLink({
  href,
  goHref,
  rel,
  className,
  title,
  tabIndex,
  children,
}: {
  href: string;
  goHref: string;
  rel: string;
  className?: string;
  title?: string;
  tabIndex?: number;
  children: React.ReactNode;
}) {
  const arm = (e: React.SyntheticEvent<HTMLAnchorElement>) => {
    e.currentTarget.href = goHref;
  };
  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className={className}
      title={title}
      tabIndex={tabIndex}
      onPointerDown={arm}
      onKeyDown={(e) => {
        if (e.key === "Enter") arm(e);
      }}
      onClick={arm}
      onAuxClick={arm}
    >
      {children}
    </a>
  );
}
