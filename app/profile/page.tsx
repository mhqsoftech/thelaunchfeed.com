import React from "react";
import ProfileClientView from "./ProfileClientView";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listMyProducts, type MyProduct } from "@/app/actions/profile";
import { batchHydrateSavedAndUpvoted, type InteractionProduct } from "@/app/actions/interactions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Founder Dashboard & Settings - The Launch Feed",
  description: "Manage your launched products, active 30-day placement subscriptions, upvoted tools, and account settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  let initialProducts: MyProduct[] = [];
  let initialSavedProducts: InteractionProduct[] = [];
  let initialUpvotedProducts: InteractionProduct[] = [];
  let isAdmin = false;

  try {
    const user = await getCurrentUser();
    if (user) {
      isAdmin = isAdminEmail(user.email);
      const [products, votes] = await Promise.all([
        listMyProducts(),
        prisma.vote.findMany({
          where: { userId: user.id },
          select: { productId: true },
        }),
      ]);
      initialProducts = products;
      const upvotedIds = votes.map((v) => v.productId);
      const savedIds = user.savedProductIds || [];

      const { saved, upvoted } = await batchHydrateSavedAndUpvoted(savedIds, upvotedIds);
      initialSavedProducts = saved;
      initialUpvotedProducts = upvoted;
    }
  } catch {}

  return (
    <ProfileClientView
      initialProducts={initialProducts}
      initialSavedProducts={initialSavedProducts}
      initialUpvotedProducts={initialUpvotedProducts}
      isAdmin={isAdmin}
    />
  );
}
