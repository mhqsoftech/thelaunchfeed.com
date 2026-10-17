/**
 * Shared 1200×630 social card for every `opengraph-image` route.
 *
 * Social crawlers (X, Facebook, LinkedIn, Slack, WhatsApp) only render
 * PNG / JPEG / GIF reliably, and the image renderer behind `next/og` can't
 * decode AVIF or WebP — which is what maker logos and avatars are stored
 * as. So every remote image is fetched and re-encoded to a PNG data URI
 * with sharp before it goes into the card.
 */

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { safeFetch } from "@/lib/ssrf";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
const SITE_HOSTS = new Set(["thelaunchfeed.com", "www.thelaunchfeed.com", new URL(SITE_URL).host]);

const C = {
  bg: "#FAFAF8",
  card: "#FFFFFF",
  hairline: "#E5E3DE",
  ink: "#111111",
  dim: "#57564F",
  faint: "#8D8B84",
  signal: "#D14000",
  signalBright: "#FF4F00",
  signalDim: "#FFEFE6",
};

export type OgStat = { label: string; value: string | number };

export type OgCardInput = {
  /** Small uppercase label top-right, e.g. "Product launch". */
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  /** Logo / avatar URL (any format) or a site path like "/logo.png". */
  image?: string | null;
  imageShape?: "rounded" | "circle";
  /** Shown instead of the image when it is missing or unreadable. */
  fallbackInitials?: string;
  stats?: OgStat[];
  /** Short line in the footer, e.g. "by Alex Rivera". */
  footnote?: string | null;
};

const clip = (s: string | null | undefined, max: number) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Fetch an image (site path or remote URL) and return it as a PNG data URI. */
export async function toPngDataUri(src: string | null | undefined, px = 256): Promise<string | null> {
  if (!src || src.startsWith("data:") && !/^data:image\//.test(src)) return null;
  try {
    let buf: Buffer;
    if (src.startsWith("data:image/")) {
      buf = Buffer.from(src.split(",")[1] || "", "base64");
    } else {
      const url = new URL(src, SITE_URL);
      if (SITE_HOSTS.has(url.host) || url.host.startsWith("localhost")) {
        // Our own static asset: read it from /public, or fetch it from the
        // site when /public isn't bundled with the function.
        const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        if (rel.includes("..")) return null;
        try {
          buf = await readFile(path.join(process.cwd(), "public", rel));
        } catch {
          const res = await fetch(`${SITE_URL}/${rel}`, { signal: AbortSignal.timeout(4000) });
          if (!res.ok) return null;
          buf = Buffer.from(await res.arrayBuffer());
        }
      } else {
        const res = await safeFetch(url.toString(), { timeoutMs: 4000, headers: { Accept: "image/*" } });
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 8 * 1024 * 1024) return null;
        buf = Buffer.from(ab);
      }
    }
    const sharp = (await import("sharp")).default;
    const png = await sharp(buf, { failOn: "none" }).resize(px, px, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// Geist (the site font, SIL OFL — see ./fonts/OFL.txt). Loaded via
// import.meta.url so Next traces the files into the serverless bundle.
let fontsPromise: Promise<Array<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }>> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(new URL("./fonts/Geist-Regular.ttf", import.meta.url)),
    readFile(new URL("./fonts/Geist-Bold.ttf", import.meta.url)),
  ])
    .then(([regular, bold]) => [
      { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
    ])
    .catch(() => []);
  return fontsPromise;
}

/** The brand mark: a 2×2 matrix of signal orange at 100 / 85 / 65 / 35 % (BRAND_IDENTITY.md). */
function Mark({ size = 36 }: { size?: number }) {
  const s = Math.round(size * 0.44);
  const g = size - s * 2;
  const sq = (opacity: number) => <div style={{ width: s, height: s, background: C.signalBright, opacity, borderRadius: 3 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: g, width: size, height: size }}>
      <div style={{ display: "flex", gap: g }}>
        {sq(1)}
        {sq(0.85)}
      </div>
      <div style={{ display: "flex", gap: g }}>
        {sq(0.65)}
        {sq(0.35)}
      </div>
    </div>
  );
}

export async function ogCard(input: OgCardInput): Promise<ImageResponse> {
  const title = clip(input.title, 70);
  const subtitle = clip(input.subtitle, 140);
  const [img, fonts] = await Promise.all([toPngDataUri(input.image), loadFonts()]);
  const radius = input.imageShape === "circle" ? 999 : 28;
  const titleSize = title.length > 40 ? 60 : 72;
  const stats = (input.stats || []).filter((s) => s.value !== "" && s.value !== null && s.value !== undefined).slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.bg,
          padding: "56px 64px",
          fontFamily: fonts.length ? "Geist" : "sans-serif",
          color: C.ink,
          borderTop: `10px solid ${C.signal}`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark />
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 3 }}>
              <span>THE LAUNCH&nbsp;</span>
              <span style={{ color: C.signal }}>FEED</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: 999,
              background: C.signalDim,
              color: C.signal,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {clip(input.eyebrow, 28)}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          {img ? (
            <img
              src={img}
              alt=""
              width={168}
              height={168}
              style={{ borderRadius: radius, border: `2px solid ${C.hairline}`, background: C.card }}
            />
          ) : input.fallbackInitials ? (
            <div
              style={{
                width: 168,
                height: 168,
                borderRadius: radius,
                background: C.ink,
                color: C.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
                fontWeight: 700,
              }}
            >
              {clip(input.fallbackInitials, 2).toUpperCase()}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>
            {subtitle ? (
              <div style={{ display: "flex", fontSize: 32, lineHeight: 1.3, color: C.dim }}>{subtitle}</div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "12px 20px",
                  borderRadius: 16,
                  background: C.card,
                  border: `2px solid ${C.hairline}`,
                }}
              >
                <span style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>{String(s.value)}</span>
                <span style={{ fontSize: 20, color: C.faint, textTransform: "uppercase", letterSpacing: 1.5 }}>{s.label}</span>
              </div>
            ))}
            {!stats.length && input.footnote ? (
              <div style={{ display: "flex", fontSize: 24, color: C.dim }}>{clip(input.footnote, 60)}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {stats.length && input.footnote ? (
              <div style={{ display: "flex", fontSize: 22, color: C.dim }}>{clip(input.footnote, 40)}</div>
            ) : null}
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: C.signal }}>thelaunchfeed.com</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, ...(fonts.length ? { fonts } : {}) }
  );
}

/** Ready-made card for a static page: `export default staticOgImage({...})`. */
export function staticOgImage(input: OgCardInput) {
  return async function Image() {
    return ogCard({ image: "/logo.png", imageShape: "rounded", ...input });
  };
}
