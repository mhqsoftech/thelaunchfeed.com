import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DOTO_FONT_BASE64 } from "@/lib/badgeFont";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/badge/[slug]
 * Dynamic vector SVG badge generator for makers to embed on their site, GitHub README, or docs.
 * Features:
 * - Bespoke brand geometry tailored to The Launch Feed's 4-Square Stepped Telemetry philosophy
 * - Custom geometric vector emblems for every award tier (Daily, Weekly, Monthly, Yearly, All-Time #1-#3)
 * - Inlined robotic brand typography (Doto 900) matching The Launch Feed brand
 * - 4 distinct themes (dark, light, signal, minimal)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const theme = (searchParams.get("theme") || "dark").toLowerCase();
  const award = (searchParams.get("award") || "launch").toLowerCase();

  // Look up live product data for real upvotes, name, and revenue
  let product: { name: string; voteCount: number; category: { name: string } | null; details: any } | null = null;
  try {
    product = await prisma.product.findUnique({
      where: { slug },
      select: {
        name: true,
        voteCount: true,
        category: { select: { name: true } },
        details: true,
      },
    });
  } catch {}

  const votes = product?.voteCount || 1;
  const revenue = product?.details?.revenue ? String(product.details.revenue) : null;

  // Configuration for Award Text, Subtitle, Stat Pill, and Custom Vector Icon
  let mainText = "LAUNCHED ON";
  let subText = "THE LAUNCH FEED";
  let statText: string | null = null;
  let customIconType = "matrix"; // default 4-square

  // 1. Daily Awards
  if (award === "pod" || award === "daily_1") {
    mainText = "#1 PRODUCT OF DAY";
    subText = "THE LAUNCH FEED";
    statText = `🥇 #1 DAILY`;
    customIconType = "daily_1";
  } else if (award === "daily_2") {
    mainText = "#2 PRODUCT OF DAY";
    subText = "THE LAUNCH FEED";
    statText = `🥈 #2 DAILY`;
    customIconType = "daily_2";
  } else if (award === "daily_3") {
    mainText = "#3 PRODUCT OF DAY";
    subText = "THE LAUNCH FEED";
    statText = `🥉 #3 DAILY`;
    customIconType = "daily_3";
  }
  // 2. Weekly Awards
  else if (award === "weekly_1") {
    mainText = "#1 PRODUCT OF WEEK";
    subText = "THE LAUNCH FEED";
    statText = `⚡ #1 WEEKLY`;
    customIconType = "weekly_1";
  } else if (award === "weekly_2") {
    mainText = "#2 PRODUCT OF WEEK";
    subText = "THE LAUNCH FEED";
    statText = `⚡ #2 WEEKLY`;
    customIconType = "weekly_2";
  } else if (award === "weekly_3") {
    mainText = "#3 PRODUCT OF WEEK";
    subText = "THE LAUNCH FEED";
    statText = `⚡ #3 WEEKLY`;
    customIconType = "weekly_3";
  }
  // 3. Monthly Awards
  else if (award === "monthly_1") {
    mainText = "#1 PRODUCT OF MONTH";
    subText = "THE LAUNCH FEED";
    statText = `★ #1 MONTHLY`;
    customIconType = "monthly_1";
  } else if (award === "monthly_2") {
    mainText = "#2 PRODUCT OF MONTH";
    subText = "THE LAUNCH FEED";
    statText = `★ #2 MONTHLY`;
    customIconType = "monthly_2";
  } else if (award === "monthly_3") {
    mainText = "#3 PRODUCT OF MONTH";
    subText = "THE LAUNCH FEED";
    statText = `★ #3 MONTHLY`;
    customIconType = "monthly_3";
  }
  // 4. Yearly Awards
  else if (award === "champion" || award === "yearly_1") {
    mainText = "2026 CHAMPION";
    subText = "THE LAUNCH FEED";
    statText = `👑 #1 YEARLY`;
    customIconType = "yearly_1";
  } else if (award === "yearly_2") {
    mainText = "2026 FINALIST #2";
    subText = "THE LAUNCH FEED";
    statText = `👑 #2 YEARLY`;
    customIconType = "yearly_2";
  } else if (award === "yearly_3") {
    mainText = "2026 FINALIST #3";
    subText = "THE LAUNCH FEED";
    statText = `👑 #3 YEARLY`;
    customIconType = "yearly_3";
  }
  // 5. All-Time Awards
  else if (award === "alltime_1") {
    mainText = "ALL-TIME #1 GOAT";
    subText = "THE LAUNCH FEED";
    statText = `🏆 GOAT #1`;
    customIconType = "alltime_1";
  } else if (award === "alltime_2") {
    mainText = "ALL-TIME #2";
    subText = "THE LAUNCH FEED";
    statText = `🛡️ #2 HALL OF FAME`;
    customIconType = "alltime_2";
  } else if (award === "alltime_3") {
    mainText = "ALL-TIME #3";
    subText = "THE LAUNCH FEED";
    statText = `🌿 #3 HALL OF FAME`;
    customIconType = "alltime_3";
  }
  // 6. Upvote & Revenue Badges
  else if (award === "revenue" && revenue) {
    mainText = "MRR TELEMETRY";
    subText = revenue;
    statText = `✓ VERIFIED`;
    customIconType = "revenue";
  } else if (award === "upvote") {
    mainText = `${votes.toLocaleString()} UPVOTES`;
    subText = "THE LAUNCH FEED";
    statText = `▲ TOP VOTED`;
    customIconType = "upvote";
  }

  // Color Palette Definitions matching official brand styles
  let bg = "#090A0C";
  let border = "#27272a";
  let leftBg = "#111318";
  let leftBorder = "#27272a";
  let textPrimary = "#ffffff";
  let accent = "#00D97E";
  let logoFill = "#00D97E";
  let statBg = "#18181b";
  let statBorder = "#00D97E";
  let statTextCol = "#00D97E";

  if (theme === "light") {
    bg = "#ffffff";
    border = "#e4e4e7";
    leftBg = "#f4f4f5";
    leftBorder = "#e4e4e7";
    textPrimary = "#09090b";
    accent = "#71717a";
    logoFill = "#09090b";
    statBg = "#f4f4f5";
    statBorder = "#09090b";
    statTextCol = "#09090b";
  } else if (theme === "signal") {
    bg = "#090A0C";
    border = "#00D97E";
    leftBg = "#042013";
    leftBorder = "rgba(0, 217, 126, 0.4)";
    textPrimary = "#ffffff";
    accent = "#00D97E";
    logoFill = "#00D97E";
    statBg = "#00D97E";
    statBorder = "#00D97E";
    statTextCol = "#000000";
  } else if (theme === "minimal") {
    bg = "#090A0C";
    border = "#27272a";
    leftBg = "#090A0C";
    leftBorder = "#27272a";
    textPrimary = "#ffffff";
    accent = "#71717a";
    logoFill = "#ffffff";
    statBg = "transparent";
    statBorder = "#3f3f46";
    statTextCol = "#a1a1aa";
  }

  // Dimensioning: snug fit without dead space
  const hasPill = Boolean(statText);
  const badgeWidth = hasPill ? 284 : 220;
  const badgeHeight = 48;
  const leftCellWidth = 48;

  // Generate Custom Bespoke Vector SVG Icon for Left Cell (22x22 viewBox)
  let customIconSvg = "";
  if (customIconType === "daily_1") {
    // Apex Solar Matrix — Sunburst Telemetry Core with Stepped 4-Quadrant
    customIconSvg = `
      <g transform="translate(13, 13)">
        <circle cx="11" cy="11" r="4.5" fill="${logoFill}" fill-opacity="0.3" />
        <circle cx="11" cy="11" r="2.5" fill="${logoFill}" />
        <path d="M11 1v3M11 18v3M1 11h3M18 11h3M3.9 3.9l2.1 2.1M16 16l2.1 2.1M3.9 18.1l2.1-2.1M16 6l2.1-2.1" stroke="${logoFill}" stroke-width="1.5" stroke-linecap="round" />
      </g>
    `;
  } else if (customIconType === "daily_2") {
    // Radiant Silver Matrix — Dual-Chevron Spark Matrix
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M11 2v18M2 11h18" stroke="${logoFill}" stroke-width="1.2" stroke-dasharray="2 2" />
        <polygon points="11,5 15,11 11,17 7,11" fill="${logoFill}" fill-opacity="0.25" stroke="${logoFill}" stroke-width="1.2" />
        <circle cx="11" cy="11" r="2" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "daily_3") {
    // Bronze Angular Leaf Matrix
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M11 3v16M7 7l4 4 4-4M7 12l4 4 4-4" stroke="${logoFill}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  } else if (customIconType === "weekly_1") {
    // Kinetic Lightning Prism
    customIconSvg = `
      <g transform="translate(13, 13)">
        <polygon points="12,1 3,13 10,13 8,21 18,9 11,9" fill="${logoFill}" fill-opacity="0.25" stroke="${logoFill}" stroke-width="1.5" stroke-linejoin="miter" />
      </g>
    `;
  } else if (customIconType === "weekly_2") {
    // Dual-Vector Waveform
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M5 6l6 6 6-6M5 12l6 6 6-6" stroke="${logoFill}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </g>
    `;
  } else if (customIconType === "weekly_3") {
    // Orbital Pulse Matrix
    customIconSvg = `
      <g transform="translate(13, 13)">
        <circle cx="11" cy="11" r="8" stroke="${logoFill}" stroke-width="1.25" fill="none" stroke-dasharray="3 2" />
        <circle cx="11" cy="11" r="3.5" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "monthly_1") {
    // 8-Point Monolith Star Crest
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M11 1l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" fill="${logoFill}" fill-opacity="0.25" stroke="${logoFill}" stroke-width="1.25" stroke-linejoin="round" />
        <circle cx="11" cy="11" r="2.5" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "monthly_2") {
    // Ascending Twin-Ribbon Matrix
    customIconSvg = `
      <g transform="translate(13, 13)">
        <circle cx="11" cy="8" r="5.5" stroke="${logoFill}" stroke-width="1.25" fill="${logoFill}" fill-opacity="0.2" />
        <path d="M7 13l-2 7 6-3 6 3-2-7" stroke="${logoFill}" stroke-width="1.25" fill="none" stroke-linejoin="round" />
      </g>
    `;
  } else if (customIconType === "monthly_3") {
    // Hexagonal Telemetry Shield
    customIconSvg = `
      <g transform="translate(13, 13)">
        <polygon points="11,2 18,6 18,16 11,20 4,16 4,6" stroke="${logoFill}" stroke-width="1.25" fill="${logoFill}" fill-opacity="0.2" />
        <circle cx="11" cy="11" r="2.5" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "yearly_1") {
    // 2026 Sovereign Crown Matrix
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M2 16l2-11 4.5 5 2.5-7 2.5 7 4.5-5 2 11H2z" fill="${logoFill}" fill-opacity="0.2" stroke="${logoFill}" stroke-width="1.25" stroke-linejoin="round" />
        <circle cx="11" cy="4" r="1.5" fill="${logoFill}" />
        <circle cx="4" cy="5" r="1.2" fill="${logoFill}" />
        <circle cx="18" cy="5" r="1.2" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "yearly_2") {
    // Dual-Diamond Silver Crest
    customIconSvg = `
      <g transform="translate(13, 13)">
        <polygon points="11,2 19,11 11,20 3,11" fill="${logoFill}" fill-opacity="0.15" stroke="${logoFill}" stroke-width="1.25" />
        <polygon points="11,6 15,11 11,16 7,11" stroke="${logoFill}" stroke-width="1.2" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "yearly_3") {
    // Bronze Medalion Core
    customIconSvg = `
      <g transform="translate(13, 13)">
        <circle cx="11" cy="12" r="6.5" stroke="${logoFill}" stroke-width="1.25" fill="${logoFill}" fill-opacity="0.15" />
        <path d="M8 2h6l2 5H6l2-5z" stroke="${logoFill}" stroke-width="1" fill="${logoFill}" fill-opacity="0.4" />
        <circle cx="11" cy="12" r="2" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "alltime_1") {
    // Hall of Fame GOAT Trophy
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M5 2h12v4c0 3.3-2.7 6-6 6s-6-2.7-6-6V2z" fill="${logoFill}" fill-opacity="0.2" stroke="${logoFill}" stroke-width="1.25" />
        <path d="M5 2H2v4c0 1.7 1.3 3 3 3M17 2h3v4c0 1.7-1.3 3-3 3" stroke="${logoFill}" stroke-width="1.2" fill="none" />
        <path d="M11 12v4M7 20h8M9 16h4" stroke="${logoFill}" stroke-width="1.25" />
        <polygon points="11,4 12,6.5 14.5,6.5 12.5,8 13.5,10.5 11,9 8.5,10.5 9.5,8 7.5,6.5 10,6.5" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "alltime_2") {
    // GrandMaster Aegis Shield
    customIconSvg = `
      <g transform="translate(13, 13)">
        <polygon points="11,1 19,5 19,13 11,21 3,13 3,5" fill="${logoFill}" fill-opacity="0.15" stroke="${logoFill}" stroke-width="1.25" stroke-linejoin="round" />
        <path d="M11 5l-3 4h6l-3 4" stroke="${logoFill}" stroke-width="1.25" fill="none" />
        <circle cx="6" cy="8" r="1" fill="${logoFill}" />
        <circle cx="16" cy="8" r="1" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "alltime_3") {
    // Eternal Stellar Laurel
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M11 2a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9z" stroke="${logoFill}" stroke-width="1.2" stroke-dasharray="3 2" fill="none" />
        <polygon points="11,6 12.5,9.5 16,9.5 13,12 14.5,15.5 11,13 7.5,15.5 9,12 6,9.5 9.5,9.5" fill="${logoFill}" />
      </g>
    `;
  } else if (customIconType === "upvote") {
    // Community Upvote Chevron
    customIconSvg = `
      <g transform="translate(13, 13)">
        <path d="M4 14l7-7 7 7" stroke="${logoFill}" stroke-width="2" stroke-linecap="square" fill="none" />
        <circle cx="11" cy="17" r="1.5" fill="${logoFill}" />
      </g>
    `;
  } else {
    // Official TLF 4-Square Stepped Telemetry Matrix (100%, 85%, 65%, 35%)
    customIconSvg = `
      <g transform="translate(13, 13)">
        <rect x="0" y="0" width="9.5" height="9.5" rx="1.5" fill="${logoFill}" />
        <rect x="12.5" y="0" width="9.5" height="9.5" rx="1.5" fill="${logoFill}" opacity="0.85" />
        <rect x="0" y="12.5" width="9.5" height="9.5" rx="1.5" fill="${logoFill}" opacity="0.65" />
        <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="1.5" fill="${logoFill}" opacity="0.35" />
      </g>
    `;
  }

  const pillWidth = statText && statText.length > 12 ? 88 : 74;
  const pillTranslateX = badgeWidth - pillWidth - 10;

  const rightPill = hasPill
    ? `<g transform="translate(${pillTranslateX}, 13)">
    <rect x="0" y="0" width="${pillWidth}" height="22" rx="3" fill="${statBg}" stroke="${statBorder}" stroke-width="1" />
    <text x="${pillWidth / 2}" y="14.5" class="stat-pill" fill="${statTextCol}" text-anchor="middle">${statText}</text>
  </g>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" fill="none">
  <defs>
    <style>
      @font-face {
        font-family: 'Doto';
        font-style: normal;
        font-weight: 900;
        src: url('data:font/woff;base64,${DOTO_FONT_BASE64}') format('woff');
      }
      .mono-label {
        font-family: ui-monospace, 'JetBrains Mono', Menlo, Monaco, Consolas, monospace;
        font-size: 7.5px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }
      .brand-robot-title {
        font-family: 'Doto', ui-monospace, 'JetBrains Mono', monospace;
        font-size: 11.5px;
        font-weight: 900;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .stat-pill {
        font-family: ui-monospace, 'JetBrains Mono', monospace;
        font-size: 7.5px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
    </style>
  </defs>

  <!-- Outer Container Card -->
  <rect x="0.5" y="0.5" width="${badgeWidth - 1}" height="${badgeHeight - 1}" rx="4" fill="${bg}" stroke="${border}" />

  <!-- Left Logo & Branding Cell -->
  <path d="M1 4.5C1 2.567 2.567 1 4.5 1H${leftCellWidth}V${badgeHeight - 1}H4.5C2.567 ${badgeHeight - 1} 1 ${badgeHeight - 2.567} 1 ${badgeHeight - 4.5}V4.5Z" fill="${leftBg}" />
  <line x1="${leftCellWidth}" y1="1" x2="${leftCellWidth}" y2="${badgeHeight - 1}" stroke="${leftBorder}" />

  <!-- Bespoke Vector Icon / Emblem -->
  ${customIconSvg}

  <!-- Middle Content & Robotic Brand Title -->
  <g transform="translate(58, 0)">
    <text x="0" y="18" class="mono-label" fill="${accent}">${mainText}</text>
    <text x="0" y="34" class="brand-robot-title" fill="${textPrimary}">${subText}</text>
  </g>

  <!-- Right Pill Badge -->
  ${rightPill}
</svg>`;

  const isDownload =
    searchParams.get("download") === "true" ||
    searchParams.get("download") === "1" ||
    searchParams.get("dl") === "1";
  const filename = `${slug || "launchfeed"}-${award}-${theme}-badge.svg`;

  const responseHeaders: Record<string, string> = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Access-Control-Allow-Origin": "*",
  };

  if (isDownload) {
    responseHeaders["Content-Disposition"] = `attachment; filename="${filename}"`;
  }

  return new NextResponse(svg, {
    headers: responseHeaders,
  });
}

