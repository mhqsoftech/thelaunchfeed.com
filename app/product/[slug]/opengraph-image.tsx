import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/queries/products";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Launch Feed — product launch";

export default async function ProductOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();
  const p = await getProductBySlug(slug).catch(() => null);

  const name = p?.name || "The Launch Feed";
  const tagline = p?.tagline || "Ship. Vote. Rise.";
  const category = p?.category?.name || "Software";
  const votes = p?.voteCount ?? 0;
  const maker = p?.owner?.name || p?.owner?.username || "";
  const logoUrl = p?.logoUrl || null;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090B",
          color: "#F4F4F5",
          padding: 64,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22, color: "#84CC16", letterSpacing: 2 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "#84CC16" }} />
          THE LAUNCH FEED
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                width={96}
                height={96}
                style={{ borderRadius: 16, border: "1px solid #27272A" }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 16,
                  background: "#18181B",
                  border: "1px solid #27272A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  fontWeight: 700,
                  color: "#84CC16",
                }}
              >
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1, letterSpacing: -1 }}>{name}</div>
              <div style={{ fontSize: 22, color: "#A1A1AA" }}>{category}{maker ? ` · by ${maker}` : ""}</div>
            </div>
          </div>
          <div style={{ fontSize: 34, color: "#D4D4D8", lineHeight: 1.25, maxWidth: 1050 }}>
            {tagline.length > 140 ? `${tagline.slice(0, 137)}…` : tagline}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, color: "#A1A1AA" }}>
          <div style={{ display: "flex", gap: 24 }}>
            <span>▲ {votes} upvotes</span>
            <span>thelaunchfeed.com</span>
          </div>
          <div style={{ color: "#84CC16", fontWeight: 700, letterSpacing: 2 }}>SHIP. VOTE. RISE.</div>
        </div>
      </div>
    ),
    size
  );
}
