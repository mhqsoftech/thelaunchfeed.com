import React from "react";

export function LaunchFeedLogo({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ shapeRendering: "crispEdges" }}
      className={`inline-block shrink-0 ${className}`}
    >
      <rect x="0.5" y="0.5" width="6.5" height="6.5" fill="var(--signal, #ff4f00)" />
      <rect x="9" y="0.5" width="6.5" height="6.5" fill="var(--signal, #ff4f00)" opacity="0.85" />
      <rect x="0.5" y="9" width="6.5" height="6.5" fill="var(--signal, #ff4f00)" opacity="0.65" />
      <rect x="9" y="9" width="6.5" height="6.5" fill="var(--signal, #ff4f00)" opacity="0.35" />
    </svg>
  );
}

export function LaunchFeedBrandLogo({
  height = 24,
  className = "",
  alt = "The Launch Feed",
}: {
  height?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span className={`inline-flex items-center shrink-0 leading-none ${className}`}>
      {/* Dark Theme Logo (Void / Thermal / Default) */}
      <img width="64" height="64"
        src="/thelaunchfeed-logo.png"
        alt={alt}
        style={{ height: `${height}px`, width: "auto" }}
        className="tlf-brand-logo-dark object-contain select-none pointer-events-none"
      />
      {/* Light Theme Logo */}
      <img width="64" height="64"
        src="/thelaunchfeed-logo-light.png"
        alt={alt}
        style={{ height: `${height}px`, width: "auto" }}
        className="tlf-brand-logo-light object-contain select-none pointer-events-none"
      />
    </span>
  );
}
