import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/queries/user";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Launch Feed — founder profile";

export default async function FounderOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();
  const f = await getPublicProfile(slug).catch(() => null);

  const name = f?.name || f?.username || "Founder";
  const handle = f?.username ? `@${f.username}` : "";
  const title = f?.title || "Founder & Software Maker";
  const bio = f?.bio || "";
  const image = f?.image || null;
  const productsCount = f?.products?.length ?? 0;
  const totalVotes = (f?.products || []).reduce((s: number, p: any) => s + (p.voteCount || 0), 0);

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
          THE LAUNCH FEED — FOUNDER
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {image ? (
            <img
              src={image}
              width={140}
              height={140}
              style={{ borderRadius: 999, border: "2px solid #27272A" }}
            />
          ) : (
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 999,
                background: "#18181B",
                border: "2px solid #27272A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                fontWeight: 800,
                color: "#84CC16",
              }}
            >
              {name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>{name}</div>
            <div style={{ fontSize: 26, color: "#A1A1AA" }}>{handle}{title ? ` · ${title}` : ""}</div>
            {bio && (
              <div style={{ fontSize: 22, color: "#D4D4D8", maxWidth: 900, marginTop: 6, lineHeight: 1.3 }}>
                {bio.length > 160 ? `${bio.slice(0, 157)}…` : bio}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, color: "#A1A1AA" }}>
          <div style={{ display: "flex", gap: 24 }}>
            <span>{productsCount} products</span>
            <span>▲ {totalVotes} upvotes</span>
            <span>thelaunchfeed.com</span>
          </div>
          <div style={{ color: "#84CC16", fontWeight: 700, letterSpacing: 2 }}>SHIP. VOTE. RISE.</div>
        </div>
      </div>
    ),
    size
  );
}
