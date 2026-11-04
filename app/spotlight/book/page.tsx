import type { Metadata } from "next";
import MainLayoutShell from "@/app/MainLayoutShell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { countLiveRailBookings } from "@/lib/rail-spotlight";
import BookSpotlightClient, { type BookableItem } from "./BookSpotlightClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a Spotlight slot - The Launch Feed",
  description: "Put your product in the sidebar Spotlight on every page of The Launch Feed: $1 for 3 days.",
  robots: { index: false, follow: true },
};

export default async function BookSpotlightPage() {
  const user = await getCurrentUser();
  const liveCount = await countLiveRailBookings();

  let items: BookableItem[] = [];
  if (user) {
    const [products, submissions] = await Promise.all([
      prisma.product.findMany({
        where: { status: "LIVE", OR: [{ ownerId: user.id }, { makers: { some: { userId: user.id } } }] },
        orderBy: { launchedAt: "desc" },
        select: { id: true, name: true, tagline: true, logoUrl: true },
        take: 50,
      }),
      prisma.submission.findMany({
        where: { ownerId: user.id, status: "SCHEDULED" },
        orderBy: { scheduledFor: "asc" },
        select: { id: true, name: true, tagline: true, logoUrl: true },
        take: 20,
      }),
    ]);
    items = [
      ...products.map((p) => ({ kind: "product" as const, ...p })),
      ...submissions.map((s) => ({ kind: "submission" as const, ...s })),
    ];
  }

  return (
    <MainLayoutShell>
      <BookSpotlightClient
        signedIn={!!user}
        items={items}
        liveCount={liveCount}
      />
    </MainLayoutShell>
  );
}
