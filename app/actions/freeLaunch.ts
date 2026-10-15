"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { badgeSnippet, evaluateFreeGate, verifyBadge, REQUIRED_UPVOTES } from "@/lib/free-launch";

export type FreeLaunchProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  voteCount: number;
  launchedAt: string;
  category: string | null;
  /** The current user has an upvote on it. */
  voted: boolean;
  /** That upvote counts toward this free launch (no earlier free launch used this product). */
  counts: boolean;
};

export type FreeLaunchStatus = {
  signedIn: boolean;
  required: number;
  upvotesDone: number;
  badge: { domain: string | null; verified: boolean };
  qualified: boolean;
  snippets: { light: string; dark: string };
  products: FreeLaunchProduct[];
};

/** Everything the submit page's "Free launch" panel needs. */
export async function getFreeLaunchStatus(websiteUrl?: string): Promise<FreeLaunchStatus> {
  const snippets = { light: badgeSnippet("light", websiteUrl), dark: badgeSnippet("dark", websiteUrl) };
  const user = await getCurrentUser();

  // Latest launches first — the list makers pick their 3 upvotes from.
  const products = await prisma.product.findMany({
    // Real launches only: seed/demo products are excluded (and don't count).
    where: {
      status: "LIVE",
      launchedAt: { lte: new Date() },
      owner: { isSeed: false },
      ...(user ? { ownerId: { not: user.id } } : {}),
    },
    orderBy: { launchedAt: "desc" },
    take: 30,
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      logoUrl: true,
      voteCount: true,
      launchedAt: true,
      category: { select: { name: true } },
    },
  });

  if (!user) {
    return {
      signedIn: false,
      required: REQUIRED_UPVOTES,
      upvotesDone: 0,
      badge: { domain: null, verified: false },
      qualified: false,
      snippets,
      products: products.map((p) => ({
        ...p,
        launchedAt: p.launchedAt.toISOString(),
        category: p.category?.name ?? null,
        voted: false,
        counts: false,
      })),
    };
  }

  const [gate, myVotes] = await Promise.all([
    evaluateFreeGate(user.id, websiteUrl || ""),
    prisma.vote.findMany({
      where: { userId: user.id, productId: { in: products.map((p) => p.id) } },
      select: { productId: true },
    }),
  ]);
  const voted = new Set(myVotes.map((v) => v.productId));
  const counting = new Set(gate.votedProductIds);

  return {
    signedIn: true,
    required: gate.upvotes.required,
    upvotesDone: gate.upvotes.done,
    badge: gate.badge,
    qualified: gate.qualified,
    snippets,
    products: products.map((p) => ({
      ...p,
      launchedAt: p.launchedAt.toISOString(),
      category: p.category?.name ?? null,
      voted: voted.has(p.id),
      counts: counting.has(p.id),
    })),
  };
}

const lastVerify = new Map<string, number>();

/** "Verify badge" button — fetches the maker's site and looks for our badge. */
export async function verifyFreeLaunchBadge(websiteUrl: string) {
  const user = await requireUser();
  const now = Date.now();
  if (now - (lastVerify.get(user.id) ?? 0) < 5_000) {
    return { domain: null, verified: false, method: null, reason: "Please wait a few seconds before checking again." };
  }
  lastVerify.set(user.id, now);
  return verifyBadge(websiteUrl);
}
