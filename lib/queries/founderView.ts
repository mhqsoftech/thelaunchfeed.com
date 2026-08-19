import { getPublicProfile, getSuggestedFounders } from "@/lib/queries/user";
import { getAccoladeDetails } from "@/lib/awards";
import { computeAwardsForProducts } from "@/lib/queries/awards";
import type { ViewFounder } from "@/app/founder/[slug]/FounderClientView";

/**
 * Assemble the exact ViewFounder shape the public /founder/[slug] page renders.
 * Used by both the server page render and the /profile preview mode so that
 * the preview matches the live profile 1:1 (same fields, same formatting).
 */
export async function buildFounderView(username: string): Promise<ViewFounder | null> {
  const f = await getPublicProfile(username);
  if (!f) return null;

  const totalVotes = f.products.reduce((s: number, p: any) => s + p.voteCount, 0);

  let verifiedMrrCents = 0;
  let verifiedTotalRevenueCents = 0;
  let verifiedMrrFormatted = "";
  let verifiedProviderName = "Stripe";
  let verifiedProviders: Array<{ name: string; mrrCents: number; totalRevenueCents: number }> = [];

  const activeConns = (f.revenueConnections || []).filter(
    (c: any) => c.status === "ACTIVE" && (c.mrrCents || 0) > 0
  );

  if (activeConns.length > 0) {
    verifiedProviders = activeConns.map((c: any) => {
      const provKey = c.provider as string;
      const name = provKey.charAt(0).toUpperCase() + provKey.slice(1).toLowerCase();
      return {
        name,
        mrrCents: c.mrrCents || 0,
        totalRevenueCents: c.totalRevenueCents || 0,
      };
    });
    verifiedMrrCents = verifiedProviders.reduce((s, p) => s + p.mrrCents, 0);
    verifiedTotalRevenueCents = verifiedProviders.reduce((s, p) => s + p.totalRevenueCents, 0);
  }

  const verifiedRevenues = f.products
    .map((p: any) => p.revenue)
    .filter((r: any): r is NonNullable<typeof r> => !!r && r.isVerified);

  if (verifiedMrrCents === 0) {
    verifiedMrrCents = verifiedRevenues.reduce((sum: number, r: any) => sum + (r.mrrCents || 0), 0);
    verifiedTotalRevenueCents = verifiedRevenues.reduce((sum: number, r: any) => sum + (r.totalRevenueCents || 0), 0);
  }

  if (verifiedMrrCents > 0) {
    if (verifiedMrrCents >= 100000) {
      verifiedMrrFormatted = `$${(verifiedMrrCents / 100000).toFixed(1)}K / mo`;
    } else {
      const dollars = verifiedMrrCents / 100;
      verifiedMrrFormatted = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)} / mo`;
    }
  }

  if (verifiedProviders.length === 0 && f.revenueConnections && f.revenueConnections.length > 0) {
    const connById = new Map<string, string>();
    for (const c of f.revenueConnections) connById.set(c.id, c.provider);
    const byProvider = new Map<string, { mrrCents: number; totalRevenueCents: number }>();
    for (const r of verifiedRevenues) {
      const prov = connById.get((r as any).connectionId);
      if (!prov) continue;
      const key = prov.charAt(0).toUpperCase() + prov.slice(1).toLowerCase();
      const cur = byProvider.get(key) || { mrrCents: 0, totalRevenueCents: 0 };
      cur.mrrCents += r.mrrCents || 0;
      cur.totalRevenueCents += r.totalRevenueCents || 0;
      byProvider.set(key, cur);
    }
    verifiedProviders = Array.from(byProvider.entries()).map(([name, v]) => ({
      name,
      mrrCents: v.mrrCents,
      totalRevenueCents: v.totalRevenueCents,
    }));
  }

  if (f.revenueConnections && f.revenueConnections.length > 0) {
    const primaryConn = f.revenueConnections[0];
    const prov = primaryConn.provider.toLowerCase();
    verifiedProviderName = prov.charAt(0).toUpperCase() + prov.slice(1);
  }

  const awardsMap = await computeAwardsForProducts(f.products);

  return {
    id: f.id,
    username: f.username,
    name: f.name || f.username,
    handle: `@${f.username}`,
    bio: f.bio || "",
    image: f.image || null,
    website: f.websiteUrl || "",
    twitter: f.twitterHandle || "",
    github: f.githubHandle || "",
    revenue: verifiedMrrFormatted,
    mrrCents: verifiedMrrCents,
    totalRevenueCents: verifiedTotalRevenueCents,
    revenueProvider: verifiedProviderName,
    verifiedProviders,
    title: f.title || "",
    totalVotes,
    productsCount: f.products.length,
    emailVerified: Boolean((f as any).emailVerified),
    joinedAt: new Date(f.createdAt).toISOString().slice(0, 10),
    products: f.products.map((p: any) => {
      const productAwards = awardsMap.get(p.id) || ["launch"];
      const accolades = getAccoladeDetails(productAwards, p.slug);
      const awardsDisplay = accolades
        .filter((a) => a.id !== "launch")
        .map((a) => ({
          label: a.rankBadge ? `${a.rankBadge} ${a.badgeLabel}` : a.badgeLabel,
          style: `${a.tone.border} ${a.tone.text} ${a.tone.bg}`,
        }));

      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        category: p.category?.name ?? "Uncategorized",
        logoUrl: p.logoUrl ?? null,
        websiteUrl: p.websiteUrl ?? null,
        tags: p.tags ?? [],
        commentCount: p.commentCount ?? 0,
        votes: p.voteCount,
        awards: awardsDisplay,
        revenue: p.revenue?.isVerified
          ? p.revenue.mrrCents >= 100000
            ? `$${(p.revenue.mrrCents / 100000).toFixed(1)}K / mo`
            : `$${(p.revenue.mrrCents / 100).toFixed(p.revenue.mrrCents % 100 === 0 ? 0 : 2)} / mo`
          : "",
        launchedAt: new Date(p.launchedAt).toISOString().slice(0, 10),
      };
    }),
  };
}

export async function buildFounderViewWithSuggested(username: string, suggestedLimit = 12) {
  const view = await buildFounderView(username);
  if (!view) return null;
  const suggestedFounders = await getSuggestedFounders(username, suggestedLimit);
  return { view, suggestedFounders };
}
