"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { SlotPosition } from "@prisma/client";
import { uploadToNeonStorage, parseDataUri } from "@/lib/storage";

export type UISlot = {
  id: string;
  kind: "PAID" | "CUSTOM";
  position: "FEATURED" | "ROTATING";
  order: number;
  name: string;
  tagline: string;
  url: string;
  logoUrl?: string | null;
  subscription?: { userName: string; price: number; expiresAt: string | null };
};

export async function listSlots(position: SlotPosition): Promise<UISlot[]> {
  let rows = await prisma.featuredSlot.findMany({
    where: { position },
    orderBy: [{ kind: "asc" }, { order: "asc" }],
    include: {
      product: { select: { id: true, name: true, tagline: true, slug: true, logoUrl: true } },
      purchase: {
        include: { user: { select: { name: true, username: true } } },
      },
    },
  });

  // If no slots exist yet in this position, automatically initialize with top active live products
  if (rows.length === 0) {
    const prods = await prisma.product.findMany({
      where: { status: "LIVE" },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
      take: 8,
      select: { id: true, name: true, tagline: true, slug: true, logoUrl: true },
    });

    if (prods.length > 0) {
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        await prisma.featuredSlot.create({
          data: {
            kind: "CUSTOM",
            position,
            order: i,
            productId: p.id,
            customName: p.name,
            customTagline: p.tagline,
            customUrl: `/product/${p.slug}`,
            customLogoUrl: p.logoUrl,
          },
        });
      }

      rows = await prisma.featuredSlot.findMany({
        where: { position },
        orderBy: [{ kind: "asc" }, { order: "asc" }],
        include: {
          product: { select: { id: true, name: true, tagline: true, slug: true, logoUrl: true } },
          purchase: {
            include: { user: { select: { name: true, username: true } } },
          },
        },
      });
    }
  }

  return rows.map((s): UISlot => {
    if (s.kind === "PAID") {
      return {
        id: s.id,
        kind: "PAID",
        position: s.position,
        order: s.order,
        name: s.customName || s.product?.name || "(unknown product)",
        tagline: s.customTagline ?? s.product?.tagline ?? "",
        url: s.customUrl || (s.product ? `/product/${s.product.slug}` : "#"),
        logoUrl: s.customLogoUrl || s.product?.logoUrl || null,
        subscription: {
          userName: s.purchase?.user.name ?? s.purchase?.user.username ?? "—",
          price: Math.round((s.purchase?.amountCents ?? 0) / 100),
          expiresAt: s.endsAt?.toISOString() ?? null,
        },
      };
    }
    return {
      id: s.id,
      kind: "CUSTOM",
      position: s.position,
      order: s.order,
      name: s.customName || s.product?.name || "",
      tagline: s.customTagline ?? s.product?.tagline ?? "",
      url: s.customUrl || (s.product ? `/product/${s.product.slug}` : "#"),
      logoUrl: s.customLogoUrl || s.product?.logoUrl || null,
    };
  });
}

const CustomSchema = z.object({
  position: z.enum(["FEATURED", "ROTATING"]),
  name: z.string().min(1).max(120),
  tagline: z.string().max(250).optional().default(""),
  url: z.string().optional().default(""),
  logoUrl: z.string().optional().default(""),
});

export async function addCustomSlot(input: z.infer<typeof CustomSchema>) {
  await requireAdmin();
  const parsed = CustomSchema.parse(input);
  const rawUrl = parsed.url?.trim() ?? "";
  const url =
    rawUrl && !rawUrl.startsWith("/") && !rawUrl.startsWith("#") && !/^https?:\/\//i.test(rawUrl)
      ? `https://${rawUrl}`
      : rawUrl || "#";

  let finalLogoUrl = parsed.logoUrl?.trim() || null;
  if (finalLogoUrl && finalLogoUrl.startsWith("data:image/")) {
    const parsedUri = parseDataUri(finalLogoUrl);
    if (parsedUri) {
      try {
        const ext = parsedUri.contentType.split("/")[1] || "png";
        const key = `slots/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        finalLogoUrl = await uploadToNeonStorage(parsedUri.buffer, key, parsedUri.contentType);
      } catch (e) {
        console.warn("[slots] Failed to upload logo to storage, falling back to data URI", e);
      }
    }
  }

  const last = await prisma.featuredSlot.findFirst({
    where: { kind: "CUSTOM", position: parsed.position },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.featuredSlot.create({
    data: {
      kind: "CUSTOM",
      position: parsed.position,
      order: (last?.order ?? -1) + 1,
      customName: parsed.name.trim(),
      customTagline: parsed.tagline?.trim() ?? "",
      customUrl: url,
      customLogoUrl: finalLogoUrl,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

const UpdateSlotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  tagline: z.string().max(250).optional().default(""),
  url: z.string().optional().default(""),
  logoUrl: z.string().optional().default(""),
  position: z.enum(["FEATURED", "ROTATING"]).optional(),
});

export async function updateSlot(input: z.infer<typeof UpdateSlotSchema>) {
  await requireAdmin();
  const parsed = UpdateSlotSchema.parse(input);
  const target = await prisma.featuredSlot.findUnique({ where: { id: parsed.id } });
  if (!target) {
    throw new Error("Slot not found");
  }

  const rawUrl = parsed.url?.trim() ?? "";
  const url =
    rawUrl && !rawUrl.startsWith("/") && !rawUrl.startsWith("#") && !/^https?:\/\//i.test(rawUrl)
      ? `https://${rawUrl}`
      : rawUrl || "#";

  let finalLogoUrl = parsed.logoUrl?.trim() || null;
  if (finalLogoUrl && finalLogoUrl.startsWith("data:image/")) {
    const parsedUri = parseDataUri(finalLogoUrl);
    if (parsedUri) {
      try {
        const ext = parsedUri.contentType.split("/")[1] || "png";
        const key = `slots/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        finalLogoUrl = await uploadToNeonStorage(parsedUri.buffer, key, parsedUri.contentType);
      } catch (e) {
        console.warn("[slots] Failed to upload logo to storage, falling back to data URI", e);
      }
    }
  }

  let newOrder = target.order;
  if (parsed.position && parsed.position !== target.position) {
    const last = await prisma.featuredSlot.findFirst({
      where: { kind: target.kind, position: parsed.position },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    newOrder = (last?.order ?? -1) + 1;
  }

  await prisma.featuredSlot.update({
    where: { id: parsed.id },
    data: {
      customName: parsed.name.trim(),
      customTagline: parsed.tagline?.trim() ?? "",
      customUrl: url,
      customLogoUrl: finalLogoUrl,
      ...(parsed.position ? { position: parsed.position, order: newOrder } : {}),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function reorderSlot(id: string, direction: -1 | 1) {
  await requireAdmin();
  const target = await prisma.featuredSlot.findUnique({ where: { id } });
  if (!target || target.kind !== "CUSTOM") return;
  const swap = await prisma.featuredSlot.findFirst({
    where: {
      kind: "CUSTOM",
      position: target.position,
      order: direction === -1 ? { lt: target.order } : { gt: target.order },
    },
    orderBy: { order: direction === -1 ? "desc" : "asc" },
  });
  if (!swap) return;
  await prisma.$transaction([
    prisma.featuredSlot.update({ where: { id: target.id }, data: { order: swap.order } }),
    prisma.featuredSlot.update({ where: { id: swap.id }, data: { order: target.order } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function removeCustomSlot(id: string) {
  await requireAdmin();
  const s = await prisma.featuredSlot.findUnique({ where: { id } });
  if (!s || s.kind !== "CUSTOM") return;
  await prisma.featuredSlot.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}
