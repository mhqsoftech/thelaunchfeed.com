import { ImageResponse } from "next/og";
import { getCategoryBySlug } from "@/lib/queries/categories";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Launch Feed — category";

export default async function CategoryOgImage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug).trim();
  const c = await getCategoryBySlug(slug).catch(() => null);

  const name = c?.name || "Category";
  const count = c?.products?.length ?? 0;
  const top = (c?.products || []).slice(0, 5).map((p: any) => p.name);

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
          THE LAUNCH FEED — CATEGORY
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{name}</div>
          <div style={{ fontSize: 30, color: "#A1A1AA" }}>
            {count} launched product{count === 1 ? "" : "s"} · daily leaderboard
          </div>
          {top.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
              {top.map((t: string) => (
                <div
                  key={t}
                  style={{
                    fontSize: 22,
                    padding: "10px 18px",
                    border: "1px solid #27272A",
                    background: "#18181B",
                    color: "#D4D4D8",
                    borderRadius: 6,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, color: "#A1A1AA" }}>
          <span>thelaunchfeed.com/category/{c?.slug || slug}</span>
          <div style={{ color: "#84CC16", fontWeight: 700, letterSpacing: 2 }}>SHIP. VOTE. RISE.</div>
        </div>
      </div>
    ),
    size
  );
}
