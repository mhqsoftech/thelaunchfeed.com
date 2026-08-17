import React from "react";

export function LaunchFeedLoader({
  size = 28,
  showGhost = true,
  label,
  className = "",
}: {
  size?: number;
  showGhost?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center lf-assemble-glow">
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ shapeRendering: "crispEdges" }}
          className="shrink-0 overflow-visible"
        >
          {/* Subtle Ghost Alignment Grid */}
          {showGhost && (
            <g className="text-ink/10" fill="currentColor">
              <rect x="0.5" y="0.5" width="6.5" height="6.5" opacity="0.08" />
              <rect x="9" y="0.5" width="6.5" height="6.5" opacity="0.08" />
              <rect x="0.5" y="9" width="6.5" height="6.5" opacity="0.08" />
              <rect x="9" y="9" width="6.5" height="6.5" opacity="0.08" />
            </g>
          )}

          {/* Square 1: Top Left (Assembles 1st) */}
          <rect
            className="lf-assemble-sq1"
            x="0.5"
            y="0.5"
            width="6.5"
            height="6.5"
            fill="var(--signal, #ff4f00)"
          />

          {/* Square 2: Top Right (Assembles 2nd) */}
          <rect
            className="lf-assemble-sq2"
            x="9"
            y="0.5"
            width="6.5"
            height="6.5"
            fill="var(--signal, #ff4f00)"
            opacity="0.85"
          />

          {/* Square 3: Bottom Left (Assembles 3rd) */}
          <rect
            className="lf-assemble-sq3"
            x="0.5"
            y="9"
            width="6.5"
            height="6.5"
            fill="var(--signal, #ff4f00)"
            opacity="0.65"
          />

          {/* Square 4: Bottom Right (Assembles 4th) */}
          <rect
            className="lf-assemble-sq4"
            x="9"
            y="9"
            width="6.5"
            height="6.5"
            fill="var(--signal, #ff4f00)"
            opacity="0.35"
          />
        </svg>
      </div>

      {label && (
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-dim animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}

export default LaunchFeedLoader;
